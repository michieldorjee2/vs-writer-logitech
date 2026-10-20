import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from '../_lib/auth.js';
import { markConfigured } from '../_lib/mark.js';
import { buildStore, getBuild } from '../_lib/page-builds-store.js';
import { detailOf } from '../_lib/page-builds.js';

/**
 * GET /api/page-builds/:id → BuildDetail: the steps, Mark's narration and tool
 * calls so far, and whether the page exists yet. What a page's own address
 * shows while Mark builds it (BuildView.tsx), polled every few seconds.
 * Any signed-in Optimizely person may follow a build: the link travels.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const store = buildStore();
  if (!store || !markConfigured()) return res.status(503).json({ error: 'Page builds are not configured' });

  const id = String(req.query.id ?? '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return res.status(400).json({ error: 'Bad build id' });
  try {
    const record = await getBuild(store, id);
    if (!record) return res.status(404).json({ error: 'No such build' });
    return res.status(200).json(await detailOf(store, record));
  } catch (err) {
    console.error('[page-builds] detail', err);
    return res.status(502).json({ error: 'Could not read the build' });
  }
}
