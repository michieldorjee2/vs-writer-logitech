import type { VercelRequest, VercelResponse } from '@vercel/node';
import { graphItems } from '../src/lib/graph-envelope.js';
import { ACCOUNT_PAGE_PREVIEW_QUERY } from '../src/lib/account-page-query.js';
import { PERSON_PAGE_PREVIEW_QUERY } from '../src/lib/person-page-query.js';
import { publicPersonPage } from '../src/www/person-content.js';
import { EXPERIENCE_PREVIEW_QUERIES, normalizeExperienceItem } from '../src/lib/experience-queries.js';
import { withPageCopy } from './_lib/page-copy.js';
import { withParentAccount } from './_lib/parent-account.js';
import { withOfferSignup } from './_lib/offer-signup.js';

/**
 * `/api/preview?key=&ver=&loc=&preview_token=` — the draft the CMS is previewing (src/components/CmsPreview.tsx).
 *
 * It answers with what the live address would serve for that draft, so the preview draws the same
 * page: an account page with the same fields and its own copy (`withPageCopy`, as api/content.ts),
 * an experience normalised with its parent account's logo and its sign-up form (as the /vb/ route),
 * and the few legacy blocks still in the CMS as they are.
 *
 * Two steps, because a selection on a type is only valid on that type: `_Content` says what the key
 * is, then that type's own query fetches it. With the editor's `preview_token` (Bearer) Graph returns
 * the draft; without one the site's key reads only what is published.
 */

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/**
 * What the key is. Through `_Content`, Graph names only the base type in `__typename` (`_Page`,
 * `_Experience`, `_Component`) unless the query names the concrete one; `_metadata.types` lists
 * the concrete type first (measured: ["CompetitorComparisonPage", "_Page", "_Content", …]).
 */
const PREVIEW_TYPE_QUERY = `
query GetPreviewType($key: String!, $ver: String, $loc: [Locales]) {
  _Content(
    where: { _metadata: { key: { eq: $key }, version: { eq: $ver } } }
    locale: $loc
  ) {
    items { __typename _metadata { types } }
  }
}
`;

/**
 * The legacy blocks BlockPreview draws: one or two of each are still in the CMS, from before the
 * pages went flat. Check the registered type before adding a field (`npm run check:graph`).
 */
const BLOCK_PREVIEW_QUERY = `
query GetPreviewBlock($key: String!, $ver: String, $loc: [Locales]) {
  _Content(
    where: { _metadata: { key: { eq: $key }, version: { eq: $ver } } }
    locale: $loc
  ) {
    items {
      __typename
      _metadata { key version url { default hierarchical } published }
      ... on HeroSectionBlock { Eyebrow Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
      ... on LogoBarBlock { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } }
      ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } }
      ... on ComparisonTableBlock { OurLabel CompetitorLabel Rows { Category OurValue CompetitorValue } }
      ... on AnalystSectionBlock { SectionHeading { html } Quote AnalystSource CtaText CtaUrl { default } }
      ... on TestimonialBlock { Quote AuthorName AuthorTitle }
      ... on PromoCardBlock { Eyebrow Heading Description CtaText CtaUrl { default } }
      ... on ClosingCtaBlock { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
    }
  }
}
`;

/** A CMS content key or version id. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** A CMS locale: `en`, `en-GB`, `en_GB`. */
const LOCALE = /^[A-Za-z]{2}(?:[_-][A-Za-z]{2,4})?$/;
/** The editor's preview token: a JWT. */
const TOKEN = /^[A-Za-z0-9._-]{1,8192}$/;

type Auth = { token: string } | { key: string };

