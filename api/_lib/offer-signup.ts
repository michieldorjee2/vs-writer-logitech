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
 *
 * The same answer carries the offer's form on its CTA (src/lib/cta-form.ts), behind its own
 * switch, OFFER_CTA_FORM=on: chosen, the page gets the `CtaForm` marker instead of the email form.
 */
import { injectCtaForm } from '../../src/lib/cta-form.js';
import { injectSignupForm } from '../../src/lib/offer-signup.js';
import { aldusConfigured, type CtaFormChoice, offerFormsFor } from './aldus.js';
import { offerIdOf } from './offer-pages.js';

const HOLD_MS = 30_000;
/** A failure is held only briefly: a page a few seconds on asks again. */
const FAILED_HOLD_MS = 5_000;
const TIMEOUT_MS = 1_500;
/** For a page shown with the link because its offer's choice couldn't be read: the next request soon asks again. */
export const UNSURE_CACHE_CONTROL = 'public, s-maxage=10';

/** The email form can be drawn here: OFFER_SIGNUP_FORM=on and Limitless configured. */
export const signupFormsOn = (): boolean => process.env.OFFER_SIGNUP_FORM === 'on' && aldusConfigured();

/**
 * The form on the CTA can be drawn here (src/lib/cta-form.ts): OFFER_CTA_FORM exactly "on" and
 * Limitless configured. Its own switch, so turning it on never turns the email form on, or back.
 */
export const ctaFormsOn = (): boolean => process.env.OFFER_CTA_FORM === 'on' && aldusConfigured();

type Choice = { form: 'link' | 'email'; ctaForm: CtaFormChoice; failed: boolean };
const NO_CTA_FORM: CtaFormChoice = { on: false, alwaysShow: false };

/** Per instance. */
const held = new Map<string, Choice & { at: number }>();
/** The experiences served with the link because the choice couldn't be read. */
const unsure = new WeakSet<object>();

/** The offer's choices, and whether reading them failed ("link" and no CTA form then). */
async function choiceOf(offerId: string): Promise<Choice> {
  const hit = held.get(offerId);
  if (hit && Date.now() - hit.at < (hit.failed ? FAILED_HOLD_MS : HOLD_MS)) return hit;
  let answer: Choice;
  try {
    answer = { ...(await offerFormsFor(offerId, AbortSignal.timeout(TIMEOUT_MS))), failed: false };
  } catch (err) {
    answer = { form: 'link', ctaForm: NO_CTA_FORM, failed: true };
    console.warn('[offer-signup] choice unread, showing the link:', err instanceof Error ? err.message : err);
  }
  held.set(offerId, { ...answer, at: Date.now() });
  return answer;
}

/**
 * The offer's form on its CTA, read as the page was (the same memo): api/cta-form.ts asks it
 * before it answers anything about a visitor, so the endpoint works only for an offer that chose
 * the form. Off while OFFER_CTA_FORM isn't "on", and when the choice can't be read.
 */
export async function ctaFormChoiceOf(offerId: string): Promise<CtaFormChoice> {
  if (!ctaFormsOn()) return NO_CTA_FORM;
  const { ctaForm, failed } = await choiceOf(offerId);
  return failed ? NO_CTA_FORM : ctaForm;
}

/**
 * The experience with the offer's form in, when it chose one; otherwise as given. Never throws.
 * The form on the CTA (OFFER_CTA_FORM) wins over the email form (OFFER_SIGNUP_FORM): with both
 * chosen, the close band keeps its button and every CTA opens the contact form.
 */
export async function withOfferSignup<T>(item: T): Promise<T> {
  try {
    const signupOn = signupFormsOn();
    const ctaOn = ctaFormsOn();
    if (!signupOn && !ctaOn) return item;
    const page = item as { __typename?: unknown; componentPlan?: unknown } | null;
    if (!page || page.__typename !== 'ABMExperience') return item;
    const offerId = offerIdOf(typeof page.componentPlan === 'string' ? page.componentPlan : null);
    if (!offerId) return item;
    const { form, ctaForm, failed } = await choiceOf(offerId);
    if (failed) unsure.add(page);
    if (ctaOn && ctaForm.on) return injectCtaForm(item, offerId, ctaForm.alwaysShow);
    return signupOn && form === 'email' ? injectSignupForm(item, offerId) : item;
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
