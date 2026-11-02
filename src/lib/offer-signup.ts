/**
 * Sign-up on an offer page, drawn at render time.
 *
 * Each offer in Limitless (aldus-ui lib/offers/signup.ts) picks how people sign up on its
 * pages: the close band's button links out (today, and the default), or an email-only form
 * on the page. When it is the form, the data layer (api/_lib/offer-signup.ts, wrapped around
 * every experience the site serves: api/content.ts, server/ssr-handler.tsx and the dev proxy)
 * runs `injectSignupForm` over the experience before anything renders it, so the server HTML,
 * the embedded __SSR_DATA__ and a client fetch all carry the same tree and hydration agrees.
 * Nothing is written to the CMS and no page is regenerated: turning it off is one click in
 * Limitless, and the next render after the caches is the page as it was.
 *
 * Pure and dependency-free: the server, the browser bundle and the check import it.
 */

/** The form's anchor: the hero's main button points here when the form is on. */
export const SIGNUP_ANCHOR = 'signup';

/**
 * The element the form takes the place of the button in. The offer blueprint's close band
 * (`offerClose`). If the redesign renames or replaces it, this name changes with it and the
 * check's fixture says so.
 */
export const CLOSE_TYPENAME = 'AbmClosingCtaElement';
const BUTTON_TYPENAME = 'ButtonBlock';
/** Only an account's offer page carries an offer's close band. */
const EXPERIENCE_TYPENAME = 'ABMExperience';

/** Optimizely's privacy notice (answers 200, 1 Nov 2026). The line under the form links to it. */
export const PRIVACY_URL = 'https://www.optimizely.com/legal/privacy-notice';

/** Every word the form shows. The privacy line's wording is Michiel's (or legal's) to confirm. */
export const SIGNUP_WORDS = {
  label: 'Work email',
  fallbackButton: 'Sign up',
  sending: 'Sending…',
  done: "Thanks, you're signed up.",
  invalid: 'Enter your work email.',
  error: "That didn't go through. Try again.",
  privacy: "We'll only use your email for this offer.",
  privacyLink: 'Privacy notice',
} as const;

const MAX_EMAIL = 254;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** An email's shape, trimmed and lower-cased, or null. The same rule Limitless keeps a sign-up by. */
export function workEmailOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email && email.length <= MAX_EMAIL && EMAIL.test(email) ? email : null;
}

/** An offer page's route segment from its path ("/vb/workshop-acme/" -> "workshop-acme"), or null. */
export function routeSegmentOf(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const m = /^\/?vb\/([a-z0-9][a-z0-9-]{0,199})\/?$/i.exec(path.trim());
  return m ? m[1].toLowerCase() : null;
}

export const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;
export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** The utm_* values of a query string, each at most 200 characters (a longer one is dropped). */
export function utmOf(search: string): Utm {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)?.trim();
    if (value && value.length <= 200) utm[key] = value;
  }
  return utm;
}

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value);
const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Every element component in one section node, in order. */
function componentsOf(section: unknown): Obj[] {
  if (!isObj(section)) return [];
  return arr(section.rows).flatMap((row) =>
    isObj(row)
      ? arr(row.columns).flatMap((column) =>
          isObj(column)
            ? arr(column.elements).flatMap((element) => (isObj(element) && isObj(element.component) ? [element.component] : []))
            : [],
        )
      : [],
  );
}

/**
 * The experience with the email form in its close band, for the offer `offerId`. A copy:
 * the input is never changed.
 *
 *   - every AbmClosingCtaElement gets `SignupOfferId` (the renderer draws the form for it)
 *   - in the FIRST section, the first ButtonBlock whose link isn't an anchor gets
 *     `#signup`, so the hero's main button goes to the form; `#about` stays
 *   - a page with no close band comes back as it was (no hero pointing nowhere), and so does
 *     anything that isn't an account's offer page
 *
 * Running it twice gives what running it once does.
 */
export function injectSignupForm<T>(item: T, offerId: string): T {
  if (!isObj(item) || item.__typename !== EXPERIENCE_TYPENAME || !offerId) return item;
  const copy = structuredClone(item) as Obj;
  const nodes = isObj(copy.composition) ? arr(copy.composition.nodes) : [];
  const closes = nodes.flatMap(componentsOf).filter((component) => component.__typename === CLOSE_TYPENAME);
  if (closes.length === 0) return item;
  for (const close of closes) close.SignupOfferId = offerId;
  const buttons = componentsOf(nodes[0]).filter((component) => component.__typename === BUTTON_TYPENAME);
  // Already pointed at the form: a second run must not move on to the next button.
  if (buttons.some((button) => button.ButtonUrl === `#${SIGNUP_ANCHOR}`)) return copy as T;
  const main = buttons.find(
    (button) => typeof button.ButtonUrl === 'string' && button.ButtonUrl.trim() !== '' && !button.ButtonUrl.trim().startsWith('#'),
  );
  if (main) main.ButtonUrl = `#${SIGNUP_ANCHOR}`;
  return copy as T;
}
