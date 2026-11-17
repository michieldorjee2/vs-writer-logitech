/**
 * The server half of the form on an offer page's CTA (src/lib/cta-form.ts): which page and offer
 * a request names, what ODP knows about a visitor, tying the browser's ODP id to an email, and
 * the submission itself, posted where optimizely.com posts its contact form.
 *
 * Server-only. ODP is asked through odp-events.ts's odpPoster, so the account key is read in that
 * one file. Nothing here logs an email or a profile value, and nothing ODP holds reaches a browser
 * except as api/cta-form.ts allows.
 *
 * Where the submission goes: the website's form (CMS "[General] 1054 Contact Form") posts to its
 * SubmitUrl, the `optisaasformproxy` OCP function, which hands each submission to ODP and Marketo
 * (Marketo syncs Salesforce). The website's server does it with a plain JSON POST and no key
 * (OptimizelyHeadless app/actions/form-submission.ts), and so does this. CTA_FORM_SUBMIT_URL may
 * point it elsewhere (a test endpoint), but only to an https URL on function.zaius.app, so a bad
 * setting can't send people's details anywhere else.
 */
import { normalizeVuid } from '../../src/lib/page-activity.js';
import { type Contact, cleanContact, FORM_ID, FORM_KEY, type Tracking } from '../../src/lib/cta-form.js';
import { odpPoster } from './odp-events.js';
import { offerIdOf } from './offer-pages.js';

