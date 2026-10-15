import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookie } from '../_lib/auth.js';

/**
 * POST /api/auth/logout → 303 /login?signed_out=1
 *
 * POST only: a GET that signs you out is a link anyone can make you follow.
 * It lands on /login rather than /search, because /search would send the
 * person straight back through Opti ID — which, with an Okta session still
 * live, signs them in again without a click.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  clearSessionCookie(res);
  return res.redirect(303, '/login?signed_out=1');
}
