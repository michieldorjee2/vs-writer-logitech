/**
 * Every offer page, by offer: the ABMExperience pages whose componentPlan
 * names the offer (`offerId`). Graph can't filter inside that string, so all
 * of them are read (a few dozen today) and sorted here.
 */
import type { OfferPage } from '../../src/lib/offer-looks.js';

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
  brandDomain: string | null;
  customerLogo: { default: string | null } | null;
  componentPlan: string | null;
};

const offerIdOf = (plan: string | null): string | null => {
  try {
    const id = (JSON.parse(plan || '{}') as { offerId?: unknown }).offerId;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
};

let held: { at: number; byOffer: Map<string, OfferPage[]> } | null = null;
const HOLD_MS = 60_000;

export async function offerPagesByOffer(): Promise<Map<string, OfferPage[]>> {
  if (held && Date.now() - held.at < HOLD_MS) return held.byOffer;
  const authKey = process.env.GRAPH_AUTH_KEY;
  const byOffer = new Map<string, OfferPage[]>();
  if (!authKey) return byOffer;
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
      const route = (item._metadata.url.hierarchical || '').replace(/^\/+|\/+$/g, '');
      if (!offerId || !route || !item.companyName) continue;
      const list = byOffer.get(offerId) ?? [];
      list.push({
        route,
        companyName: item.companyName,
        domain: item.brandDomain,
        logoUrl: item.customerLogo?.default ?? null,
        published: item._metadata.published,
      });
      byOffer.set(offerId, list);
    }
    if (items.length < PAGE_SIZE || skip + PAGE_SIZE >= (body.data?.ABMExperience?.total ?? 0)) break;
  }
  held = { at: Date.now(), byOffer };
  return byOffer;
}
