/**
 * The form on an offer page's CTA (src/lib/cta-form.ts), checked with no network: every fetch is a
 * stand-in (Graph, Limitless, ODP, KV and the website's form endpoint).
 *
 *   a. The rules: the website's work-email rule (gmail refused, a company domain kept), fields
 *      cleaned (unknown keys dropped, a country off the list a problem, a state kept only for its
 *      country, consent only as "yes"), missingOf, the tracking fields read query-first then
 *      cookie, ctaStep, the page marker.
 *   b. withOfferSignup with OFFER_CTA_FORM: unset, the CTA form is never drawn; on, an offer that
 *      chose it gets the marker and NOT the email form (the CTA form wins); one that didn't keeps
 *      the email form as before.
 *   c. POST /api/cta-form: off → 404 and nothing fetched; 405, 415, 403 cross-site; a page that
 *      isn't an offer page, or an offer without the form, 404.
 *        status  unknown visitor → known false; known → missing named, NO values unless the offer
 *                chose "Always show form" (then the visitor's own profile).
 *        lookup  a free mail domain 422; a known email → field names only, never a value; the
 *                browser's ODP id tied to the email; ODP asked with variables, the email never
 *                pasted into the query.
 *        submit  the website's exact body (field order, FormID, form_key, page_key, pageURL with
 *                the query, queryString, userAgentString, PageName) to the website's endpoint;
 *                typed values win over ODP's; consent never from a profile;
 *                still missing → 422 and nothing sent; a filled honeypot → 201 and nothing sent;
 *                the endpoint failing → 502; CTA_FORM_SUBMIT_URL off function.zaius.app → 503
 *                and nothing sent; the 21st lookup a minute from one address → 429.
 *   d. The page: an offer page with the marker draws the same CTA links (the form is a click
 *      handler, not a rewrite); the dev server routes /api/cta-form.
 *
 * Run: `npm run check:cta-form` (scripts/check-cta-form.mjs bundles it).
 */
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  cleanContact,
  cleanTracking,
  ctaFormMarkerOf,
  ctaStep,
  emailProblem,
  FORM_KEY,
  injectCtaForm,
  missingOf,
  REQUIRED,
  trackingOf,
} from '../src/lib/cta-form';
import { CLOSE_TYPENAME } from '../src/lib/offer-signup';
import { optionLabel } from '../src/lib/contact-form-options';
import ctaFormHandler from '../api/cta-form';
import { forgetCtaPages, submitUrl, WEBSITE_SUBMIT_URL } from '../api/_lib/cta-form';
import { forgetSignupForms, withOfferSignup } from '../api/_lib/offer-signup';
import OfferPage from '../src/www/OfferPage';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 600)}`);
  if (!ok) failures++;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

const OFFER = 'acme-workshop';
const HERO_URL = 'https://www.optimizely.com/events/acme/?utm_source=limitless';
const SIGNUP_URL = 'https://www.optimizely.com/events/acme/register';
const el = (component: Record<string, unknown>) => ({ nodeType: 'component', key: `k-${String(component.__typename)}-${Math.random()}`, displaySettings: [], component });
const section = (name: string, elements: ReturnType<typeof el>[]) => ({
  nodeType: 'section',
  key: `s-${name}`,
  displayName: name,
  section: { __typename: 'BlankSection' },
  rows: [{ nodeType: 'row', key: `r-${name}`, columns: [{ nodeType: 'column', key: `c-${name}`, elements }] }],
});
const page = () => ({
  __typename: 'ABMExperience',
  __template: 'abm-experience',
  companyName: 'Acme',
  componentPlan: JSON.stringify({ kind: 'offer-page', offerId: OFFER }),
  composition: {
    key: 'x',
    nodeType: 'experience',
    nodes: [
      section('Hero', [
        el({ __typename: 'ButtonBlock', ButtonText: 'Save your seat', ButtonUrl: HERO_URL, Variant: 'primary' }),
        el({ __typename: 'ButtonBlock', ButtonText: 'Who is Optimizely?', ButtonUrl: '#about', Variant: 'secondary' }),
      ]),
      section('Sign up', [el({ __typename: CLOSE_TYPENAME, Title: 'Save your seat.', Description: 'On 19 November.', ButtonText: 'Register', ScheduleUrl: SIGNUP_URL })]),
    ],
  },
});

const VUID_KNOWN = '0123456789abcdef0123456789abcdef';
const VUID_PARTIAL = 'fedcba9876543210fedcba9876543210';
const VUID_UNKNOWN = '00000000000000000000000000000000';
type Customer = Record<string, string | null>;
const PAT: Customer = { email: 'pat@acme.com', first_name: 'Pat', last_name: 'Lee', company_name: 'Acme', job_title: 'CMO', country: 'United States', state: 'New York' };
const SAM: Customer = { email: 'sam@acme.com', first_name: 'Sam', last_name: 'Ray', company_name: 'Acme', job_title: null, country: 'Narnia', state: null };
const byVuid: Record<string, Customer> = { [VUID_KNOWN]: PAT, [VUID_PARTIAL]: SAM };
const byEmail: Record<string, Customer> = { 'pat@acme.com': PAT, 'sam@acme.com': SAM };

// ─── Stand-in network ─────────────────────────────────────────────────────

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };
let calls: Call[] = [];
let ctaChoice: { on: boolean; alwaysShow: boolean } = { on: true, alwaysShow: false };
let aldusForm: 'link' | 'email' = 'link';
let formEndpoint = 200;
const kvCount = new Map<string, number>();
const graphPages: Record<string, unknown> = {
  '/workshop-acme/': { companyName: 'Acme', componentPlan: JSON.stringify({ offerId: OFFER }), _metadata: { key: 'aaaabbbb-cccc-dddd-eeee-ffff00001111' } },
  '/not-an-offer/': { companyName: 'Acme', componentPlan: null, _metadata: { key: 'x' } },
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const body = typeof init?.body === 'string' ? (() => { try { return JSON.parse(init.body as string); } catch { return init.body; } })() : init?.body;
  const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
  calls.push({ url, method: init?.method ?? 'GET', body, headers });
  if (url.startsWith('https://cg.optimizely.com/')) {
    const slug = (body as { variables?: { slug?: string } })?.variables?.slug ?? '';
    return json({ data: { ABMExperience: { items: graphPages[slug] ? [graphPages[slug]] : [] } } });
  }
  if (url.startsWith('http://aldus.test/')) return json({ form: aldusForm, ctaForm: ctaChoice });
  if (url.startsWith('https://kv.test/')) {
    const commands = body as unknown[][];
    return json(
      commands.map(([cmd, key]) => {
        if (cmd !== 'incr') return { result: 1 };
        const counted = String(key).replace(/:\d{12}$/, '');
        const n = (kvCount.get(counted) ?? 0) + 1;
        kvCount.set(counted, n);
        return { result: n };
      }),
    );
  }
  if (url === 'https://odp.test/v3/graphql') {
    const { query, variables } = body as { query: string; variables: { v: string } };
    const found = /customer\(vuid:/.test(query) ? byVuid[variables.v] : byEmail[variables.v];
    if (!found) return json({ errors: [{ message: 'could not resolve any of the supplied identifiers', extensions: { code: 'INVALID_IDENTIFIER_EXCEPTION' } }], data: { customer: null } });
    return json({ data: { customer: found } });
  }
  if (url === 'https://odp.test/v3/profiles') return json({ title: 'Accepted' }, 202);
  if (url.startsWith('https://function.zaius.app/')) return json({}, formEndpoint);
  throw new Error(`unexpected fetch ${url}`);
}) as typeof fetch;

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
setEnv({
  ALDUS_UI_URL: 'http://aldus.test',
  ALDUS_SHOWCASE_TOKEN: 'showcase-token',
  GRAPH_AUTH_KEY: 'graph-key',
  KV_REST_API_URL: 'https://kv.test',
  KV_REST_API_TOKEN: 'kv-token',
  ODP_PRIVATE_KEY: 'odp-key',
  ODP_API_BASE: 'https://odp.test',
  OFFER_SIGNUP_FORM: undefined,
  OFFER_CTA_FORM: undefined,
  CTA_FORM_SUBMIT_URL: undefined,
});

type Answer = { status: number; body: Record<string, unknown> };
let ipN = 1;
const nextIp = () => `198.51.100.${ipN++}`;
async function post(body: unknown, opts: { method?: string; ip?: string; contentType?: string; site?: string | null } = {}): Promise<Answer> {
  let status = 0;
  let sent: Record<string, unknown> = {};
  const headers: Record<string, string> = {
    'x-forwarded-for': `${opts.ip ?? nextIp()}, 10.0.0.1`,
    host: 'showcase.optimizely.com',
    'content-type': opts.contentType ?? 'application/json',
    'user-agent': 'Mozilla/5.0 (check)',
  };
  if (opts.site !== null) headers['sec-fetch-site'] = opts.site ?? 'same-origin';
  const req = { method: opts.method ?? 'POST', headers, socket: { remoteAddress: '127.0.0.1' }, body } as unknown as VercelRequest;
  const res = {
    setHeader() {
      return res;
    },
    status(code: number) {
      status = code;
      return res;
    },
    json(value: Record<string, unknown>) {
      sent = value;
      return res;
    },
  } as unknown as VercelResponse;
  await ctaFormHandler(req, res);
  return { status, body: sent };
}
const toForm = () => calls.filter((c) => c.url.startsWith('https://function.zaius.app/'));
const toOdp = () => calls.filter((c) => c.url.startsWith('https://odp.test/'));
const reset = () => {
  calls = [];
  forgetCtaPages();
  forgetSignupForms();
};

async function main(): Promise<void> {
  // ─── a. The rules ─────────────────────────────────────────────────────
  console.log('\na. The rules');
  check('a company address passes the website\'s rule', emailProblem('pat@acme.com') === null);
  check('gmail, outlook and proton are refused as not work email', ['a@gmail.com', 'a@outlook.com', 'a@proton.me'].every((e) => emailProblem(e) === 'workEmail'));
  check('"mailchimp.com" passes', emailProblem('a@mailchimp.com') === null);
  check('form 1002\'s rule, not 1054\'s: "mail.com" passes, a domain ending over 7 letters is refused', emailProblem('a@mail.com') === null && emailProblem('a@acme.consulting') === 'workEmail');
  check('no @ is invalid, empty is required', emailProblem('nope') === 'invalidEmail' && emailProblem('  ') === 'required');
  const cleaned = cleanContact({
    firstName: '  Pat  ',
    lastName: 'Lee',
    country: 'United States',
    state: 'Ontario',
    Marketing_Consent__c: 'on',
    evil: 'x',
    company: 'a'.repeat(256),
  });
  check(
    'cleanContact: trimmed, unknown key dropped, a state of another country dropped, consent only as "yes", an over-long value a problem',
    cleaned.values.firstName === 'Pat' && !('evil' in cleaned.values) && !cleaned.values.state && !cleaned.values.Marketing_Consent__c && cleaned.problems.company === 'required',
    cleaned,
  );
  check('cleanContact: a country off the list is a problem', cleanContact({ country: 'Narnia' }).problems.country === 'pickOne');
  check('cleanContact: a Canadian province kept for Canada', cleanContact({ country: 'Canada', state: 'Ontario' }).values.state === 'Ontario');
  check('cleanContact: Québec as form 1002 submits it ("Quebec"), 1054\'s spelling taken too; shown as "Québec"', cleanContact({ country: 'Canada', state: 'Québec' }).values.state === 'Quebec' && cleanContact({ country: 'Canada', state: 'Quebec' }).values.state === 'Quebec' && optionLabel('Quebec') === 'Québec' && optionLabel('Ontario') === 'Ontario');
  check('no phone and no free-text question on form 1002: dropped if sent', JSON.stringify(cleanContact({ phone: '+1 555', Other_Additional_Information__c: 'hi', firstName: 'Pat' }).values) === JSON.stringify({ firstName: 'Pat' }));
  check('cleanContact: a control character refuses the value', cleanContact({ firstName: 'Pat\u0000' }).problems.firstName === 'required');
  check('missingOf: in the form\'s order', JSON.stringify(missingOf({ email: 'pat@acme.com', firstName: 'Pat' })) === JSON.stringify(['lastName', 'company', 'title', 'country']));
  const tracking = trackingOf('?utm_source=linkedin&gclid=g1', 'utm_source=cookie; utm_medium=email; _ga=GA1.2.3; optimizelyEndUserId=oeu1; _mkto_trk=id:947-RKE-048&token:_mch-optimizely.com-1-2');
  check(
    'trackingOf: the query first, then the cookie, under the website\'s field names (Marketo\'s own cookie too)',
    tracking.utm_source === 'linkedin' && tracking.utm_medium === 'email' && tracking.gAID === 'GA1.2.3' && tracking.optimizelyenduserid === 'oeu1' && tracking.Google_Click_ID__c === 'g1' && tracking._mkto_trk === 'id:947-RKE-048&token:_mch-optimizely.com-1-2',
    tracking,
  );
  check('cleanTracking: unknown keys and long values dropped', JSON.stringify(cleanTracking({ utm_source: 'x', evil: 'y', msclkid: 'z'.repeat(201) })) === JSON.stringify({ utm_source: 'x' }));
  const known = { known: true, missing: [] };
  check(
    'ctaStep: known and complete goes through with a background submit; always-show, unknown or incomplete opens the panel; submitted or the CMS preview go through',
    ctaStep({ submitted: false, status: known, alwaysShow: false, preview: false }) === 'submit-through' &&
      ctaStep({ submitted: false, status: known, alwaysShow: true, preview: false }) === 'panel' &&
      ctaStep({ submitted: false, status: { known: false, missing: [...REQUIRED] }, alwaysShow: false, preview: false }) === 'panel' &&
      ctaStep({ submitted: false, status: { known: true, missing: ['title'] }, alwaysShow: false, preview: false }) === 'panel' &&
      ctaStep({ submitted: false, status: null, alwaysShow: false, preview: false }) === 'panel' &&
      ctaStep({ submitted: true, status: null, alwaysShow: false, preview: false }) === 'through' &&
      ctaStep({ submitted: false, status: null, alwaysShow: false, preview: true }) === 'through',
  );
  const marked = injectCtaForm(page(), OFFER, true);
  check('the marker: on an offer page, read back; a person page untouched', JSON.stringify(ctaFormMarkerOf(marked)) === JSON.stringify({ offerId: OFFER, alwaysShow: true }) && ctaFormMarkerOf(page()) === null);
  const person = { ...page(), __typename: 'PersonExperience' };
  check('…a person page comes back as given', injectCtaForm(person, OFFER, false) === person);

  // ─── b. withOfferSignup ───────────────────────────────────────────────
  console.log('\nb. withOfferSignup');
  reset();
  aldusForm = 'email';
  const p0 = page();
  check('OFFER_CTA_FORM and OFFER_SIGNUP_FORM unset: nothing asked, the page as it was', (await withOfferSignup(p0)) === p0 && calls.length === 0);
  setEnv({ OFFER_CTA_FORM: 'on', OFFER_SIGNUP_FORM: 'on' });
  reset();
  const shown = (await withOfferSignup(page())) as ReturnType<typeof page> & { CtaForm?: unknown };
  const closeOf = (p: ReturnType<typeof page>) => p.composition.nodes[1].rows[0].columns[0].elements[0].component as Record<string, unknown>;
  check('both on, the offer chose both: the CTA form marker, and NOT the email form (the CTA form wins)', !!shown.CtaForm && !closeOf(shown).SignupOfferId, { marker: shown.CtaForm, close: closeOf(shown) });
  ctaChoice = { on: false, alwaysShow: false };
  reset();
  const emailOnly = (await withOfferSignup(page())) as ReturnType<typeof page> & { CtaForm?: unknown };
  check('the CTA form off: the email form as before, no marker', !emailOnly.CtaForm && closeOf(emailOnly).SignupOfferId === OFFER);
  setEnv({ OFFER_SIGNUP_FORM: undefined });
  ctaChoice = { on: true, alwaysShow: false };
  aldusForm = 'link';
  reset();

  // ─── c. POST /api/cta-form ────────────────────────────────────────────
  console.log('\nc. POST /api/cta-form');
  setEnv({ OFFER_CTA_FORM: undefined });
  let answer = await post({ step: 'status', route: '/vb/workshop-acme', vuid: VUID_KNOWN });
  check('OFFER_CTA_FORM unset: 404 and nothing fetched (no such endpoint)', answer.status === 404 && calls.length === 0);
  setEnv({ OFFER_CTA_FORM: 'on' });
  check('GET: 405', (await post(undefined, { method: 'GET' })).status === 405);
  check('text/plain: 415', (await post('{}', { contentType: 'text/plain' })).status === 415);
  check('another site: 403', (await post({ step: 'status', route: '/vb/workshop-acme' }, { site: 'cross-site' })).status === 403);
  check('an unknown step: 400', (await post({ step: 'export', route: '/vb/workshop-acme' })).status === 400);
  check('a route outside /vb/: 400', (await post({ step: 'status', route: '/acme/' })).status === 400);
  check('a page that names no offer: 404', (await post({ step: 'status', route: '/vb/not-an-offer', vuid: VUID_KNOWN })).status === 404);
  check('no such page: 404', (await post({ step: 'status', route: '/vb/nowhere', vuid: VUID_KNOWN })).status === 404);
  ctaChoice = { on: false, alwaysShow: false };
  reset();
  answer = await post({ step: 'lookup', route: '/vb/workshop-acme', email: 'pat@acme.com' });
  check('an offer without the form: 404, and ODP never asked', answer.status === 404 && toOdp().length === 0, answer);
  ctaChoice = { on: true, alwaysShow: false };
  reset();

  // status
  answer = await post({ step: 'status', route: '/vb/workshop-acme', vuid: VUID_UNKNOWN });
  check('status: an unknown visitor → known false, every required field', answer.status === 200 && answer.body.known === false && (answer.body.missing as string[]).length === REQUIRED.length, answer);
  answer = await post({ step: 'status', route: '/vb/workshop-acme', vuid: VUID_KNOWN });
  check('status: a known, complete visitor → known, nothing missing, NO values', answer.body.known === true && (answer.body.missing as string[]).length === 0 && !('prefill' in answer.body) && !JSON.stringify(answer.body).includes('Pat'), answer);
  answer = await post({ step: 'status', route: '/vb/workshop-acme', vuid: VUID_PARTIAL });
  check('status: known but incomplete → names the fields (a country off the list counts as missing), no values', JSON.stringify(answer.body.missing) === JSON.stringify(['title', 'country']) && !JSON.stringify(answer.body).includes('Sam'), answer);
  ctaChoice = { on: true, alwaysShow: true };
  reset();
  answer = await post({ step: 'status', route: '/vb/workshop-acme', vuid: VUID_KNOWN });
  const prefill = answer.body.prefill as Record<string, string> | undefined;
  check('status with "Always show form": the visitor\'s own profile to fill the form in', prefill?.firstName === 'Pat' && prefill?.email === 'pat@acme.com' && prefill?.state === 'New York', answer);
  ctaChoice = { on: true, alwaysShow: false };
  reset();

  // lookup
  answer = await post({ step: 'lookup', route: '/vb/workshop-acme', email: 'pat@gmail.com' });
  check('lookup: a free mail address 422, ODP never asked', answer.status === 422 && (answer.body.problems as Record<string, string>).email === 'workEmail' && toOdp().length === 0, answer);
  reset();
  answer = await post({ step: 'lookup', route: '/vb/workshop-acme', email: 'Sam@Acme.com', vuid: VUID_UNKNOWN });
  const gql = toOdp().find((c) => c.url.endsWith('/graphql'))?.body as { query: string; variables: { v: string } };
  check('lookup: a known email → field names only, never a value', answer.status === 200 && JSON.stringify(answer.body) === JSON.stringify({ missing: ['title', 'country'] }), answer);
  check('…ODP asked with a variable, the email never in the query text', gql?.variables.v === 'sam@acme.com' && !gql.query.includes('sam@acme.com'), gql);
  const tie = toOdp().find((c) => c.url.endsWith('/profiles'));
  check('…the browser\'s ODP id tied to the email', JSON.stringify(tie?.body) === JSON.stringify({ attributes: { vuid: VUID_UNKNOWN, email: 'sam@acme.com' } }) && tie?.headers['x-api-key'] === 'odp-key', tie);
  answer = await post({ step: 'lookup', route: '/vb/workshop-acme', email: 'new@acme.com' });
  check('lookup: an email ODP has never seen → everything but the email', JSON.stringify(answer.body.missing) === JSON.stringify(REQUIRED.filter((k) => k !== 'email')), answer);

  // submit
  reset();
  answer = await post({ step: 'submit', route: '/vb/workshop-acme', query: '?utm_source=linkedin', vuid: VUID_KNOWN, fields: {}, tracking: { utm_source: 'linkedin', gAID: 'GA1.2.3', _mkto_trk: 'id:947-RKE-048&token:_mch-optimizely.com-1-2', evil: 'x' } });
  const sent = toForm()[0];
  const expected = {
    firstName: 'Pat',
    lastName: 'Lee',
    email: 'pat@acme.com',
    company: 'Acme',
    title: 'CMO',
    country: 'United States',
    state: 'New York',
    _mkto_trk: 'id:947-RKE-048&token:_mch-optimizely.com-1-2',
    gAID: 'GA1.2.3',
    utm_source: 'linkedin',
    FormID: '1002',
    pageURL: 'https://showcase.optimizely.com/vb/workshop-acme?utm_source=linkedin',
    queryString: '?utm_source=linkedin',
    userAgentString: 'Mozilla/5.0 (check)',
    page_key: 'aaaabbbbccccddddeeeeffff00001111',
    form_key: FORM_KEY,
    PageName: 'Acme',
  };
  check('submit, a known visitor: 201, one POST to the website\'s form endpoint', answer.status === 201 && toForm().length === 1 && sent.url === WEBSITE_SUBMIT_URL && sent.method === 'POST', answer);
  check('…the website\'s exact body, in its order, no consent (the visitor never gave it), no unknown tracking key', JSON.stringify(sent?.body) === JSON.stringify(expected), sent?.body);
  check('…as JSON, with no key of ours', sent?.headers['content-type'] === 'application/json' && !('x-api-key' in (sent?.headers ?? {})) && !('authorization' in (sent?.headers ?? {})));
  reset();
  answer = await post({
    step: 'submit',
    route: '/vb/workshop-acme',
    email: 'sam@acme.com',
    fields: { title: 'VP Marketing', country: 'United Kingdom', firstName: 'Samuel', Marketing_Consent__c: 'yes' },
    tracking: {},
  });
  const merged = toForm()[0]?.body as Record<string, string>;
  check(
    'submit by email: ODP fills what wasn\'t typed, typed values win, consent as typed',
    answer.status === 201 && merged.firstName === 'Samuel' && merged.lastName === 'Ray' && merged.title === 'VP Marketing' && merged.country === 'United Kingdom' && merged.Marketing_Consent__c === 'yes' && merged.email === 'sam@acme.com',
    merged,
  );
  reset();
  answer = await post({ step: 'submit', route: '/vb/workshop-acme', email: 'sam@acme.com', fields: { title: 'VP' }, tracking: {} });
  check('submit still missing something: 422 naming it, nothing sent', answer.status === 422 && JSON.stringify(answer.body.missing) === JSON.stringify(['country']) && toForm().length === 0, answer);
  answer = await post({ step: 'submit', route: '/vb/workshop-acme', email: 'sam@gmail.com', fields: {}, tracking: {} });
  check('submit with a free mail address: 422, nothing sent', answer.status === 422 && toForm().length === 0, answer);
  reset();
  answer = await post({ step: 'submit', route: '/vb/workshop-acme', email: 'pat@acme.com', fields: {}, tracking: {}, website: 'http://spam' });
  check('a filled honeypot: 201 and nothing sent anywhere', answer.status === 201 && toForm().length === 0 && toOdp().length === 0, answer);
  formEndpoint = 500;
  answer = await post({ step: 'submit', route: '/vb/workshop-acme', vuid: VUID_KNOWN, fields: {}, tracking: {} });
  check('the website\'s endpoint failing: 502, so the visitor is told to try again', answer.status === 502, answer);
  formEndpoint = 200;
  setEnv({ CTA_FORM_SUBMIT_URL: 'https://evil.example/collect' });
  reset();
  answer = await post({ step: 'submit', route: '/vb/workshop-acme', vuid: VUID_KNOWN, fields: {}, tracking: {} });
  check('CTA_FORM_SUBMIT_URL off function.zaius.app: 503 and nothing sent', answer.status === 503 && calls.every((c) => !c.url.includes('evil.example')), answer);
  setEnv({ CTA_FORM_SUBMIT_URL: undefined });
  check(
    'submitUrl: the website\'s by default; only https on function.zaius.app otherwise',
    submitUrl(undefined) === WEBSITE_SUBMIT_URL &&
      submitUrl('https://function.zaius.app/x/y') === 'https://function.zaius.app/x/y' &&
      submitUrl('http://function.zaius.app/x') === null &&
      submitUrl('https://function.zaius.app.evil.example/x') === null &&
      submitUrl('https://user:pw@function.zaius.app/x') === null,
  );
  reset();
  const ip = '203.0.113.99';
  const statuses: number[] = [];
  for (let i = 0; i < 21; i++) statuses.push((await post({ step: 'lookup', route: '/vb/workshop-acme', email: `p${i}@acme.com` }, { ip })).status);
  check('the 21st lookup in a minute from one address: 429', statuses.slice(0, 20).every((s) => s === 200) && statuses[20] === 429, statuses);
  kvCount.clear();

  // ─── d. The page ──────────────────────────────────────────────────────
  console.log('\nd. The page');
  const plainHtml = renderToString(<OfferPage experience={page()} />);
  const markedHtml = renderToString(<OfferPage experience={injectCtaForm(page(), OFFER, false)} />);
  const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).join(' ');
  check('with the marker, the same CTA links (the form is a click handler, not a rewrite)', hrefs(markedHtml) === hrefs(plainHtml) && markedHtml.includes(HERO_URL.replace(/&/g, '&amp;')) && markedHtml.includes(SIGNUP_URL));
  check('…and no form in the server HTML (the panel opens on a click)', !markedHtml.includes('data-cta-form'));
  const vite = readFileSync('vite.config.ts', 'utf-8');
  check('the dev server routes /api/cta-form to the function', vite.includes(`[/^\\/api\\/cta-form$/, '/api/cta-form.ts']`));
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(() => {
    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  });
