/**
 * The form on an offer page's CTA: optimizely.com's lead form (Marketo form 1002, the "Global Lead
 * Form" the website's resource, webinar and event pages use, CMS "[General] 1002 Resources form"),
 * asked only for what Optimizely doesn't already know about the visitor. Each offer turns it on in Limitless
 * (aldus-ui lib/offers/cta-form.ts, "Form on CTA"), with a second switch, "Always show form".
 *
 * With it on, a click on the page's call to action (the hero's main button, the sticky bar, the
 * close band's button) goes through src/www/CtaForm.tsx:
 *
 *   1. ODP knows the visitor (the browser's ODP id resolves to a profile with an email) and holds
 *      every field the form needs: the form is submitted for them in the background, and the
 *      button goes where it always went. Nothing on screen changes.
 *   2. ODP doesn't know them: a panel asks for their work email.
 *   3. With the email, the server asks ODP again (and ties the browser's ODP id to the email), and
 *      the panel asks only for the fields ODP doesn't hold, then submits.
 *   "Always show form": a known visitor sees the whole form too, filled in from their own profile.
 *
 * The server (api/cta-form.ts) posts the submission where optimizely.com's own forms post it (the
 * form's SubmitUrl, the `optisaasformproxy` OCP function), in the website's exact shape, so ODP,
 * Marketo and Salesforce receive it as a website form 1002 submission from the offer page's URL,
 * with no new wiring anywhere.
 *
 * Privacy: profile values only ever leave the server for the visitor's OWN browser id, and only
 * on an offer that chose "Always show form" (to fill the form in). An email typed into the panel
 * gets back which fields to ask for, never what ODP holds for that address.
 *
 * Dependency-free apart from the generated option lists: the server, the browser bundle and the
 * check import it. Only the post* functions touch the network (the page's own endpoint).
 */

import { COUNTRIES, PROVINCES, US_STATES, WORK_EMAIL_PATTERN } from './contact-form-options.js'

export const CTA_FORM_ENDPOINT = '/api/cta-form'

/** The website's form: its Marketo id (the FormID hidden field) and its CMS key (form_key). */
export const FORM_ID = '1002'
export const FORM_KEY = '8df6340c6cdd4e19a40a82103f1a96a5'

/** The form's fields the visitor can see, by the name each is submitted as. */
export type FieldKey =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'company'
  | 'title'
  | 'country'
  | 'state'
  | 'Marketing_Consent__c'

export type Contact = Partial<Record<FieldKey, string>>

/** Required on the website's form, in its order. */
export const REQUIRED: readonly FieldKey[] = ['firstName', 'lastName', 'email', 'company', 'title', 'country']
/** Every visible field, in the website's order. */
export const ALL_FIELDS: readonly FieldKey[] = [...REQUIRED, 'state', 'Marketing_Consent__c']

/** The website's labels. `state` is "US state" for the United States and "Province" for Canada. */
export const FIELD_LABELS: Record<Exclude<FieldKey, 'state' | 'Marketing_Consent__c'>, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  company: 'Company',
  title: 'Job title',
  country: 'Country',
}
export const STATE_LABELS = { 'United States': 'US state', Canada: 'Province' } as const
/** The browser's autofill hint per field, as the website sets it. */
export const AUTOCOMPLETE: Partial<Record<FieldKey, string>> = {
  firstName: 'given-name',
  lastName: 'family-name',
  email: 'email',
  company: 'organization',
  title: 'organization-title',
  country: 'country-name',
}

