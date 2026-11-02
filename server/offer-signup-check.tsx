/**
 * The email form on an offer page (src/lib/offer-signup.ts), checked with no network: every
 * fetch is a stand-in, and the env is the check's own.
 *
 *   a. injectSignupForm on a page shaped like the offer blueprint (the hero's main button and
 *      its #about button, the close band's AbmClosingCtaElement): the close gets the offer, the
 *      hero's main button goes to #signup, #about stays; the input is untouched; twice is
 *      once (a hero with a second outside button keeps it); a page with no close band and a
 *      person page come back as they were. Control: an injector that rewrites every button is
 *      caught.
 *   b. AbmClosingCtaElement rendered on the server: with the offer, a form (id="signup", one
 *      email field, the band's button text on submit, method="post", the privacy line and its
 *      link) and no link to the sign-up URL; without it (control) today's link and no form;
 *      a stroke band's form still renders its ring.
 *   c. withOfferSignup: OFFER_SIGNUP_FORM unset asks nothing and leaves every page as it was
 *      (production with nothing new set); on, "email" from Limitless puts the form in, "link"
 *      doesn't; an answer held 30 s (no second ask), a failure only 5 s; Limitless unset asks
 *      nothing; an error or a slow answer leaves the page as it was and serves it with a 10 s
 *      edge cache (signupCacheControl; an answer keeps the usual one); a person page asks
 *      nothing.
 *   d. POST /api/offer-signup with stand-in Graph, Limitless, KV and webhooks: OFFER_SIGNUP_FORM
 *      unset 404; GET 405; a text/plain body (another site's no-cors post) 415 and another
 *      site's post (Sec-Fetch-Site) 403, nothing forwarded, while no Sec-Fetch-Site (curl, an
 *      old browser) is let through; a body that doesn't parse 400; a filled honeypot 200 and
 *      nothing forwarded; a bad email or route 400; a page of another offer 404, nothing
 *      forwarded; a good one 201 with exactly one POST to Limitless, with its token, carrying
 *      the page's account even when the form claims another; an offer whose pages link out
 *      (Limitless 409) 200 and no webhook; webhooks (when set) each get email, utm_* and
 *      campaign_id, and one answering 500 still gives 201; campaign_id empty when the offer
 *      has none, never the visitor's utm_campaign; Limitless failing 502; ten colleagues from
 *      one address all 201, the 31st from it in a minute 429, the 4th of one email 429 from
 *      any address; with KV unset no limit; over 4 KB 413.
 *   e. The wiring, read from the source: api/content.ts, server/ssr-handler.tsx
 *      (fetchExperienceContent) and the dev proxy in vite.config.ts each pass the experience
 *      through withOfferSignup, and the first two serve it with signupCacheControl; the form
 *      posts through postSignup with the page's location; the endpoint it posts to is the
 *      file Vercel serves there, and the dev server routes it to that file.
 *   f. postSignup, against a stand-in fetch: one JSON POST to /api/offer-signup with the
 *      page's path as the route and its utm_* values; 201 is done; 400 saying the email is
 *      invalid is "invalid", any other 400, a 502 or no answer is "error" (a good email is
 *      never told it's wrong).
 *
 * Mutations run by hand (each turned it red, then restored and compared with cmp): the wraps
 * taken out of api/content.ts and server/ssr-handler.tsx (e), the form posting to another
 * path (e, f), campaign_id falling back to utm_campaign (d), the Sec-Fetch-Site rule taken out
 * (d), the OFFER_SIGNUP_FORM gate taken out (c, d), the per-address limit back to 5 (d), a
 * failure held 30 s (c), any 400 read as "invalid" (f).
 *
 * Run: `npm run check:signup` (scripts/check-offer-signup.mjs bundles it). Under server/ so
 * `npm run typecheck:server` type-checks it with the api/ files it imports; nothing deploys it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import AbmClosingCtaElement from '../src/cms/components/abm-closing-cta-element';
import { CLOSE_TYPENAME, injectSignupForm, postSignup, PRIVACY_URL, SIGNUP_ENDPOINT, SIGNUP_WORDS } from '../src/lib/offer-signup';
import signupHandler from '../api/offer-signup';
import { forgetSignupForms, signupCacheControl, UNSURE_CACHE_CONTROL, withOfferSignup } from '../api/_lib/offer-signup';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
  if (!ok) failures++;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

const OFFER = 'acme-workshop';
const SIGNUP_URL = 'https://www.optimizely.com/events/acme/?utm_source=limitless&utm_content=close';
const HERO_URL = 'https://www.optimizely.com/events/acme/?utm_source=limitless&utm_content=hero';
const el = (component: Record<string, unknown>) => ({ nodeType: 'component', key: `k-${String(component.__typename)}-${Math.random()}`, displaySettings: [], component });
const section = (name: string, elements: ReturnType<typeof el>[]) => ({
  nodeType: 'section',
  key: `s-${name}`,
  displayName: name,
  section: { __typename: 'BlankSection' },
  rows: [{ nodeType: 'row', key: `r-${name}`, columns: [{ nodeType: 'column', key: `c-${name}`, elements }] }],
});
const hero = (extra: ReturnType<typeof el>[] = []) =>
  section('Hero', [
    el({ __typename: 'StackedHeadingElement', Heading: 'A workshop for Acme' }),
    el({ __typename: 'ButtonBlock', ButtonText: 'Save your seat', ButtonUrl: HERO_URL, Variant: 'primary' }),
    el({ __typename: 'ButtonBlock', ButtonText: 'Who is Optimizely?', ButtonUrl: '#about', Variant: 'secondary' }),
    ...extra,
  ]);
const close = section('Sign up', [
  el({ __typename: CLOSE_TYPENAME, Title: 'Save your seat.', Description: 'On 19 November.', ButtonText: 'Save your seat', ScheduleUrl: SIGNUP_URL }),
]);
const page = (sections: unknown[], typeName = 'ABMExperience') => ({
  __typename: typeName,
  __template: 'abm-experience',
  companyName: 'Acme',
  componentPlan: JSON.stringify({ kind: 'offer-page', offerId: OFFER }),
  composition: { key: 'x', nodeType: 'experience', nodes: sections },
});
type Page = ReturnType<typeof page>;
const components = (p: Page) =>
  (p.composition.nodes as Array<ReturnType<typeof section>>).flatMap((s) => s.rows.flatMap((r) => r.columns.flatMap((c) => c.elements.map((e) => e.component as Record<string, unknown>))));
const buttons = (p: Page) => components(p).filter((c) => c.__typename === 'ButtonBlock');
const closeOf = (p: Page) => components(p).find((c) => c.__typename === CLOSE_TYPENAME);

// ─── a. injectSignupForm ──────────────────────────────────────────────────
console.log('\na. injectSignupForm');
const base = page([hero(), section('Who is Optimizely?', [el({ __typename: 'TextContentElement', Body: 'x' })]), close]);
const frozen = JSON.stringify(base);
const once = injectSignupForm(base, OFFER);
check('the close band gets the offer', closeOf(once)?.SignupOfferId === OFFER, closeOf(once));
check("the hero's main button goes to #signup", buttons(once)[0]?.ButtonUrl === '#signup', buttons(once));
check('#about stays', buttons(once)[1]?.ButtonUrl === '#about');
check('the input is untouched', JSON.stringify(base) === frozen);
check('twice is once', JSON.stringify(injectSignupForm(once, OFFER)) === JSON.stringify(once));
const twoOut = page([hero([el({ __typename: 'ButtonBlock', ButtonText: 'Agenda', ButtonUrl: 'https://example.com/agenda' })]), close]);
const twoOnce = injectSignupForm(twoOut, OFFER);
check(
  'a hero with a second outside button keeps it, run once or twice',
  buttons(twoOnce)[2]?.ButtonUrl === 'https://example.com/agenda' && JSON.stringify(injectSignupForm(twoOnce, OFFER)) === JSON.stringify(twoOnce),
  buttons(injectSignupForm(twoOnce, OFFER)),
);
const noClose = page([hero()]);
check('a page with no close band comes back as it was (no hero pointing nowhere)', injectSignupForm(noClose, OFFER) === noClose && buttons(noClose)[0]?.ButtonUrl === HERO_URL);
const person = page([hero(), close], 'PersonExperience');
check('a person page comes back as it was', injectSignupForm(person, OFFER) === person);
// Control: an injector that rewrites every button would send #about to the form too.
const everyButton = structuredClone(base);
for (const b of buttons(everyButton)) b.ButtonUrl = '#signup';
check('control: rewriting every button is caught (#about)', buttons(everyButton)[1]?.ButtonUrl !== '#about');

// ─── b. The close band, rendered ──────────────────────────────────────────
console.log('\nb. The close band, rendered');
const props = { Title: 'Save your seat.', Description: 'On 19 November.', ButtonText: 'Save your seat', ScheduleUrl: SIGNUP_URL };
const withForm = renderToString(<AbmClosingCtaElement {...props} SignupOfferId={OFFER} />);
const linkOnly = renderToString(<AbmClosingCtaElement {...props} />);
const escapedUrl = SIGNUP_URL.replace(/&/g, '&amp;');
check('with the offer: the form, at #signup', /id="signup"/.test(withForm) && /<form[^>]*method="post"/.test(withForm));
check('…one email field and its label', (withForm.match(/type="email"/g) ?? []).length === 1 && withForm.includes(SIGNUP_WORDS.label));
check("…the band's button text on submit", /<button[^>]*type="submit"[^>]*>Save your seat<\/button>/.test(withForm), withForm.match(/<button[^>]*>[^<]*<\/button>/g));
check('…the privacy line and its link', withForm.includes(SIGNUP_WORDS.privacy.replace("'", '&#x27;')) && withForm.includes(`href="${PRIVACY_URL}"`));
check('…and no link to the sign-up URL', !withForm.includes(escapedUrl) && !withForm.includes(SIGNUP_URL));
check('control: without it, today\'s link and no form', linkOnly.includes(`href="${escapedUrl}"`) && !linkOnly.includes('<form') && !linkOnly.includes('data-offer-signup'));
const strokeForm = renderToString(<AbmClosingCtaElement {...props} SignupOfferId={OFFER} displaySettings={[{ key: 'buttonVariant', value: 'whiteStroke' }] as never} />);
const strokeLink = renderToString(<AbmClosingCtaElement {...props} displaySettings={[{ key: 'buttonVariant', value: 'whiteStroke' }] as never} />);
const formPart = (html: string) => html.slice(Math.max(0, html.indexOf('<form')));
check(
  "a stroke band's form keeps the band's ring around its button",
  formPart(strokeForm).includes('group/stroke') && !formPart(withForm).includes('group/stroke') && strokeLink.includes('group/stroke'),
);

// ─── Stand-ins for the network ───────────────────────────────────────────

type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };
let calls: Call[] = [];
let aldusForm: 'link' | 'email' | 'throw' | 'slow' = 'link';
let aldusPost: number = 201;
let aldusCampaign: string | null = '701CAMPAIGN';
let endpointAnswer: { status: number; body: unknown } | 'throw' = { status: 201, body: { ok: true } };
const kvCount = new Map<string, number>();
const graphPages: Record<string, unknown> = {
  '/workshop-acme/': { companyName: 'Acme', brandDomain: 'acme.com', componentPlan: JSON.stringify({ offerId: OFFER }) },
  '/other-offer-page/': { companyName: 'Other', brandDomain: 'other.com', componentPlan: JSON.stringify({ offerId: 'another-offer' }) },
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
  calls.push({ url, method: init?.method ?? 'GET', body, headers });
  if (url.startsWith('https://cg.optimizely.com/')) {
    const slug = (body as { variables?: { slug?: string } })?.variables?.slug ?? '';
    return json({ data: { ABMExperience: { items: graphPages[slug] ? [graphPages[slug]] : [] } } });
  }
  if (url.startsWith('https://kv.test/')) {
    const commands = body as unknown[][];
    return json(
      commands.map(([cmd, key]) => {
        if (cmd === 'incr') {
          // Counted per address or email whatever the minute, so a run across a minute's turn counts the same.
          const counted = String(key).replace(/:\d{12}$/, '');
          const n = (kvCount.get(counted) ?? 0) + 1;
          kvCount.set(counted, n);
          return { result: n };
        }
        return { result: 1 };
      }),
    );
  }
  if (url.startsWith('http://aldus.test/')) {
    if ((init?.method ?? 'GET') === 'GET') {
      if (aldusForm === 'throw') return json({ error: 'down' }, 500);
      if (aldusForm === 'slow') {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, 3000);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new DOMException('aborted', 'TimeoutError'));
          });
        });
        return json({ form: 'email' });
      }
      return json({ form: aldusForm });
    }
    if (aldusPost === 409) return json({ error: "This offer's pages link out, so it takes no sign-ups.", kept: false }, 409);
    return aldusPost === 201 ? json({ ok: true, campaignId: aldusCampaign }, 201) : json({ error: 'nope' }, aldusPost);
  }
  if (url === SIGNUP_ENDPOINT) {
    if (endpointAnswer === 'throw') throw new TypeError('Failed to fetch');
    return json(endpointAnswer.body, endpointAnswer.status);
  }
  if (url.startsWith('https://hooks.test/fail')) return json({}, 500);
  if (url.startsWith('https://hooks.test/')) return json({ ok: true });
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
  OFFER_SIGNUP_FORM: undefined,
  OFFER_SIGNUP_WEBHOOKS: undefined,
});
const NORMAL_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';
/** Runs `fn` with the clock `ms` ahead, for the holds. */
async function later<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  const real = Date.now;
  Date.now = () => real() + ms;
  try {
    return await fn();
  } finally {
    Date.now = real;
  }
}

