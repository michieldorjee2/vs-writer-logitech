import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from './_lib/auth.js';
import { homeIndexFor, loadHomeIndex, type HomeIndexSource } from '../src/lib/home-index.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/**
 * /home's lists: account pages, person pages, and the signed-in person's own
 * accounts. Signed-in Optimizely people only, like /api/search-index, and for
 * the same reason held in this instance's memory rather than the edge cache.
 * The cache holds Graph's answer; "mine" is cut per request.
 */
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; source: HomeIndexSource } | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return res.status(200).json(homeIndexFor(cached.source, identity.email));
  }

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) return res.status(500).json({ error: 'GRAPH_AUTH_KEY not configured' });

  try {
    const source = await loadHomeIndex(async (query, variables) => {
      const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      return r.json();
    });
    // An empty answer is a Graph hiccup, not an empty site: don't keep it.
    if (source.companies.length) cached = { at: Date.now(), source };
    return res.status(200).json(homeIndexFor(source, identity.email));
  } catch (err) {
    console.error('[api/home-index] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to load index' });
  }
}
