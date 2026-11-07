/**
 * check-cms-purge — the CMS webhook that empties a page's edge cache when it is published or
 * deleted (api/cms-published.ts), offline.
 *
 *   1. The handshake and the token: OPTIONS answers the CloudEvents validation; a POST without
 *      the right bearer token is refused, as is one when no token is configured.
 *   2. A publish waits until Graph serves the new version, then deletes the page's cache by its tag
 *      (never an invalidate, which shows the old copy once more). A delete waits until Graph no
 *      longer has the item. Graph never catching up still purges, after the wait.
 *   3. Payload shapes: a dashed key, a key only in the subject, a batch naming a page twice,
 *      another event type.
 *   4. Wiring, read from the sources: the server render tags pages with the header Vercel reads,
 *      with the same tag the purge uses, and keeps purged pages longer than unpurged ones.
 *
 * Graph and Vercel are stubbed; the clock is simulated. No network, no credentials.
 *
 *   npx tsx scripts/check-cms-purge.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler, { deps, POLL_MS, WAIT_MS } from '../api/cms-published.js';
import { pageTag } from '../api/_lib/purge-page.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
let passed = 0;
let failed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${err instanceof Error ? err.message : String(err)}`);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const KEY = 'a359c5e9985d432c8ddedc69b4eba6b8';
const DASHED = 'a359c5e9-985d-432c-8dde-dc69b4eba6b8';
const OTHER = '0123456789abcdef0123456789abcdef';
const TOKEN = 'test-webhook-token';

/** The world the handler sees: Graph's versions per key over time, Vercel's purge endpoint, a clock. */
type World = { graph: (key: string, call: number) => number[] | 'error'; purgeStatus?: number };
type Seen = { graphCalls: Map<string, number>; purges: { url: string; tags: string[] }[]; clock: number };

function install(world: World): Seen {
  const seen: Seen = { graphCalls: new Map(), purges: [], clock: 0 };
  deps.now = () => seen.clock;
  deps.sleep = async (ms: number) => {
    seen.clock += ms;
  };
  deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (url.startsWith('https://cg.optimizely.com/')) {
      const key = body.variables.key as string;
      const call = (seen.graphCalls.get(key) ?? 0) + 1;
      seen.graphCalls.set(key, call);
      const versions = world.graph(key, call);
      if (versions === 'error') return new Response('nope', { status: 500 });
      const items = versions.map((v) => ({ _metadata: { key, version: String(v) } }));
      return Response.json({ data: { _Content: { items } } });
    }
    if (url.startsWith('https://api.vercel.com/')) {
      seen.purges.push({ url, tags: body.tags });
      return new Response('{}', { status: world.purgeStatus ?? 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  return seen;
}

type Reply = { status: number; headers: Record<string, string>; json: unknown };
async function call(method: string, opts: { headers?: Record<string, string>; body?: unknown } = {}): Promise<Reply> {
  const reply: Reply = { status: 0, headers: {}, json: null };
  const req = { method, headers: Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])), body: opts.body };
  const res = {
    setHeader(name: string, value: string) {
      reply.headers[name.toLowerCase()] = String(value);
      return res;
    },
    status(code: number) {
      reply.status = code;
      return res;
    },
    json(value: unknown) {
      reply.json = value;
      return res;
    },
    end() {
      return res;
    },
  };
  await handler(req as never, res as never);
  return reply;
}
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/cloudevents+json' };
const published = (key: string, version: string) => ({
  specversion: '1.0',
  type: 'contentVersion:preview1:published',
  source: 'https://example.cms.optimizely.com',
  subject: `/contentVersion/preview1/${key}/${version}`,
  data: { key, version },
});

process.env.CMS_WEBHOOK_TOKEN = TOKEN;
process.env.GRAPH_AUTH_KEY = 'test-graph-key';
process.env.VERCEL_TOKEN = 'test-vercel-token';

