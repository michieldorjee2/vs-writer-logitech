import type { VercelRequest, VercelResponse } from '@vercel/node';
import { askAnswerOf } from '../../../src/lib/offer-from-search.js';
import { isOfferId } from '../../../src/lib/offer-looks.js';
import { aldusConfigured, askOfferPage } from '../../_lib/aldus.js';
import { requireIdentity } from '../../_lib/auth.js';
import { validateCompanyWebsite } from '../../_lib/validate-input.js';

/**
 * POST /api/offers/{id}/pages { website } → OfferPageAsk: the search page, run
 * as this offer, asks for one more page of it for the company at `website`
 * (src/lib/offer-from-search.ts). Aldus UI decides: it finds the account by
 * the domain, and writes the page at once, holds it for the offer's team to
 * approve, or says why not. The rep is the signed-in person, never the body.
 * Only the answer's known fields reach the browser (askAnswerOf).
 */
export const config = { maxDuration: 120 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!aldusConfigured()) return res.status(503).json({ error: 'Offer pages are not configured' });
  const id = String(req.query.id ?? '');
  if (!isOfferId(id)) return res.status(400).json({ error: 'Bad offer id' });
  const website = validateCompanyWebsite(((req.body ?? {}) as Record<string, unknown>).website);
  if (!website.ok) return res.status(400).json({ code: 'website', error: website.error });

  try {
    const { status, body } = await askOfferPage(id, { website: website.value, requestedBy: { email: identity.email, ...(identity.name ? { name: identity.name } : {}) } });
    const answer = askAnswerOf(body);
    console.log(`[offers] page ask ${id} ${website.value}: ${status} ${answer.outcome ?? answer.code ?? ''}`);
    // Aldus UI refusing the showcase's token is this deployment's fault, not the rep's sign-in.
    if (status === 401) return res.status(502).json({ error: 'Could not reach Aldus UI' });
    return res.status(status).json(answer);
  } catch (err) {
    console.error('[offers] page ask', err);
    return res.status(502).json({ error: 'Could not reach Aldus UI' });
  }
}
