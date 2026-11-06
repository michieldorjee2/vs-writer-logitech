/**
 * check-perf — the detail pages' speed work, offline.
 *
 *   1. server/reads.ts: the server render's Graph reads run together but answer as they did one
 *      after another — the first hit in order wins, an earlier failure still fails, a later
 *      failure after an answer is dropped (never an unhandled rejection) — in the time of the
 *      slowest read, not the sum.
 *   2. src/lib/warm-pages.ts: the address a search page row opens (the same as SearchHome's
 *      open()), and what getting it ready does: a Speculation Rules list of at most two pages,
 *      replaced as the rep moves on, or one request per page where the browser has no rules.
 *   3. Wiring, read from the sources: SearchHome calls the hook with its active row and opens
 *      rows at the address the hook prerenders; the server render preloads each renderer's chunks.
 *
 * No network, no credentials.
 *
 *   npx tsx scripts/check-perf.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstFound, startRead } from '../server/reads.js';
import { KEEP, pageHrefOf, prerenderRules, resetWarmPages, warmPage } from '../src/lib/warm-pages.js';

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
await check('the first hit in order wins, not the first to arrive', async () => {
  const got = await firstFound([after(40, null), after(30, 'second'), after(5, 'third')]);
  assert(got === 'second', `got ${got}`);
});
await check('nothing found is null', async () => {
  assert((await firstFound([after(5, null), Promise.resolve(null)])) === null, 'expected null');
});
await check('reads run together: the time of the slowest, not the sum', async () => {
  const t = performance.now();
  await firstFound([after(60, null), after(60, null), after(60, null), after(60, 'x')]);
  const ms = performance.now() - t;
  assert(ms < 150, `took ${Math.round(ms)} ms for four 60 ms reads`);
});
await check('a failure before any hit fails the whole, as one after another did', async () => {
  let thrown: unknown = null;
  await firstFound([after(5, null), failAfter(10, 'graph down'), after(1, 'later')]).catch((e) => (thrown = e));
  assert(thrown instanceof Error && thrown.message === 'graph down', `threw ${String(thrown)}`);
});
await check('a later read failing after an earlier hit is dropped, never unhandled', async () => {
  const got = await firstFound([after(5, 'hit'), failAfter(20, 'late failure')]);
  await after(40, null);
  assert(got === 'hit', `got ${got}`);
  assert(unhandled.length === 0, `unhandled: ${unhandled.map(String).join(', ')}`);
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
await check('a company or person row opens /<slug>?search=1; others open nothing here', () => {
  assert(pageHrefOf({ kind: 'item', item: { kind: 'company', entry: { slug: 'cdw' } } }) === '/cdw?search=1', 'company');
  assert(pageHrefOf({ kind: 'item', item: { kind: 'person', person: { slug: 'logitech/ben-yu' } } }) === '/logitech/ben-yu?search=1', 'person');
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
const urlsOf = (el: FakeEl) => (JSON.parse(el.textContent) as { prerender: Array<{ source: string; urls: string[] }> }).prerender[0].urls;

await check('prerender: one rules script, the latest page first, at most two', () => {
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
await check('prerender: settling on the same page again changes nothing', () => {
  resetWarmPages();
  const { head, doc } = fakeDoc();
  warmPage('/a?search=1', doc, true);
  const first = head[0];
  warmPage('/a?search=1', doc, true);
  assert(head.length === 1 && head[0] === first, 'rules were rewritten');
});
await check('prerender rules are a list rule (rows are buttons, not links)', () => {
  const rules = JSON.parse(prerenderRules(['/x?search=1']));
  assert(rules.prerender[0].source === 'list' && rules.prerender[0].urls[0] === '/x?search=1', JSON.stringify(rules));
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
await check("SearchHome calls the hook with its active row, and open() goes where the hook prerenders", () => {
  const src = read('src/components/SearchHome.tsx');
  assert(/useWarmPage\(navRows\[activeIdx\]\)/.test(src), 'useWarmPage(navRows[activeIdx]) not found');
  assert(src.includes('const href = `/${slug}?search=1`;'), "open()'s address changed: update pageHrefOf in src/lib/warm-pages.ts to match");
});
await check('the server render preloads each renderer, low priority, and the booth rail from /search', () => {
  const ssr = read('server/ssr-handler.tsx');
  assert(/routePreloadLinks\('experience'\)/.test(ssr), 'experience');
  assert(/routePreloadLinks\(renderer, \.\.\.\(booth/.test(ssr), 'page renderers');
  assert(/fetchpriority="low"/.test(ssr), 'priority');
  const build = read('scripts/build-ssr.mjs');
  for (const key of ['src/www/AccountRoute.tsx', 'src/www/PersonPage.tsx', 'src/components/VisualBuilderPage.tsx', 'src/components/FloatingSidebar.tsx']) {
    assert(build.includes(`'${key}'`), key);
  }
  const app = read('src/App.tsx');
  for (const lazyImport of ["import('./www/AccountRoute')", "import('./www/PersonPage')", "import('./components/VisualBuilderPage')", "import('./components/FloatingSidebar')"]) {
    assert(app.includes(lazyImport), `App.tsx no longer lazy-loads ${lazyImport}: update routePreloads() in scripts/build-ssr.mjs`);
  }
});
await check('the icon font: the subset in, the package font out', () => {
  const vite = read('vite.config.ts');
  assert(/'material-symbols\/rounded\.css': path\.resolve\(import\.meta\.dirname, 'src\/styles\/material-symbols\/rounded\.css'\)/.test(vite), 'alias');
  assert(/url\("\.\/rounded-subset\.woff2"\)/.test(read('src/styles/material-symbols/rounded.css')), 'subset face');
  assert(/watchIconFont\(\)/.test(read('src/App.tsx')), 'the whole-font fallback is not watching');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
