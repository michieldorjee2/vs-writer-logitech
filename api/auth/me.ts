import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentIdentity } from '../_lib/auth.js';

/**
 * GET /api/auth/me → 200 { email, name } | 401
 *
 * How the browser learns who is signed in. The account pages are public and
 * edge-cached, so they cannot carry this themselves; the booth sidebar and the
 * search page ask here instead.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const identity = currentIdentity(req, res);
  if (!identity) return res.status(401).json({ error: 'signed_out' });
  return res.status(200).json({ email: identity.email, name: identity.name ?? null });
}
