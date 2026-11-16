/**
 * check-page-builds — what keeps a failed page build from going unseen (16 Nov 2026).
 *
 *   1. A company or a website is not a person (src/lib/person-name.ts). Every bad name reps
 *      actually sent between 22 Oct and 16 Nov is refused; real names, accents and
 *      apostrophes included, pass. POST /api/page-builds answers 400 not_a_person.
 *   2. A failed person build says why (personProblemOf): the run report's stopped_reason,
 *      the stakeholder lookup's reason, and the old 16 Nov "blocked" answer with none.
 *   3. A failure is emailed once (build-alerts.ts): nothing without BUILD_ALERT_EMAIL, one
 *      email per build however often it is looked at, client type mcp, a tool-level failure
 *      counts as not sent and gives the once-key back.
 *   4. refreshBuild settles a finished run as failed, emails it, and drops it from pb:open;
 *      a run still going after an hour gets one "stalled" email and stays running.
 *   5. The sweep refuses anyone without CRON_SECRET's bearer.
 *   6. Only a running or waiting build stands in front of its address (buildHoldsAddress),
 *      and the wiring that uses it, the search bar's checks and the cron, is in place.
 *
 * Network, Redis and Mark are stand-ins. No credentials.
 *
 *   npx tsx scripts/check-page-builds.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { personNameProblem, looksLikePersonName } from '../src/lib/person-name.js';
import { buildHoldsAddress, type BuildRecord, type MarkExecution } from '../src/lib/page-builds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`);
}

/* ---------- Stand-ins ---------- */

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let toolAnswer: unknown = { response_type: 'application/json', response: { message: 'Email sent successfully.' } };
const executions = new Map<string, MarkExecution>();
globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  calls.push({ url, init });
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (url.includes('/tools/invoke')) return ok(toolAnswer);
  const ex = /\/workflow-executions\/([^/?]+)/.exec(url);
  if (ex && executions.has(ex[1])) return ok(executions.get(ex[1]));
  return new Response('not stubbed', { status: 404 });
}) as typeof fetch;

/** An in-memory stand-in for the Upstash calls the build store makes. */
function memoryStore() {
  const kv = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  const store = {
    kv,
    sets,
    async get<T>(k: string) {
      return (kv.has(k) ? kv.get(k) : null) as T | null;
    },
    async set(k: string, v: unknown, opts?: { nx?: boolean }) {
      if (opts?.nx && kv.has(k)) return null;
      kv.set(k, v);
      return 'OK';
    },
    async del(k: string) {
      return kv.delete(k) ? 1 : 0;
    },
    async sadd(k: string, ...members: string[]) {
      const s = sets.get(k) ?? new Set<string>();
      members.forEach((m) => s.add(m));
      sets.set(k, s);
      return members.length;
    },
    async srem(k: string, ...members: string[]) {
      const s = sets.get(k);
      members.forEach((m) => s?.delete(m));
      return members.length;
    },
    async smembers(k: string) {
      return [...(sets.get(k) ?? [])];
    },
    async lpush() {
      return 1;
    },
    async ltrim() {
      return 'OK';
    },
    async lrange() {
      return [];
    },
    async expire() {
      return 1;
    },
    async mget() {
      return [];
    },
    async incr() {
      return 1;
    },
  };
  return store;
}

function fakeRes() {
  const out = { status: 0, body: undefined as unknown, headers: {} as Record<string, unknown> };
  const res = {
    setHeader(k: string, v: unknown) {
      out.headers[k.toLowerCase()] = v;
      return res;
    },
    getHeader(k: string) {
      return out.headers[k.toLowerCase()];
    },
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
    send(body: unknown) {
      out.body = body;
      return res;
    },
    end() {
      return res;
    },
  };
  return { res: res as unknown as VercelResponse, out };
}

const req = (over: Partial<VercelRequest>) => ({ method: 'GET', headers: {}, query: {}, cookies: {}, body: undefined, ...over }) as unknown as VercelRequest;

/* ---------- 1. Not a person ---------- */

