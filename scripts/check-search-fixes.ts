/**
 * check-search-fixes — the search page fixes of 3 Nov 2026.
 *
 *   1. A refused page build says WHY. Levi's (levis.com) and Patagonia were refused
 *      because no Salesforce account lists that website, but the search page showed
 *      the "tell the requester" agent's reply instead: "The recipient address … is the
 *      same as the authenticated user's", because the requester was the workflow's own
 *      identity. failedBuildError() now takes the workflow's request_problem, whole.
 *      Control: the same run without request_problem gives the old line, so the check
 *      can tell the two apart.
 *   2. An offer's pages are listed once, at the address that draws them. Graph has each
 *      offer page at its CMS address (/vegas-dinner-d2l/), where the site answers
 *      "We're not quite ready for …"; Aldus UI's page log has /vb/vegas-dinner-d2l. The
 *      merge kept both. Control: the bare CMS route lists the page twice.
 *   3. The wiring, read from the sources: / redirects to /search (temporary, in
 *      vercel.json and in the SSR handler), the search feed's and "+ Add company"'s
 *      Graph calls give up instead of hanging for 300 s, refreshBuild uses
 *      failedBuildError.
 *
 * No network, no env, no credentials.
 *
 *   npx tsx scripts/check-search-fixes.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { failedBuildError, requestProblemOf } from '../api/_lib/page-builds.js';
import { offerPageRoute } from '../api/_lib/offer-pages.js';
import { withPages } from '../api/_lib/offers.js';
import type { AldusOffer } from '../api/_lib/aldus.js';
import type { MarkExecution } from '../src/lib/page-builds.js';
import type { OfferPage } from '../src/lib/offer-looks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const fold = (s: string) => s.replace(/\s+/g, ' ');

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? `\n     ${detail}` : ''}`);
}

/* ---------- 1. A refused build says why ---------- */

// The Levi's run of 3 Nov (da0ffc0d…), cut down to what failedBuildError reads.
const PROBLEM =
  'No Salesforce account has the website levis.com in its Domain Name field. Request it again with the website that account lists, or ask its owner to set the field.';
const REFUSAL =
  "The recipient address (michiel@optimizely.com) is the same as the authenticated user's (Michiel Dorjee, michiel@optimizely.com), so this is a chat with myself, which can't be done. Per the instructions, I'll finish without sending.";
const step = (step_id: string, extra: Record<string, unknown>) => ({ step_id, status: 'completed', ...extra });
const levis = (withProblem: boolean): MarkExecution => ({
  id: 'da0ffc0d-ee32-4337-ba01-28b8eaf10358',
  status: 'completed',
  step_executions: [
    step('1b000000-0000-4000-8000-000000000001', {
      output_data: { return_value: { count: 0, ...(withProblem ? { request_problem: PROBLEM, error: `one-off request not resolved: ${PROBLEM}` } : {}) } },
    }),
    step('1d000000-0000-4000-8000-000000000001', { output_data: { return_value: { route: 'error', ...(withProblem ? { request_problem: PROBLEM } : {}) } } }),
    step('1c000000-0000-4000-8000-000000000001', {}),
    step('4d000000-0000-4000-8000-000000000004', { agent_execution_id: '1aa20849', result: { response: REFUSAL } }),
  ] as MarkExecution['step_executions'],
});

check('Levi\'s: the rep sees the workflow\'s reason, both sentences', failedBuildError(levis(true), 'account') === PROBLEM, failedBuildError(levis(true), 'account'));
check('Levi\'s: the Teams refusal is not shown', !/recipient address|chat with myself/i.test(failedBuildError(levis(true), 'account')));
check('requestProblemOf finds it in the gather step', requestProblemOf(levis(true)) === PROBLEM);
check(
  'control: without request_problem the old refusal line comes back (the check can fail)',
  /^The recipient address/.test(failedBuildError(levis(false), 'account')),
  failedBuildError(levis(false), 'account'),
);
check(
  'a run that failed on its own still says the run\'s error',
  failedBuildError({ id: 'x', status: 'failed', error_message: 'Execution stopped! Anomaly threshold exceeded. More text.', step_executions: [] }, 'account') ===
    'Execution stopped!',
);
check('nothing to go on: the plain fallback', failedBuildError({ id: 'x', status: 'completed', step_executions: [] }, 'person') === 'Mark finished without building the page.');

/* ---------- 2. Offer pages listed once, at /vb/ ---------- */