/** Every word the panel shows. */
export const CTA_FORM_WORDS = {
  emailTitle: 'First, your work email',
  emailBody: "We'll take you straight there after.",
  detailsTitle: 'Just a few details',
  detailsBody: "Only what we don't have yet.",
  fullTitle: 'Check your details',
  fullBody: "We've filled in what we have.",
  checking: 'One moment…',
  next: 'Next',
  submit: 'Submit',
  sending: 'Sending…',
  done: "Thanks, you're all set.",
  continue: 'Continue',
  close: 'Close',
  otherEmail: 'Use a different email',
  required: 'This field is required.',
  invalidEmail: 'Enter a valid email address.',
  workEmail: 'Enter your work email.',
  pickOne: 'Choose one.',
  error: "That didn't go through. Try again.",
  privacy: 'Optimizely will store and process your personal data as described in our',
  privacyLink: 'Privacy Notice',
  privacyTail: '. Refer to the Privacy Notice for opt out.',
} as const

export const PRIVACY_URL = 'https://www.optimizely.com/legal/privacy-notice/'

/* ---------- The fields' rules (the server applies them; the panel shows the same answers) ---------- */

const MAX_TEXT = 255
const MAX_EMAIL = 254
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const WORK_EMAIL = new RegExp(WORK_EMAIL_PATTERN, 'i')
// Control characters (C0, DEL, C1) never belong in a form value; a value holding one is refused.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/
const COUNTRY_SET = new Set(COUNTRIES)
const STATE_SETS: Record<string, Set<string>> = { 'United States': new Set(US_STATES), Canada: new Set(PROVINCES) }

/** The states to choose from for a country, or none: only the United States and Canada have a list. */
export function statesFor(country: string | undefined): readonly string[] {
  return country === 'United States' ? US_STATES : country === 'Canada' ? PROVINCES : []
}

/** One line of text: trimmed, inner whitespace collapsed, at most `max`; null when empty, too long or holding a control character. */
function line(raw: unknown, max = MAX_TEXT): string | null {
  if (typeof raw !== 'string' || CONTROL.test(raw)) return null
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat && flat.length <= max ? flat : null
}

/** The email's problem, or null: the website's two rules (a real address, a work domain). */
export function emailProblem(raw: unknown): 'required' | 'invalidEmail' | 'workEmail' | null {
  const email = typeof raw === 'string' ? raw.trim() : ''
  if (!email) return 'required'
  if (email.length > MAX_EMAIL || !EMAIL.test(email) || CONTROL.test(email)) return 'invalidEmail'
  return WORK_EMAIL.test(email) ? null : 'workEmail'
}

/** A work email, trimmed and lower-cased, or null. */
export function workEmailOf(raw: unknown): string | null {
  return emailProblem(raw) === null ? (raw as string).trim().toLowerCase() : null
}

export type FieldProblem = 'required' | 'invalidEmail' | 'workEmail' | 'pickOne'

/**
 * The fields a body sends, each checked by the website's rules: what passes is kept, what
 * doesn't is named in `problems` (an empty field isn't a problem here; `missingOf` says what's
 * still needed). Unknown keys are dropped. `state` is kept only when it is one of its country's
 * options; consent only as "yes".
 */
export function cleanContact(raw: unknown): { values: Contact; problems: Partial<Record<FieldKey, FieldProblem>> } {
  const given = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const values: Contact = {}
  const problems: Partial<Record<FieldKey, FieldProblem>> = {}
  const present = (key: string) => typeof given[key] === 'string' && (given[key] as string).trim() !== ''
  for (const key of ['firstName', 'lastName', 'company', 'title'] as const) {
    const value = line(given[key])
    if (value) values[key] = value
    else if (present(key)) problems[key] = 'required'
  }
  if (present('email')) {
    const problem = emailProblem(given.email)
    if (problem && problem !== 'required') problems.email = problem
    else values.email = (given.email as string).trim().toLowerCase()
  }
  const country = line(given.country)
  if (country && COUNTRY_SET.has(country)) values.country = country
  else if (present('country')) problems.country = 'pickOne'
  // "Québec" is how form 1054 (and so some ODP profiles) spell it; form 1002 submits "Quebec".
  const state = line(given.state) === 'Québec' ? 'Quebec' : line(given.state)
  if (state && values.country && STATE_SETS[values.country]?.has(state)) values.state = state
  if (given.Marketing_Consent__c === 'yes') values.Marketing_Consent__c = 'yes'
  return { values, problems }
}