console.log('1. handshake and token');
await check('OPTIONS answers the CloudEvents validation with the origin it was asked for', async () => {
  install({ graph: () => [] });
  const r = await call('OPTIONS', { headers: { 'WebHook-Request-Origin': 'eventgrid.example.com' } });
  assert(r.status === 200, `status ${r.status}`);
  assert(r.headers['webhook-allowed-origin'] === 'eventgrid.example.com', `allowed origin ${r.headers['webhook-allowed-origin']}`);
});
await check('a POST without the token, or with another one, is refused and nothing is purged', async () => {
  const seen = install({ graph: () => [15000] });
  const none = await call('POST', { body: published(KEY, '15000') });
  const wrong = await call('POST', { headers: { Authorization: 'Bearer nope' }, body: published(KEY, '15000') });
  assert(none.status === 401 && wrong.status === 401, `statuses ${none.status} ${wrong.status}`);
  assert(seen.purges.length === 0 && seen.graphCalls.size === 0, 'something was read or purged');
});
await check('no token configured: refused (503), never open to anyone', async () => {
  delete process.env.CMS_WEBHOOK_TOKEN;
  try {
    install({ graph: () => [15000] });
    const r = await call('POST', { headers: auth, body: published(KEY, '15000') });
    assert(r.status === 503, `status ${r.status}`);
  } finally {
    process.env.CMS_WEBHOOK_TOKEN = TOKEN;
  }
});
await check('GET is not a webhook (405)', async () => {
  install({ graph: () => [] });
  assert((await call('GET')).status === 405, 'not 405');
});

console.log('2. wait for Graph, then delete the cache');
await check('a publish waits until Graph serves the new version, then deletes the page tag', async () => {
  // Graph has the old version for two reads, then the new one.
  const seen = install({ graph: (_k, n) => (n < 3 ? [14969] : [15000]) });
  const r = await call('POST', { headers: auth, body: published(KEY, '15000') });
  assert(r.status === 200, `status ${r.status}`);
  assert(seen.graphCalls.get(KEY) === 3, `graph reads ${seen.graphCalls.get(KEY)}`);
  assert(seen.purges.length === 1, `purges ${seen.purges.length}`);
  assert(seen.purges[0].url.includes('/v1/edge-cache/dangerously-delete-by-tags'), `endpoint ${seen.purges[0].url}`);
  assert(!seen.purges[0].url.includes('invalidate'), 'an invalidate shows the old copy once more');
  assert(JSON.stringify(seen.purges[0].tags) === JSON.stringify([`page:${KEY}`]), `tags ${seen.purges[0].tags}`);
  assert(seen.clock === 2 * POLL_MS, `waited ${seen.clock} ms`);
  const outcome = (r.json as { outcomes: { graph: string }[] }).outcomes[0];
  assert(outcome.graph === 'current', `graph ${outcome.graph}`);
});
await check('the purge never runs before Graph has the version (the old copy would be cached again)', async () => {
  let purgedAtCall = -1;
  const seen = install({ graph: (_k, n) => (n < 4 ? [14969] : [15000]) });
  const realFetch = deps.fetch;
  deps.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).startsWith('https://api.vercel.com/')) purgedAtCall = seen.graphCalls.get(KEY) ?? 0;
    return realFetch(input, init);
  }) as typeof fetch;
  await call('POST', { headers: auth, body: published(KEY, '15000') });
  assert(purgedAtCall === 4, `purged after Graph read ${purgedAtCall}`);
});
await check('a Graph error is not taken for an answer: it asks again', async () => {
  const seen = install({ graph: (_k, n) => (n === 1 ? 'error' : [15000]) });
  const r = await call('POST', { headers: auth, body: published(KEY, '15000') });
  assert(r.status === 200 && seen.graphCalls.get(KEY) === 2 && seen.purges.length === 1, `reads ${seen.graphCalls.get(KEY)} purges ${seen.purges.length}`);
});
await check('a delete waits until Graph no longer has the item', async () => {
  const seen = install({ graph: (_k, n) => (n < 2 ? [15000] : []) });
  const r = await call('POST', {
    headers: auth,
    body: { specversion: '1.0', type: 'content:preview1:deleted', subject: `/content/preview1/${KEY}`, data: { key: KEY, isPermanent: false } },
  });
  assert(r.status === 200 && seen.purges.length === 1, `status ${r.status} purges ${seen.purges.length}`);
  assert((r.json as { outcomes: { graph: string }[] }).outcomes[0].graph === 'gone', 'not gone');
});
await check(`Graph never catching up: purged anyway, after at most ${WAIT_MS / 1000} s`, async () => {
  const seen = install({ graph: () => [14969] });
  const r = await call('POST', { headers: auth, body: published(KEY, '15000') });
  assert(seen.purges.length === 1, `purges ${seen.purges.length}`);
  assert(seen.clock <= WAIT_MS, `waited ${seen.clock} ms`);
  assert((r.json as { outcomes: { graph: string }[] }).outcomes[0].graph === 'timeout', 'not timeout');
});
await check('a failed purge is not a success: 502, so the CMS delivers again', async () => {
  install({ graph: () => [15000], purgeStatus: 500 });
  const r = await call('POST', { headers: auth, body: published(KEY, '15000') });
  assert(r.status === 502, `status ${r.status}`);
});

