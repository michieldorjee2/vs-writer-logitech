/**
 * The running offers as the search page lists them (src/lib/offer-looks.ts):
 * Aldus UI's list, each with its pages from Graph. Aldus UI's page log is
 * the record of what it wrote; Graph is what is live on this site, so a page
 * is listed when either has it. Shared by api/offers/* and the SSR handler.
 */
import type { OfferPage, RunningOffer } from '../../src/lib/offer-looks.js';
import { runningOffers, type AldusOffer } from './aldus.js';
import { offerPagesByOffer } from './offer-pages.js';

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
  return { id: offer.id, title: offer.title, windowStart: offer.windowStart, windowEnd: offer.windowEnd, look: offer.look, pages };
}

export async function listRunning(fresh = false): Promise<RunningOffer[]> {
  const [offers, graph] = await Promise.all([runningOffers(fresh), offerPagesByOffer().catch(() => new Map<string, OfferPage[]>())]);
  return offers.map((o) => withPages(o, graph));
}

export async function aldusOffer(id: string, fresh = false): Promise<AldusOffer | null> {
  return (await runningOffers(fresh)).find((o) => o.id === id) ?? null;
}