/** The required fields `values` lacks, in the form's order. */
export function missingOf(values: Contact): FieldKey[] {
  return REQUIRED.filter((key) => !values[key])
}

/* ---------- The website's hidden fields ---------- */

/**
 * The website's tracking fields (OptiFormsHiddenValueElement), each read from the query string
 * first and then a cookie of the source name, as the website reads them. `_mkto_trk` is Marketo's
 * own cookie (Munchkin, set on .optimizely.com): sent along, Marketo ties the lead to the visitor's
 * earlier web activity.
 */
export const TRACKING_SOURCES = {
  _mkto_trk: '_mkto_trk',
  gAID: '_ga',
  optimizelyenduserid: 'optimizelyEndUserId',
  utm_medium: 'utm_medium',
  utm_source: 'utm_source',
  utm_campaign: 'utm_campaign',
  utm_term: 'utm_term',
  utm_content: 'utm_content',
  UTM_Partner__c: 'utm_partner',
  msclkid: 'msclkid',
  li_fat_id: 'li_fat_id',
  Google_Click_ID__c: 'gclid',
} as const
export type TrackingKey = keyof typeof TRACKING_SOURCES
export type Tracking = Partial<Record<TrackingKey, string>>
const MAX_TRACKING = 200

/** The tracking fields from a query string and a cookie header, as the website reads them. */
export function trackingOf(search: string, cookie: string): Tracking {
  const params = new URLSearchParams(search)
  const cookies = new Map<string, string>()
  for (const part of cookie.split(';')) {
    const at = part.indexOf('=')
    if (at < 0) continue
    const name = part.slice(0, at).trim()
    if (!name || cookies.has(name)) continue
    try {
      cookies.set(name, decodeURIComponent(part.slice(at + 1).trim()))
    } catch {
      cookies.set(name, part.slice(at + 1).trim())
    }
  }
  const out: Tracking = {}
  for (const [key, source] of Object.entries(TRACKING_SOURCES) as Array<[TrackingKey, string]>) {
    const value = line(params.get(source) ?? '', MAX_TRACKING) ?? line(cookies.get(source) ?? '', MAX_TRACKING)
    if (value) out[key] = value
  }
  return out
}

/** Tracking fields from a body: known keys, short single-line values; anything else dropped. */
export function cleanTracking(raw: unknown): Tracking {
  const given = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out: Tracking = {}
  for (const key of Object.keys(TRACKING_SOURCES) as TrackingKey[]) {
    const value = line(given[key], MAX_TRACKING)
    if (value) out[key] = value
  }
  return out
}

/* ---------- The page's own endpoint ---------- */

/** What the server says about the visitor: known (ODP has their email) and which required fields it lacks. */
export interface CtaStatus {
  known: boolean
  missing: FieldKey[]
  /** Only for the visitor's own browser id, and only when the offer chose "Always show form". */
  prefill?: Contact
}

export type CtaSubmitAnswer =
  | { outcome: 'done' }
  | { outcome: 'missing'; missing: FieldKey[]; problems: Partial<Record<FieldKey, FieldProblem>> }
  | { outcome: 'error' }

type Where = { pathname: string; search: string }

async function post<T>(body: Record<string, unknown>, opts: { keepalive?: boolean } = {}): Promise<{ status: number; data: T | null }> {
  const res = await fetch(CTA_FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
    keepalive: opts.keepalive,
  })
  return { status: res.status, data: (await res.json().catch(() => null)) as T | null }
}

const FIELD_KEYS = new Set<string>(ALL_FIELDS)
const fieldList = (value: unknown): FieldKey[] => (Array.isArray(value) ? value.filter((k): k is FieldKey => typeof k === 'string' && FIELD_KEYS.has(k)) : [])

