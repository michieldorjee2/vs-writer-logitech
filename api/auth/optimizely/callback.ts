import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  authEnabled,
  claimOnce,
  clearFlowCookie,
  firstQuery,
  isOptimizelyEmail,
  readFlowCookie,
  safeNext,
  setSessionCookie,
  verifyAssertion,
} from '../../_lib/auth.js';

/**
 * GET /api/auth/optimizely/callback?assertion=…&state=…
 *
 * Where the wiki's relay sends the person back, with a signed assertion of who
 * they are. Verified here (api/_lib/auth.ts), its one-time id burned, and our
 * own long-lived session opened in its place.
 *
 * Every failure goes to /login with a short code rather than a raw error, and
 * is logged with the reason. This code never prints the assertion, but the
 * platform's request log keeps the full URL it arrived on — which is why the
 * assertion is single-use and lives two minutes.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  // This URL carried the assertion; do not hand it on as a Referer.
  res.setHeader('Referrer-Policy', 'no-referrer');

  const flow = readFlowCookie(req);
  const next = safeNext(flow.next);
  const failed = (code: string, detail: string) => {
    console.warn(`[auth] sign-in refused: ${code} (${detail})`);
    clearFlowCookie(res);
    return res.redirect(303, `/login?error=${code}&next=${encodeURIComponent(next)}`);
  };

  if (!authEnabled()) return failed('unavailable', 'OPTIID_RELAY_SECRET is not set');

  const state = firstQuery(req.query.state) ?? '';
  // Most often a stale tab, or a callback opened in a different browser.
  if (!flow.state || state !== flow.state) return failed('expired', 'no matching sign-in in this browser');

  const check = verifyAssertion(firstQuery(req.query.assertion), flow.state);
  if (!check.ok) return failed(check.reason === 'expired' ? 'expired' : 'invalid', check.reason);

  // Opti ID also signs in customers. These tools act on Optimizely's behalf
  // (they publish pages and message the requester on Teams), so they stay
  // inside the company — the rule the old email prompt enforced.
  if (!isOptimizelyEmail(check.identity.email)) {
    return failed('not_optimizely', `${check.identity.email} is not an optimizely.com address`);
  }

  // Held a little past the assertion's own expiry, so a replay is refused
  // for exactly as long as the assertion could otherwise still pass.
  const ttl = Math.max(60, check.exp - Math.floor(Date.now() / 1000) + 60);
  let fresh = false;
  try {
    fresh = await claimOnce(check.jti, ttl);
  } catch (err) {
    console.error('[auth] could not record the assertion id', err);
  }
  if (!fresh) return failed('invalid', 'assertion already used, or nowhere to record it');

  console.info(`[auth] ${check.identity.email} signed in (${check.identity.env})`);
  setSessionCookie(res, check.identity);
  clearFlowCookie(res);
  return res.redirect(303, next);
}
