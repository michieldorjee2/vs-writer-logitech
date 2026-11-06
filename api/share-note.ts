import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentIdentity, firstQuery } from './_lib/auth.js';
import { sendOdpEvent } from './_lib/odp-events.js';
import { clientIp, isJson, jsonBody, sameSite, visitorHash } from './_lib/share-http.js';
import { getLink, recordOpen, SHARE_LIMITS_PER, shareStore, underLimit, type ShareStore } from './_lib/share-store.js';
import { normalizeVuid } from '../src/lib/page-activity.js';
import { shareCodeOf, sharePathOf, type ShareNote } from '../src/lib/share-links.js';

/**
 * The recipient's side of a personal link (src/components/InviteNote.tsx). Public: whoever has the
 * link is who it was for.
 *
 *   GET  /api/share-note?code=<code>&page=/lenovo/   -> ShareNote (no addresses), 404 for another page
 *   POST /api/share-note { code, page, vuid? }        -> 204: "the note was opened"
 *
 * An open is counted once per visitor per six hours, and goes to ODP as `personal_link_open` with the
 * visitor's id and, when the rep gave one, the recipient's address, so ODP knows who read it. Nobody
 * signed in is counted or sent: an employee checking their own link is not the recipient.
 */
let storeOverride: ShareStore | null | undefined;
let odpOverride: typeof sendOdpEvent | undefined;
/** For the checks: stand-ins for Redis and ODP. */
export function setShareNoteSources(store: ShareStore | null | undefined, odp?: typeof sendOdpEvent): void {
  storeOverride = store;
  odpOverride = odp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const store = storeOverride !== undefined ? storeOverride : shareStore();
  if (!store) return res.status(404).json({ error: 'Not found' });
  const now = Math.floor(Date.now() / 1000);

  let code: string | null;
  let page: ReturnType<typeof sharePathOf>;
  let vuid: string | null = null;
  if (req.method === 'GET') {
    code = shareCodeOf(firstQuery(req.query.code));
    page = sharePathOf(firstQuery(req.query.page)?.slice(0, 420));
  } else {
    if (!isJson(req)) return res.status(415).json({ error: 'JSON only' });
    if (!sameSite(req)) return res.status(403).json({ error: 'Not from this site' });
    const body = jsonBody(req, 512);
    code = shareCodeOf(body?.code);
    page = sharePathOf(typeof body?.page === 'string' ? body.page.slice(0, 420) : '');
    vuid = normalizeVuid(body?.vuid);
  }
  if (!code || !page) return res.status(400).json({ error: 'Bad request' });

  try {
    if (!(await underLimit(store, 'read', clientIp(req), SHARE_LIMITS_PER.readMinute, 'minute', now))) {
      return res.status(429).json({ error: 'Too many' });
    }
    const link = await getLink(store, code);
    // A code on a page it wasn't made for is no note at all.
    if (!link || link.path !== page.path) return res.status(404).json({ error: 'Not found' });

    if (req.method === 'GET') {
      const note: ShareNote = {
        to: { name: link.recipient.name, title: link.recipient.title },
        from: { name: link.sender.name },
        message: link.message,
        created: link.created,
      };
      return res.status(200).json(note);
    }

    if (currentIdentity(req, res)) return res.status(204).end();
    const counted = await recordOpen(store, code, vuid ?? visitorHash(req), now);
    if (counted) {
      await (odpOverride ?? sendOdpEvent)({
        type: 'engagement',
        action: 'personal_link_open',
        identifiers: { vuid: vuid ?? undefined, email: link.recipient.email || undefined },
        data: { page: `/${link.path}/`, element: 'personal_link', label: code },
      });
      console.info(`[share-note] /${link.path}/ ${code}: opened`);
    }
    return res.status(204).end();
  } catch (error) {
    console.error('[share-note] failed:', error instanceof Error ? error.message : 'error');
    return res.status(502).json({ error: 'Unavailable' });
  }
}
