import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity, sessionKey } from './_lib/auth.js';
import {
  badgeAgentId,
  badgeMode,
  badgeParameters,
  cleanPhoto,
  executionOutcome,
  openTicket,
  readPhoto,
  signTicket,
  stubOutcome,
  ticketKey,
  TICKET_MS,
  uploadBadgePhoto,
} from './_lib/badge-read.js';
import { getAgentExecution, MarkError, startAgent } from './_lib/mark.js';
import { countStore, overReadLimit } from './_lib/badge-read-limit.js';
import { BADGE_ERRORS } from '../src/lib/badge-card.js';

/**
 * Mark reads a badge for the search page (api/_lib/badge-read.ts says how, and
 * what is kept where).
 *
 *   GET                       → { ready }  whether the reader is set up (the dev server's
 *                               /search asks; in production the page render says)
 *   POST { image }            → 202 { ticket }  image: a JPEG/PNG/WebP data URL, at most 3 MB;
 *                               429 past ten reads in ten minutes
 *   GET, X-Badge-Ticket: …    → { status: 'reading' } | { status: 'done', card } | { status: 'failed' }
 *
 * POST and a GET with a ticket answer 503 until MARK_BADGE_AGENT_ID is set; a
 * GET without one answers { ready: false }. Nothing is built here: the page
 * shows the card, and the rep sends it to /api/page-builds.
 */
export const config = { maxDuration: 60 };

const NOT_FOUND = { error: 'That read is not there any more.' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');

  const mode = badgeMode();
  // A header, never the query: the address lands in the request logs, and the ticket names the rep and the run.
  const sent = req.headers?.['x-badge-ticket'];
  const ticket = typeof sent === 'string' && sent ? sent : null;
  if (req.method === 'GET' && !ticket) return res.status(200).json({ ready: mode !== 'off' });
  if (mode === 'off') return res.status(503).json({ error: BADGE_ERRORS.notSetUp });

  const key = ticketKey(sessionKey());
  const email = identity.email.trim().toLowerCase();
  try {
    if (req.method === 'POST') {
      const photo = readPhoto((req.body as { image?: unknown } | undefined)?.image);
      if (!photo.ok) return res.status(400).json({ error: photo.error });
      let jpeg: Buffer;
      try {
        jpeg = await cleanPhoto(photo.bytes);
      } catch {
        return res.status(400).json({ error: BADGE_ERRORS.notAPhoto });
      }
      // Counted before anything reaches Mark. A store that doesn't answer doesn't stop a read.
      const tooMany = await overReadLimit(countStore(), email).catch((err: unknown) => {
        console.error('[badge-read] count', err instanceof Error ? err.name : 'failed');
        return false;
      });
      if (tooMany) return res.status(429).json({ error: BADGE_ERRORS.tooMany });
      const ex =
        mode === 'stub'
          ? `stub:${Date.now()}`
          : await startAgent(badgeAgentId(), badgeParameters(await uploadBadgePhoto(jpeg)), { private: true });
      return res.status(202).json({ ticket: signTicket({ ex, em: email, exp: Date.now() + TICKET_MS }, key) });
    }

    if (req.method === 'GET') {
      const open = openTicket(ticket, key, email);
      if (!open) return res.status(404).json(NOT_FOUND);
      // A stand-in's ticket is answered only by the stand-in, a real run's only by Mark.
      if (open.ex.startsWith('stub:')) {
        if (mode !== 'stub') return res.status(404).json(NOT_FOUND);
        return res.status(200).json(stubOutcome(process.env, Number(open.ex.slice(5))));
      }
      if (mode !== 'live') return res.status(404).json(NOT_FOUND);
      return res.status(200).json(executionOutcome(await getAgentExecution(open.ex)));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    // Never the photo or what was read: only what went wrong talking to Mark.
    console.error('[badge-read]', err instanceof MarkError ? err.message : err instanceof Error ? err.name : 'failed');
    return res.status(502).json({ error: "Couldn't reach Mark. Try again." });
  }
}
