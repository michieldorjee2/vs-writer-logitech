/**
 * The search page's links back to Limitless, for Limitless admins only
 * (Notion: "Offer link from search UI back to admin UI for abm admins"; the
 * Notion sweep, 1 Nov). Aldus UI says who (its POST
 * /api/machine/showcase/viewer, with the showcase token); GET /api/offers
 * passes its address on as `limitless`, and the profile menu draws "Open
 * Limitless" and a pencil on the offer the page runs as.
 *
 *   1. api/offers, with fetch stubbed (no network): Aldus UI says yes, and
 *      the answer carries its address, after exactly one POST that names the
 *      session's email (lower-cased) with the showcase token. It says no, or
 *      answers 404 (an older Aldus UI), fails, hangs past 3 s or answers
 *      something other than a boolean: no address, the offers still listed,
 *      200, and a hang doesn't hold the page for long.
 *   2. The answer is held five minutes per person; ?fresh=1 asks again; a
 *      failed answer isn't held. An email in the query, body or a header
 *      changes nothing: only the session's is asked about. Signed out: 401
 *      and no request. Aldus UI unset: no offers, no address, no request.
 *   3. limitlessOrigin(): ALDUS_UI_URL's origin, https only, http only for
 *      localhost or 127.0.0.1; anything else (another http host, a look-alike,
 *      javascript:, unset) is null, and an admin then gets no address.
 *      limitlessFrom(), the browser's side: an origin or null.
 *   4. ProfileMenu, rendered open: with an address, the active offer has one
 *      pencil (Edit offer) to its screen in Limitless, the id encoded, in a
 *      new tab with noopener; Open Limitless (to Limitless's Home) sits after
 *      the Offers and before Log out; no other offer gets a pencil. Without an
 *      address the menu is the one drawn without the prop, byte for byte. The
 *      links add exactly two visible words, "Open Limitless".
 *   5. SearchHome hands the menu the address /api/offers sent, through
 *      limitlessFrom (control: either half missing is caught).
 *
 * scripts/check-limitless-links.mjs bundles and runs this, then runs it again
 * against mutants of the files it guards, each of which must fail it.
 *
 * Run: npm run check:limitless
 */
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import offersHandler from '../../api/offers/index.js';
import { limitlessOrigin } from '../../api/_lib/aldus.js';
import ProfileMenu from '../../src/components/ProfileMenu';
import { limitlessFrom, type RunningOffer } from '../../src/lib/offer-looks';

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

// ─── The environment this check sets, and nothing else ───────────────────

const BASE = 'https://aldus.invalid';
for (const name of ['OPTIID_RELAY_SECRET', 'GRAPH_AUTH_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'DEV_AUTH_EMAIL']) delete process.env[name];
process.env.ALDUS_UI_URL = BASE;
process.env.ALDUS_SHOWCASE_TOKEN = 't';
const as = (email: string | null) => {
  if (email === null) delete process.env.DEV_AUTH_EMAIL;
  else process.env.DEV_AUTH_EMAIL = email;
};

// ─── Aldus UI, stubbed ───────────────────────────────────────────────────

type Call = { url: string; method: string; headers: Record<string, string>; body: string | null };
const calls: Call[] = [];
type ViewerReply = 'yes' | 'no' | '404' | 'throw' | 'hang' | 'not-boolean';
let viewerReply: ViewerReply = 'yes';

const aldusOffer = (id: string, title: string) => ({ id, title, brief: '', windowStart: '2026-07-01', windowEnd: '2026-12-31', look: null, pages: [] });
const OFFERS = [aldusOffer('a b', 'AI Fitness Workshop'), aldusOffer('platform-value', 'Platform Value Assessment')];

globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input instanceof Request ? input.url : input);
  calls.push({
    url,
    method: init.method ?? 'GET',
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    body: typeof init.body === 'string' ? init.body : null,
  });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const path = url.replace(/^https?:\/\/[^/]+/, '');
  if (path === '/api/machine/showcase/offers') return json(200, { offers: OFFERS });
  if (path === '/api/machine/showcase/viewer') {
    if (viewerReply === 'yes') return json(200, { admin: true });
    if (viewerReply === 'no') return json(200, { admin: false });
    if (viewerReply === 'not-boolean') return json(200, { admin: 'yes' });
    if (viewerReply === '404') return new Response('<!doctype html><title>404</title>', { status: 404, headers: { 'Content-Type': 'text/html' } });
    if (viewerReply === 'throw') throw new TypeError('fetch failed');
    // Hangs until the caller gives up (or 10 s, so a caller that never does still ends).
    return new Promise<Response>((resolve, reject) => {
      const giveUp = setTimeout(() => resolve(json(200, { admin: true })), 10_000);
      init.signal?.addEventListener('abort', () => (clearTimeout(giveUp), reject(init.signal?.reason)), { once: true });
    });
  }
  throw new Error(`unexpected fetch: ${url}`);
}) as typeof fetch;

