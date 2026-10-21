import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isOfferId } from '../../../src/lib/offer-looks.js';
import { aldusConfigured, clearLook } from '../../_lib/aldus.js';
import { requireIdentity } from '../../_lib/auth.js';
import { markConfigured } from '../../_lib/mark.js';
import { getJob, jobView, refreshJob, startLook } from '../../_lib/offer-looks.js';
import { buildStore } from '../../_lib/page-builds-store.js';
import { aldusOffer } from '../../_lib/offers.js';

/**
 * The look Mark is making for an offer (src/lib/offer-looks.ts).
 *
 *   POST → LookJob: starts Mark on it, unless the offer has a look or a run
 *          is under way (then that run), or one failed in the last half hour
 *          (then that one; `?retry=1` starts anew). 409 when the offer has a look,
 *          unless `?remake=1`: then the look is cleared in Aldus UI first.
 *   GET  → LookJob: the run so far, polled every few seconds. When Mark is
 *          done, the request that sees it first cuts the photograph and
 *          stores the look in Aldus UI (it can take half a minute).
 */
export const config = { maxDuration: 300 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const store = buildStore();
  if (!store || !markConfigured() || !aldusConfigured() || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Offer looks are not configured' });
  }
  const id = String(req.query.id ?? '');
  if (!isOfferId(id)) return res.status(400).json({ error: 'Bad offer id' });

  try {
    const offer = await aldusOffer(id, req.method === 'POST');
    if (req.method === 'POST') {
      if (!offer) return res.status(404).json({ error: 'That offer is not running' });
      const remake = req.query.remake === '1';
      if (offer.look && !remake) return res.status(409).json({ error: 'That offer has a look already', look: offer.look });
      if (offer.look) await clearLook(offer.id, identity.email);
      const job = await startLook(store, { ...offer, look: null }, identity.email, remake || req.query.retry === '1');
      const { job: fresh, execution } = await refreshJob(store, job, offer);
      return res.status(202).json(await jobView(fresh, execution));
    }
    const job = await getJob(store, id);
    if (!job) return res.status(404).json({ error: 'Mark is not making a look for that offer' });
    const { job: fresh, execution } = await refreshJob(store, job, offer);
    return res.status(200).json(await jobView(fresh, execution));
  } catch (err) {
    console.error('[offers] look', err);
    return res.status(502).json({ error: 'Could not reach Mark' });
  }
}
