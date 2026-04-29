import type { VercelRequest, VercelResponse } from '@vercel/node';

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
const VERCEL_API = 'https://api.vercel.com';
/** Canonical Vercel IDs for this project. NOT the URL slugs — the
 *  invalidate-by-tags endpoint accepts the slug forms with a 200 OK
 *  but silently no-ops, which is exactly the kind of mistake that
 *  hides cache bugs in production. Pulled from
 *  `vercel api /v9/projects/aldus`. */
const VERCEL_TEAM_ID = 'team_36vwk4IJMOpRMCwSOu1biPWG';
const VERCEL_PROJECT_ID = 'prj_BXIHuf6RBP5le8pfrxPGhLnb6Uqf';

const STATUS_QUERY = `
query EditStatusByKey($key: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { key: { eq: $key } } }
    locale: en
  ) {
    items {
      _metadata { key published }
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
  return res.json() as Promise<any>;
}

/** Best-effort Cache-Tag purge. Vercel's tag-based eviction is
 *  eventually consistent — the API returns 200 immediately but the
 *  edge nodes can take anywhere from a few seconds to a minute to
 *  drop the cached entry, which is too slow for the moment the
 *  visitor clicks Refresh right after the toast. The client also
 *  appends a `?refresh=…` cache-buster on that immediate click for
 *  a deterministic first-click experience; this purge then catches
 *  the slower paths (manual Cmd-R later, second-tab visitor, etc.). */
async function purgePageCache(key: string): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.warn('[api/edit-status] VERCEL_TOKEN not set — skipping cache purge');
    return;
  }

  const url =
    `${VERCEL_API}/v1/edge-cache/invalidate-by-tags` +
    `?teamId=${encodeURIComponent(VERCEL_TEAM_ID)}` +
    `&projectIdOrName=${encodeURIComponent(VERCEL_PROJECT_ID)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: [`page:${key}`] }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn('[api/edit-status] purge failed', res.status, body.slice(0, 200));
    }
  } catch (err) {
    console.warn('[api/edit-status] purge fetch error', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = req.query.key;
  const since = req.query.since;
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
    const changed = !!sinceStr && meta.published !== sinceStr;

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
      changed,
    });
  } catch (err) {
    console.error('[api/edit-status] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch status' });
  }
}
