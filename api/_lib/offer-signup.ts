/**
 * The email form on an offer page, decided per offer in Limitless (src/lib/offer-signup.ts).
 *
 * `withOfferSignup` wraps every experience the site serves (api/content.ts, server/ssr-handler.tsx,
 * the dev proxy in vite.config.ts): for an account's offer page whose offer chose the email
 * form, it hands back the experience with the form in its close band. Anything else, and any
 * failure, is the page as it is: a slow or unreachable Limitless costs at most 1.5 s once per
 * offer per 30 s, and never fails a page.
 */
import { injectSignupForm } from '../../src/lib/offer-signup.js';
import { aldusConfigured, signupFormFor } from './aldus.js';
import { offerIdOf } from './offer-pages.js';

const HOLD_MS = 30_000;
const TIMEOUT_MS = 1_500;
/** Per instance; a miss is held as long as a hit, so a down Limitless isn't asked on every page. */
const held = new Map<string, { at: number; form: 'link' | 'email' }>();

/** The offer's choice: "link" when Limitless isn't configured here, or on any error. */
export async function signupFormOf(offerId: string): Promise<'link' | 'email'> {
  if (!aldusConfigured()) return 'link';
  const hit = held.get(offerId);
  if (hit && Date.now() - hit.at < HOLD_MS) return hit.form;
  let form: 'link' | 'email' = 'link';
  try {
    form = await signupFormFor(offerId, AbortSignal.timeout(TIMEOUT_MS));
  } catch (err) {
    console.warn('[offer-signup] choice unread, showing the link:', err instanceof Error ? err.message : err);
  }
  held.set(offerId, { at: Date.now(), form });
  return form;
}

/** The experience with the email form in, when its offer chose it; otherwise as given. Never throws. */
export async function withOfferSignup<T>(item: T): Promise<T> {
  try {
    const page = item as { __typename?: unknown; componentPlan?: unknown } | null;
    if (!page || page.__typename !== 'ABMExperience') return item;
    const offerId = offerIdOf(typeof page.componentPlan === 'string' ? page.componentPlan : null);
    if (!offerId) return item;
    return (await signupFormOf(offerId)) === 'email' ? injectSignupForm(item, offerId) : item;
  } catch (err) {
    console.warn('[offer-signup] left the page as it is:', err instanceof Error ? err.message : err);
    return item;
  }
}

/** For the check: forget what was held. */
export function forgetSignupForms(): void {
  held.clear();
}
