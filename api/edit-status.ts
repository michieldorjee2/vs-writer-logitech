import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GraphResponse } from '../src/lib/graph-envelope.js';
import { requireIdentity } from './_lib/auth.js';
import { purgePageCache } from './_lib/purge-page.js';

/**
 * Edit-mode polling endpoint. The FloatingSidebar hits this every 15s
 * during the working window, passing the CMS content key (stable
 * across slug shapes) and the baseline `published` timestamp it
 * captured at submit time.
 *
 * When the current `published` differs from the baseline we know
 * Opal has republished. We immediately purge the Vercel edge cache
 * for that page (by the Cache-Tag the SSR handler stamped on the
 * response) so the visitor's next reload — even a plain Cmd-R —
 * gets the fresh HTML on the first try.
 *
 * Response shape:
 *   { key, published, changed: boolean }
 *
 * `Cache-Control: no-store` so polling actually hits Graph each call.
 */

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

const STATUS_QUERY = `
query EditStatusByKey($key: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { key: { eq: $key } } }
    locale: en
  ) {
    items {
      _metadata { key published lastModified }
    }
  }
}
`;

async function queryGraph(authKey: string, key: string) {
  const res = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: STATUS_QUERY, variables: { key } }),
  });
  return res.json() as Promise<GraphResponse<{ _metadata?: Record<string, unknown> }>>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Only the sidebar's Edit flow polls this, and it can purge the edge cache.
  if (!requireIdentity(req, res)) return;

  const key = req.query.key;
  const since = req.query.since;
  // Preferred baseline: the page's lastModified at submit. Graph keeps `published` at the first
  // publish date when a page is saved again, so a `since` (published) baseline never changes.
  const modifiedSince = req.query.modifiedSince;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    return res.status(500).json({ error: 'GRAPH_AUTH_KEY not configured' });
  }

  try {
    const json = await queryGraph(authKey, key);
    const meta = json?.data?.CompetitorComparisonPage?.items?.[0]?._metadata;
    if (!meta) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const sinceStr = typeof since === 'string' && since ? since : null;
    const modifiedStr = typeof modifiedSince === 'string' && modifiedSince ? modifiedSince : null;
    const changed = modifiedStr ? !!meta.lastModified && meta.lastModified !== modifiedStr : !!sinceStr && meta.published !== sinceStr;

    if (changed) {
      // Awaited so the function isn't killed mid-flight by the
      // platform; the visitor only adds ~50–100ms to their poll
      // response while we wait for Vercel to ack.
      await purgePageCache(key);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).json({
      key: meta.key,
      published: meta.published,
      lastModified: meta.lastModified ?? null,
      changed,
    });
  } catch (err) {
    console.error('[api/edit-status] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
}