const sentAsPeople: [string, string][] = [
  ['IKEA', 'IKEA'],
  ['microsoft', 'IKEA'],
  ['thales', 'Thales'],
  ['https://www.depaul.edu', 'DePaul University'],
  ['lenovo', 'Atlassian PTY Ltd.'],
  ['https://exclaimer.com/', 'Exclaimer'],
  ['https://www.spirehealthcare.com', 'Spire Healthcare Limited'],
  ['asurion', 'Asurion'],
  ['Red Hat', 'Red Hat'],
  ['Ikea', 'IKEA AB'],
  ['exclaimer.com', 'Exclaimer'],
];
for (const [name, company] of sentAsPeople) {
  check(`refused as a person: "${name}" at ${company}`, personNameProblem(name, company) !== null, String(personNameProblem(name, company)));
}
const people: [string, string][] = [
  ['Cecilia Jeppsson', 'IKEA'],
  ['Ben Yu', 'Logitech'],
  ["Alex O'Connor", 'Mace Construct'],
  ['José María García', 'Telefónica'],
  ['Elizabeth Rutledge', 'American Express Company (AMEX)'],
  ['Laura Platt', 'Wolters Kluwer'],
];
for (const [name, company] of people) {
  check(`accepted as a person: "${name}" at ${company}`, personNameProblem(name, company) === null, String(personNameProblem(name, company)));
}
check('the search text "IKEA" is not carried into the name field', !looksLikePersonName('IKEA'));
check('the search text "Cecilia Jeppsson" is', looksLikePersonName('Cecilia Jeppsson'));
check('a website answer says website', /website/i.test(personNameProblem('www.ikea.com', 'IKEA') ?? ''));
check('the company answer names the company', /IKEA/.test(personNameProblem('IKEA', 'IKEA') ?? ''));

process.env.DEV_AUTH_EMAIL = 'rep@example.com';
process.env.KV_REST_API_URL = 'https://kv.example';
process.env.KV_REST_API_TOKEN = 'kv-token';
process.env.OPAL_PAT = 'x.e30.x';
const buildsHandler = (await import('../api/page-builds/index.js')).default;
{
  calls = [];
  const { res, out } = fakeRes();
  await buildsHandler(req({ method: 'POST', body: { kind: 'person', personName: 'IKEA', company: { route: 'ikea', name: 'IKEA' } } }), res);
  check('POST /api/page-builds refuses "IKEA" at IKEA with 400 not_a_person', out.status === 400 && (out.body as { error?: string })?.error === 'not_a_person', JSON.stringify(out));
  check('…and says why, for the search bar to show', /company/i.test((out.body as { message?: string })?.message ?? ''));
  check('…without asking Mark or the store anything', calls.length === 0, calls.map((c) => c.url).join(', '));
}
{
  const { res, out } = fakeRes();
  await buildsHandler(req({ method: 'POST', body: { kind: 'person', personName: 'https://www.depaul.edu', company: { website: 'depaul.edu', name: 'DePaul University' } } }), res);
  check('POST /api/page-builds refuses a website as the person', out.status === 400, JSON.stringify(out));
}

/* ---------- 2. Why a person build failed ---------- */

const { failedBuildError, personProblemOf, refreshBuild, STALL_MS } = await import('../api/_lib/page-builds.js');
const LOOKUP = 'b1a1fdce-0865-4851-b693-aae8f4592211';
const REPORT = 'b2000000-0000-4000-8000-000000000006';
const step = (step_id: string, response: unknown, status = 'completed') => ({ step_id, status, result: { response } });
const execution = (id: string, steps: unknown[], status = 'completed') => ({ id, status, step_executions: steps }) as unknown as MarkExecution;

