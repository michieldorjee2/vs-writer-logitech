import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentIdentity } from './_lib/auth.js';
import { activityStore, recordVisit, underVisitLimit, type ActivityStore } from './_lib/page-activity-store.js';
import { isPageKey, normalizeVuid, pageKey } from '../src/lib/page-activity.js';

/**
 * POST /api/page-visit  { page, vuid }  ->  204
 *
 * Sent by every account and offer page once per view (src/hooks/useOdpTracking.ts): "this ODP
 * visitor opened this page". It is the index Activity mode reads, because ODP cannot list a page's
 * visitors (api/_lib/page-activity-store.ts). A signed-in employee's visit also marks their vuid
 * as team, so their own reading never counts as a prospect's.
 *
 * Public by design (prospects are not signed in), so it accepts only what it needs: a page key of
 * the site's shape and a 32-hex vuid, from the site itself, at a per-address rate. Nothing is read
 * back from here.
 */
let storeOverride: ActivityStore | null | undefined;
/** For the checks: a store to use instead of Redis. */
export function setVisitStore(store: ActivityStore | null | undefined): void {
  storeOverride = store;
}

function clientIp(req: VercelRequest): string {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return (fwd || String(req.headers['x-real-ip'] ?? '') || 'unknown').slice(0, 64);
}

/** Only the site's own pages send this; a cross-site form post or fetch is refused. */
function sameSite(req: VercelRequest): boolean {
  const site = String(req.headers['sec-fetch-site'] ?? '');
  if (site && site !== 'same-origin') return false;
  const origin = String(req.headers.origin ?? '');
  if (!origin) return true;
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameSite(req)) return res.status(403).json({ error: 'Not from this site' });

  const body = (typeof req.body === 'object' && req.body) || {};
  const page = pageKey(typeof body.page === 'string' ? body.page.slice(0, 200) : '');
  const vuid = normalizeVuid(body.vuid);
  if (!isPageKey(page) || !vuid) return res.status(400).json({ error: 'Expected { page, vuid }' });

  const store = storeOverride !== undefined ? storeOverride : activityStore();
  if (!store) return res.status(204).end();
  const now = Math.floor(Date.now() / 1000);
  try {
    if (!(await underVisitLimit(store, clientIp(req), now))) return res.status(429).json({ error: 'Too many' });
    await recordVisit(store, page, vuid, now, Boolean(currentIdentity(req, res)));
  } catch (error) {
    // A visit that is not recorded costs one line in a report; it never breaks the page.
    console.warn('[page-visit] not recorded:', error instanceof Error ? error.message : 'error');
  }
  return res.status(204).end();
}