console.log('3. payload shapes');
await check('a dashed key is the same page as Graph’s 32-hex key', async () => {
  const seen = install({ graph: () => [15000] });
  await call('POST', { headers: auth, body: published(DASHED, '15000') });
  assert(seen.purges[0]?.tags[0] === `page:${KEY}`, `tag ${seen.purges[0]?.tags[0]}`);
});
await check('a key only in the subject is found', async () => {
  const seen = install({ graph: () => [15000] });
  await call('POST', { headers: auth, body: { type: 'contentVersion:preview1:published', subject: `/contentVersion/preview1/${KEY}/15000`, data: { version: '15000' } } });
  assert(seen.purges[0]?.tags[0] === `page:${KEY}`, `tag ${seen.purges[0]?.tags[0]}`);
});
await check('a batch naming a page twice: one wait per page, one purge with each tag once', async () => {
  const seen = install({ graph: () => [15001] });
  await call('POST', { headers: auth, body: [published(KEY, '15000'), published(KEY, '15001'), published(OTHER, '7')] });
  assert(seen.purges.length === 1, `purges ${seen.purges.length}`);
  assert(JSON.stringify(seen.purges[0].tags.sort()) === JSON.stringify([`page:${OTHER}`, `page:${KEY}`].sort()), `tags ${seen.purges[0].tags}`);
  assert(seen.graphCalls.get(KEY) === 1, `graph reads for the page ${seen.graphCalls.get(KEY)}`);
});
await check('the body as text (application/cloudevents+json is not parsed for us)', async () => {
  const seen = install({ graph: () => [15000] });
  const r = await call('POST', { headers: auth, body: JSON.stringify(published(KEY, '15000')) });
  assert(r.status === 200 && seen.purges.length === 1, `status ${r.status} purges ${seen.purges.length}`);
});
await check('an event about no page is acknowledged and purges nothing', async () => {
  const seen = install({ graph: () => [] });
  const r = await call('POST', { headers: auth, body: { type: 'import:preview1:completed', data: { counts: {}, hasErrors: false } } });
  assert(r.status === 200 && seen.purges.length === 0, `status ${r.status} purges ${seen.purges.length}`);
});

console.log('4. wiring');
const ssr = read('server/ssr-handler.tsx');
await check('the server render tags pages with Vercel-Cache-Tag, the tag the purge deletes', () => {
  assert(/res\.setHeader\('Vercel-Cache-Tag', `page:\$\{key\}`\)/.test(ssr), 'no Vercel-Cache-Tag `page:${key}` header in setPageTag');
  assert(pageTag(KEY) === `page:${KEY}`, `pageTag ${pageTag(KEY)}`);
});
await check('every tagged page response goes through setPageTag (no bare Cache-Tag left)', () => {
  const bare = ssr.split('\n').filter((l) => /setHeader\('Cache-Tag'/.test(l) && !/function setPageTag|^\s*res\.setHeader\('Cache-Tag', `page:\$\{key\}`\);$/.test(l));
  assert(bare.length === 0, `bare Cache-Tag lines: ${bare.join(' | ')}`);
  assert((ssr.match(/setPageTag\(res, /g) ?? []).length >= 2, 'pages and experiences are not both tagged');
});
await check('a purged page lives longer at the edge than an unpurged one; the not-found shell stays short', () => {
  const long = /export const PAGE_CACHE_CONTROL = 'public, s-maxage=(\d+), stale-while-revalidate=(\d+)'/.exec(ssr);
  assert(long && Number(long[1]) >= 3600, 'PAGE_CACHE_CONTROL missing or short');
  assert(/page\._metadata\?\.key \? PAGE_CACHE_CONTROL : SHORT_CACHE_CONTROL/.test(ssr), 'page response does not choose PAGE_CACHE_CONTROL by its key');
  const notFound = ssr.slice(ssr.indexOf('// Unknown slug → SPA shell'), ssr.indexOf('// Unknown slug → SPA shell') + 300);
  assert(notFound.includes("'public, s-maxage=60, stale-while-revalidate=300'"), 'the not-found shell is cached longer');
});
await check('the CMS webhook is reachable: no rewrite or auth gate in front of /api/cms-published', () => {
  const vercel = read('vercel.json');
  assert(!/cms-published/.test(vercel), 'vercel.json routes /api/cms-published somewhere');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