check('CMS address becomes the served address', offerPageRoute('/vegas-dinner-d2l/') === 'vb/vegas-dinner-d2l');
check('a /vb/ address stays as it is', offerPageRoute('/vb/vegas-dinner-d2l/') === 'vb/vegas-dinner-d2l');
check('no address stays empty', offerPageRoute(null) === '' && offerPageRoute('/') === '');

const graphPage = (route: string): OfferPage => ({
  route,
  companyName: 'D2L',
  domain: 'd2l.com',
  logoUrl: 'https://cdn.example/d2l.svg',
  published: '2026-10-28T10:00:00Z',
});
const offer: AldusOffer = {
  id: 'murder-mystery-dinner-at-6sense-breakthrough',
  title: 'Murder Mystery Dinner',
  brief: '',
  windowStart: '2026-10-20',
  windowEnd: '2026-11-05',
  look: null,
  pages: [
    { accountName: 'D2L', pageUrl: 'https://showcase.optimizely.com/vb/vegas-dinner-d2l', liveSince: '2026-10-28T10:00:00Z' },
    { accountName: 'Wrike, Inc.', pageUrl: 'https://showcase.optimizely.com/vb/vegas-dinner-wrike-inc', liveSince: '2026-10-28T09:00:00Z' },
  ],
};
const fixed = withPages(offer, new Map([[offer.id, [graphPage(offerPageRoute('/vegas-dinner-d2l/'))]]])).pages;
check('D2L is listed once', fixed.filter((p) => p.companyName === 'D2L').length === 1, JSON.stringify(fixed.map((p) => p.route)));
check('…at /vb/, the address that draws it', fixed.find((p) => p.companyName === 'D2L')?.route === 'vb/vegas-dinner-d2l');
check('…keeping Graph\'s logo and domain', fixed.find((p) => p.companyName === 'D2L')?.logoUrl === 'https://cdn.example/d2l.svg');
check('a page only Aldus UI knows is still listed', fixed.some((p) => p.route === 'vb/vegas-dinner-wrike-inc'));
const before = withPages(offer, new Map([[offer.id, [graphPage('vegas-dinner-d2l')]]])).pages;
check('control: the bare CMS route lists D2L twice (the check can fail)', before.filter((p) => p.companyName === 'D2L').length === 2);

/* ---------- 3. Wiring ---------- */

const vercel = JSON.parse(read('vercel.json')) as {
  redirects: { source: string; destination: string; permanent?: boolean }[];
  rewrites: { source: string; destination: string }[];
};
const rootRedirect = vercel.redirects.find((r) => r.source === '/');
check('vercel.json: / redirects to /search', rootRedirect?.destination === '/search');
check('…temporarily, so a later home page is not stuck behind a cached 308', rootRedirect?.permanent === false);
check('…and / is no longer rewritten to the "Page not found" shell', !vercel.rewrites.some((r) => r.source === '/'));

const ssr = fold(read('server/ssr-handler.tsx'));
check(
  'SSR handler: no slug → 307 to /search with the query kept',
  ssr.includes("if (!slug) { res.setHeader('Location', `/search${url.search}`); return res.status(307).end(); }"),
);
check('SSR handler: /preview still gets the app shell', ssr.includes("if (slug === 'preview') { res.setHeader('Content-Type', 'text/html'); return res.status(200).send(template); }"));

const homeIndex = fold(read('api/home-index.ts'));
check('search feed: the Graph call has a timeout', /body: JSON\.stringify\(\{ query, variables \}\), signal: AbortSignal\.timeout\(GRAPH_TIMEOUT_MS\)/.test(homeIndex));
check('…well inside the 300 s function limit', /GRAPH_TIMEOUT_MS = (\d+)_?(\d*)/.test(homeIndex) && Number(homeIndex.match(/GRAPH_TIMEOUT_MS = ([\d_]+)/)?.[1].replace(/_/g, '')) <= 60_000);

const builds = fold(read('api/_lib/page-builds.ts'));
const pageExists = builds.slice(builds.indexOf('export async function pageExists'), builds.indexOf('export const PAGE_AT_ROUTE_QUERY'));
check('"+ Add company": the page-exists Graph call has a timeout', /signal: AbortSignal\.timeout\(\d[\d_]*\)/.test(pageExists));
check('refreshBuild uses failedBuildError', builds.includes("error: failedBuildError(execution, record.kind)"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
