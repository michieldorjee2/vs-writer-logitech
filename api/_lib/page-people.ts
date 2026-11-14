/**
 * Who a page names from Optimizely, read from the page's own content in Graph, for api/page-photo.ts.
 * This is what keeps the photo route from being a way to fetch any colleague's photo by address: a
 * person is served only when they are on the page the visitor is on, and "on the page" is decided here,
 * on the server, from what the CMS holds, never from anything the request says beyond which page.
 *
 *   account page  `teamMembers`, as the page draws them (src/lib/account-rep.ts realContacts)
 *   person page   `team`, as the page draws it (src/www/person-content.ts teamOf)
 *   offer page    its hosts, as the offer page draws them (src/www/offer-content.ts readOffer), and the offer
 *                 they are the hosts of (componentPlan.offerId), which Limitless is asked about
 *
 * Only @optimizely.com addresses are kept: a customer's, on any page, is not a person this site fetches
 * a photo of, so it is not on the list. Held a minute per page per instance, so a page of six people is
 * one read. A Graph that cannot answer is 'failed' and held for nothing.
 */
import { graphItems } from '../../src/lib/graph-envelope.js';
import { ABM_EXPERIENCE_QUERY, normalizeExperienceItem } from '../../src/lib/experience-queries.js';
import { realContacts } from '../../src/lib/account-rep.js';
import { isOfferId } from '../../src/lib/offer-looks.js';
import { optimizelyAddress, type PhotoPage, type PhotoPageKind } from '../../src/lib/page-photos.js';
import { PAGE_PHOTOS_ACCOUNT_QUERY, PAGE_PHOTOS_PERSON_QUERY } from '../../src/lib/page-photos-query.js';
import { isOfferExperience } from '../../src/www/design.js';
import { list, readOffer, str } from '../../src/www/offer-content.js';
import { teamOf } from '../../src/www/person-content.js';
import { graphOp, postGraphRead } from './graph-read.js';
import { offerIdOf } from './offer-pages.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';
/** Most people one page can name: more than this is not a page of a team. */
export const MAX_PEOPLE = 24;
const HOLD_MS = 60_000;
const NONE_HOLD_MS = 30_000;
const MAX_HELD = 200;

export interface PagePeople {
  kind: PhotoPageKind;
  /** The page's CMS key: the edge-cache tag its HTML carries, so a publish empties its photos too. Null when Graph gave none. */
  key: string | null;
  /** The offer an offer page's hosts are the hosts of; null on every other page. */
  offerId: string | null;
  /** The @optimizely.com addresses it names, lower-cased, each once. */
  emails: string[];
}

export type PagePeopleAnswer = PagePeople | null | 'failed';

/** What the queries select of one person on a team. */
type Member = { Name?: string | null; Role?: string | null; Email?: string | null };

const held = new Map<string, { at: number; people: PagePeople | null }>();

/** Forget what was held. The checks use it; nothing else needs to. */
export function forgetPagePeople(): void {
  held.clear();
}

const addressesOf = (members: Array<{ Email?: unknown }>): string[] => {
  const emails = new Set<string>();
  for (const m of members) {
    const email = optimizelyAddress(m.Email);
    if (email) emails.add(email);
    if (emails.size >= MAX_PEOPLE) break;
  }
  return [...emails];
};

/** One Graph question, bounded and asked once more if it stalls. Throws on a transport failure; `errors` is the caller's to read. */
async function ask(authKey: string, query: string, slug: string): Promise<unknown> {
  const { json } = await postGraphRead(
    `${GRAPH_ENDPOINT}?auth=${authKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { slug } }) },
    graphOp(query),
  );
  return json;
}

/** A page's CMS key as a cache tag may carry it (a header value): word characters only, else none. */
const tagKeyOf = (key: unknown): string | null => (typeof key === 'string' && /^[\w-]{1,64}$/.test(key) ? key : null);

const hasErrors = (json: unknown): boolean => ((json as { errors?: unknown[] } | null)?.errors?.length ?? 0) > 0;

async function readPeople(page: PhotoPage, authKey: string): Promise<PagePeopleAnswer> {
  const route = page.kind === 'offer' ? page.path.slice('vb/'.length) : page.path;
  // Graph stores locale-prefixed addresses for some pages: the SSR render tries both, so does this.
  for (const slug of [`/${route}/`, `/en/${route}/`]) {
    if (page.kind === 'offer') {
      const json = await ask(authKey, ABM_EXPERIENCE_QUERY, slug);
      if (hasErrors(json)) return 'failed';
      const raw = graphItems<Record<string, unknown>>(json, 'ABMExperience')?.[0];
      if (!raw) continue;
      const item = normalizeExperienceItem({ ...raw, __typename: 'ABMExperience' }) as Record<string, unknown> & {
        _metadata?: { key?: string | null };
        componentPlan?: unknown;
        composition?: Parameters<typeof readOffer>[0]['composition'];
      };
      // Only an offer page has hosts, and only one written for an offer has an offer to ask.
      const offerId = isOfferExperience(item) ? offerIdOf(typeof item.componentPlan === 'string' ? item.componentPlan : null) : null;
      if (!offerId || !isOfferId(offerId)) return null;
      const hosts = list(readOffer(item).find((section) => section.slot === 'offer-hosts')?.values.hosts);
      return {
        kind: 'offer',
        key: tagKeyOf(item._metadata?.key),
        offerId,
        // The Email is the card's own; a host whose card holds none has no key to ask for.
        emails: addressesOf(hosts.map((h) => ({ Email: str(h, 'Email') }))),
      };
    }
    const person = page.kind === 'person';
    const json = await ask(authKey, person ? PAGE_PHOTOS_PERSON_QUERY : PAGE_PHOTOS_ACCOUNT_QUERY, slug);
    if (hasErrors(json)) return 'failed';
    const item = graphItems<{ _metadata?: { key?: string | null }; teamMembers?: Member[] | null; team?: Member[] | null }>(
      json,
      person ? 'PersonPage' : 'CompetitorComparisonPage',
    )?.[0];
    if (!item) continue;
    // The people the page draws, so a photo is served for exactly the cards a visitor can see.
    const members: Member[] = person ? teamOf({ team: item.team } as Parameters<typeof teamOf>[0]) : realContacts(item.teamMembers);
    return { kind: page.kind, key: tagKeyOf(item._metadata?.key), offerId: null, emails: addressesOf(members) };
  }
  return null;
}

/**
 * The people a page names at Optimizely, or null when there is no such page (or it is not one that
 * names people), or 'failed' when Graph could not say. Never throws.
 */
export async function pagePeople(page: PhotoPage, now = Date.now()): Promise<PagePeopleAnswer> {
  const hit = held.get(page.path);
  if (hit && now - hit.at < (hit.people ? HOLD_MS : NONE_HOLD_MS)) return hit.people;
  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) return 'failed';
  let people: PagePeopleAnswer;
  try {
    people = await readPeople(page, authKey);
  } catch (err) {
    console.warn(`[page-photo] page not read (${page.kind}):`, err instanceof Error ? err.name : 'error');
    return 'failed';
  }
  if (people === 'failed') return 'failed';
  held.delete(page.path);
  held.set(page.path, { at: now, people });
  while (held.size > MAX_HELD) {
    const oldest = held.keys().next().value;
    if (oldest === undefined) break;
    held.delete(oldest);
  }
  return people;
}