const ikea16Nov = execution('ex-ikea', [step(LOOKUP, '{"status":"blocked","company":"IKEA","stakeholders":[]}')]);
check('the 16 Nov IKEA run (blocked, no reason) no longer says only "Mark finished without building the page"', failedBuildError(ikea16Nov, 'person') !== 'Mark finished without building the page.', failedBuildError(ikea16Nov, 'person'));
const invalid = execution('ex-invalid', [
  step(LOOKUP, '{"status":"invalid_person","company":"IKEA","reason":"\'IKEA\' is a company or a website, not a person\'s name.","stakeholders":[]}'),
  step(REPORT, '{\n "company": "IKEA",\n "needs_attention": true,\n "stopped_reason": "\'IKEA\' is a company or a website, not a person\'s name. Ask for the person\'s full name.",\n "summary": "IKEA: nothing built."\n}'),
]);
check('a run the report stopped says the report\'s stopped_reason', /not a person's name\. Ask for/.test(personProblemOf(invalid) ?? ''), String(personProblemOf(invalid)));
const blocked = execution('ex-blocked', [step(LOOKUP, '```json\n{"status":"blocked","reason":"get_page failed: Optimizely GET … failed (410): The \'preview3\' API has been sunset.","stakeholders":[]}\n```')]);
check('a blocked lookup says its reason, fenced or not', /410/.test(personProblemOf(blocked) ?? ''), String(personProblemOf(blocked)));
check('an account build is not read as a person build', personProblemOf(execution('ex-acc', [])) === null);

/* ---------- 3. The email ---------- */

const { alertBuildFailed, alertEmail } = await import('../api/_lib/build-alerts.js');
const alert = { what: 'Cecilia Jeppsson at IKEA', kind: 'person' as const, email: 'rep@example.com', stage: 'run' as const, reason: 'get_page failed <410>', buildId: 'b1', route: 'ikea/cecilia-jeppsson', executionId: 'ex-1', startedAt: Date.UTC(2026, 10, 16, 14, 1) };
const mail = alertEmail(alert);
check('the subject names the build', mail.subject === 'Showcase build failed: Cecilia Jeppsson at IKEA', mail.subject);
check('the body has the reason (escaped), who asked, the address and the run', mail.html.includes('get_page failed &lt;410&gt;') && mail.html.includes('rep@example.com') && mail.html.includes('https://showcase.optimizely.com/ikea/cecilia-jeppsson') && mail.html.includes('ex-1'));

{
  const { alertRecipients } = await import('../api/_lib/build-alerts.js');
  const ownerPat = `x.${Buffer.from(JSON.stringify({ sub: 'owner@example.com', instance: { hosted_region: 'us' } })).toString('base64url')}.x`;
  delete process.env.BUILD_ALERT_EMAIL;
  delete process.env.VERCEL_ENV;
  calls = [];
  const r = await alertBuildFailed(alert, memoryStore() as never);
  check('a preview or local run with no BUILD_ALERT_EMAIL mails nobody', r === 'skipped' && calls.length === 0 && alertRecipients(ownerPat).length === 0);
  process.env.VERCEL_ENV = 'production';
  check("production with no BUILD_ALERT_EMAIL mails the Mark key's owner", alertRecipients(ownerPat).join() === 'owner@example.com');
  process.env.BUILD_ALERT_EMAIL = 'off';
  check('BUILD_ALERT_EMAIL=off mails nobody, even in production', alertRecipients(ownerPat).length === 0);
  process.env.BUILD_ALERT_EMAIL = 'a@example.com, b@example.com';
  check('BUILD_ALERT_EMAIL wins, comma-separated', alertRecipients(ownerPat).join() === 'a@example.com,b@example.com');
  delete process.env.VERCEL_ENV;
}
process.env.BUILD_ALERT_EMAIL = 'alerts@example.com';
{
  const store = memoryStore();
  calls = [];
  const first = await alertBuildFailed(alert, store as never);
  const second = await alertBuildFailed(alert, store as never);
  check('one email per build, however often it is looked at', first === 'sent' && second === 'skipped' && calls.length === 1, `${first} ${second} ${calls.length}`);
  const sent = calls[0];
  const headers = (sent?.init.headers ?? {}) as Record<string, string>;
  const body = JSON.parse(String(sent?.init.body ?? '{}')) as { tool_name?: string; parameters?: { toRecipients?: string; bodyContentType?: string } };
  check("it calls Mark's outlook_mail_send on the tools service as an mcp client", /\/tools-mgmt-service\/api\/tools\/organizations\/[^/]+\/tools\/invoke$/.test(sent?.url ?? '') && body.tool_name === 'outlook_mail_send' && headers['x-opal-client-type'] === 'mcp', `${sent?.url} ${headers['x-opal-client-type']}`);
  check('…to BUILD_ALERT_EMAIL, as HTML', (body.parameters?.toRecipients ?? '').includes('alerts@example.com') && body.parameters?.bodyContentType === 'HTML');
  const stall = await alertBuildFailed({ ...alert, stage: 'stalled' }, store as never);
  check('a stall is its own email (sent once more for the same build)', stall === 'sent');
}
{
  const store = memoryStore();
  toolAnswer = { response_type: 'application/json', response: { submitted: false } };
  calls = [];
  const staged = await alertBuildFailed(alert, store as never);
  toolAnswer = { response_type: 'auth_required', response: { requirements: [] } };
  const auth = await alertBuildFailed(alert, store as never);
  toolAnswer = { response_type: 'application/json', response: { message: 'Email sent successfully.' } };
  const retried = await alertBuildFailed(alert, store as never);
  check('a staged card or a missing sign-in counts as not sent, and the next look tries again', staged === 'failed' && auth === 'failed' && retried === 'sent' && calls.length === 3, `${staged} ${auth} ${retried} ${calls.length}`);
}

/* ---------- 4. refreshBuild ---------- */

{
  const store = memoryStore();
  const record: BuildRecord = { id: 'pb-ikea', kind: 'person', name: 'Cecilia Jeppsson', route: 'ikea/cecilia-jeppsson', companyName: 'IKEA', email: 'rep@example.com', startedAt: Date.now() - 60_000, status: 'running', executionId: 'ex-refresh' };
  await store.sadd('pb:open', record.id);
  executions.set('ex-refresh', blocked);
  calls = [];
  const { record: fresh } = await refreshBuild(store as never, record);
  const mails = calls.filter((c) => c.url.includes('/tools/invoke')).length;
  check('a finished run without a page settles as failed, with the reason', fresh.status === 'failed' && /410/.test(fresh.error ?? ''), JSON.stringify(fresh));
  check('…is emailed', mails === 1, String(mails));
  check('…and leaves pb:open', !(await store.smembers('pb:open')).includes(record.id));
  calls = [];
  await refreshBuild(store as never, fresh);
  check('looking again sends nothing more', calls.filter((c) => c.url.includes('/tools/invoke')).length === 0);
}
{
  const store = memoryStore();
  const record: BuildRecord = { id: 'pb-slow', kind: 'account', name: 'Acme', route: 'acme', email: 'rep@example.com', startedAt: Date.now() - STALL_MS - 60_000, status: 'running', executionId: 'ex-slow' };
  executions.set('ex-slow', execution('ex-slow', [], 'running'));
  calls = [];
  const { record: still } = await refreshBuild(store as never, record);
  await refreshBuild(store as never, record);
  const mails = calls.filter((c) => c.url.includes('/tools/invoke'));
  check('a run going for over an hour gets one "stalled" email and stays running', still.status === 'running' && mails.length === 1 && /stalled/.test(String(mails[0]?.init.body)), `${still.status} ${mails.length}`);
}
{
  const { saveBuild } = await import('../api/_lib/page-builds-store.js');
  const store = memoryStore();
  const record: BuildRecord = { id: 'pb-open', kind: 'account', name: 'Acme', route: 'acme', email: 'rep@example.com', startedAt: Date.now(), status: 'running' };
  await saveBuild(store as never, record);
  const openWhileRunning = (await store.smembers('pb:open')).includes('pb-open');
  await saveBuild(store as never, { ...record, status: 'done' });
  check('a running build is in pb:open, and leaves it when done', openWhileRunning && !(await store.smembers('pb:open')).includes('pb-open'));
}

/* ---------- 5. The sweep ---------- */

{
  const sweep = (await import('../api/page-builds/sweep.js')).default;
  delete process.env.CRON_SECRET;
  let r = fakeRes();
  await sweep(req({ headers: { authorization: 'Bearer anything' } }), r.res);
  check('no CRON_SECRET: the sweep refuses every call', r.out.status === 401);
  process.env.CRON_SECRET = 'cron-secret';
  r = fakeRes();
  await sweep(req({ headers: { authorization: 'Bearer wrong' } }), r.res);
  check('the wrong bearer is refused', r.out.status === 401);
  delete process.env.KV_REST_API_URL;
  r = fakeRes();
  await sweep(req({ headers: { authorization: 'Bearer cron-secret' } }), r.res);
  check("Vercel Cron's bearer gets through (503 here: no store in this check)", r.out.status === 503, String(r.out.status));
}

/* ---------- 6. The address, and the wiring ---------- */

check('a running or waiting build holds its address', buildHoldsAddress({ status: 'running' }) && buildHoldsAddress({ status: 'waiting' }));
check('a failed or finished build does not', !buildHoldsAddress({ status: 'failed' }) && !buildHoldsAddress({ status: 'done' }));
const ssr = read('server/ssr-handler.tsx');
check('the server render asks buildHoldsAddress before it puts the build view in front of the page', /buildHoldsAddress\(build\) && url\.searchParams\.get\('view'\) !== 'page'/.test(ssr));
check("…and no longer stands any unfinished build there (status !== 'done')", !/if \(build\.status !== 'done' && url\.searchParams/.test(ssr));
const hook = read('src/hooks/usePageRequest.tsx');
check('the search bar carries the search text into the name only when it reads as a person', /setPerson\(nextKind === 'person' && looksLikePersonName\(q\) && !findCompany\(q\) \? q : ''\)/.test(hook));
check('…checks the name before sending, and shows a 400\'s reason', /personNameProblem\(who,/.test(hook) && /r\.status === 400/.test(hook));
const vercel = JSON.parse(read('vercel.json')) as { crons?: { path: string; schedule: string }[] };
check('the sweep is a Vercel Cron every 10 minutes', !!vercel.crons?.some((c) => c.path === '/api/page-builds/sweep' && c.schedule === '*/10 * * * *'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
