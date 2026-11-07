/**
 * check-perf — the detail pages' speed work, offline.
 *
 *   1. server/reads.ts: the server render asks Graph once which candidate has a page (every
 *      field selecting only `_metadata { key }`), takes the first in order as the one-by-one reads
 *      did, treats a Graph error as "ask one by one" rather than "no page", and a read started
 *      early is never an unhandled rejection.
 *   2. src/lib/warm-pages.ts: the address a search page row opens (the same as SearchHome's),
 *      and what getting it ready does: a Speculation Rules prefetch list (never a prerender) of at
 *      most two pages, replaced as the rep moves on, or one request per page where the browser has
 *      no rules.
 *   3. Wiring, read from the sources: SearchHome calls the hook with its active row and opens rows
 *      at the address the hook prefetches; the server render preloads no renderer chunk; the chunk
 *      order is left as it is (see vite.config.ts).
 *   4. api/_lib/graph-read.ts: a stalled Graph read gives up at 4 s and is asked once more (8 s),
 *      in the server render, the client's content read (api/content.ts) and the CMS preview
 *      (api/preview.ts). The two endpoints run for real against a stubbed fetch (timeouts scaled
 *      down 100×): a stall answers a 500 no cache keeps, a stall then an answer serves the page.
 *
 * No network, no credentials.
 *
 *   npx tsx scripts/check-perf.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstCandidateFound, startRead, whichPageQuery, type Candidate } from '../server/reads.js';
import { KEEP, pageHrefOf, prefetchRules, resetWarmPages, warmPage } from '../src/lib/warm-pages.js';
import { GRAPH_TIMEOUT_MS, graphOp, postGraphRead } from '../api/_lib/graph-read.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

const unhandled: unknown[] = [];
process.on('unhandledRejection', (reason) => unhandled.push(reason));
const after = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));
const failAfter = (ms: number, msg: string) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

console.log('1. server reads');
const candidates: Candidate[] = [
  { kind: 'person', slug: '/cdw/' },
  { kind: 'person', slug: '/en/cdw/' },
  { kind: 'retail', slug: '/cdw/' },
  { kind: 'retail', slug: '/en/cdw/' },
  { kind: 'finserv', slug: '/cdw/' },
  { kind: 'finserv', slug: '/en/cdw/' },
  { kind: 'account', slug: '/cdw/' },
  { kind: 'account', slug: '/en/cdw/' },
];
const answer = (hits: number[]) => ({ data: Object.fromEntries(candidates.map((_, i) => [`c${i}`, { items: hits.includes(i) ? [{ _metadata: { key: 'k' } }] : [] }])) });
await check('one question for every candidate: one aliased field each, the addresses as variables once', () => {
  const { query, variables } = whichPageQuery(candidates);
  assert(JSON.stringify(variables) === JSON.stringify({ s0: '/cdw/', s1: '/en/cdw/' }), JSON.stringify(variables));
  assert(/^query WhichPage\(\$s0: String!, \$s1: String!\) \{/.test(query), query.split('\n')[0]);
  for (const [i, c] of candidates.entries()) {
    const type = { person: 'PersonPage', retail: 'RetailCustomerPage', finserv: 'FinServPage', account: 'CompetitorComparisonPage' }[c.kind];
    const v = c.slug === '/cdw/' ? 's0' : 's1';
    assert(query.includes(`c${i}: ${type}(where: { _metadata: { url: { hierarchical: { eq: $${v} } } } }, locale: en) { items { _metadata { key } } }`), `c${i}`);
  }
});
await check('every field selects only _metadata { key }: no page field the schema could drop', () => {
  const { query } = whichPageQuery(candidates);
  const selections = [...query.matchAll(/\{ items \{ ([^}]*\}) \} \}/g)].map((m) => m[1]);
  assert(selections.length === candidates.length && selections.every((s) => s === '_metadata { key }'), selections.join(' | '));
});
await check('the first candidate in order with a page wins, as the one-by-one reads found it', () => {
  assert(firstCandidateFound(candidates, answer([6]))?.kind === 'account', 'account only');
  assert(firstCandidateFound(candidates, answer([7, 1]))?.slug === '/en/cdw/' && firstCandidateFound(candidates, answer([7, 1]))?.kind === 'person', 'person before account');
  assert(firstCandidateFound(candidates, answer([3, 6])) === candidates[3], 'retail before account');
  assert(firstCandidateFound(candidates, answer([])) === null, 'nothing');
});
await check('Graph errors or no data throw (the render then reads one by one), never "no such page"', () => {
  for (const bad of [{ errors: [{ message: 'Unknown type' }], data: null }, { data: null }, null, { errors: [{ message: 'x' }], data: answer([6]).data }]) {
    let threw = false;
    try {
      firstCandidateFound(candidates, bad);
    } catch {
      threw = true;
    }
    assert(threw, `did not throw for ${JSON.stringify(bad).slice(0, 80)}`);
  }
});
await check('the render asks once, then reads one page, and falls back to one by one', () => {
  const ssr = read('server/ssr-handler.tsx');
  assert(/const answer = await queryGraph\(authKey, query, variables\);\s+let found: Candidate \| null;\s+try \{\s+found = firstCandidateFound\(candidates, answer\);/.test(ssr), 'one question; only its errors (not a network failure) fall back');
  assert(/return found \? readPage\(authKey, found, finservQuery\) : null;/.test(ssr), 'then the one page');
  assert(/for \(const c of candidates\) \{[\s\S]{0,300}await readPage\(authKey, c, finservQuery\)/.test(ssr), 'the fallback');
  assert(/await postGraphRead\(\s*`\$\{GRAPH_ENDPOINT\}\?auth=\$\{authKey\}`/.test(ssr), 'Graph reads are bounded and retried (api/_lib/graph-read.ts; section 4 tests it)');
});
await check('a read started early fails only when awaited, never unhandled before', async () => {
  const read = startRead(failAfter(5, 'boom'));
  await after(20, null);
  assert(unhandled.length === 0, 'rejected before it was awaited');
  let thrown: unknown = null;
  await read().catch((e) => (thrown = e));
  assert(thrown instanceof Error && thrown.message === 'boom', `threw ${String(thrown)}`);
  const unread = startRead(failAfter(5, 'never awaited'));
  void unread;
  await after(20, null);
  assert(unhandled.length === 0, 'an unawaited read surfaced as unhandled');
});

console.log('2. warming pages from the search page');
await check('a company or person row opens /<slug>?search=1, an offer row its route; others nothing here', () => {
  assert(pageHrefOf({ kind: 'item', item: { kind: 'company', entry: { slug: 'cdw' } } }) === '/cdw?search=1', 'company');
  assert(pageHrefOf({ kind: 'item', item: { kind: 'person', person: { slug: 'logitech/ben-yu' } } }) === '/logitech/ben-yu?search=1', 'person');
  assert(pageHrefOf({ kind: 'offer', page: { route: '/vb/vegas-dinner-d2l' } }) === '/vb/vegas-dinner-d2l', 'offer (same tab since #46)');
  for (const kind of ['build', 'offer', 'add']) assert(pageHrefOf({ kind }) === null, kind);
  assert(pageHrefOf(undefined) === null, 'no row');
});

type FakeEl = { type: string; textContent: string; removed: boolean; remove(): void };
function fakeDoc() {
  const head: FakeEl[] = [];
  return {
    head,
    doc: {
      createElement: () => {
        const el: FakeEl = { type: '', textContent: '', removed: false, remove: () => { el.removed = true; head.splice(head.indexOf(el), 1); } };
        return el;
      },
      head: { append: (el: FakeEl) => head.push(el) },
    } as unknown as Pick<Document, 'createElement' | 'head'>,
  };
}
const urlsOf = (el: FakeEl) => (JSON.parse(el.textContent) as { prefetch: Array<{ source: string; urls: string[] }> }).prefetch[0].urls;

await check('prefetch: one rules script, the latest page first, at most two', () => {
  resetWarmPages();
  const { head, doc } = fakeDoc();
  warmPage('/a?search=1', doc, true);
  warmPage('/b?search=1', doc, true);
  warmPage('/c?search=1', doc, true);
  assert(head.length === 1, `${head.length} rules scripts`);
  assert(head[0].type === 'speculationrules', head[0].type);
  assert(JSON.stringify(urlsOf(head[0])) === JSON.stringify(['/c?search=1', '/b?search=1']), JSON.stringify(urlsOf(head[0])));
  assert(KEEP === 2, `KEEP ${KEEP}`);
});
await check('prefetch: settling on the same page again changes nothing', () => {
  resetWarmPages();
  const { head, doc } = fakeDoc();
  warmPage('/a?search=1', doc, true);
  const first = head[0];
  warmPage('/a?search=1', doc, true);
  assert(head.length === 1 && head[0] === first, 'rules were rewritten');
});
await check('the rules are a prefetch list rule (rows are buttons, not links), never a prerender', () => {
  const rules = JSON.parse(prefetchRules(['/x?search=1']));
  assert(rules.prefetch[0].source === 'list' && rules.prefetch[0].urls[0] === '/x?search=1', JSON.stringify(rules));
  // A prerendered page starts before the click and mounts its rail before the reveal: the view
  // transition from the search page makes the rail's room and starts the app itself (src/lib/warm-pages.ts).
  assert(!('prerender' in rules), 'prerender rules: the view transition from the search page needs the page to start after the click');
  assert(!/prerender/.test(read('src/lib/warm-pages.ts').replace(/\/\*[\s\S]*?\*\//g, '')), 'src/lib/warm-pages.ts asks for a prerender');
});
await check('no Speculation Rules: each page requested once, same-origin, low priority', async () => {
  resetWarmPages();
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response('<html></html>');
  }) as typeof fetch;
  try {
    const { head, doc } = fakeDoc();
    warmPage('/a?search=1', doc, false);
    warmPage('/a?search=1', doc, false);
    warmPage('/b?search=1', doc, false);
    await settle();
    assert(head.length === 0, 'wrote rules without support');
    assert(calls.map((c) => c.url).join(',') === '/a?search=1,/b?search=1', calls.map((c) => c.url).join(','));
    assert(calls.every((c) => c.init.credentials === 'same-origin'), 'credentials');
  } finally {
    globalThis.fetch = realFetch;
  }
});

console.log('3. wiring');
await check("SearchHome calls the hook with its active row, and its rows go where the hook prefetches", () => {
  const src = read('src/components/SearchHome.tsx');
  assert(/useWarmPage\(navRows\[activeIdx\]\)/.test(src), 'useWarmPage(navRows[activeIdx]) not found');
  assert(src.includes('const href = `/${slug}?search=1`;'), "open()'s address changed: update pageHrefOf in src/lib/warm-pages.ts to match");
  assert(src.includes("const href = `/${row.page.route.replace(/^\\/+/, '')}`;"), "an offer row's address changed: update pageHrefOf in src/lib/warm-pages.ts to match");
});
await check('the server render preloads no renderer chunk (the app must not start before the hero paints)', () => {
  const ssr = read('server/ssr-handler.tsx');
  assert(!/rel="modulepreload"/.test(ssr), 'server/ssr-handler.tsx writes a modulepreload link');
  assert(!/__ROUTE_PRELOADS__|manifest: true/.test(ssr + read('scripts/build-ssr.mjs') + read('vite.config.ts')), 'route preloads are wired back in');
});
await check('the chunk order stays as main has it until the start-up gate waits for the hero', () => {
  const vite = read('vite.config.ts');
  assert(/manualChunks\(id\) \{/.test(vite) && !/codeSplitting:/.test(vite), 'vite.config.ts changed the chunk order: measure the hero paint (mobile LCP) before and after');
  assert(vite.includes("Don't fix that alone."), 'the note on why the chunk order stays is gone');
});
await check('the icon font: the subset in, the package font out', () => {
  const vite = read('vite.config.ts');
  assert(/'material-symbols\/rounded\.css': path\.resolve\(import\.meta\.dirname, 'src\/styles\/material-symbols\/rounded\.css'\)/.test(vite), 'alias');
  assert(/url\("\.\/rounded-subset\.woff2"\)/.test(read('src/styles/material-symbols/rounded.css')), 'subset face');
  assert(/watchIconFont\(\)/.test(read('src/App.tsx')), 'the whole-font fallback is not watching');
});

console.log('4. Graph reads: bounded, and a stalled one asked once more');
const GRAPH = 'https://cg.optimizely.com/content/v2';
type GraphReply = 'stall' | Error | Record<string, unknown>;
/**
 * Run `fn` against a stubbed Graph: each POST gets `reply(n)` (n from 1): 'stall' never answers
 * until its signal aborts, an Error rejects, anything else is the JSON answer. AbortSignal.timeout
 * is scaled down 100× and records what it was asked for. Any other address throws: no network.
 */
