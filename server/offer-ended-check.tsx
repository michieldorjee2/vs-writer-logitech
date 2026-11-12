/**
 * An ended offer's pages come down (src/lib/offer-ended.ts, api/_lib/offer-ended.ts; Laura, 12 Nov
 * 2026: "pages are not 'self destroying' once the offer ends"), checked with no network: Limitless
 * and Graph are stand-ins, and the env is the check's own.
 *
 *   a. The stand-in. endedOffer keeps the page's identity and the company's mark and nothing
 *      else: no composition, no componentPlan, none of the page's copy; it is noindex, titled
 *      "This offer has ended". safeAccountUrl keeps a site path ("/acme" → "/acme/") and refuses
 *      another origin, a protocol-relative "//", a javascript: URL, a backslash and a space.
 *   b. withOfferEnded, against stand-in Limitless and Graph. Limitless unset: nothing is asked,
 *      the page as it was. Not ended: the same page, one ask with the showcase token, held a
 *      minute (no second ask). Ended: the stand-in, with the company's account page from Graph
 *      (or none when Graph has none). Limitless doesn't know the offer (404): the page stays, at
 *      the usual cache. Limitless failing or slow: the page stays, served with a 10 s edge cache
 *      (endedCacheControl), the failure held only 5 s. A page with no offer id, a person page and
 *      a stand-in already: nothing asked.
 *   c. What a visitor sees (OfferEndedPage on the server): the headline, the company's mark, a
 *      link to its account page, none of the offer's copy and no sign-up; with no account page, a
 *      link to optimizely.com instead. (ExperienceBody is checked from its source in d: importing
 *      the /vb/ route pulls in Vite's import.meta.glob, which doesn't run here.)
 *   d. The wiring, read from the source: api/content.ts, server/ssr-handler.tsx
 *      (fetchExperienceContent) and the dev proxy in vite.config.ts each pass the experience
 *      through withOfferEnded, outermost; the first two serve it with endedCacheControl; the
 *      server answers 410 for the stand-in; ExperienceBody draws OfferEndedPage before it
 *      checks for an offer page; the CMS preview (api/preview.ts) doesn't ask.
 *   e. Controls: a stand-in that keeps the page's composition, a wrap that asks no one (never
 *      ends a page) and an account link to another site are each caught.
 *
 * Run: `npm run check:offer-ended` (scripts/check-offer-ended.mjs bundles it). Under server/ so
 * `npm run typecheck:server` type-checks it with the api/ files it imports; nothing deploys it.
 */
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';

import { ENDED_FLAG, ENDED_WORDS, endedOffer, isEndedOffer, OPTIMIZELY_HOME, safeAccountUrl } from '../src/lib/offer-ended';
import { endedCacheControl, forgetOfferEnded, UNSURE_CACHE_CONTROL, withOfferEnded } from '../api/_lib/offer-ended';
import { forgetParentAccounts } from '../api/_lib/parent-account';
import OfferEndedPage from '../src/www/OfferEndedPage';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
  if (!ok) failures++;
}

// ─── Fixtures and stand-ins ───────────────────────────────────────────────

const OFFER = 'vegas-dinner';
const SECRET = 'Join us for a murder mystery dinner in Vegas';
const page = (extra: Record<string, unknown> = {}) => ({
  __typename: 'ABMExperience',
  __template: 'abm-experience',
  _metadata: { key: 'k123', url: { hierarchical: '/vegas-dinner-acme/' }, published: '2026-10-24T00:00:00Z' },
  companyName: 'Acme',
  salesforceAccountID: '0014J00000AcmeAAA',
  customerLogo: { default: 'https://cdn.example.com/acme.png' },
  brandDomain: 'acme.com',
  componentPlan: JSON.stringify({ kind: 'offer-page', offerId: OFFER, blueprint: 'offer' }),
  composition: { key: 'x', nodeType: 'experience', nodes: [{ key: 's', nodeType: 'section', rows: [{ columns: [{ elements: [{ component: { __typename: 'StackedHeadingElement', Heading: SECRET } }] }] }] }] },
  PageTitle: SECRET,
  MetaDescription: 'Dinner, mystery and Optimizely.',
  ...extra,
});

