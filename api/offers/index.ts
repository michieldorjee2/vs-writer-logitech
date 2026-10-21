import type { VercelRequest, VercelResponse } from '@vercel/node';
import { aldusConfigured } from '../_lib/aldus.js';
import { requireIdentity } from '../_lib/auth.js';
import { listRunning } from '../_lib/offers.js';

/**
 * GET /api/offers → { offers: RunningOffer[] }: the offers a rep can run the
 * search page as (Aldus UI's running offers), each with its look, when Mark
 * has made one, and its pages. Signed-in Optimizely people only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!aldusConfigured()) return res.status(200).json({ offers: [] });
  try {
    const offers = await listRunning(req.query.fresh === '1');
    console.log(`[offers] ${offers.length} running, ${offers.filter((o) => o.look).length} with a look`);
    return res.status(200).json({ offers });
  } catch (err) {
    console.error('[offers] list', err);
    return res.status(502).json({ error: 'Could not read the running offers' });
  }
}