async function main(): Promise<void> {
// ─── c. withOfferSignup ───────────────────────────────────────────────────
console.log('\nc. withOfferSignup');
const pageC = page([hero(), close]);
forgetSignupForms();
calls = [];
aldusForm = 'email';
check(
  'OFFER_SIGNUP_FORM unset: nothing asked, the page as it was, the usual cache (production with nothing new set)',
  (await withOfferSignup(pageC)) === pageC && calls.length === 0 && signupCacheControl(pageC, NORMAL_CACHE) === NORMAL_CACHE,
  calls,
);
setEnv({ OFFER_SIGNUP_FORM: 'yes' });
check('…and only "on" turns it on', (await withOfferSignup(pageC)) === pageC && calls.length === 0);
setEnv({ OFFER_SIGNUP_FORM: 'on' });
const shown = await withOfferSignup(pageC);
check('on, "email" from Limitless puts the form in', closeOf(shown)?.SignupOfferId === OFFER && calls.length === 1 && calls[0].url === `http://aldus.test/api/machine/showcase/offers/${OFFER}/signup`, calls);
check('…asked with the showcase token', calls[0]?.headers.authorization === 'Bearer showcase-token');
check('…served with the usual cache', signupCacheControl(shown, NORMAL_CACHE) === NORMAL_CACHE);
aldusForm = 'link';
const held = await withOfferSignup(pageC);
check('an answer held: no second ask, still the form', calls.length === 1 && closeOf(held)?.SignupOfferId === OFFER);
const held29 = await later(29_000, () => withOfferSignup(pageC));
const asked31 = await later(31_000, () => withOfferSignup(pageC));
check('…for 30 s: still held at 29 s, asked again at 31 s ("link" now)', closeOf(held29)?.SignupOfferId === OFFER && asked31 === pageC && calls.length === 2, calls.length);
forgetSignupForms();
check('"link" leaves the page as it was', (await withOfferSignup(pageC)) === pageC);
forgetSignupForms();
calls = [];
setEnv({ ALDUS_UI_URL: undefined });
check('Limitless unset here: the page as it was, nothing asked', (await withOfferSignup(pageC)) === pageC && calls.length === 0);
setEnv({ ALDUS_UI_URL: 'http://aldus.test' });
forgetSignupForms();
calls = [];
aldusForm = 'throw';
const failedPage = page([hero(), close]);
check('an error leaves the page as it was', (await withOfferSignup(failedPage)) === failedPage);
check('…served with a 10 s edge cache, so the next request asks again', signupCacheControl(failedPage, NORMAL_CACHE) === UNSURE_CACHE_CONTROL && UNSURE_CACHE_CONTROL === 'public, s-maxage=10');
aldusForm = 'email';
const failHeld = await later(4_000, () => withOfferSignup(page([hero(), close])));
const failAsked = await later(6_000, () => withOfferSignup(page([hero(), close])));
check(
  'a failure held only 5 s: the link at 4 s with no second ask, asked again at 6 s ("email" now)',
  closeOf(failHeld)?.SignupOfferId === undefined && closeOf(failAsked)?.SignupOfferId === OFFER && calls.length === 2,
  calls.length,
);
forgetSignupForms();
aldusForm = 'slow';
const started = Date.now();
const slow = await withOfferSignup(pageC);
check('a slow answer is given up at 1.5 s, the page as it was', slow === pageC && Date.now() - started < 2500, Date.now() - started);
forgetSignupForms();
calls = [];
check('a person page asks nothing', (await withOfferSignup(page([hero(), close], 'PersonExperience'))).__typename === 'PersonExperience' && calls.length === 0);

// ─── d. POST /api/offer-signup ────────────────────────────────────────────
console.log('\nd. POST /api/offer-signup');
type Answer = { status: number; body: Record<string, unknown> };
type PostOpts = { method?: string; ip?: string; contentType?: string; site?: string | null; bodyThrows?: boolean };
async function post(body: unknown, opts: PostOpts = {}): Promise<Answer> {
  let status = 0;
  let sent: Record<string, unknown> = {};
  const headers: Record<string, string> = {
    'x-forwarded-for': `${opts.ip ?? '203.0.113.7'}, 10.0.0.1`,
    host: 'showcase.optimizely.com',
    'content-type': opts.contentType ?? 'application/json',
  };
  // What a browser sends for the form's fetch; null leaves it out (curl, an older browser).
  if (opts.site !== null) headers['sec-fetch-site'] = opts.site ?? 'same-origin';
  const req = {
    method: opts.method ?? 'POST',
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as VercelRequest;
  Object.defineProperty(req, 'body', {
    get() {
      if (opts.bodyThrows) throw new Error('Invalid JSON');
      return body;
    },
  });
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
  await signupHandler(req, res);
  return { status, body: sent };
}
const GOOD = { offerId: OFFER, route: '/vb/workshop-acme', email: 'Pat@Acme.com', website: '', utm: { source: 'linkedin', campaign: 'fall' }, account: 'Evil Corp' };
const toAldus = () => calls.filter((c) => c.url.startsWith('http://aldus.test/') && c.method === 'POST');
const toHooks = () => calls.filter((c) => c.url.startsWith('https://hooks.test/'));
let ip = 1;
const nextIp = () => `198.51.100.${ip++}`;

setEnv({ OFFER_SIGNUP_FORM: undefined });
calls = [];
let answer = await post(GOOD, { ip: nextIp() });
check('OFFER_SIGNUP_FORM unset: 404, nothing read or forwarded (no such endpoint, as before)', answer.status === 404 && calls.length === 0, answer);
setEnv({ OFFER_SIGNUP_FORM: 'on' });
check('GET: 405', (await post(undefined, { method: 'GET' })).status === 405);
answer = await post(JSON.stringify(GOOD), { contentType: 'text/plain;charset=UTF-8', ip: nextIp() });
check("a text/plain body (another site's no-cors post): 415, nothing forwarded", answer.status === 415 && calls.length === 0, answer);
answer = await post(GOOD, { site: 'cross-site', ip: nextIp() });
check("another site's post (Sec-Fetch-Site cross-site): 403, nothing forwarded", answer.status === 403 && calls.length === 0, answer);
answer = await post(GOOD, { site: 'same-site', ip: nextIp() });
check('…same-site (another subdomain) too: 403', answer.status === 403 && calls.length === 0, answer);
answer = await post(undefined, { bodyThrows: true, ip: nextIp() });
check("a JSON body that doesn't parse: 400", answer.status === 400 && answer.body.error === SIGNUP_WORDS.error && calls.length === 0, answer);
answer = await post({ ...GOOD, website: 'https://spam.example' }, { ip: nextIp() });
check('a filled honeypot: 200, nothing forwarded', answer.status === 200 && toAldus().length === 0 && calls.every((c) => !c.url.includes('cg.optimizely.com')), calls);
for (const [why, body] of [
  ['no @', { ...GOOD, email: 'pat.acme.com' }],
  ['no email', { ...GOOD, email: undefined }],
  ['a route outside /vb/', { ...GOOD, route: '/workshop-acme' }],
  ['an offer id with a slash', { ...GOOD, offerId: '../x' }],
] as const) {
  answer = await post(body, { ip: nextIp() });
  check(`${why}: 400`, answer.status === 400 && toAldus().length === 0, answer);
}
answer = await post({ ...GOOD, email: 'other@acme.com', route: '/vb/other-offer-page' }, { ip: nextIp() });
check("a page of another offer: 404, nothing forwarded", answer.status === 404 && toAldus().length === 0, answer);
answer = await post({ ...GOOD, email: 'nopage@acme.com', route: '/vb/no-such-page' }, { ip: nextIp() });
check('no such page: 404', answer.status === 404 && toAldus().length === 0, answer);
calls = [];
answer = await post(GOOD, { ip: nextIp() });
const forwarded = toAldus();
check('a good one: 201', answer.status === 201 && answer.body.ok === true, answer);
check(
  "…exactly one POST to Limitless, with its token, carrying the page's account and not the form's",
  forwarded.length === 1 &&
    forwarded[0].url === `http://aldus.test/api/machine/showcase/offers/${OFFER}/signup` &&
    forwarded[0].headers.authorization === 'Bearer showcase-token' &&
    JSON.stringify(forwarded[0].body) ===
      JSON.stringify({ email: 'pat@acme.com', route: '/vb/workshop-acme', account: 'Acme', domain: 'acme.com', utm: { source: 'linkedin', campaign: 'fall' } }),
  forwarded,
);
check('…and no webhook while OFFER_SIGNUP_WEBHOOKS is unset', toHooks().length === 0);
calls = [];
answer = await post({ ...GOOD, email: 'curl@acme.com' }, { site: null, ip: nextIp() });
check('no Sec-Fetch-Site (curl, an older browser): let through, 201', answer.status === 201 && toAldus().length === 1, answer);

setEnv({ OFFER_SIGNUP_WEBHOOKS: 'https://hooks.test/sheet, https://hooks.test/fail , http://insecure.test/x, not a url' });
calls = [];
answer = await post(GOOD, { ip: nextIp() });
const hooks = toHooks();
const hookBody = hooks[0]?.body as Record<string, unknown> | undefined;
check('webhooks set: 201 even with one answering 500', answer.status === 201, answer);
check('…each https one posted once, the http one and the junk skipped', hooks.length === 2 && hooks.every((h) => h.method === 'POST'), hooks.map((h) => h.url));
check(
  "…with optimizely.com forms' field names, utm_* and the campaign id",
  hookBody?.email === 'pat@acme.com' &&
    hookBody?.PageName === 'Acme' &&
    hookBody?.pageURL === 'https://showcase.optimizely.com/vb/workshop-acme' &&
    hookBody?.page_key === '/vb/workshop-acme' &&
    hookBody?.offer_id === OFFER &&
    hookBody?.campaign_id === '701CAMPAIGN' &&
    hookBody?.utm_source === 'linkedin' &&
    hookBody?.utm_campaign === 'fall' &&
    hookBody?.utm_medium === '',
  hookBody,
);
aldusCampaign = null;
calls = [];
answer = await post({ ...GOOD, email: 'nocampaign@acme.com' }, { ip: nextIp() });
const noCampaign = toHooks()[0]?.body as Record<string, unknown> | undefined;
check(
  "an offer with no conversion campaign: campaign_id empty, never the visitor's utm_campaign (that rides as utm_campaign)",
  answer.status === 201 && noCampaign?.campaign_id === '' && noCampaign?.utm_campaign === 'fall',
  noCampaign,
);
aldusCampaign = '701CAMPAIGN';
aldusPost = 409;
calls = [];
answer = await post({ ...GOOD, email: 'late@acme.com' }, { ip: nextIp() });
check("an offer whose pages link out (Limitless 409): 200 as a bot's, no webhook", answer.status === 200 && answer.body.ok === true && toAldus().length === 1 && toHooks().length === 0, answer);
aldusPost = 201;
setEnv({ OFFER_SIGNUP_WEBHOOKS: undefined });

aldusPost = 500;
calls = [];
answer = await post(GOOD, { ip: nextIp() });
check('Limitless failing: 502, and the form says try again', answer.status === 502 && answer.body.error === SIGNUP_WORDS.error && toHooks().length === 0, answer);
aldusPost = 201;

kvCount.clear();
const office = nextIp();
const colleagues: number[] = [];
for (let i = 0; i < 10; i++) colleagues.push((await post({ ...GOOD, email: `person${i}@acme.com` }, { ip: office })).status);
check('ten colleagues behind one office address in a minute: all 201', colleagues.every((s) => s === 201), colleagues);
const busy: number[] = [];
for (let i = 10; i < 31; i++) busy.push((await post({ ...GOOD, email: `person${i}@acme.com` }, { ip: office })).status);
check('…the 31st from that address in a minute: 429', busy.slice(0, 20).every((s) => s === 201) && busy[20] === 429, busy);
const oneEmail: number[] = [];
for (let i = 0; i < 4; i++) oneEmail.push((await post({ ...GOOD, email: 'retry@acme.com' }, { ip: nextIp() })).status);
check('the 4th of one email in a minute, from any address: 429', JSON.stringify(oneEmail) === '[201,201,201,429]', oneEmail);
check('…and the email is never in a key, only its hash', [...kvCount.keys()].every((key) => !key.includes('@')) && [...kvCount.keys()].some((key) => key.startsWith('signup:email:')), [...kvCount.keys()].slice(0, 3));
setEnv({ KV_REST_API_URL: '', KV_REST_API_TOKEN: '' });
const noKv: number[] = [];
for (let i = 0; i < 8; i++) noKv.push((await post(GOOD, { ip: office })).status);
check('KV unset: no limit', noKv.every((s) => s === 201), noKv);
setEnv({ KV_REST_API_URL: 'https://kv.test', KV_REST_API_TOKEN: 'kv-token' });
answer = await post({ ...GOOD, utm: { content: 'x'.repeat(5000) } }, { ip: nextIp() });
check('over 4 KB: 413', answer.status === 413, answer.status);

// ─── e. The wiring ────────────────────────────────────────────────────────
console.log('\ne. The wiring');
const source = (file: string) => readFileSync(file, 'utf8');
const content = source('api/content.ts');
const ssr = source('server/ssr-handler.tsx');
const ssrFetch = ssr.slice(ssr.indexOf('async function fetchExperienceContent('), ssr.indexOf('\n}\n', ssr.indexOf('async function fetchExperienceContent(')));
const vite = source('vite.config.ts');
const form = source('src/components/offer-signup/OfferSignupForm.tsx');
const WRAP = /withOfferSignup\(normalizeExperienceItem\(/;
check('api/content.ts passes the experience through withOfferSignup and serves it with signupCacheControl', WRAP.test(content) && /signupCacheControl\(shown,/.test(content));
check(
  'server/ssr-handler.tsx: fetchExperienceContent wraps, the /vb page is served with signupCacheControl',
  ssrFetch.length > 0 && WRAP.test(ssrFetch) && /signupCacheControl\(item,/.test(ssr),
);
check("the dev proxy (vite.config.ts) wraps the experience too", WRAP.test(vite));
check(
  'the form posts through postSignup with the page\'s location',
  /await postSignup\(offerId, email, .*, window\.location\)/.test(form) && !/fetch\(/.test(form),
);
check(
  `the endpoint (${SIGNUP_ENDPOINT}) is the file Vercel serves there, and the dev server routes it to it`,
  SIGNUP_ENDPOINT === '/api/offer-signup' && existsSync(`.${SIGNUP_ENDPOINT}.ts`) && vite.includes(`[/^\\/api\\/offer-signup$/, '/api/offer-signup.ts']`),
);

// ─── f. postSignup ────────────────────────────────────────────────────────
console.log('\nf. postSignup');
const at = { pathname: '/vb/workshop-acme', search: '?utm_source=linkedin&utm_campaign=fall&other=x' };
calls = [];
endpointAnswer = { status: 201, body: { ok: true } };
const done = await postSignup(OFFER, 'pat@acme.com', '', at);
const sentBody = calls[0]?.body as Record<string, unknown> | undefined;
check(
  'one JSON POST to /api/offer-signup, the route the page\'s path, its utm_* values along',
  calls.length === 1 &&
    calls[0].url === '/api/offer-signup' &&
    calls[0].method === 'POST' &&
    calls[0].headers['content-type'] === 'application/json' &&
    JSON.stringify(sentBody) === JSON.stringify({ offerId: OFFER, route: '/vb/workshop-acme', email: 'pat@acme.com', website: '', utm: { source: 'linkedin', campaign: 'fall' } }),
  calls,
);
check('201: done', done === 'done');
endpointAnswer = { status: 400, body: { error: SIGNUP_WORDS.invalid } };
check('400 saying the email is invalid: "invalid"', (await postSignup(OFFER, 'pat@acme.com', '', at)) === 'invalid');
endpointAnswer = { status: 400, body: { error: SIGNUP_WORDS.error } };
check('any other 400 (a bad offer id or route): "error", not "Enter your work email."', (await postSignup(OFFER, 'pat@acme.com', '', at)) === 'error');
endpointAnswer = { status: 502, body: { error: SIGNUP_WORDS.error } };
check('502: "error"', (await postSignup(OFFER, 'pat@acme.com', '', at)) === 'error');
endpointAnswer = 'throw';
check('no answer: "error"', (await postSignup(OFFER, 'pat@acme.com', '', at)) === 'error');
}

main().then(
  () => {
    console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
