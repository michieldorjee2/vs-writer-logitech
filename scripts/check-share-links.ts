/**
 * check-share-links — personal links (src/lib/share-links.ts) and the Share card's ways out.
 *
 *   1. What a rep types: who, an address that is one, a note within bounds, a page that is an
 *      account or person page (never an offer page, the search page or the API).
 *   2. Codes: eight letters and digits from a CSPRNG, no repeats in thousands.
 *   3. api/share-links: signed-in only, same-site JSON only; the sender is the signed-in person and
 *      never one the request names; 40 a day; the list carries no addresses.
 *   4. api/share-go (/s/<code>): to the link's own page with the code; unknown codes are a 404.
 *   5. api/share-note: the note without addresses, only on its own page; an open counted once per
 *      visitor, sent to ODP with the visitor and the recipient's address; never for anyone signed in.
 *   6. api/cta-ping: a click by a personal link names it to Mark (fixture-shared.json, which
 *      mark/cta-ping/test_step.py reads), counts on the link once per visitor, and goes to ODP;
 *      a code from another page is ignored.
 *   7. api/share-send: Teams only ever to the signed-in person, with the link of this page only
 *      (mark/share-teams/fixture.json, which mark/share-teams/test_step.py reads); off without the
 *      webhook. Email: Mark's draft when it answers, a template when it doesn't, the link in both.
 *   8. Wiring, read from the sources: the rewrite, the note never counting for staff, the webhook
 *      and the Mark key never in browser code.
 *
 * No network, no credentials.
 *
 *   npx tsx scripts/check-share-links.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkShareInput, isEmail, noteText, sharePathOf, type ShareLink } from '../src/lib/share-links.js';
import { newCode, type ShareStore } from '../api/_lib/share-store.js';
import linksHandler, { setShareLinksStore } from '../api/share-links.js';
import goHandler, { setShareGoStore } from '../api/share-go.js';
import noteHandler, { setShareNoteSources } from '../api/share-note.js';
import sendHandler, { buildShareTeams, parseDraft, setShareSendSources, teamsCheckOf, type ShareTeamsPing } from '../api/share-send.js';
import ctaHandler, { accountSource, buildPing, checkOf, setCtaShareSources, type CtaPing } from '../api/cta-ping.js';
import type { OdpEventIn } from '../api/_lib/odp-events.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600));
  }
}

/* ---------- 1. What a rep types ---------- */

const good = { route: '/lenovo/', recipient: { name: '  Ana  Silva ', title: 'CMO', email: 'Ana@Lenovo.com' }, message: 'Hi Ana,\r\n\r\n\r\n\r\nHere it is.\u0007' };
const ok = checkShareInput(good);
check('a good note is taken, tidied', ok.ok && 'value' in ok && ok.value.recipient.name === 'Ana Silva' && ok.value.recipient.email === 'ana@lenovo.com' && ok.value.message === 'Hi Ana,\n\nHere it is.' && ok.value.path === 'lenovo', ok);
const bad = (patch: Record<string, unknown>) => checkShareInput({ ...good, ...patch });
check('no name: refused', (bad({ recipient: { name: ' ' } }) as { field?: string }).field === 'name');
check('a bad address: refused', (bad({ recipient: { name: 'A', email: 'ana@lenovo' } }) as { field?: string }).field === 'email');
check('no address is fine', bad({ recipient: { name: 'A' } }).ok);
check('no note: refused', (bad({ message: ' \n ' }) as { field?: string }).field === 'message');
check('a note over 1200 characters: refused', (bad({ message: 'x'.repeat(1201) }) as { field?: string }).field === 'message');
for (const route of ['/vb/offer/', '/search', '/api/share-links', '/s/Ab3dE9xY', '/a/b/c/', 'https://evil.example/lenovo/', '/../etc/', '/Le novo/']) {
  check(`not a page for links: ${route}`, sharePathOf(route) === null);
}
check('a person page and a locale prefix', sharePathOf('/en/Logitech/ben-yu/')?.path === 'logitech/ben-yu' && sharePathOf('/logitech/ben-yu')?.person === true);
check('addresses', isEmail('a.b+c@x.co.uk') && !isEmail('a@b') && !isEmail('a b@c.com') && !isEmail('<a@b.com>') && !isEmail(`${'a'.repeat(65)}@b.com`));
check('a note keeps its line breaks and drops control characters', noteText('a\u0000b\n\n\n\nc\td', 50) === 'a b\n\nc d');

