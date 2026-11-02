/**
 * The email form on an offer page, decided per offer in Limitless (src/lib/offer-signup.ts).
 *
 * `withOfferSignup` wraps every experience the site serves (api/content.ts, server/ssr-handler.tsx,
 * the dev proxy in vite.config.ts): for an account's offer page whose offer chose the email
 * form, it hands back the experience with the form in its close band. Anything else, and any
 * failure, is the page as it is.
 *
 * Off unless OFFER_SIGNUP_FORM is "on" (and Limitless is configured, ALDUS_UI_URL and
 * ALDUS_SHOWCASE_TOKEN): unset, no page asks Limitless anything and every page is as it was,
 * so production with nothing new set behaves as before. On, a slow or unreachable Limitless
 * costs at most 1.5 s once per offer per few seconds and never fails a page: a failure is held
 * 5 s (an answer 30 s), and the page it served is edge-cached 10 s (`signupCacheControl`), so
 * an offer with the form on isn't shown with the link for the page cache's six minutes.
 */
import { injectSignupForm } from '../../src/lib/offer-signup.js';
import { aldusConfigured, signupFormFor } from './aldus.js';
import { offerIdOf } from './offer-pages.js';

const HOLD_MS = 30_000;
/** A failure is held only briefly: a page a few seconds on asks again. */
const FAILED_HOLD_MS = 5_000;
const TIMEOUT_MS = 1_500;
/** For a page shown with the link because its offer's choice couldn't be read: the next request soon asks again. */
export const UNSURE_CACHE_CONTROL = 'public, s-maxage=10';

/** The email form can be drawn here: OFFER_SIGNUP_FORM=on and Limitless configured. */
export const signupFormsOn = (): boolean => process.env.OFFER_SIGNUP_FORM === 'on' && aldusConfigured();

/** Per instance. */
const held = new Map<string, { at: number; form: 'link' | 'email'; failed: boolean }>();
/** The experiences served with the link because the choice couldn't be read. */
const unsure = new WeakSet<object>();

/** The offer's choice, and whether reading it failed ("link" then). */
async function choiceOf(offerId: string): Promise<{ form: 'link' | 'email'; failed: boolean }> {
  const hit = held.get(offerId);
  if (hit && Date.now() - hit.at < (hit.failed ? FAILED_HOLD_MS : HOLD_MS)) return hit;
  let form: 'link' | 'email' = 'link';
  let failed = false;
  try {
    form = await signupFormFor(offerId, AbortSignal.timeout(TIMEOUT_MS));
  } catch (err) {
    failed = true;
    console.warn('[offer-signup] choice unread, showing the link:', err instanceof Error ? err.message : err);
  }
  const answer = { at: Date.now(), form, failed };
  held.set(offerId, answer);
  return answer;
}

/** The experience with the email form in, when its offer chose it; otherwise as given. Never throws. */
export async function withOfferSignup<T>(item: T): Promise<T> {
  try {
    if (!signupFormsOn()) return item;
    const page = item as { __typename?: unknown; componentPlan?: unknown } | null;
    if (!page || page.__typename !== 'ABMExperience') return item;
    const offerId = offerIdOf(typeof page.componentPlan === 'string' ? page.componentPlan : null);
    if (!offerId) return item;
    const { form, failed } = await choiceOf(offerId);
    if (failed) unsure.add(page);
    return form === 'email' ? injectSignupForm(item, offerId) : item;
  } catch (err) {
    console.warn('[offer-signup] left the page as it is:', err instanceof Error ? err.message : err);
    return item;
  }
}

/** The Cache-Control to serve an experience with: `normal`, or UNSURE_CACHE_CONTROL when withOfferSignup couldn't read its offer's choice. */
export function signupCacheControl(item: unknown, normal: string): string {
  return item !== null && typeof item === 'object' && unsure.has(item) ? UNSURE_CACHE_CONTROL : normal;
}

/** For the check: forget what was held. */
export function forgetSignupForms(): void {
  held.clear();
}