async function withGraph<T>(reply: (n: number) => GraphReply, fn: () => Promise<T>) {
  const realFetch = globalThis.fetch;
  const realTimeout = AbortSignal.timeout;
  const { warn, error } = console;
  const calls: string[] = [];
  const asked: number[] = [];
  AbortSignal.timeout = (ms: number) => {
    asked.push(ms);
    return realTimeout.call(AbortSignal, Math.max(1, ms / 100));
  };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(GRAPH)) throw new Error(`unexpected fetch: ${url.split('?')[0]}`);
    const n = calls.push(graphOp(JSON.parse(String(init?.body)).query));
    const r = reply(n);
    if (r instanceof Error) throw r;
    if (r === 'stall') {
      return new Promise<Response>((_, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    return new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  console.warn = () => {};
  console.error = () => {};
  try {
    const result = await Promise.race([fn(), failAfter(3000, 'still waiting after 3 s (40 s unscaled): a stalled read is not bounded')]);
    return { result, calls, asked };
  } finally {
    globalThis.fetch = realFetch;
    AbortSignal.timeout = realTimeout;
    console.warn = warn;
    console.error = error;
  }
}
function fakeRes() {
  const headers: Record<string, string> = {};
  const out = { status: 0, body: undefined as unknown, headers };
  const res = {
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = String(value); return res; },
    getHeader(name: string) { return headers[name.toLowerCase()]; },
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
  };
  return { res: res as unknown as VercelResponse, out };
}
const req = (query: Record<string, string>) => ({ query, headers: {}, method: 'GET' }) as unknown as VercelRequest;
const POST = { method: 'POST', body: JSON.stringify({ query: 'query Probe { x }' }) };
process.env.GRAPH_AUTH_KEY = 'check-key';
const { default: contentHandler } = await import('../api/content.js');
const { default: previewHandler } = await import('../api/preview.js');

await check('graph-read: 4 s, then once more with 8 s; the second answer is used', async () => {
  const { result, calls, asked } = await withGraph((n) => (n === 1 ? 'stall' : { data: { ok: 1 } }), () => postGraphRead(GRAPH, POST, 'Probe'));
  assert(GRAPH_TIMEOUT_MS === 4000, `GRAPH_TIMEOUT_MS ${GRAPH_TIMEOUT_MS}`);
  assert(JSON.stringify(asked) === '[4000,8000]', `timeouts asked: ${JSON.stringify(asked)}`);
  assert(calls.length === 2, `${calls.length} calls`);
  assert(JSON.stringify(result.json) === '{"data":{"ok":1}}', JSON.stringify(result.json));
});
await check('graph-read: a second stall throws the TimeoutError; never a third ask', async () => {
  let thrown: unknown;
  const { calls } = await withGraph(() => 'stall', () => postGraphRead(GRAPH, POST, 'Probe').catch((err) => { thrown = err; }));
  assert(thrown instanceof Error && thrown.name === 'TimeoutError', `threw ${String(thrown)}`);
  assert(calls.length === 2, `${calls.length} calls`);
});
await check('graph-read: any other failure throws at once, not asked again', async () => {
  let thrown: unknown;
  const { calls } = await withGraph(() => new TypeError('fetch failed'), () => postGraphRead(GRAPH, POST, 'Probe').catch((err) => { thrown = err; }));
  assert(thrown instanceof TypeError, `threw ${String(thrown)}`);
  assert(calls.length === 1, `${calls.length} calls`);
});
await check('api/content: Graph stalls twice → a 500 within the bound, with no Cache-Control a cache could keep', async () => {
  const { res, out } = fakeRes();
  const { calls, asked } = await withGraph(() => 'stall', () => contentHandler(req({ slug: 'cdw' }), res));
  assert(out.status === 500, `status ${out.status}`);
  assert(!/s-maxage|max-age|public/.test(out.headers['cache-control'] ?? ''), `cache-control: ${out.headers['cache-control']}`);
  assert(calls.length === 2 && JSON.stringify(asked) === '[4000,8000]', `${calls.join(',')} ${JSON.stringify(asked)}`);
});
await check('api/content: a stall, then the answer → the page is served', async () => {
  const { res, out } = fakeRes();
  const person = { data: { PersonPage: { items: [{ _metadata: { key: 'k' }, provenance: null }] } } };
  const { calls } = await withGraph((n) => (n === 1 ? 'stall' : person), () => contentHandler(req({ slug: 'acme/jane-doe' }), res));
  assert(out.status === 200 && (out.body as { __template?: string })?.__template === 'person', `status ${out.status} ${JSON.stringify(out.body)}`);
  assert(calls.length === 2, `${calls.length} calls`);
});
await check('api/preview: Graph stalls twice → a 500, no-store', async () => {
  const { res, out } = fakeRes();
  const { calls } = await withGraph(() => 'stall', () => previewHandler(req({ key: 'abc123' }), res));
  assert(out.status === 500, `status ${out.status}`);
  assert(out.headers['cache-control'] === 'no-store', `cache-control: ${out.headers['cache-control']}`);
  assert(calls.length === 2, `${calls.length} calls`);
});
await check('api/preview: a stall, then the answer → the draft is served', async () => {
  const { res, out } = fakeRes();
  const block = { data: { _Content: { items: [{ __typename: 'HeroSectionBlock', _metadata: { key: 'abc123', types: ['HeroSectionBlock', '_Component'] } }] } } };
  const { calls } = await withGraph((n) => (n === 1 ? 'stall' : block), () => previewHandler(req({ key: 'abc123' }), res));
  assert(out.status === 200 && (out.body as { __typename?: string })?.__typename === 'HeroSectionBlock', `status ${out.status} ${JSON.stringify(out.body)}`);
  assert(JSON.stringify(calls) === '["GetPreviewType","GetPreviewType","GetPreviewBlock"]', calls.join(','));
});
await check('every Graph read in the render, content and preview goes through graph-read', () => {
  for (const f of ['api/content.ts', 'api/preview.ts']) {
    const src = read(f);
    assert(/await postGraphRead\(/.test(src), `${f} does not read through postGraphRead`);
    assert(!/\bfetch\(/.test(src), `${f} calls fetch itself`);
  }
  assert(!/fetch\(`\$\{GRAPH_ENDPOINT\}/.test(read('server/ssr-handler.tsx')), 'server/ssr-handler.tsx fetches Graph itself');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
