import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from './_lib/auth.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/**
 * Graph caps `limit` at 100 per page, so we paginate by skip until we've
 * drained the index or hit the safety cap. The cap is generous — the
 * dataset grows continuously and a recently-added brand (e.g. Dayforce)
 * has to be reachable through the booth UI even on a busy week.
 *
 * orderBy published DESC gives stable pagination AND surfaces the
 * newest entries first. If we ever do hit MAX_ITEMS, the oldest pages
 * — which are the least interesting to a sales floor anyway — are
 * what get cut.
 */
const PAGE_SIZE = 100;
const MAX_ITEMS = 5000;

/**
 * The index lists every account page, so it is for signed-in Optimizely people
 * only (api/_lib/auth.ts) — which also means it can no longer sit in the shared
 * edge cache, where the CDN would hand it out without asking this function.
 * It is held in this instance's memory instead, for as long as the edge used
 * to hold it.
 */
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; body: { items: unknown[]; total: number } } | null = null;

const INDEX_QUERY = `
query SearchIndex($limit: Int!, $skip: Int!) {
  CompetitorComparisonPage(
    locale: en
    limit: $limit
    skip: $skip
    orderBy: { _metadata: { published: DESC } }
  ) {
    total
    items {
      _metadata { url { default hierarchical } published }
      headline
      eyebrow
      competitorName
      brandDomain
      brandAccentColor
      customerLogo
      intelHeadline
    }
  }
}
`;

async function fetchPage(authKey: string, skip: number) {
  const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: INDEX_QUERY, variables: { limit: PAGE_SIZE, skip } }),
  });
  return r.json() as Promise<{ data?: { CompetitorComparisonPage?: { total?: number; items?: unknown[] } } }>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireIdentity(req, res)) return;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (cached && Date.now() - cached.at < CACHE_MS) return res.status(200).json(cached.body);

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) return res.status(500).json({ error: 'GRAPH_AUTH_KEY not configured' });

  try {
    const first = await fetchPage(authKey, 0);
    const total = first?.data?.CompetitorComparisonPage?.total ?? 0;
    const items: unknown[] = [...(first?.data?.CompetitorComparisonPage?.items ?? [])];

    const target = Math.min(total, MAX_ITEMS);
    const pages: Promise<unknown>[] = [];
    for (let skip = PAGE_SIZE; skip < target; skip += PAGE_SIZE) {
      pages.push(fetchPage(authKey, skip));
    }
    const rest = (await Promise.all(pages)) as Array<Awaited<ReturnType<typeof fetchPage>>>;
    for (const chunk of rest) {
      items.push(...(chunk?.data?.CompetitorComparisonPage?.items ?? []));
    }

    // An empty answer is a Graph hiccup, not an empty site: don't keep it.
    if (items.length) cached = { at: Date.now(), body: { items, total } };
    return res.status(200).json({ items, total });
  } catch (err) {
    console.error('[api/search-index] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to load index' });
  }
}
