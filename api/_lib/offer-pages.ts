/**
 * Every offer page, by offer: the ABMExperience pages whose componentPlan
 * names the offer (`offerId`). Graph can't filter inside that string, so all
 * of them are read (a few dozen today) and sorted here.
 */
import type { OfferPage } from '../../src/lib/offer-looks.js';
import { hasOwnLogo } from '../../src/lib/parent-account.js';
import { parentAccountsOf, parentKey } from './parent-account.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';
const PAGE_SIZE = 100;
const MAX_ITEMS = 1000;

export const OFFER_PAGES_QUERY = `
query OfferPages($limit: Int!, $skip: Int!) {
  ABMExperience(locale: en, limit: $limit, skip: $skip, orderBy: { _metadata: { published: DESC } }) {
    total
    items {
      _metadata { url { hierarchical } published }
      companyName
      salesforceAccountID
      brandDomain
      customerLogo { default }
      componentPlan
    }
  }
}
`;

type Item = {
  _metadata: { url: { hierarchical: string | null }; published: string | null };
  companyName: string | null;
  salesforceAccountID?: string | null;
  brandDomain: string | null;
  customerLogo: { default: string | null } | null;
  componentPlan: string | null;
};

/** The offer a page was written for: componentPlan's `offerId` (also read by api/_lib/offer-signup.ts). */
export const offerIdOf = (plan: string | null): string | null => {
  try {
    const id = (JSON.parse(plan || '{}') as { offerId?: unknown }).offerId;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
};

/**
 * The address an offer page is served at. In the CMS every offer page sits under Start
 * (`/vegas-dinner-d2l/`), but the site draws it at `/vb/<slug>`; the bare CMS address answers
 * "We're not quite ready for …". Aldus UI's page log already has the /vb/ form, so using it
 * here also stops each page being listed twice.
 */
export function offerPageRoute(hierarchical: string | null): string {
  const route = (hierarchical || '').replace(/^\/+|\/+$/g, '');
  if (!route) return '';
  return route.startsWith('vb/') ? route : `vb/${route}`;
}

let held: { at: number; byOffer: Map<string, OfferPage[]> } | null = null;
/** For the checks: forget what was held. */
export function forgetOfferPages(): void {
  held = null;
}
const HOLD_MS = 60_000;

export async function offerPagesByOffer(): Promise<Map<string, OfferPage[]>> {
  if (held && Date.now() - held.at < HOLD_MS) return held.byOffer;
  const authKey = process.env.GRAPH_AUTH_KEY;
  const byOffer = new Map<string, OfferPage[]>();
  if (!authKey) return byOffer;
  // The pages with no logo of their own, and their Salesforce accounts, for the parent lookup below.
  const orphans: Array<{ page: OfferPage; salesforceAccountID: string | null }> = [];
  for (let skip = 0; skip < MAX_ITEMS; skip += PAGE_SIZE) {
    const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: OFFER_PAGES_QUERY, variables: { limit: PAGE_SIZE, skip } }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await r.json()) as { data?: { ABMExperience?: { total?: number; items?: Item[] } } };
    const items = body.data?.ABMExperience?.items ?? [];
    for (const item of items) {
      const offerId = offerIdOf(item.componentPlan);
      // Offer pages are served under /vb/ (the www offer page); the bare CMS path is not a page on
      // this site, and Aldus UI's page log names the same page as vb/<slug> (api/_lib/offers.ts).
      const route = offerPageRoute(item._metadata.url.hierarchical);
      if (!offerId || !route || !item.companyName) continue;
      const list = byOffer.get(offerId) ?? [];
      const own = item.customerLogo?.default ?? null;
      const page: OfferPage = {
        route,
        companyName: item.companyName,
        domain: item.brandDomain,
        logoUrl: hasOwnLogo(own) ? own : null,
        published: item._metadata.published,
      };
      list.push(page);
      if (!page.logoUrl) orphans.push({ page, salesforceAccountID: item.salesforceAccountID ?? null });
      byOffer.set(offerId, list);
    }
    if (items.length < PAGE_SIZE || skip + PAGE_SIZE >= (body.data?.ABMExperience?.total ?? 0)) break;
  }
  // As on the page itself (api/_lib/parent-account.ts): a page without a logo of its own shows its
  // parent account page's, so the search page's list matches what the page shows.
  const parents = await parentAccountsOf(orphans.map((o) => ({ companyName: o.page.companyName, salesforceAccountID: o.salesforceAccountID })));
  for (const o of orphans) {
    const parent = parents.get(parentKey(o.page.companyName, o.salesforceAccountID));
    if (!parent) continue;
    o.page.logoUrl = parent.logo;
    o.page.domain ??= parent.domain;
  }
  held = { at: Date.now(), byOffer };
  return byOffer;
}