const viewerCalls = () => calls.filter((c) => c.url.endsWith('/api/machine/showcase/viewer'));

type Reply = { status: number; body: Record<string, unknown> | null; headers: Record<string, string> };

/** GET /api/offers as the browser asks it, with the route's own logging kept quiet. */
async function getOffers(query: Record<string, string> = {}, extra: { body?: unknown; headers?: Record<string, string> } = {}): Promise<Reply> {
  const headers: Record<string, string> = {};
  let status = 200;
  let body: Record<string, unknown> | null = null;
  const res = {
    setHeader(name: string, value: unknown) {
      headers[name.toLowerCase()] = String(value);
      return res;
    },
    getHeader: (name: string) => headers[name.toLowerCase()],
    status(code: number) {
      status = code;
      return res;
    },
    json(value: Record<string, unknown>) {
      body = value;
      return res;
    },
  };
  const req = { method: 'GET', query, cookies: {}, headers: extra.headers ?? {}, body: extra.body };
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try {
    await offersHandler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  } finally {
    console.log = log;
    console.error = error;
  }
  return { status, body, headers };
}

const listed = (reply: Reply) => Array.isArray(reply.body?.offers) && (reply.body?.offers as unknown[]).length === OFFERS.length;

// CJS (the bundle) has no top-level await.
async function main(): Promise<void> {
  // ─── 1. Aldus UI's answer decides ────────────────────────────────────────

  {
    as('Laura@Optimizely.com');
    viewerReply = 'yes';
    const before = calls.length;
    const reply = await getOffers();
    const asked = viewerCalls().filter((c) => calls.indexOf(c) >= before);
    check('an admin: 200, the offers and Limitless\'s address', reply.status === 200 && listed(reply) && reply.body?.limitless === BASE, reply);
    check('…and the answer holds those two and nothing else', JSON.stringify(Object.keys(reply.body ?? {}).sort()) === '["limitless","offers"]', Object.keys(reply.body ?? {}));
    check('…"private, no-store"', reply.headers['cache-control'] === 'private, no-store', reply.headers);
    const one = asked[0];
    check(
      '…after exactly one POST to the viewer route, naming the session\'s email lower-cased, with the showcase token',
      asked.length === 1 &&
        one.method === 'POST' &&
        one.body === '{"email":"laura@optimizely.com"}' &&
        one.headers.authorization === 'Bearer t' &&
        one.headers['content-type'] === 'application/json' &&
        one.url === `${BASE}/api/machine/showcase/viewer`,
      asked,
    );
  }

  const noAddress: Array<[string, ViewerReply, string]> = [
    ['Aldus UI says no', 'no', 'ben@optimizely.com'],
    ['the viewer route answers 404 (an older Aldus UI)', '404', 'old@optimizely.com'],
    ['the request fails', 'throw', 'down@optimizely.com'],
    ['the answer isn\'t a boolean', 'not-boolean', 'odd@optimizely.com'],
    ['the request hangs', 'hang', 'slow@optimizely.com'],
  ];
  for (const [how, answer, email] of noAddress) {
    as(email);
    viewerReply = answer;
    const started = Date.now();
    const reply = await getOffers();
    const took = Date.now() - started;
    check(`${how}: 200, the offers still listed, no address`, reply.status === 200 && listed(reply) && reply.body?.limitless === null, reply);
    if (answer === 'hang') check('…and the page waits at most a few seconds for it (3 s, not the 8 s of other calls)', took < 5000, `${took} ms`);
  }

  // ─── 2. Held, fresh, the session's email only ────────────────────────────

  {
    as('hold@optimizely.com');
    viewerReply = 'yes';
    let before = viewerCalls().length;
    await getOffers();
    await getOffers();
    check('the answer is held: a second read asks once in all', viewerCalls().length - before === 1, viewerCalls().length - before);
    before = viewerCalls().length;
    const fresh = await getOffers({ fresh: '1' });
    check('?fresh=1 asks again', viewerCalls().length - before === 1 && fresh.body?.limitless === BASE, viewerCalls().length - before);

    as('blip@optimizely.com');
    viewerReply = '404';
    await getOffers();
    viewerReply = 'yes';
    before = viewerCalls().length;
    const after = await getOffers();
    check('a failed answer isn\'t held: the next read asks again and gets the address', viewerCalls().length - before === 1 && after.body?.limitless === BASE, after.body);

    as('spoof@optimizely.com');
    before = calls.length;
    await getOffers({ email: 'ada@optimizely.com', fresh: '1' }, { body: { email: 'ada@optimizely.com' }, headers: { 'x-email': 'ada@optimizely.com' } });
    const asked = viewerCalls().filter((c) => calls.indexOf(c) >= before);
    check('an email in the query, body or a header changes nothing: the session\'s is asked about', asked.length === 1 && asked[0].body === '{"email":"spoof@optimizely.com"}', asked);

    as(null);
    before = calls.length;
    const out = await getOffers();
    check('signed out: 401 and no request to Aldus UI', out.status === 401 && calls.length === before, { calls: calls.length - before, status: out.status });

    as('hold@optimizely.com');
    delete process.env.ALDUS_UI_URL;
    before = calls.length;
    const unset = await getOffers({ fresh: '1' });
    check('Aldus UI unset: no offers, no address, no request', unset.status === 200 && JSON.stringify(unset.body) === '{"offers":[],"limitless":null}' && calls.length === before, unset.body);

    process.env.ALDUS_UI_URL = 'http://aldus.example';
    as('plain@optimizely.com');
    viewerReply = 'yes';
    const plain = await getOffers({ fresh: '1' });
    check('an admin, but ALDUS_UI_URL is plain http on another host: the offers, no address', listed(plain) && plain.body?.limitless === null, plain.body);
    process.env.ALDUS_UI_URL = BASE;
  }

  // ─── 3. The address ──────────────────────────────────────────────────────

  {
    const origins: Array<[string | undefined, string | null]> = [
      ['https://aldus-ui.vercel.app/x/', 'https://aldus-ui.vercel.app'],
      ['https://aldus-ui.vercel.app', 'https://aldus-ui.vercel.app'],
      ['http://localhost:3121', 'http://localhost:3121'],
      ['http://127.0.0.1:3121/', 'http://127.0.0.1:3121'],
      ['http://evil.com', null],
      ['http://localhost.evil.com', null],
      ['javascript:alert(1)', null],
      ['ftp://aldus.invalid', null],
      ['not a url', null],
      ['', null],
      [undefined, null],
    ];
    const wrong: unknown[] = [];
    for (const [value, want] of origins) {
      if (value === undefined) delete process.env.ALDUS_UI_URL;
      else process.env.ALDUS_UI_URL = value;
      const got = limitlessOrigin();
      if (got !== want) wrong.push({ got, value, want });
    }
    process.env.ALDUS_UI_URL = BASE;
    check('limitlessOrigin: the origin, https only, http only on localhost or 127.0.0.1', wrong.length === 0, wrong);

    const browser: Array<[unknown, string | null]> = [
      ['https://aldus.invalid', 'https://aldus.invalid'],
      ['http://localhost:3121', 'http://localhost:3121'],
      ['https://aldus.invalid/', null],
      ['https://aldus.invalid/offers', null],
      ['https://aldus.invalid?x=1', null],
      ['https://user@evil.com', null],
      ['javascript:alert(1)', null],
      ['//evil.com', null],
      ['null', null],
      [null, null],
      [42, null],
    ];
    const off = browser.filter(([value, want]) => limitlessFrom(value) !== want).map(([value, want]) => ({ got: limitlessFrom(value), value, want }));
    check('limitlessFrom: an origin, or null', off.length === 0, off);
  }

  // ─── 4. The menu ─────────────────────────────────────────────────────────

  {
    const LAURA = { email: 'laura@optimizely.com', name: 'Laura Example' };
    const offer = (id: string, title: string): RunningOffer => ({ id, title, windowStart: '2026-07-01', windowEnd: '2026-12-31', look: null, pages: [] });
    const A = offer('a b', 'AI Fitness Workshop');
    const B = offer('platform-value', 'Platform Value Assessment');
    const noop = () => {};
    const menu = (props: { limitless?: string | null; chosen?: string | null; defaultOpen?: boolean }) =>
      renderToString(<ProfileMenu identity={LAURA} offers={[A, B]} chosen={A.id} onChoose={noop} onRemake={noop} defaultOpen {...props} />);
    const tagWith = (html: string, needle: string) => html.match(new RegExp(`<a\\b[^>]*${needle.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}[^>]*>`))?.[0] ?? '';

    const admin = menu({ limitless: BASE });
    const pencil = tagWith(admin, `href="${BASE}/offers/a%20b"`);
    check(
      'an admin: the active offer has a pencil to its screen in Limitless (id encoded), in a new tab with noopener',
      Boolean(pencil) &&
        pencil.includes('target="_blank"') &&
        pencil.includes('rel="noopener noreferrer"') &&
        pencil.includes('role="menuitem"') &&
        pencil.includes('title="Edit offer"') &&
        pencil.includes('aria-label="Edit AI Fitness Workshop in Limitless"'),
      pencil || admin,
    );
    check('…one pencil in all, none on the other offers', admin.split(`href="${BASE}/offers/`).length === 2 && !admin.includes('offers/platform-value'));
    check('…before Make the look again', admin.indexOf('title="Edit offer"') < admin.indexOf('title="Make the look again"'));
    const home = tagWith(admin, `href="${BASE}/"`);
    check(
      'an admin: Open Limitless, to its Home, in a new tab with noopener',
      Boolean(home) && home.includes('target="_blank"') && home.includes('rel="noopener noreferrer"') && home.includes('role="menuitem"') && admin.includes('Open Limitless</a>'),
      home || admin,
    );
    check(
      '…after the Offers and before Log out',
      admin.indexOf('Platform Value Assessment') < admin.indexOf('Open Limitless') && admin.indexOf('Open Limitless') < admin.indexOf('Log out'),
    );

    const everyoneElse = menu({ limitless: null });
    check('everyone else: no pencil, no Open Limitless, no address', !/Open Limitless|Edit offer|aldus\.invalid|in Limitless/.test(everyoneElse));
    check('…and the menu drawn without the prop at all, byte for byte', everyoneElse === menu({}));

    const words = (html: string) =>
      html
        .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&#x27;|&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .split(/\s+/)
        .filter(Boolean);
    const added = [...words(admin)];
    for (const word of words(everyoneElse)) {
      const at = added.indexOf(word);
      if (at >= 0) added.splice(at, 1);
    }
    check('the links add two visible words, "Open Limitless", and no others', JSON.stringify(added) === '["Open","Limitless"]', { added, admin: words(admin).length, everyoneElse: words(everyoneElse).length });

    const noActive = menu({ limitless: BASE, chosen: null });
    check('an admin with no offer chosen: Open Limitless, no pencil', noActive.includes('Open Limitless') && !noActive.includes('Edit offer') && !noActive.includes('/offers/'));
    check('the closed menu draws neither', !/Open Limitless|Edit offer/.test(menu({ limitless: BASE, defaultOpen: false })));
  }

  // ─── 5. The page hands the menu the address ──────────────────────────────

  {
    const source = readFileSync('src/components/SearchHome.tsx', 'utf-8');
    const wired = (src: string) => /<ProfileMenu\b[^>]*\blimitless=\{limitless\}/.test(src) && src.includes('setLimitless(limitlessFrom(body.limitless))');
    check('SearchHome hands the menu the address /api/offers sent, through limitlessFrom', wired(source));
    check(
      'control: either half missing is caught',
      !wired(source.replace('limitless={limitless}', '')) && !wired(source.replace('setLimitless(limitlessFrom(body.limitless))', 'setLimitless(body.limitless as string)')),
    );
  }

}

main().then(
  () => {
    console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
    process.exit(failures ? 1 : 0);
  },
  (err) => {
    console.error('FAIL  the check threw', err);
    process.exit(1);
  },
);