async function queryGraph(auth: Auth, query: string, variables: Record<string, unknown>) {
  const url = 'token' in auth ? GRAPH_ENDPOINT : `${GRAPH_ENDPOINT}?auth=${encodeURIComponent(auth.key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...('token' in auth ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  const errors = (json as { errors?: Array<{ message: string }> })?.errors;
  if (errors?.length) {
    // The variables are the key, version and locale: never the token, which rides in the header.
    const op = /query\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
    console.error(`[api/preview] ${op} failed (HTTP ${res.status}) for ${JSON.stringify(variables)}: ${errors.map((e) => e.message).join(' | ')}`);
  }
  return json;
}

/** The item's own content type: `__typename` when Graph gave the concrete one, else the first of `_metadata.types` that is not a base type. */
export function concreteType(item: { __typename?: string; _metadata?: { types?: string[] | null } | null } | null | undefined): string | null {
  if (!item) return null;
  const isConcrete = (t: unknown): t is string => typeof t === 'string' && t.length > 0 && !t.startsWith('_');
  if (isConcrete(item.__typename)) return item.__typename;
  return item._metadata?.types?.find(isConcrete) ?? null;
}

/** Graph refused the token (measured: `{"code":"AUTHENTICATION_ERROR","status":401,"details":{"msg":"Token expired"}}`). */
function refused(json: unknown): string | null {
  const j = json as { code?: unknown; details?: { msg?: unknown } } | null;
  return j?.code === 'AUTHENTICATION_ERROR' ? String(j.details?.msg || 'refused') : null;
}

function one(query: unknown): string | undefined {
  return typeof query === 'string' ? query : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // A draft is the editor's, never a cache's.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const key = one(req.query.key);
  const ver = one(req.query.ver);
  const loc = one(req.query.loc);
  const previewToken = one(req.query.preview_token);

  if (!key || !ID.test(key)) return res.status(400).json({ error: 'Missing or invalid key parameter' });
  if (ver && !ID.test(ver)) return res.status(400).json({ error: 'Invalid ver parameter' });
  if (loc && !LOCALE.test(loc)) return res.status(400).json({ error: 'Invalid loc parameter' });
  if (previewToken && !TOKEN.test(previewToken)) return res.status(400).json({ error: 'Invalid preview_token parameter' });

  const singleKey = process.env.GRAPH_SINGLE_KEY || process.env.GRAPH_AUTH_KEY;
  if (!previewToken && !singleKey) return res.status(500).json({ error: 'No auth configured for preview' });
  const auth: Auth = previewToken ? { token: previewToken } : { key: singleKey! };

  const variables: Record<string, unknown> = { key };
  if (ver) variables.ver = ver;
  if (loc) variables.loc = [loc];

  try {
    const typeJson = await queryGraph(auth, PREVIEW_TYPE_QUERY, variables);
    // A CMS preview token lives five minutes; the CMS hands a new one with every save. An old one
    // is not "no such draft": say so, so the page can tell the editor to reload it.
    const why = previewToken ? refused(typeJson) : null;
    if (why) return res.status(401).json({ error: `The preview token was refused (${why})`, expired: /expired/i.test(why) });
    const typed = graphItems<{ __typename?: string; _metadata?: { types?: string[] | null } | null }>(typeJson, '_Content')?.[0];
    const typeName = concreteType(typed);
    if (!typeName) return res.status(404).json({ error: 'Content not found' });

    if (typeName === 'CompetitorComparisonPage') {
      const items = graphItems<Record<string, unknown>>(await queryGraph(auth, ACCOUNT_PAGE_PREVIEW_QUERY, variables), typeName);
      if (!items?.length) return res.status(404).json({ error: 'Content not found' });
      return res.status(200).json(await withPageCopy({ ...items[0], __typename: typeName }));
    }

    // A person page (src/www/PersonPage.tsx), with the fields the live address reads.
    if (typeName === 'PersonPage') {
      const items = graphItems<Record<string, unknown>>(await queryGraph(auth, PERSON_PAGE_PREVIEW_QUERY, variables), typeName);
      if (!items?.length) return res.status(404).json({ error: 'Content not found' });
      return res.status(200).json({ ...publicPersonPage(items[0] as { provenance?: null }), __typename: typeName, __template: 'person' });
    }

    const experience = EXPERIENCE_PREVIEW_QUERIES[typeName];
    if (experience) {
      const items = graphItems<Record<string, unknown>>(await queryGraph(auth, experience.query, variables), typeName);
      if (!items?.length) return res.status(404).json({ error: 'Content not found' });
      const item = normalizeExperienceItem({ ...items[0], __typename: typeName, __template: experience.template });
      return res.status(200).json(await withOfferSignup(await withParentAccount(item)));
    }

    const items = graphItems<Record<string, unknown>>(await queryGraph(auth, BLOCK_PREVIEW_QUERY, variables), '_Content');
    if (!items?.length) return res.status(404).json({ error: 'Content not found' });
    return res.status(200).json(items[0]);
  } catch (err) {
    console.error('[api/preview] Graph fetch failed:', err instanceof Error ? err.message : err);
    return res.status(500).json({ error: 'Failed to fetch preview content' });
  }
}