/* ---------- 2. Codes ---------- */

const codes = new Set(Array.from({ length: 5000 }, () => newCode()));
check('codes: 8 letters and digits', [...codes].every((c) => /^[A-Za-z0-9]{8}$/.test(c)));
check('codes: no repeats in 5000', codes.size === 5000);

/* ---------- the stand-ins ---------- */

type Res = { statusCode: number; body: unknown; headers: Record<string, string>; ended: boolean };
function call(handler: (req: never, res: never) => unknown, req: Record<string, unknown>): Promise<Res> {
  const out: Res = { statusCode: 200, body: undefined, headers: {}, ended: false };
  const res = {
    setHeader: (k: string, v: string) => (out.headers[k.toLowerCase()] = v),
    getHeader: (k: string) => out.headers[k.toLowerCase()],
    status(c: number) {
      out.statusCode = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      out.ended = true;
      return res;
    },
    send(b: unknown) {
      out.body = b;
      out.ended = true;
      return res;
    },
    end() {
      out.ended = true;
      return res;
    },
  };
  const headers = { host: 'showcase.optimizely.com', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.9', 'user-agent': 'check', ...(req.headers as object) };
  return Promise.resolve(handler({ cookies: {}, query: {}, socket: {}, ...req, headers } as never, res as never)).then(() => out);
}

function memoryStore() {
  const kv = new Map<string, unknown>();
  const z = new Map<string, Map<string, number>>();
  const h = new Map<string, Record<string, unknown>>();
  const store = {
    async set(key: string, v: unknown, o?: { nx?: boolean }) {
      if (o?.nx && kv.has(key)) return null;
      kv.set(key, v);
      return 'OK';
    },
    async get(key: string) {
      return kv.has(key) ? structuredClone(kv.get(key)) : null;
    },
    async incr(key: string) {
      const n = Number(kv.get(key) ?? 0) + 1;
      kv.set(key, n);
      return n;
    },
    async expire() {
      return 1;
    },
    async zadd(key: string, m: { score: number; member: string }) {
      const s = z.get(key) ?? new Map();
      s.set(m.member, m.score);
      z.set(key, s);
      return 1;
    },
    async zremrangebyrank() {
      return 0;
    },
    async zrange(key: string, start: number, stop: number, o?: { rev?: boolean }) {
      const sorted = [...(z.get(key) ?? new Map())].sort((a, b) => (o?.rev ? b[1] - a[1] : a[1] - b[1])).map(([m]) => m);
      return sorted.slice(start, stop + 1);
    },
    async hincrby(key: string, f: string, by: number) {
      const o = h.get(key) ?? {};
      o[f] = Number(o[f] ?? 0) + by;
      h.set(key, o);
      return o[f];
    },
    async hset(key: string, o: Record<string, unknown>) {
      h.set(key, { ...(h.get(key) ?? {}), ...o });
      return 1;
    },
    async hsetnx(key: string, f: string, v: unknown) {
      const o = h.get(key) ?? {};
      if (f in o) return 0;
      o[f] = v;
      h.set(key, o);
      return 1;
    },
    async hgetall(key: string) {
      return h.get(key) ?? null;
    },
  };
  return { store: store as unknown as ShareStore, kv, z, h };
}

const signIn = (email: string | null) => {
  delete process.env.OPTIID_RELAY_SECRET;
  if (email) process.env.DEV_AUTH_EMAIL = email;
  else delete process.env.DEV_AUTH_EMAIL;
};

/* ---------- 3. api/share-links ---------- */

const mem = memoryStore();
setShareLinksStore(mem.store);
setShareGoStore(mem.store);
const odp: OdpEventIn[] = [];
setShareNoteSources(mem.store, async (e) => {
  odp.push(e);
  return true;
});
setCtaShareSources({ store: mem.store, odp: async (e) => (odp.push(e), true) });

signIn(null);
check('share-links: signed out is refused', (await call(linksHandler, { method: 'POST', body: good })).statusCode === 401);
check('share-links: signed out can\'t list', (await call(linksHandler, { method: 'GET', query: { page: '/lenovo/' } })).statusCode === 401);
signIn('rep@optimizely.com');
check('share-links: another site is refused', (await call(linksHandler, { method: 'POST', body: good, headers: { 'sec-fetch-site': 'cross-site' } })).statusCode === 403);
check('share-links: a form post is refused', (await call(linksHandler, { method: 'POST', body: JSON.stringify(good), headers: { 'content-type': 'text/plain' } })).statusCode === 415);
const badPost = await call(linksHandler, { method: 'POST', body: { ...good, recipient: { name: 'A', email: 'nope' } } });
check('share-links: a bad address says which field', badPost.statusCode === 400 && (badPost.body as { field?: string }).field === 'email', badPost.body);
check('share-links: too large is refused', (await call(linksHandler, { method: 'POST', body: { ...good, pad: 'x'.repeat(5000) } })).statusCode === 400);

const made = await call(linksHandler, { method: 'POST', body: { ...good, sender: { name: 'Mallory', email: 'mallory@evil.example' } } });
const madeBody = made.body as { code: string; url: string };
check('share-links: made, at the site\'s short address', made.statusCode === 201 && /^https:\/\/showcase\.optimizely\.com\/s\/[A-Za-z0-9]{8}$/.test(madeBody.url), made.body);
const stored = mem.kv.get(`sl:${madeBody.code}`) as ShareLink;
check('share-links: the sender is the signed-in person, never the request\'s', stored?.sender.email === 'rep@optimizely.com' && !JSON.stringify(stored).includes('evil'), stored);
const preview = await call(linksHandler, { method: 'POST', body: good, headers: { host: 'aldus-preprod.vercel.app' } });
check('share-links: a preview\'s link is the preview\'s', /^https:\/\/aldus-preprod\.vercel\.app\/s\//.test((preview.body as { url: string }).url));
const elsewhere = await call(linksHandler, { method: 'POST', body: good, headers: { host: 'evil.example', origin: 'https://evil.example' } });
check('share-links: any other host\'s link is the site\'s', /^https:\/\/showcase\.optimizely\.com\/s\//.test((elsewhere.body as { url: string }).url));

const list = await call(linksHandler, { method: 'GET', query: { page: '/lenovo/' } });
const rows = (list.body as { links: Array<Record<string, unknown>> }).links;
check('share-links: the page\'s links, newest first', list.statusCode === 200 && rows.length === 3, list.body);
check('share-links: the list carries no addresses', !JSON.stringify(rows).includes('@'), rows);
check('share-links: another page\'s list is its own', ((await call(linksHandler, { method: 'GET', query: { page: '/cdw/' } })).body as { links: unknown[] }).links.length === 0);

let limited = 0;
for (let i = 0; i < 40; i++) if ((await call(linksHandler, { method: 'POST', body: good })).statusCode === 429) limited++;
check('share-links: 40 a day each', limited === 3, limited);

/* ---------- 4. /s/<code> ---------- */

const go = await call(goHandler, { method: 'GET', query: { code: madeBody.code } });
check('share-go: to the link\'s page, with the code', go.statusCode === 302 && go.headers.location === `/lenovo/?p=${madeBody.code}`, go);
check('share-go: unknown code is a 404 page', (await call(goHandler, { method: 'GET', query: { code: 'ZZZZZZZZ' } })).statusCode === 404);
check('share-go: a malformed code is a 404 page', (await call(goHandler, { method: 'GET', query: { code: '../x' } })).statusCode === 404);

/* ---------- 5. api/share-note ---------- */

signIn(null);
const note = await call(noteHandler, { method: 'GET', query: { code: madeBody.code, page: '/lenovo/' } });
check('share-note: the note, without addresses', note.statusCode === 200 && (note.body as { message: string }).message === 'Hi Ana,\n\nHere it is.' && !JSON.stringify(note.body).includes('@'), note.body);
check('share-note: not on another page', (await call(noteHandler, { method: 'GET', query: { code: madeBody.code, page: '/cdw/' } })).statusCode === 404);

const VUID = '63066a45fbc6401782b6dcfe90d43b84';
const open1 = await call(noteHandler, { method: 'POST', body: { code: madeBody.code, page: '/lenovo/', vuid: '63066a45-fbc6-4017-82b6-dcfe90d43b84' } });
const open2 = await call(noteHandler, { method: 'POST', body: { code: madeBody.code, page: '/lenovo/', vuid: VUID } });
const stats = () => mem.h.get(`sl:s:${madeBody.code}`) ?? {};
check('share-note: an open is counted once per visitor', open1.statusCode === 204 && open2.statusCode === 204 && stats().opens === 1, stats());
check('share-note: …and goes to ODP with the visitor and the recipient', odp.length === 1 && odp[0].action === 'personal_link_open' && odp[0].identifiers.vuid === VUID && odp[0].identifiers.email === 'ana@lenovo.com' && odp[0].data.label === madeBody.code && odp[0].data.page === '/lenovo/', odp);
await call(noteHandler, { method: 'POST', body: { code: madeBody.code, page: '/lenovo/' }, headers: { 'user-agent': 'another browser' } });
check('share-note: another visitor is another open', stats().opens === 2 && odp.length === 2 && !odp[1].identifiers.vuid);
signIn('rep@optimizely.com');
await call(noteHandler, { method: 'POST', body: { code: madeBody.code, page: '/lenovo/', vuid: 'f'.repeat(32) } });
check('share-note: someone signed in is never counted or sent', stats().opens === 2 && odp.length === 2);
signIn(null);
check('share-note: another site can\'t count opens', (await call(noteHandler, { method: 'POST', body: { code: madeBody.code, page: '/lenovo/' }, headers: { 'sec-fetch-site': 'cross-site' } })).statusCode === 403);
let reads = 0;
for (let i = 0; i < 40; i++) if ((await call(noteHandler, { method: 'GET', query: { code: madeBody.code, page: '/lenovo/' }, headers: { 'x-forwarded-for': '198.51.100.4' } })).statusCode === 429) reads++;
check('share-note: 30 reads a minute an address', reads === 10, reads);

/* ---------- 6. api/cta-ping ---------- */

const TEAM = [
  { Initials: 'SR', Name: 'Sam Rep', Role: 'Sales Development Representative', Email: 'sam.rep@optimizely.com' },
  { Initials: 'SA', Name: 'Solutions Architect', Role: 'Solutions Architect', Email: null },
  { Initials: 'AE', Name: 'Alex Exec', Role: 'Enterprise Account Executive', Email: 'Alex.Exec@optimizely.com' },
];
const ZURICH = {
  _metadata: { url: { default: '/en/zurich-versicherung/', hierarchical: '/en/zurich-versicherung/' } },
  eyebrow: 'Personalized for Zürich Versicherung',
  intelHeadline: 'We know <em>Zürich Versicherung – “Group” | AG</em>',
  teamMembers: TEAM,
};
const sharedPing = buildPing(accountSource(ZURICH as never), 'zurich-versicherung', 'hero-connect-btn', {}, new Date('2026-11-06T09:12:00.000Z'), '5b0f3c1e-2d4a-4e8b-9c7d-1a2b3c4d5e6f', {
  code: 'Ab3dE9xY',
  recipient: { name: 'Lena Brunner', title: 'Head of Digital <Experience>', email: 'Lena.Brunner@zurich.example' },
  sender: { name: 'Michiel Dorjee', email: 'michiel@optimizely.com' },
});
check('cta-ping: a click by a personal link is fixture-shared.json, which Mark\'s step reads', JSON.stringify(sharedPing) === JSON.stringify(JSON.parse(read('mark/cta-ping/fixture-shared.json'))), sharedPing);
{
  const { check: c, ...rest } = sharedPing;
  check('cta-ping: …and its check covers the link', c === checkOf(rest) && checkOf({ ...rest, shared: { ...rest.shared!, code: 'Zz9yX8wV' } }) !== c);
}
const plain = buildPing(accountSource(ZURICH as never), 'zurich-versicherung', 'hero-connect-btn', {});
check('cta-ping: a click without one has no `shared` at all (fixture.json unchanged)', !('shared' in plain));

// The handler, end to end: Graph and Mark stood in.
// Another rep: the first one used up their day above.
signIn('other.rep@optimizely.com');
const zLink = (await call(linksHandler, { method: 'POST', body: { ...good, route: '/zurich-versicherung/', recipient: { name: 'Lena Brunner', title: 'Head of Digital', email: 'lena@zurich.example' } } })).body as { code: string };
signIn(null);
const realFetch = globalThis.fetch;
const marked: string[] = [];
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  const u = String(url);
  if (u.startsWith('https://cg.optimizely.com/')) {
    const { variables } = JSON.parse(String(init?.body)) as { variables: { slug: string } };
    const items = variables.slug === '/en/zurich-versicherung/' ? [ZURICH] : [];
    return new Response(JSON.stringify({ data: { CompetitorComparisonPage: { items } } }), { status: 200 });
  }
  if (u.startsWith('https://webhook.mark.optimizely.com/')) {
    marked.push(String(init?.body));
    return new Response('{}', { status: 200 });
  }
  throw new Error(`unexpected fetch ${u}`);
}) as typeof fetch;
const env = { CTA_PING_WEBHOOK_URL: 'https://webhook.mark.optimizely.com/webhooks/i/t', CTA_PING_WEBHOOK_KEY: 'k'.repeat(32), GRAPH_AUTH_KEY: 'g', KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined };
const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
const setEnv = (e: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(e)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};
setEnv(env);
const odpBefore = odp.length;
try {
  const r = await call(ctaHandler, { method: 'POST', body: { route: '/zurich-versicherung/', source: 'cta-connect-btn', utm: {}, share: zLink.code, vuid: VUID } });
  const sent = JSON.parse(marked[0] ?? '{}') as CtaPing;
  check('cta-ping: Mark hears who the link was for and who sent it', r.statusCode === 202 && sent.shared?.code === zLink.code && sent.shared?.recipient.email === 'lena@zurich.example' && sent.shared?.sender.email === 'other.rep@optimizely.com', { r, sent });
  const { check: c, ...rest } = sent;
  check('cta-ping: …under the check', c === checkOf(rest));
  check('cta-ping: the link counts the click', mem.h.get(`sl:s:${zLink.code}`)?.ctas === 1);
  check('cta-ping: …and ODP hears it, with the visitor and the recipient', odp.length === odpBefore + 1 && odp.at(-1)?.action === 'personal_link_cta' && odp.at(-1)?.identifiers.email === 'lena@zurich.example' && odp.at(-1)?.identifiers.vuid === VUID);
  await call(ctaHandler, { method: 'POST', body: { route: '/zurich-versicherung/', source: 'hero-connect-btn', utm: {}, share: zLink.code, vuid: VUID } });
  check('cta-ping: once per visitor an hour on the link', mem.h.get(`sl:s:${zLink.code}`)?.ctas === 1 && odp.length === odpBefore + 1);
  marked.length = 0;
  await call(ctaHandler, { method: 'POST', body: { route: '/zurich-versicherung/', source: 'hero-connect-btn', utm: {}, share: madeBody.code } });
  check('cta-ping: another page\'s code is ignored', marked.length === 1 && !('shared' in JSON.parse(marked[0])));
  setEnv({ CTA_PING_WEBHOOK_URL: undefined });
  marked.length = 0;
  await call(ctaHandler, { method: 'POST', body: { route: '/zurich-versicherung/', source: 'hero-connect-btn', utm: {}, share: zLink.code }, headers: { 'user-agent': 'a preview visitor' } });
  check('cta-ping: with the webhook off (previews) the link still counts, and nobody is messaged', mem.h.get(`sl:s:${zLink.code}`)?.ctas === 2 && marked.length === 0);
} finally {
  globalThis.fetch = realFetch;
  setEnv(saved);
}

/* ---------- 7. api/share-send ---------- */

const teamsFixture = JSON.parse(read('mark/share-teams/fixture.json')) as ShareTeamsPing;
const rebuilt = buildShareTeams({
  to: { sub: 'x', email: 'Michiel@optimizely.com', name: 'Michiel Dorjee', env: 'prod' },
  pageUrl: 'https://showcase.optimizely.com/zurich-versicherung/',
  title: 'Zürich Versicherung – “Group” | AG',
  person: false,
  link: {
    code: 'Ab3dE9xY',
    path: 'zurich-versicherung',
    created: 1793955120,
    url: 'https://showcase.optimizely.com/s/Ab3dE9xY',
    message: 'Hi Lena,\n\nGreat to meet you at <Opticon>. Here is the page we made.\n\n\n\nMichiel',
    recipient: { name: 'Lena Brunner', title: 'Head of Digital', email: 'lena.brunner@zurich.example' },
    sender: { name: 'Michiel Dorjee', email: 'michiel@optimizely.com' },
    stats: { opens: 2, firstOpen: 1793990000, lastOpen: 1794040000, ctas: 1, lastCta: 1794040100 },
  },
  report: {
    report: { visitors: { visits: 12, visitors: 4, ctaClicks: 1, visitList: [{ ts: 1793900000, sec: 40, scroll: 50, source: 'linkedin', ctas: [], country: 'CH' }, { ts: 1794040000, sec: 90, scroll: 80, source: 'email', ctas: ['Arrange a session'], country: 'CH' }] }, to: 1794050000 },
    history: [],
    bench: null,
    account: { id: '001xx000003DGb2AAG', stage: 'Prospect' },
  } as never,
  now: new Date('2026-11-06T10:00:00.000Z'),
  pingId: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f',
});
check('share-send: the Teams request is mark/share-teams/fixture.json, which Mark\'s step reads', JSON.stringify(rebuilt) === JSON.stringify(teamsFixture), rebuilt);
{
  const { check: c, ...rest } = teamsFixture;
  check('share-send: …with its check', c === teamsCheckOf(rest));
}

const posts: Array<{ url: string; headers: Record<string, string>; body: ShareTeamsPing }> = [];
let agentAnswer: string | Error = '{"subject":"Ana, your page","body":"Hi Ana,\\n\\nHave a look."}';
setShareSendSources({
  store: mem.store,
  post: (async (url: string, init: RequestInit) => {
    posts.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response('{}', { status: 200 });
  }) as never,
  agent: async () => {
    if (agentAnswer instanceof Error) throw agentAnswer;
    return agentAnswer;
  },
});
const sendEnv = { SHARE_TEAMS_WEBHOOK_URL: 'https://webhook.mark.optimizely.com/webhooks/i/share', SHARE_TEAMS_WEBHOOK_KEY: 's'.repeat(32), SHARE_EMAIL_AGENT_ID: 'agent-1', KV_REST_API_URL: undefined, KV_REST_API_TOKEN: undefined };
const sendSaved = Object.fromEntries(Object.keys(sendEnv).map((k) => [k, process.env[k]]));
setEnv(sendEnv);
try {
  signIn(null);
  check('share-send: signed out is refused', (await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/lenovo/' } })).statusCode === 401);
  signIn('rep@optimizely.com');
  const t = await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/lenovo/', code: madeBody.code, title: 'Lenovo', to: { email: 'ceo@lenovo.com' } } });
  const p = posts[0];
  check('share-send: Teams goes to Mark with the key', t.statusCode === 202 && p?.url === sendEnv.SHARE_TEAMS_WEBHOOK_URL && p.headers['x-showcase-key'] === sendEnv.SHARE_TEAMS_WEBHOOK_KEY, t);
  check('share-send: …only ever to the signed-in person', p?.body.to.email === 'rep@optimizely.com' && !JSON.stringify(p?.body).includes('ceo@'), p?.body);
  check('share-send: …with their personal link and its opens', p?.body.link?.url === `https://showcase.optimizely.com/s/${madeBody.code}` && p.body.link.opens === 2 && p.body.link.recipient === 'Ana Silva, CMO');
  {
    const { check: c, ...rest } = p.body;
    check('share-send: …under the check', c === teamsCheckOf(rest));
  }
  check('share-send: another page\'s link is refused', (await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/cdw/', code: madeBody.code } })).statusCode === 404);
  check('share-send: a malformed code is refused', (await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/lenovo/', code: 'x' } })).statusCode === 400);
  check('share-send: another site is refused', (await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/lenovo/' }, headers: { 'sec-fetch-site': 'cross-site' } })).statusCode === 403);
  setEnv({ SHARE_TEAMS_WEBHOOK_URL: 'https://example.com/hook' });
  const n = posts.length;
  check('share-send: a webhook that isn\'t Mark\'s gets nothing', (await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/lenovo/' } })).statusCode === 503 && posts.length === n);
  setEnv({ SHARE_TEAMS_WEBHOOK_URL: undefined });
  check('share-send: off without the webhook', (await call(sendHandler, { method: 'POST', body: { channel: 'teams', route: '/lenovo/' } })).statusCode === 503);

  const e1 = await call(sendHandler, { method: 'POST', body: { channel: 'email', route: '/lenovo/', code: madeBody.code, title: 'Lenovo' } });
  const d1 = e1.body as { to: string; subject: string; body: string; by: string };
  check('share-send: Mark\'s draft, to the recipient, with the link', e1.statusCode === 200 && d1.by === 'mark' && d1.to === 'ana@lenovo.com' && d1.subject === 'Ana, your page' && d1.body.endsWith(`https://showcase.optimizely.com/s/${madeBody.code}`), d1);
  agentAnswer = new Error('Mark took too long');
  const d2 = (await call(sendHandler, { method: 'POST', body: { channel: 'email', route: '/lenovo/', code: madeBody.code, title: 'Lenovo' } })).body as typeof d1;
  check('share-send: Mark unavailable: the template, with the note and the link', d2.by === 'template' && d2.body.includes('Here it is.') && d2.body.includes(`/s/${madeBody.code}`) && d2.subject === 'Ana, a page we made for Lenovo', d2);
  agentAnswer = 'Sure! Here you go: nothing useful';
  const d3 = (await call(sendHandler, { method: 'POST', body: { channel: 'email', route: '/lenovo/', title: 'Lenovo' } })).body as typeof d1;
  check('share-send: an answer that isn\'t a draft: the template, to nobody, with the public link', d3.by === 'template' && d3.to === '' && d3.body.includes('https://showcase.optimizely.com/lenovo/'), d3);
  check('parseDraft: the link is added when Mark left it out', parseDraft('{"subject":"S","body":"B"}', '', 'https://x/s/1')?.body === 'B\n\nhttps://x/s/1');
} finally {
  setEnv(sendSaved);
  signIn(null);
}

/* ---------- 8. Wiring ---------- */

const vercel = JSON.parse(read('vercel.json')) as { rewrites: Array<{ source: string; destination: string }> };
const rw = vercel.rewrites.findIndex((r) => r.source === '/s/:code' && r.destination === '/api/share-go?code=:code');
const ssr = vercel.rewrites.findIndex((r) => r.destination === '/api/ssr');
check('vercel.json: /s/<code> is the short link, ahead of the page renderer', rw >= 0 && rw < ssr);
const invite = read('src/components/InviteNote.tsx');
check('the note never counts a staff browser', /if \(isStaffBrowser\(\)\) return;[\s\S]*fetch\('\/api\/share-note', \{\s*method: 'POST'/.test(invite));
check('the note is only mounted without the booth tools', /const shareCode = hydrated && !fromSearch/.test(read('src/App.tsx')));
const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? (f === 'node_modules' || f === 'vendor' || f === '__tests__' ? [] : files(join(dir, f))) : [join(dir, f)]));
const browser = files('src').filter((f) => /\.(ts|tsx)$/.test(f));
const leaks = browser.filter((f) => /SHARE_TEAMS_WEBHOOK|SHARE_EMAIL_AGENT|OPAL_PAT|webhook\.mark\.optimizely/.test(read(f)));
check('the browser code never holds the share webhook, the agent or Mark\'s key', leaks.length === 0, leaks);
check('the ODP key is still read in one server file', [...files('api'), ...files('src')].filter((f) => /\.(ts|tsx)$/.test(f) && read(f).includes('ODP_PRIVATE_KEY')).join() === 'api/_lib/odp-events.ts');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
