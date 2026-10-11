import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  RELAY_APP_ID,
  authEnabled,
  callbackUrl,
  firstQuery,
  randomState,
  safeNext,
  setFlowCookie,
  wikiOrigin,
} from '../../_lib/auth.js';

/**
 * GET /api/auth/optimizely/start?next=/path
 *
 * "Log in with Optimizely": send the person to the wiki's sign-in relay.
 *
 * The state is bound to THIS browser in an httpOnly cookie before the person
 * leaves, and the callback refuses an assertion whose state does not match it.
 * That is what stops someone completing their own sign-in in your browser by
 * getting you to open their callback link.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const next = safeNext(firstQuery(req.query.next));
  // Not to `next`: with no gate, /search would send the person straight back
  // here, and round and round.
  if (!authEnabled()) return res.redirect(303, `/login?error=unavailable&next=${encodeURIComponent(next)}`);

  const state = randomState();
  const relay = new URL('/api/auth/relay', wikiOrigin());
  relay.searchParams.set('app', RELAY_APP_ID);
  relay.searchParams.set('state', state);
  relay.searchParams.set('return_to', callbackUrl(req));

  setFlowCookie(res, { next, state });
  return res.redirect(303, relay.toString());
}
