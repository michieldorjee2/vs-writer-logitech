/**
 * The mark a signed-in Optimizely person's browser carries, so the site never sends them to ODP.
 *
 * Set beside the session cookie (api/_lib/auth.ts) and cleared with it. Unlike the session it is
 * readable by the page, because the page decides before anything else loads: index.html checks it
 * before adding ODP's SDK, and the tracking hook (src/hooks/useOdpTracking.ts) checks it before
 * sending anything. It is not a credential: a visitor who sets it only stops being tracked.
 */
export const STAFF_COOKIE = 'showcase_staff';

export function isStaffBrowser(cookie: string = typeof document === 'undefined' ? '' : document.cookie): boolean {
  return new RegExp(`(?:^|;\\s*)${STAFF_COOKIE}=1(?:;|$)`).test(cookie);
}
