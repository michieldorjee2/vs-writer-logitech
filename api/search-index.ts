import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/**
 * Graph caps `limit` at 100 per page, so we paginate by skip until we've
 * drained the index or hit a safety cap.
 */
const PAGE_SIZE = 100;
const MAX_ITEMS = 1500;

const INDEX_QUERY = `
query SearchIndex($limit: Int!, $skip: Int!) {
  CompetitorComparisonPage(locale: en, limit: $limit, skip: $skip) {
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

export default async function handler(_req: VercelRequest, res: VercelResponse) {
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

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).json({ items, total });
  } catch (err) {
    console.error('[api/search-index] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to load index' });
  }
}
