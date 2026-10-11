/* Who is signed in, from the browser's side. The server half — the session,
 * the wiki relay, what each route accepts — is api/_lib/auth.ts.
 *
 * The account pages are public and edge-cached, so the signed-in state cannot
 * be rendered into them; the sidebar and the search page ask /api/auth/me. */

import { useEffect, useState } from 'react';

export type Identity = { email: string; name: string | null };

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-in'; identity: Identity }
  | { status: 'signed-out' };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) return null;
        const body = (await r.json()) as Partial<Identity>;
        return typeof body.email === 'string' && body.email ? { email: body.email, name: body.name ?? null } : null;
      })
      .catch(() => null)
      .then((identity) => {
        if (cancelled) return;
        setState(identity ? { status: 'signed-in', identity } : { status: 'signed-out' });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** Sign in through Opti ID and come back to `next` (this page, by default). */
export function signInHref(next = window.location.pathname + window.location.search): string {
  return `/api/auth/optimizely/start?next=${encodeURIComponent(next)}`;
}

/** Where sign-out posts; it lands on /login, never on a page that would sign you straight back in. */
export const SIGN_OUT_ACTION = '/api/auth/logout';
