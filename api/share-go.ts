import type { VercelRequest, VercelResponse } from '@vercel/node';
import { firstQuery } from './_lib/auth.js';
import { getLink, shareStore, type ShareStore } from './_lib/share-store.js';
import { SHARE_PARAM, shareCodeOf } from '../src/lib/share-links.js';

/**
 * GET /s/<code> (vercel.json rewrites it here): a personal link, sent on to its page with the
 * code, where the note is read (src/components/InviteNote.tsx). Nothing is counted here: mail
 * scanners follow links too, so an open is what the page reports once someone is reading it.
 */
let storeOverride: ShareStore | null | undefined;
/** For the checks: a store to use instead of Redis. */
export function setShareGoStore(store: ShareStore | null | undefined): void {
  storeOverride = store;
}

const GONE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Link not found</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f6f7f8;color:#08251a}p{max-width:28rem;padding:0 16px;text-align:center}</style></head><body><p>This link isn’t available anymore. Ask whoever sent it for a new one.</p></body></html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const code = shareCodeOf(firstQuery(req.query.code));
  const store = storeOverride !== undefined ? storeOverride : shareStore();
  let path: string | null = null;
  if (code && store) {
    try {
      path = (await getLink(store, code))?.path ?? null;
    } catch (error) {
      console.error('[share-go] read failed:', error instanceof Error ? error.message : 'error');
    }
  }
  if (!code || !path) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(GONE);
  }
  // The path was checked when the link was made (sharePathOf): lowercase segments only.
  res.setHeader('Location', `/${path}/?${SHARE_PARAM}=${code}`);
  return res.status(302).end();
}