/** Asks whether the browser's ODP id is a known visitor. Unknown on any failure. */
export async function postCtaStatus(location: Where, vuid: string | null): Promise<CtaStatus> {
  const unknown: CtaStatus = { known: false, missing: [...REQUIRED] }
  if (!vuid) return unknown
  try {
    const { status, data } = await post<Partial<CtaStatus>>({ step: 'status', route: location.pathname, vuid })
    if (status !== 200 || !data) return unknown
    const prefill = data.prefill && typeof data.prefill === 'object' ? cleanContact(data.prefill).values : undefined
    return { known: data.known === true, missing: fieldList(data.missing), ...(prefill ? { prefill } : {}) }
  } catch {
    return unknown
  }
}

/** Sends the typed email: which required fields to ask for next (never their values). Null on failure. */
export async function postCtaLookup(location: Where, email: string, vuid: string | null, website: string): Promise<FieldKey[] | null> {
  try {
    const { status, data } = await post<{ missing?: unknown }>({ step: 'lookup', route: location.pathname, email, website, ...(vuid ? { vuid } : {}) })
    return status === 200 && data ? fieldList(data.missing) : null
  } catch {
    return null
  }
}

/**
 * Submits the form. With `email`, the server fills what the visitor didn't type from ODP's profile
 * for that email; without it, from the browser's own ODP id's profile. `keepalive` for the
 * background submit, which must survive the visitor following the link at once.
 */
export async function postCtaSubmit(
  location: Where,
  input: { email?: string; vuid: string | null; fields: Contact; tracking: Tracking; website: string },
  opts: { keepalive?: boolean } = {},
): Promise<CtaSubmitAnswer> {
  try {
    const { status, data } = await post<{ missing?: unknown; problems?: unknown }>(
      {
        step: 'submit',
        route: location.pathname,
        query: location.search,
        fields: input.fields,
        tracking: input.tracking,
        website: input.website,
        ...(input.email ? { email: input.email } : {}),
        ...(input.vuid ? { vuid: input.vuid } : {}),
      },
      opts,
    )
    if (status === 201) return { outcome: 'done' }
    if (status === 422 && data) {
      const problems = (data.problems && typeof data.problems === 'object' ? data.problems : {}) as Partial<Record<FieldKey, FieldProblem>>
      return { outcome: 'missing', missing: fieldList(data.missing), problems }
    }
    return { outcome: 'error' }
  } catch {
    return { outcome: 'error' }
  }
}

/* ---------- On the page ---------- */

/** The marker the data layer puts on an offer page whose offer chose the form (api/_lib/offer-signup.ts). */
export interface CtaFormMarker {
  offerId: string
  alwaysShow: boolean
}

/** The marker on an experience, or null. */
export function ctaFormMarkerOf(experience: unknown): CtaFormMarker | null {
  const marker = (experience as { CtaForm?: unknown } | null)?.CtaForm as Partial<CtaFormMarker> | undefined
  return marker && typeof marker.offerId === 'string' && marker.offerId ? { offerId: marker.offerId, alwaysShow: marker.alwaysShow === true } : null
}

/** The experience with the marker on (a copy), for an account's offer page. Anything else comes back as given. */
export function injectCtaForm<T>(item: T, offerId: string, alwaysShow: boolean): T {
  const page = item as { __typename?: unknown } | null
  if (!page || typeof page !== 'object' || page.__typename !== 'ABMExperience' || !offerId) return item
  return { ...(item as object), CtaForm: { offerId, alwaysShow } } as T
}

/** What a click on a CTA does: go through (submitting for a known visitor in the background, once), or open the panel. */
export function ctaStep(state: { submitted: boolean; status: CtaStatus | null; alwaysShow: boolean; preview: boolean }): 'through' | 'submit-through' | 'panel' {
  if (state.preview || state.submitted) return 'through'
  const s = state.status
  if (s && s.known && s.missing.length === 0 && !state.alwaysShow) return 'submit-through'
  return 'panel'
}

/** The session key that remembers a submit for one page, so a reload doesn't ask again. */
export const submittedKey = (pathname: string) => `cta-form:${pathname.replace(/\/+$/, '')}`