type Answer = { status: number; body: unknown } | 'throw' | 'hang';
let limitless: Answer = { status: 200, body: { ended: false } };
let graphAccount: string | null = '/acme/';
let calls: Array<{ url: string; auth: string | null }> = [];

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const headers = new Headers(init?.headers);
  calls.push({ url, auth: headers.get('authorization') });
  if (url.startsWith('https://cg.optimizely.com/')) {
    const items = graphAccount ? [{ _metadata: { url: { hierarchical: graphAccount } }, salesforceAccountID: '0014J00000AcmeAAA', customerLogo: null, brandDomain: 'acme.com' }] : [];
    return new Response(JSON.stringify({ data: { CompetitorComparisonPage: { items } } }), { status: 200 });
  }
  if (url.startsWith('https://limitless.check/')) {
    const now = limitless;
    if (now === 'throw') throw new Error('connection refused');
    if (now === 'hang') {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    }
    return new Response(JSON.stringify(now.body), { status: now.status });
  }
  throw new Error(`unexpected fetch: ${url}`);
}) as typeof fetch;

const NORMAL = 'public, s-maxage=60, stale-while-revalidate=300';
const limitlessCalls = () => calls.filter((c) => c.url.startsWith('https://limitless.check/'));
const reset = () => {
  forgetOfferEnded();
  forgetParentAccounts();
  calls = [];
};

// ─── a. The stand-in ──────────────────────────────────────────────────────
console.log('\na. The stand-in');
const standIn = endedOffer(page(), '/acme/');
const keys = Object.keys(standIn).sort();
check(
  'keeps the identity and the mark, and nothing else',
  JSON.stringify(keys) === JSON.stringify(['PageTitle', '__offerEnded', '__template', '__typename', '_metadata', 'accountUrl', 'companyName', 'customerLogo', 'noIndex']),
  keys,
);
check("none of the page's copy is in it", !JSON.stringify(standIn).includes(SECRET) && !JSON.stringify(standIn).includes('Dinner, mystery'));
check(
  'noindex, titled, flagged, the company and its logo kept, the address its account page',
  standIn.noIndex === true &&
    standIn.PageTitle === ENDED_WORDS.title &&
    isEndedOffer(standIn) &&
    standIn.companyName === 'Acme' &&
    standIn.customerLogo?.default === 'https://cdn.example.com/acme.png' &&
    standIn.accountUrl === '/acme/' &&
    standIn._metadata?.key === 'k123',
  standIn,
);
check('isEndedOffer: a page, null, a string and a flag that isn\'t true are not', !isEndedOffer(page()) && !isEndedOffer(null) && !isEndedOffer('x') && !isEndedOffer({ [ENDED_FLAG]: 'yes' }));
check('safeAccountUrl keeps a site path and ends it with a slash', safeAccountUrl('/acme') === '/acme/' && safeAccountUrl('/acme/') === '/acme/' && safeAccountUrl(' /lenovo-2/ ') === '/lenovo-2/');
const refused = ['//evil.example/', 'https://evil.example/', 'javascript:alert(1)', '/\\evil.example', '/a b/', '', null, 42];
check('safeAccountUrl refuses another origin, //, javascript:, a backslash, a space and non-strings', refused.every((u) => safeAccountUrl(u) === null), refused.map((u) => safeAccountUrl(u)));
check('a stand-in made with a bad account address has none', endedOffer(page(), 'https://evil.example/').accountUrl === null);