/** The website's form's SubmitUrl (CMS form 863c05ac…, live version 99984, 17 Nov 2026). Public: it is in the website's page data. */
export const WEBSITE_SUBMIT_URL = 'https://function.zaius.app/optisaasformproxy/forms_odp_webhook/b8a55a4a-6585-4639-8068-5c43b12facf8';
const SUBMIT_HOST = 'function.zaius.app';
const SUBMIT_TIMEOUT_MS = 8000;
const ODP_TIMEOUT_MS = 4000;
const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/** Where submissions go: CTA_FORM_SUBMIT_URL when it is an https URL on function.zaius.app, else the website's own. Null for a bad setting. */
export function submitUrl(value = process.env.CTA_FORM_SUBMIT_URL): string | null {
  if (!value) return WEBSITE_SUBMIT_URL;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === SUBMIT_HOST && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

/* ---------- The page ---------- */

export type OfferPage = { offerId: string; companyName: string | null; key: string | null };

const PAGE_QUERY = `
query CtaFormPage($slug: String!) {
  ABMExperience(where: { _metadata: { url: { hierarchical: { eq: $slug } } } }, locale: en) {
    items { companyName componentPlan _metadata { key } }
  }
}
`;
const pageHeld = new Map<string, { at: number; page: OfferPage | null }>();
const PAGE_HOLD_MS = 60_000;

/** The offer page at /vb/<segment>, read from Graph (held a minute), or null when there is none or it names no offer. Throws when Graph can't say. */
export async function offerPageAt(segment: string, authKey: string): Promise<OfferPage | null> {
  const hit = pageHeld.get(segment);
  if (hit && Date.now() - hit.at < PAGE_HOLD_MS) return hit.page;
  let page: OfferPage | null = null;
  for (const slug of [`/${segment}/`, `/en/${segment}/`]) {
    const res = await fetch(`${GRAPH_ENDPOINT}?auth=${encodeURIComponent(authKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PAGE_QUERY, variables: { slug } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Graph answered ${res.status}`);
    type Item = { companyName: string | null; componentPlan: string | null; _metadata?: { key?: string | null } | null };
    const body = (await res.json().catch(() => ({}))) as { data?: { ABMExperience?: { items?: Item[] } } };
    const item = body.data?.ABMExperience?.items?.[0];
    if (!item) continue;
    const offerId = offerIdOf(item.componentPlan);
    page = offerId ? { offerId, companyName: item.companyName ?? null, key: item._metadata?.key?.replace(/-/g, '') ?? null } : null;
    break;
  }
  pageHeld.set(segment, { at: Date.now(), page });
  return page;
}

/* ---------- ODP ---------- */

/** What ODP holds for a person, as the form's fields (only values the form would accept), and their email. */
export type Profile = { email: string | null; contact: Contact };

const PROFILE_FIELDS = 'email first_name last_name company_name job_title phone country state';
type OdpCustomer = Partial<Record<'email' | 'first_name' | 'last_name' | 'company_name' | 'job_title' | 'phone' | 'country' | 'state', string | null>>;

/** ODP's profile as the form's fields, through the form's own rules (a country not on the list, or a state not of its country, is left out). */
export function contactOfProfile(c: OdpCustomer | null | undefined): Profile {
  if (!c) return { email: null, contact: {} };
  const { values } = cleanContact({
    email: c.email ?? '',
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    company: c.company_name ?? '',
    title: c.job_title ?? '',
    phone: c.phone ?? '',
    country: c.country ?? '',
    state: c.state ?? '',
  });
  // An address the website would refuse (a free mail domain) is still the person's: it identifies them, it just isn't a field value.
  const email = typeof c.email === 'string' && c.email.trim() ? c.email.trim().toLowerCase() : null;
  return { email, contact: values };
}

export interface Odp {
  /** The profile for a browser's ODP id or an email, or null when ODP has none. Throws when ODP can't say. */
  profile(by: { vuid: string } | { email: string }): Promise<Profile | null>;
  /** Ties the browser's ODP id to the email (one profile update with both identifiers). Throws when ODP refuses. */
  identify(vuid: string, email: string): Promise<void>;
}

/** ODP, when its key is set (odpPoster); null otherwise (then nobody is known, and the form asks everyone). */
export function odp(): Odp | null {
  const post = odpPoster();
  if (!post) return null;
  return {
    async profile(by) {
      // Variables, never pasted into the query: an email is the visitor's text.
      const [arg, type, value] = 'vuid' in by ? ['vuid', 'String', normalizeVuid(by.vuid)] : ['email', 'String', by.email];
      if (!value) return null;
      const r = await post('/v3/graphql', { query: `query P($v: ${type}!) { customer(${arg}: $v) { ${PROFILE_FIELDS} } }`, variables: { v: value } }, ODP_TIMEOUT_MS);
      if (!r.ok) throw new Error(`ODP answered ${r.status}`);
      const body = (await r.json()) as {
        data?: { customer?: OdpCustomer | null } | null;
        errors?: Array<{ message?: string; extensions?: { code?: string } }>;
      };
      // An identifier ODP has never seen comes back as an error, not as null (probed 17 Nov 2026):
      // INVALID_IDENTIFIER_EXCEPTION, "could not resolve any of the supplied identifiers".
      if (body.errors?.length && !body.data?.customer) {
        if (body.errors.every((e) => e.extensions?.code === 'INVALID_IDENTIFIER_EXCEPTION')) return null;
        throw new Error('ODP answered with errors');
      }
      return body.data?.customer ? contactOfProfile(body.data.customer) : null;
    },
    async identify(vuid, email) {
      const id = normalizeVuid(vuid);
      if (!id) return;
      const r = await post('/v3/profiles', { attributes: { vuid: id, email } }, ODP_TIMEOUT_MS);
      if (!r.ok) throw new Error(`ODP answered ${r.status}`);
    },
  };
}

/* ---------- The submission ---------- */

/**
 * The body the website's server posts for form 1054 (form-submission.ts): the visible fields
 * that have a value, the hidden ones that have one, then FormID, pageURL, queryString,
 * userAgentString, page_key, form_key and PageName. Empty fields are left out, as the website's
 * validation leaves them out.
 */
export function websiteBody(input: {
  contact: Contact;
  tracking: Tracking;
  pageUrl: string;
  query: string;
  userAgent: string;
  pageKey: string | null;
  pageName: string | null;
}): Record<string, string | null> {
  const body: Record<string, string | null> = {};
  const order = ['firstName', 'lastName', 'email', 'company', 'title', 'phone', 'country', 'state', 'Other_Additional_Information__c', 'Marketing_Consent__c'] as const;
  for (const key of order) if (input.contact[key]) body[key] = input.contact[key] as string;
  for (const [key, value] of Object.entries(input.tracking)) if (value) body[key] = value;
  body.FormID = FORM_ID;
  body.pageURL = input.pageUrl;
  if (input.query) body.queryString = input.query;
  if (input.userAgent) body.userAgentString = input.userAgent;
  body.page_key = input.pageKey;
  body.form_key = FORM_KEY;
  body.PageName = input.pageName;
  return body;
}

/** Posts one submission where the website's form posts. Throws on a refusal or no answer, so the visitor is told to try again. */
export async function postToWebsiteForm(url: string, body: Record<string, string | null>): Promise<void> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`form endpoint answered ${r.status}`);
}

/** For the check: forget the pages held. */
export function forgetCtaPages(): void {
  pageHeld.clear();
}
