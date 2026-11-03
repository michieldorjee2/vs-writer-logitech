/**
 * The running offers as the search page lists them (src/lib/offer-looks.ts):
 * Aldus UI's list, each with its pages from Graph. Aldus UI's page log is
 * the record of what it wrote; Graph is what is live on this site, so a page
 * is listed when either has it. Shared by api/offers/* and the SSR handler.
 */
import { isFromSearch } from '../../src/lib/offer-from-search.js';
import type { OfferPage, RunningOffer } from '../../src/lib/offer-looks.js';
import { runningOffers, type AldusOffer } from './aldus.js';
import { offerPagesByOffer } from './offer-pages.js';
import { parentAccountsOf, parentKey } from './parent-account.js';

const routeOf = (pageUrl: string) => {
  try {
    return new URL(pageUrl, 'https://showcase.optimizely.com').pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    return '';
  }
};

export function withPages(offer: AldusOffer, graph: Map<string, OfferPage[]>): RunningOffer {
  const pages = [...(graph.get(offer.id) ?? [])];
  const have = new Set(pages.map((p) => p.route));
  for (const p of offer.pages) {
    const route = routeOf(p.pageUrl);
    if (!route || have.has(route)) continue;
    have.add(route);
    pages.push({ route, companyName: p.accountName, domain: null, logoUrl: null, published: p.liveSince });
  }
  pages.sort((a, b) => (b.published ?? '').localeCompare(a.published ?? '') || a.companyName.localeCompare(b.companyName));
  return {
    id: offer.id,
    title: offer.title,
    windowStart: offer.windowStart,
    windowEnd: offer.windowEnd,
    look: offer.look,
    pages,
    fromSearch: isFromSearch(offer.fromSearch) ? offer.fromSearch : 'off',
  };
}

export async function listRunning(fresh = false): Promise<RunningOffer[]> {
  const [offers, graph] = await Promise.all([runningOffers(fresh), offerPagesByOffer().catch(() => new Map<string, OfferPage[]>())]);
  const running = offers.map((o) => withPages(o, graph));
  // Pages Aldus UI wrote that Graph doesn't list yet have no logo: their parent account's, by name.
  const inGraph = new Set([...graph.values()].flat().map((p) => p.route));
  const bare = running.flatMap((o) => o.pages.filter((p) => !p.logoUrl && !inGraph.has(p.route)));
  if (bare.length) {
    const parents = await parentAccountsOf(bare.map((p) => ({ companyName: p.companyName })));
    for (const p of bare) {
      const parent = parents.get(parentKey(p.companyName));
      if (parent?.logo) p.logoUrl = parent.logo;
      if (parent?.domain) p.domain ??= parent.domain;
    }
  }
  return running;
}

export async function aldusOffer(id: string, fresh = false): Promise<AldusOffer | null> {
  return (await runningOffers(fresh)).find((o) => o.id === id) ?? null;
}