async function main(): Promise<void> {
  // ─── b. withOfferEnded ────────────────────────────────────────────────────
  console.log('\nb. withOfferEnded');
  process.env.GRAPH_AUTH_KEY = 'graph-check-key';
  delete process.env.ALDUS_UI_URL;
  delete process.env.ALDUS_SHOWCASE_TOKEN;
  reset();
  const p0 = page();
  check('Limitless unset: nothing asked, the page as it was', (await withOfferEnded(p0)) === p0 && calls.length === 0);

  process.env.ALDUS_UI_URL = 'https://limitless.check';
  process.env.ALDUS_SHOWCASE_TOKEN = 'showcase-check-token';
  reset();
  limitless = { status: 200, body: { ended: false, id: OFFER, title: 'Vegas dinner', windowEnd: '2099-12-31' } };
  const p1 = page();
  const notEnded = await withOfferEnded(p1);
  check(
    'not ended: the same page, one ask for this offer with the showcase token',
    notEnded === p1 &&
      limitlessCalls().length === 1 &&
      limitlessCalls()[0].url === `https://limitless.check/api/machine/showcase/offers/${OFFER}` &&
      limitlessCalls()[0].auth === 'Bearer showcase-check-token',
    calls,
  );
  check('…served with the usual cache', endedCacheControl(notEnded, NORMAL) === NORMAL);
  limitless = { status: 200, body: { ended: true } };
  await withOfferEnded(page());
  check('the answer is held a minute: a second page of the offer asks nothing', limitlessCalls().length === 1, limitlessCalls().length);

  reset();
  limitless = { status: 200, body: { ended: true, id: OFFER, title: 'Vegas dinner', windowEnd: '2026-10-29' } };
  const ended = await withOfferEnded(page());
  check('ended: the stand-in, with the account page Graph has', isEndedOffer(ended) && ended.accountUrl === '/acme/' && ended.companyName === 'Acme', ended);
  check("…and none of the page's copy", !JSON.stringify(ended).includes(SECRET));
  check('…served with the usual cache', endedCacheControl(ended, NORMAL) === NORMAL);
  check('a stand-in passed in again asks nothing', (await withOfferEnded(ended)) === ended && limitlessCalls().length === 1);

  reset();
  graphAccount = null;
  const noAccount = await withOfferEnded(page());
  check('ended, and Graph has no account page: the stand-in, no account address', isEndedOffer(noAccount) && noAccount.accountUrl === null, noAccount);
  graphAccount = '/acme/';

  reset();
  limitless = { status: 404, body: { error: 'No offer “vegas-dinner”.' } };
  const p404 = page();
  check("Limitless doesn't know the offer (404): the page stays", (await withOfferEnded(p404)) === p404);
  check('…at the usual cache (an answer, not a failure)', endedCacheControl(p404, NORMAL) === NORMAL);

  reset();
  limitless = { status: 200, body: { nope: true } };
  const pOdd = page();
  check('an answer without `ended`: the page stays, as a failure', (await withOfferEnded(pOdd)) === pOdd && endedCacheControl(pOdd, NORMAL) === UNSURE_CACHE_CONTROL);

  reset();
  limitless = 'throw';
  const pFail = page();
  check('Limitless failing: the page stays', (await withOfferEnded(pFail)) === pFail);
  check('…served with a 10 s edge cache, so the next request asks again', endedCacheControl(pFail, NORMAL) === UNSURE_CACHE_CONTROL && UNSURE_CACHE_CONTROL === 'public, s-maxage=10');
  limitless = { status: 200, body: { ended: true } };
  await withOfferEnded(page());
  check('…the failure is held (no ask within 5 s)', limitlessCalls().length === 1, limitlessCalls().length);
  // The clock moved on: a failure is asked about again after 5 s, an answer after a minute.
  const realNow = Date.now;
  const at = realNow();
  try {
    Date.now = () => at + 6_000;
    const retried = await withOfferEnded(page());
    check('…and asked again 6 s later (now ended: the stand-in)', limitlessCalls().length === 2 && isEndedOffer(retried), limitlessCalls().length);
    Date.now = () => at + 6_000 + 50_000;
    await withOfferEnded(page());
    check('an answer is still held 50 s on', limitlessCalls().length === 2, limitlessCalls().length);
    limitless = { status: 200, body: { ended: false } };
    Date.now = () => at + 6_000 + 61_000;
    const later = page();
    check('…and asked again after a minute (extended in Limitless: the page is back)', (await withOfferEnded(later)) === later && limitlessCalls().length === 3, limitlessCalls().length);
  } finally {
    Date.now = realNow;
  }

  reset();
  limitless = 'hang';
  const started = Date.now();
  const pSlow = page();
  // AbortSignal.timeout's timer doesn't hold Node open: with nothing else pending, this check
  // exited 0 right here, mid-test, while written. A request holds the server open; this stands in.
  const keepAlive = setTimeout(() => {}, 10_000);
  const slow = await withOfferEnded(pSlow);
  clearTimeout(keepAlive);
  const took = Date.now() - started;
  check(`Limitless slow: the page stays after the 1.5 s limit (took ${took} ms)`, slow === pSlow && took >= 1400 && took < 3000 && endedCacheControl(pSlow, NORMAL) === UNSURE_CACHE_CONTROL, took);

  reset();
  limitless = { status: 200, body: { ended: true } };
  const noOffer = page({ componentPlan: JSON.stringify({ kind: 'offer-page' }) });
  const person = { ...page(), __typename: 'PersonExperience' };
  check('a page with no offer id and a person page: nothing asked, as they were', (await withOfferEnded(noOffer)) === noOffer && (await withOfferEnded(person)) === person && calls.length === 0, calls);

  // ─── c. What a visitor sees ───────────────────────────────────────────────
  console.log('\nc. What a visitor sees');
  const html = renderToString(<OfferEndedPage experience={endedOffer(page(), '/acme/')} />);
  // Heading draws each word in its own span (the entrance), so the h1's text is read without its tags.
  const h1 = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  check('the headline, one h1', h1 === ENDED_WORDS.heading && (html.match(/<h1/g) ?? []).length === 1, h1);
  check("the company's mark", html.includes('Made for Acme') && html.includes('https://cdn.example.com/acme.png'));
  check("a link to the company's page", html.includes('href="/acme/"') && html.includes(ENDED_WORDS.toAccount('Acme').replace("'", '&#x27;')), html);
  check("none of the offer's copy and no sign-up", !html.includes(SECRET) && !/<form/i.test(html) && !html.includes('signup'));
  const bare = renderToString(<OfferEndedPage experience={endedOffer(page(), null)} />);
  check('with no account page: a link to optimizely.com instead', bare.includes(`href="${OPTIMIZELY_HOME}"`) && bare.includes(ENDED_WORDS.toOptimizely) && !bare.includes('href="/acme/"'));

  // ─── d. The wiring ────────────────────────────────────────────────────────
  console.log('\nd. The wiring');
  const content = readFileSync('api/content.ts', 'utf-8');
  const ssr = readFileSync('server/ssr-handler.tsx', 'utf-8');
  const vite = readFileSync('vite.config.ts', 'utf-8');
  const preview = readFileSync('api/preview.ts', 'utf-8');
  const body = readFileSync('src/components/VisualBuilderPage.tsx', 'utf-8');
  const ssrFetch = ssr.slice(ssr.indexOf('async function fetchExperienceContent'), ssr.indexOf('interface VbLevelProps'));
  // Outermost: withOfferEnded( await withOfferSignup(await withParentAccount(normalizeExperienceItem(
  const OUTERMOST = /withOfferEnded\(\s*await withOfferSignup\(await withParentAccount\(normalizeExperienceItem\(/;
  check('api/content.ts: withOfferEnded outermost, served with endedCacheControl', OUTERMOST.test(content) && /endedCacheControl\(shown,/.test(content));
  check('server/ssr-handler.tsx: fetchExperienceContent wraps it outermost, served with endedCacheControl', ssrFetch.length > 0 && OUTERMOST.test(ssrFetch) && /endedCacheControl\(item,/.test(ssr));
  check('the server answers 410 for the stand-in, 200 otherwise', /res\.status\(ended \? 410 : 200\)/.test(ssr) && /const ended = isEndedOffer\(item\)/.test(ssr));
  check('the dev proxy (vite.config.ts) wraps it outermost too', OUTERMOST.test(vite));
  check('the CMS preview does not ask (editors see the page)', !preview.includes('withOfferEnded'));
  check('ExperienceBody draws OfferEndedPage before it checks for an offer page', body.indexOf('isEndedOffer(experience)') > 0 && body.indexOf('isEndedOffer(experience)') < body.indexOf('isOfferExperience(experience)'));

  // ─── e. Controls ──────────────────────────────────────────────────────────
  console.log('\ne. Controls');
  const leaky = { ...endedOffer(page(), '/acme/'), composition: page().composition };
  check("a stand-in that keeps the page's composition is caught by a's copy test", JSON.stringify(leaky).includes(SECRET));
  const askNoOne = async <T,>(item: T) => item;
  reset();
  limitless = { status: 200, body: { ended: true } };
  check('a wrap that asks no one is caught by b\'s ended test', !isEndedOffer(await askNoOne(page())));
  const offSite = renderToString(<OfferEndedPage experience={{ ...endedOffer(page(), null), accountUrl: '//evil.example/' }} />);
  check("an account link to another site (set past safeAccountUrl) would show: the stand-in's builder is what stops it", offSite.includes('href="//evil.example/"') && endedOffer(page(), '//evil.example/').accountUrl === null);
}

main().then(
  () => {
    console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
    process.exit(failures === 0 ? 0 : 1);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
