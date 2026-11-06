import type { VercelRequest, VercelResponse } from '@vercel/node';
import { firstQuery, requireIdentity } from './_lib/auth.js';
import { isJson, jsonBody, linkOrigin, sameSite } from './_lib/share-http.js';
import { pageLinks, saveLink, SHARE_LIMITS_PER, shareStore, underLimit, type ShareStore } from './_lib/share-store.js';
import { checkShareInput, nameFromEmail, oneLine, sharePathOf, shareUrl } from '../src/lib/share-links.js';

/**
 * Personal links on one page (src/lib/share-links.ts). Signed-in Optimizely people only.
 *
 *   GET  /api/share-links?page=/lenovo/                                -> { links: ShareLinkRow[] }
 *   POST /api/share-links { route, recipient: { name, title, email }, message }  -> 201 { code, url }
 *
 * The sender is the signed-in person, never one the request names. 40 links a day each.
 */
let storeOverride: ShareStore | null | undefined;
/** For the checks: a store to use instead of Redis. */
export function setShareLinksStore(store: ShareStore | null | undefined): void {
  storeOverride = store;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const identity = requireIdentity(req, res);
  if (!identity) return;
  const store = storeOverride !== undefined ? storeOverride : shareStore();
  if (!store) return res.status(503).json({ error: 'Links are not configured here' });

  if (req.method === 'GET') {
    const route = sharePathOf(firstQuery(req.query.page)?.slice(0, 420));
    if (!route) return res.status(400).json({ error: 'Unknown page' });
    try {
      return res.status(200).json({ links: await pageLinks(store, route.path) });
    } catch (error) {
      console.error('[share-links] list failed:', error instanceof Error ? error.message : 'error');
      return res.status(502).json({ error: 'Could not read the links' });
    }
  }

  if (!isJson(req)) return res.status(415).json({ error: 'JSON only' });
  if (!sameSite(req)) return res.status(403).json({ error: 'Not from this site' });
  const body = jsonBody(req, 4096);
  if (!body) return res.status(400).json({ error: 'Bad request' });
  const input = checkShareInput(body);
  if (!input.ok) return res.status(400).json({ error: input.error, field: input.field });

  const now = Math.floor(Date.now() / 1000);
  try {
    if (!(await underLimit(store, 'create', identity.email.toLowerCase(), SHARE_LIMITS_PER.createDay, 'day', now))) {
      return res.status(429).json({ error: 'That’s a lot of links for one day. Try again tomorrow' });
    }
    const code = await saveLink(store, {
      path: input.value.path,
      message: input.value.message,
      recipient: input.value.recipient,
      sender: { name: oneLine(identity.name, 120) || nameFromEmail(identity.email), email: identity.email.toLowerCase() },
      created: now,
    });
    console.info(`[share-links] /${input.value.path}/ ${code}: made`);
    return res.status(201).json({ code, url: shareUrl(linkOrigin(req), code) });
  } catch (error) {
    console.error('[share-links] create failed:', error instanceof Error ? error.message : 'error');
    return res.status(502).json({ error: 'Could not make the link' });
  }
}
