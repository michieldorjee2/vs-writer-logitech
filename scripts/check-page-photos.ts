/**
 * check-page-photos — Teams photos on pages (README, "Teams photos on pages").
 *
 *   1. Who is Optimizely's (src/lib/page-photos.ts): the address gate that stands before the wiki and
 *      Limitless, the pages that name people, the URL that carries a person (never an address), and the
 *      photos an avatar tries in order (Gravatar for who always had it, Teams only for Optimizely's own).
 *   2. The wiki's request token: byte for byte what the wiki's own verifier library (jose, the options of
 *      lib/people-auth.ts verifyRequestToken) makes and accepts. The vector below was made with it.
 *   3. api/page-photo against stand-ins for Graph, the wiki and Limitless that refuse what the real
 *      ones refuse (the wiki's stand-in verifies the token as the wiki does):
 *        - served: an account page's team, a person page's team, an offer page's hosts (through Limitless)
 *        - never served: anyone not on the page asked, a colleague by address, a customer, a placeholder,
 *          a person of another page; and for each the wiki or Limitless was not asked at all
 *        - the shape of the request (exactly `p` and `k`, canonical), the switch, the method, the rate limit
 *        - what a photo may be (a raster type, a size), what a failure is (nothing kept, 502, never cached)
 *        - what it says: cache headers, ETag and 304, the page's cache tag, no address in the answer
 *      and, over everything, that the wiki and Limitless were only ever sent @optimizely.com people.
 *   4. api/me-photo: the signed-in person's own, never one the request names.
 *   5. Wiring, read from the sources: the secret, the token and the switch in no browser code; the
 *      wiki's signed link never used; every avatar draws the way it should.
 *
 * No network, no credentials.
 *
 *   npx tsx scripts/check-page-photos.ts
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { avatarSources, optimizelyAddress, pagePhotoUrl, photoKeyOf, photoPageOf } from '../src/lib/page-photos.js';
import { emailHash } from '../src/lib/gravatar.js';
import { setSessionCookie } from '../api/_lib/auth.js';
import { pageTag } from '../api/_lib/purge-page.js';
import { forgetPagePeople } from '../api/_lib/page-people.js';
import {
  OWN_PHOTOS_PER_MINUTE,
  PEOPLE_KEY_LABEL,
  PEOPLE_TOKEN_TYPE,
  PHOTOS_PER_IP_PER_MINUTE,
  WIKI_CALLS_PER_MINUTE,
  forgetTeamsPhotos,
  hostKey,
  overPhotoLimit,
  peopleRequestToken,
  setPhotoLimitStore,
} from '../api/_lib/teams-photo.js';
import pageHandler, { PHOTO_CACHE_CONTROL } from '../api/page-photo.js';
import meHandler from '../api/me-photo.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** What the code under test logs: held back, and read at the end for anything it must never say. */
const logs: string[] = [];
for (const level of ['warn', 'info', 'error', 'log'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    const line = args.map(String).join(' ');
    if (/^\s*(\d+ passed|FAIL )/.test(line) || line.startsWith('FAIL')) original(...args);
    else logs.push(line);
  };
}
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

/* ---------- 1. Who is Optimizely's, and what a URL carries ---------- */

check('an Optimizely address is tidied and lower-cased', optimizelyAddress('  Ben.Yu@Optimizely.com ') === 'ben.yu@optimizely.com');
for (const bad of [
  'ben@optimizely.com.evil.test',
  'ben@sub.optimizely.com',
  'a@b@optimizely.com',
  'ben@gmail.com',
  'ben@optimizely.co',
  'ben@optimizely.com.',
  'ben smith@optimizely.com',
  '<ben@optimizely.com>',
  `${'a'.repeat(65)}@optimizely.com`,
  'ben@optimizely.com\n',
  'ben@optіmizely.com', // a Cyrillic і
  '@optimizely.com',
  '',
]) {
  // The newline case is trimmed away, so only a clean address passes: "ben@optimizely.com\n" IS ben@optimizely.com once tidied.
  if (bad === 'ben@optimizely.com\n') check(`tidied, then fine: ${JSON.stringify(bad)}`, optimizelyAddress(bad) === 'ben@optimizely.com');
  else check(`not an Optimizely address: ${JSON.stringify(bad)}`, optimizelyAddress(bad) === null, optimizelyAddress(bad));
}
check('not strings are not addresses', [null, undefined, 42, {}, ['a@optimizely.com']].every((v) => optimizelyAddress(v) === null));

check("Gravatar's documented example hash", emailHash('MyEmailAddress@example.com ') === '0bc83cb571cd1c50ba6f3e8a78ef1346');
check('the key is the Gravatar hash, 32 hex', photoKeyOf('Ben.Yu@optimizely.com') === emailHash('ben.yu@optimizely.com') && /^[0-9a-f]{32}$/.test(photoKeyOf('ben.yu@optimizely.com')));

const pageOf = (raw: unknown) => photoPageOf(raw);
check('an account page', JSON.stringify(pageOf('/Acme/')) === '{"path":"acme","kind":"account"}');
check('a person page, and a locale prefix', JSON.stringify(pageOf('/en/acme/pat')) === '{"path":"acme/pat","kind":"person"}');
check('an offer page', JSON.stringify(pageOf('/vb/spring-dinner/')) === '{"path":"vb/spring-dinner","kind":"offer"}');
for (const bad of ['', '/', 'vb', '/vb/', 'vb/a/b', 'a/b/c', 'api/page-photo', '/search', '/login', 'preview', 'retail/x', '../x', 'a b', 'a%2fb', '-a', 'a-', `${'a'.repeat(201)}`, 'https://evil.test/x', 'a/../b', 'a.b']) {
  check(`not a page: ${JSON.stringify(bad)}`, pageOf(bad) === null, pageOf(bad));
}
check('not strings are not pages', [null, undefined, 3, {}].every((v) => pageOf(v) === null));

const pat = 'pat@optimizely.com';
const url = pagePhotoUrl('/acme/', pat);
check('the URL is the page and a key, in a fixed order', url === `/api/page-photo?p=acme&k=${emailHash(pat)}`, url);
check('a person page and an offer page: the slash is encoded', pagePhotoUrl('/acme/pat/', pat)?.startsWith('/api/page-photo?p=acme%2Fpat&k=') === true && pagePhotoUrl('/vb/x', pat)?.includes('p=vb%2Fx') === true);
check('the URL never carries the address, or the name in it', !url?.includes('pat') && !url?.includes('optimizely') && !pagePhotoUrl('/acme/pat/', pat)?.includes('@'));
check('a customer gets no Teams URL', pagePhotoUrl('/acme/', 'cust@acme.com') === null && pagePhotoUrl('/acme/', 'pat@optimizely.com.evil.test') === null && pagePhotoUrl('/acme/', null) === null);
check('no page, no Teams URL', pagePhotoUrl('/search', pat) === null && pagePhotoUrl('/preview', pat) === null && pagePhotoUrl(null, pat) === null);

const src = (email: string | null, pathname: string | null, others: 'gravatar' | 'initials') => avatarSources(email, { size: 52, pathname, others });
check('Optimizely, in the browser: Gravatar, then Teams', JSON.stringify(src(pat, '/acme/', 'gravatar').map((s) => s.kind)) === '["gravatar","teams"]');
check('Optimizely, on the server (no page known): only Gravatar is ever drawn', JSON.stringify(src(pat, null, 'gravatar').map((s) => s.kind)) === '["gravatar"]');
check('Optimizely on a card that never had Gravatar: Gravatar then Teams all the same', JSON.stringify(src(pat, '/vb/x', 'initials').map((s) => s.kind)) === '["gravatar","teams"]');
check('a customer on a card that had Gravatar: Gravatar only, as ever', JSON.stringify(src('cust@acme.com', '/acme/', 'gravatar').map((s) => s.kind)) === '["gravatar"]');
check('a customer on a card that never had it: nothing sent anywhere, initials', src('cust@acme.com', '/acme/', 'initials').length === 0);
check('no address: initials', src(null, '/acme/', 'gravatar').length === 0 && src('  ', '/acme/', 'gravatar').length === 0);
check('Optimizely off any page: Gravatar, no Teams', JSON.stringify(src(pat, '/search', 'gravatar').map((s) => s.kind)) === '["gravatar"]');

/* ---------- 2. The wiki's request token ---------- */

const SECRET = 'test-relay-secret';
const NOW = 1_700_000_000_000;
// Made with jose (the wiki's verifier) from the same claims; scratch: SignJWT HS256, typ people-call+jwt, key HMAC-SHA256(secret, label).
const VECTOR =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6InBlb3BsZS1jYWxsK2p3dCJ9.eyJpc3MiOiJzaG93Y2FzZSIsImF1ZCI6Imh0dHBzOi8vbWQub3B0aW1pemVseS5jb20vYXBpL2F1dGgvcGVvcGxlIiwiaWF0IjoxNjk5OTk5OTk1LCJleHAiOjE3MDAwMDAwNTV9.UChSnVlja9ETem8AI4AF7TTR_KByYLQWpDsiKcAPMGY';
check('the token is byte for byte what the wiki\'s own library makes', peopleRequestToken(SECRET, 'https://md.optimizely.com', NOW) === VECTOR);

/** The wiki's verifyRequestToken (lib/people-auth.ts), as plain node:crypto: every check it makes. */
function wikiVerifies(token: string, secret: string, origin: string, nowMs: number): { ok: boolean; reason?: string } {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  let header: { alg?: string; typ?: string };
  let claims: { iss?: string; aud?: string; iat?: number; exp?: number };
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (header.typ !== PEOPLE_TOKEN_TYPE) return { ok: false, reason: 'type' };
  if (header.alg !== 'HS256') return { ok: false, reason: 'alg' };
  if (claims.iss !== 'showcase') return { ok: false, reason: 'issuer' };
  const key = createHmac('sha256', secret).update(PEOPLE_KEY_LABEL).digest();
  const want = createHmac('sha256', key).update(`${parts[0]}.${parts[1]}`).digest();
  const got = Buffer.from(parts[2], 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: 'signature' };
  if (claims.aud !== `${origin}/api/auth/people`) return { ok: false, reason: 'audience' };
  const now = Math.floor(nowMs / 1000);
  if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') return { ok: false, reason: 'claims' };
  if (claims.exp < now - 30) return { ok: false, reason: 'expired' };
  if (now - claims.iat > 300 + 30 || claims.iat > now + 30) return { ok: false, reason: 'iat' };
  if (claims.exp - claims.iat > 300) return { ok: false, reason: 'lifetime' };
  return { ok: true };
}
check('the wiki\'s checks accept it', wikiVerifies(VECTOR, SECRET, 'https://md.optimizely.com', NOW).ok);
check('and refuse another secret, another audience, a stale token', !wikiVerifies(VECTOR, 'other', 'https://md.optimizely.com', NOW).ok && !wikiVerifies(VECTOR, SECRET, 'https://evil.test', NOW).ok && !wikiVerifies(VECTOR, SECRET, 'https://md.optimizely.com', NOW + 600_000).ok);
check('the token lives a minute', JSON.parse(Buffer.from(VECTOR.split('.')[1], 'base64url').toString()).exp - JSON.parse(Buffer.from(VECTOR.split('.')[1], 'base64url').toString()).iat === 60);
check('Limitless\'s key for a host is the first 32 hex of the SHA-256 of the lower-cased address', hostKey(' Pat@Optimizely.com ') === createHash('sha256').update('pat@optimizely.com').digest('hex').slice(0, 32) && hostKey(pat) !== photoKeyOf(pat));

/* ---------- the stand-ins ---------- */

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PNG2 = Buffer.concat([PNG, Buffer.from([0])]);
const ids = { ae: 'pat@optimizely.com', sam: 'sam@optimizely.com', none: 'nophoto@optimizely.com', ceo: 'ceo@optimizely.com', placeholder: 'placeholder@optimizely.com', signer: 'sig@optimizely.com' };
const WIKI = 'https://md.optimizely.com';
const LIMITLESS = 'https://limitless.example';

type Member = { Name: string; Role?: string; Email: string | null };
const graphPages: Record<string, { type: string; key: string; members?: Member[]; team?: Member[]; experience?: unknown }> = {
  '/acme/': {
    type: 'CompetitorComparisonPage',
    key: 'key-acme',
    members: [
      { Name: 'Pat Example', Role: 'Account Executive', Email: ids.ae },
      { Name: 'Sam Example', Role: 'Solutions Consultant', Email: ids.sam },
      { Name: 'No Photo', Role: 'CSM', Email: ids.none },
      { Name: 'Solutions Architect', Role: 'placeholder', Email: ids.placeholder },
      { Name: 'Cust Omer', Role: 'Their side', Email: 'cust@acme.com' },
      { Name: 'No Email', Role: 'Nobody', Email: null },
    ],
  },
  '/other/': { type: 'CompetitorComparisonPage', key: 'key-other', members: [{ Name: 'Other Rep', Role: 'AE', Email: 'other.rep@optimizely.com' }] },
  '/acme/pat/': {
    type: 'PersonPage',
    key: 'key-acme-pat',
    team: [
      { Name: 'Sig Ner', Role: 'Account Executive', Email: ids.signer },
      { Name: 'Account Executive', Role: '', Email: ids.placeholder },
    ],
  },
};
const offerPlan = (id: string | null) => JSON.stringify({ blueprint: 'offer', ...(id ? { offerId: id } : {}) });
const host = (name: string, email: string | null) => ({ key: `k-${name}`, component: { __typename: 'AbmTeamMemberElement', Initials: 'H', Name: name, Role: 'Host', Email: email } });
const offerExperience = (id: string | null, hosts: Array<ReturnType<typeof host>>) => ({
  _metadata: { key: id ? `key-offer-${id}` : 'key-offer-none', url: { default: 'x', hierarchical: '/x/' } },
  template: 'offer',
  componentPlan: offerPlan(id),
  composition: {
    nodes: [
      {
        key: 's1',
        displayName: 'Who runs it',
        rows: [{ columns: [{ elements: [{ key: 'e0', component: { __typename: 'StackedHeadingElement', Text: 'Hosts', HeadingLevel: 'h2' } }, ...hosts] }] }],
      },
    ],
  },
});
const OFFER_HOSTS = { h1: 'host1@optimizely.com', h2: 'partner@acme.com', h4: 'host4@optimizely.com' };
const offers: Record<string, unknown> = {
  '/spring-dinner/': offerExperience('offer-1', [host('Host One', OFFER_HOSTS.h1), host('Partner', OFFER_HOSTS.h2), host('No Email', null), host('Host Four', OFFER_HOSTS.h4)]),
  '/no-plan/': offerExperience(null, [host('Host One', OFFER_HOSTS.h1)]),
};

interface Calls {
  graph: number;
  wiki: Array<{ email: string; auth: string; url: string; redirect: unknown }>;
  limitless: Array<{ path: string; auth: string }>;
}
let calls: Calls = { graph: 0, wiki: [], limitless: [] };
const everyWikiEmail: string[] = [];
const everyLimitlessKey: string[] = [];
type WikiBehaviour = 'photo' | 'error' | 'html' | 'svg' | 'huge' | 'slow-lie' | 'empty' | 'throw';
const behaviour = { wiki: 'photo' as WikiBehaviour, limitless: 'photo' as 'photo' | 'none' | 'html404' | 'unauthorized', graph: 'ok' as 'ok' | 'errors' | 'down', wikiSecret: SECRET, delayMs: 0 };

const png = (bytes: Buffer, type = 'image/png') => new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': type } });

function wikiAnswer(email: string, auth: string, nowMs: number): Response {
  const token = /^Bearer (.+)$/.exec(auth)?.[1] ?? '';
  const verdict = wikiVerifies(token, behaviour.wikiSecret, WIKI, nowMs);
  if (!verdict.ok) return new Response('Sign in, send an app request token, or use a signed photo link.', { status: 401 });
  switch (behaviour.wiki) {
    case 'error':
      return new Response('boom', { status: 500 });
    case 'throw':
      throw new TypeError('fetch failed');
    case 'html':
      return new Response('<script>alert(1)</script>', { status: 200, headers: { 'content-type': 'text/html' } });
    case 'svg':
      return new Response('<svg onload="alert(1)"/>', { status: 200, headers: { 'content-type': 'image/svg+xml' } });
    case 'empty':
      return new Response(new Uint8Array(0), { status: 200, headers: { 'content-type': 'image/png' } });
    case 'huge':
      return png(Buffer.alloc(300 * 1024, 1));
    case 'slow-lie': {
      // Says it is small, sends too much.
      const body = Buffer.alloc(300 * 1024, 1);
      return new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': 'image/png', 'content-length': '10' } });
    }
  }
  if (email === ids.none || email === ids.sam) return new Response(email === ids.none ? 'No photo.' : 'No photo yet; it is on its way.', { status: 404 });
  return png(email === ids.ae ? PNG : PNG2);
}

globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
  const u = new URL(typeof input === 'string' ? input : (input as URL | Request).toString());
  const headers = (init?.headers ?? {}) as Record<string, string>;
  if (behaviour.delayMs) await new Promise((r) => setTimeout(r, behaviour.delayMs));
  if (u.hostname === 'cg.optimizely.com') {
    calls.graph++;
    if (behaviour.graph === 'down') throw new TypeError('fetch failed');
    if (behaviour.graph === 'errors') return Response.json({ errors: [{ message: 'schema drift' }], data: null });
    const body = JSON.parse(String(init?.body)) as { query: string; variables: { slug: string } };
    const slug = body.variables.slug.replace(/^\/en\//, '/');
    if (/query GetABMExperience\b/.test(body.query)) {
      const item = offers[slug];
      return Response.json({ data: { ABMExperience: { items: item ? [item] : [] } } });
    }
    const page = graphPages[slug];
    const person = /query GetPagePhotosPerson\b/.test(body.query);
    const account = /query GetPagePhotosAccount\b/.test(body.query);
    if (!person && !account) return Response.json({ errors: [{ message: 'unexpected query' }] });
    if (!page || page.type !== (person ? 'PersonPage' : 'CompetitorComparisonPage')) return Response.json({ data: { [person ? 'PersonPage' : 'CompetitorComparisonPage']: { items: [] } } });
    return Response.json({ data: { [page.type]: { items: [{ _metadata: { key: page.key }, ...(person ? { team: page.team } : { teamMembers: page.members }) }] } } });
  }
  if (u.origin === WIKI && u.pathname === '/api/auth/people/photo') {
    const email = u.searchParams.get('email') ?? '';
    const auth = headers.Authorization ?? '';
    calls.wiki.push({ email, auth, url: u.toString(), redirect: init?.redirect });
    everyWikiEmail.push(email);
    return wikiAnswer(email, auth, Date.now());
  }
  if (u.origin === LIMITLESS) {
    const m = /^\/api\/machine\/showcase\/offers\/([^/]+)\/hosts\/([^/]+)\/photo$/.exec(u.pathname);
    calls.limitless.push({ path: u.pathname, auth: headers.Authorization ?? '' });
    if (m) everyLimitlessKey.push(m[2]);
    if (headers.Authorization !== 'Bearer showcase-token' || behaviour.limitless === 'unauthorized') return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (behaviour.limitless === 'html404') return new Response('<html>404</html>', { status: 404, headers: { 'content-type': 'text/html' } });
    if (!m || behaviour.limitless === 'none') return Response.json({ code: 'no-photo' }, { status: 404 });
    // Limitless's own rule: only the hosts of the offer, by key.
    return m[1] === 'offer-1' && m[2] === hostKey(OFFER_HOSTS.h1) ? png(PNG) : Response.json({ code: 'not-a-host' }, { status: 404 });
  }
  throw new Error(`unexpected fetch ${u.toString()}`);
}) as typeof fetch;

type Res = { statusCode: number; body: unknown; headers: Record<string, string>; ended: boolean };
function call(handler: (req: never, res: never) => unknown, req: Record<string, unknown>): Promise<Res> {
  const out: Res = { statusCode: 200, body: undefined, headers: {}, ended: false };
  const res = {
    setHeader: (k: string, v: string | string[]) => (out.headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v)),
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
  const headers = { host: 'showcase.optimizely.com', 'x-forwarded-for': '203.0.113.9', ...(req.headers as object) };
  return Promise.resolve(handler({ method: 'GET', cookies: {}, query: {}, socket: {}, ...req, headers } as never, res as never)).then(() => out);
}

const reset = () => {
  calls = { graph: 0, wiki: [], limitless: [] };
  behaviour.wiki = 'photo';
  behaviour.limitless = 'photo';
  behaviour.graph = 'ok';
  behaviour.wikiSecret = SECRET;
  behaviour.delayMs = 0;
  forgetTeamsPhotos();
  forgetPagePeople();
  setPhotoLimitStore(null);
};
const env = (patch: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};
env({
  GRAPH_AUTH_KEY: 'graph-key',
  OPTIID_RELAY_SECRET: SECRET,
  PAGE_PEOPLE_PHOTOS: 'on',
  ALDUS_UI_URL: LIMITLESS,
  ALDUS_SHOWCASE_TOKEN: 'showcase-token',
  WIKI_URL: undefined,
  KV_REST_API_URL: undefined,
  KV_REST_API_TOKEN: undefined,
  DEV_AUTH_EMAIL: undefined,
});
const ask = (p: unknown, k: unknown, more: Record<string, unknown> = {}, req: Record<string, unknown> = {}) => call(pageHandler, { query: { p, k, ...more }, ...req });
const asBytes = (r: Res) => Buffer.from(r.body as Buffer);
const json = (r: Res) => JSON.stringify(r.body ?? '');

/* ---------- 3a. An account page's team ---------- */

reset();
let r = await ask('acme', emailHash(ids.ae));
check('the account executive on the page: 200 with the photo', r.statusCode === 200 && asBytes(r).equals(PNG) && r.headers['content-type'] === 'image/png', { s: r.statusCode, h: r.headers });
check('the wiki was asked once, for that address, with a token the wiki accepts', calls.wiki.length === 1 && calls.wiki[0].email === ids.ae && wikiVerifies(calls.wiki[0].auth.replace('Bearer ', ''), SECRET, WIKI, Date.now()).ok, calls.wiki);
check('the wiki is called at its own photo route, with redirects refused', calls.wiki[0].url === `${WIKI}/api/auth/people/photo?email=pat%40optimizely.com` && calls.wiki[0].redirect === 'error', calls.wiki[0]);
check('cached for a public page: short and shared, with an ETag', r.headers['cache-control'] === PHOTO_CACHE_CONTROL && PHOTO_CACHE_CONTROL === 'public, max-age=300, s-maxage=900' && /^"[0-9a-f]{32}"$/.test(r.headers.etag), r.headers);
check('never run or framed, never cross-origin, never indexed', r.headers['x-content-type-options'] === 'nosniff' && r.headers['content-security-policy'] === "default-src 'none'; sandbox" && r.headers['cross-origin-resource-policy'] === 'same-origin' && r.headers['referrer-policy'] === 'no-referrer' && /noindex/.test(r.headers['x-robots-tag']));
check("carries the page's own cache tag, so a CMS publish empties it", r.headers['vercel-cache-tag'] === pageTag('key-acme') && r.headers['cache-tag'] === pageTag('key-acme'), r.headers);
check('no cookie, and nothing of the person but the image', !('set-cookie' in r.headers) && !/pat|optimizely\.com/i.test(JSON.stringify(r.headers)));

const etag = r.headers.etag;
r = await ask('acme', emailHash(ids.ae), {}, { headers: { 'if-none-match': `"zzz", ${etag}` } });
check('a browser holding the photo is told 304, with no body', r.statusCode === 304 && r.body === undefined, r.statusCode);
r = await ask('acme', emailHash(ids.ae), {}, { method: 'HEAD' });
check('HEAD answers the headers and no body', r.statusCode === 200 && r.body === undefined && r.headers['content-length'] === String(PNG.length));
check('asked three times within ten minutes: the wiki was asked once', calls.wiki.length === 1, calls.wiki.length);

// The same colleague, on another page that names them, is the same photo from the same call.
graphPages['/other/'].members!.push({ Name: 'Pat Again', Role: 'AE', Email: ids.ae });
forgetPagePeople();
r = await ask('other', emailHash(ids.ae));
check('the same person on another page: served, from what the instance already holds', r.statusCode === 200 && asBytes(r).equals(PNG) && calls.wiki.length === 1);
graphPages['/other/'].members!.pop();

// A key from Graph is only ever a cache tag if it is one: nothing odd reaches a header.
graphPages['/oddkey/'] = { type: 'CompetitorComparisonPage', key: 'x\r\nSet-Cookie: a=b', members: [{ Name: 'Pat Example', Role: 'AE', Email: ids.ae }] };
reset();
r = await ask('oddkey', emailHash(ids.ae));
check('a page key that is not a plain key is no cache tag, and the photo is still served', r.statusCode === 200 && !('vercel-cache-tag' in r.headers) && !('cache-tag' in r.headers) && !('set-cookie' in r.headers), r.headers);

/* ---------- 3b. Whoever is not on the page is not served, and nothing is asked of anyone ---------- */

reset();
const never = async (label: string, p: string, email: string, code = 'not-on-page') => {
  const before = { wiki: calls.wiki.length, limitless: calls.limitless.length };
  const x = await ask(p, emailHash(email));
  check(`${label}: 404 ${code}, and neither the wiki nor Limitless was asked`, x.statusCode === 404 && (x.body as { code?: string }).code === code && calls.wiki.length === before.wiki && calls.limitless.length === before.limitless, { s: x.statusCode, b: x.body, calls });
  check(`${label}: nothing of a person in the answer`, !/@|pat|sam/i.test(json(x)) && !/image/.test(x.headers['content-type'] ?? ''));
};
await never('a colleague who is not on this page', 'acme', ids.ceo);
await never("a person of another page, asked on this one", 'acme', 'other.rep@optimizely.com');
await never('a customer on the page', 'acme', 'cust@acme.com');
await never('a placeholder the page does not draw, with an Optimizely address', 'acme', ids.placeholder);
await never('the key of an address no page has', 'acme', 'nobody@example.test');
await never('a host asked on an account page', 'acme', OFFER_HOSTS.h1);
check('the wiki stayed untouched by every one of those', calls.wiki.length === 0 && calls.limitless.length === 0, calls);
r = await ask('acme', ids.ae);
check('the raw address in place of the key: 400, never looked up', r.statusCode === 400 && calls.wiki.length === 0);
r = await ask('acme', emailHash(ids.ae).toUpperCase());
check('an upper-case key: 400', r.statusCode === 400);
r = await ask('nosuch', emailHash(ids.ae));
check('a page that is not there: 404 no-page, the wiki not asked', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-page' && calls.wiki.length === 0, r.body);
r = await ask('acme/pat', emailHash(ids.ae));
check('a person page asked for an account\'s person: 404 not-on-page', r.statusCode === 404 && calls.wiki.length === 0, r.body);

/* ---------- 3c. The shape of the request ---------- */

reset();
const key = emailHash(ids.ae);
for (const [label, req] of [
  ['an extra parameter (a way round the cache)', ask('acme', key, { v: '2' })],
  ['no key', call(pageHandler, { query: { p: 'acme' } })],
  ['no page', call(pageHandler, { query: { k: key } })],
  ['two keys', ask('acme', [key, key])],
  ['a page that is not canonical (upper case)', ask('Acme', key)],
  ['a page with slashes', ask('/acme/', key)],
  ['a locale prefix', ask('en/acme', key)],
  ['a page that is the site\'s own', ask('search', key)],
  ['a path out of the site', ask('../etc/passwd', key)],
  ['a page of three segments', ask('a/b/c', key)],
  ['a key of 31 characters', ask('acme', key.slice(1))],
  ['a key with a non-hex character', ask('acme', `${key.slice(1)}g`)],
] as Array<[string, Promise<Res>]>) {
  const x = await req;
  check(`${label}: 400`, x.statusCode === 400 && (x.body as { code?: string }).code === 'bad-request', x.statusCode);
}
check('every one refused before any page or photo was read', calls.graph === 0 && calls.wiki.length === 0 && calls.limitless.length === 0, calls);
for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
  const x = await ask('acme', key, {}, { method });
  check(`${method}: 405`, x.statusCode === 405 && x.headers.allow === 'GET, HEAD');
}
check('a refusal is cached for minutes at the edge, never as long as a photo', (await ask('acme', key.slice(1))).headers['cache-control'] === 'public, max-age=60, s-maxage=300');

/* ---------- 3d. The switch ---------- */

for (const value of [undefined, '', 'off', 'On', 'ON', 'true', '1', 'yes', ' on']) {
  reset();
  env({ PAGE_PEOPLE_PHOTOS: value });
  const x = await ask('acme', key);
  check(`switch ${JSON.stringify(value)}: off, and nobody was asked`, x.statusCode === 404 && (x.body as { code?: string }).code === 'off' && calls.graph === 0 && calls.wiki.length === 0 && calls.limitless.length === 0, { s: x.statusCode, b: x.body });
  check(`switch ${JSON.stringify(value)}: read again within a minute, so switching on shows within one`, x.headers['cache-control'] === 'public, max-age=0, s-maxage=60');
}
env({ PAGE_PEOPLE_PHOTOS: 'on' });

/* ---------- 3e. What a photo may be, and what a failure is ---------- */

for (const mode of ['error', 'html', 'svg', 'huge', 'slow-lie', 'empty', 'throw'] as WikiBehaviour[]) {
  reset();
  behaviour.wiki = mode;
  const x = await ask('acme', key);
  check(`the wiki answers ${mode}: 502, no image, not cached by anything`, x.statusCode === 502 && x.headers['cache-control'] === 'no-store' && !/image/.test(x.headers['content-type'] ?? '') && x.body !== undefined && (x.body as { code?: string }).code === 'unavailable', { s: x.statusCode, h: x.headers });
  behaviour.wiki = 'photo';
  const y = await ask('acme', key);
  check(`after ${mode}: asked again, and served (a failure is not kept)`, y.statusCode === 200 && calls.wiki.length === 2, { s: y.statusCode, n: calls.wiki.length });
}
reset();
behaviour.wikiSecret = 'rotated';
r = await ask('acme', key);
check('the wiki refusing the token (401): 502, so a wrong secret is seen in the logs, never shown as "no photo"', r.statusCode === 502 && r.headers['cache-control'] === 'no-store', r.statusCode);
reset();
env({ OPTIID_RELAY_SECRET: undefined });
r = await ask('acme', key);
check('no relay secret (a local run): no photo, and the wiki is not called', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-photo' && calls.wiki.length === 0, r.body);
env({ OPTIID_RELAY_SECRET: SECRET });
reset();
r = await ask('acme', emailHash(ids.none));
check('someone with no photo: 404 no-photo, cached for minutes, tagged with the page', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-photo' && r.headers['cache-control'] === 'public, max-age=60, s-maxage=300' && r.headers['vercel-cache-tag'] === pageTag('key-acme'));
await ask('acme', emailHash(ids.none));
check('and the "none" is kept five minutes, not asked again', calls.wiki.length === 1);
r = await ask('acme', emailHash(ids.sam));
check('the wiki\'s "on its way" is none too', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-photo');

reset();
behaviour.graph = 'errors';
r = await ask('acme', key);
check('Graph answering errors: 502 and not "no such page" (a drifted query is not a 404)', r.statusCode === 502 && r.headers['cache-control'] === 'no-store' && calls.wiki.length === 0, r.body);
behaviour.graph = 'down';
forgetPagePeople();
r = await ask('acme', key);
check('Graph down: 502, never throws', r.statusCode === 502 && calls.wiki.length === 0);
behaviour.graph = 'ok';
r = await ask('acme', key);
check('and served as soon as Graph is back (a failed read is not held)', r.statusCode === 200);
env({ GRAPH_AUTH_KEY: undefined });
forgetPagePeople();
r = await ask('acme', key);
check('no Graph key: 502, nothing guessed', r.statusCode === 502);
env({ GRAPH_AUTH_KEY: 'graph-key' });

// Many asks at once for one person are one call.
reset();
behaviour.delayMs = 15;
const burst = await Promise.all(Array.from({ length: 8 }, () => ask('acme', key)));
check('eight asks at once for one person share one call to the wiki', burst.every((x) => x.statusCode === 200) && calls.wiki.length === 1, calls.wiki.length);
behaviour.delayMs = 0;

/* ---------- 3f. The wiki is called no more than a loop could make it ---------- */

reset();
const many = Array.from({ length: WIKI_CALLS_PER_MINUTE + 30 }, (_, i) => `person${i}@optimizely.com`);
graphPages['/crowd/'] = { type: 'CompetitorComparisonPage', key: 'key-crowd', members: many.map((email, i) => ({ Name: `P ${i}`, Role: 'AE', Email: email })) };
const crowdKeys = many.map((e) => emailHash(e));
check('a page names at most 24 people (the rest are not served)', photoKeyOf(many[30]) !== '' && (await ask('crowd', crowdKeys[30])).statusCode === 404);
// Past 24 per page, so a loop is made of many pages: the instance's own cap on wiki calls.
for (let i = 0; i < WIKI_CALLS_PER_MINUTE + 10; i++) {
  graphPages[`/c${i}/`] = { type: 'CompetitorComparisonPage', key: `key-c${i}`, members: [{ Name: 'X', Role: 'AE', Email: `loop${i}@optimizely.com` }] };
}
reset();
let wikiCallsMade = 0;
for (let i = 0; i < WIKI_CALLS_PER_MINUTE + 10; i++) {
  // Spread over addresses so the per-address limit never fires: this is the wiki's own cap.
  const x = await call(pageHandler, { query: { p: `c${i}`, k: emailHash(`loop${i}@optimizely.com`) }, headers: { 'x-forwarded-for': `198.51.100.${i % 250}` } });
  if (x.statusCode === 200 || x.statusCode === 404 || x.statusCode === 502) wikiCallsMade = calls.wiki.length;
}
check(`the wiki is called at most ${WIKI_CALLS_PER_MINUTE} times a minute by an instance, whatever is asked`, wikiCallsMade === WIKI_CALLS_PER_MINUTE, wikiCallsMade);

/* ---------- 3g. How many may ask ---------- */

reset();
const crowd = [];
for (let i = 0; i < PHOTOS_PER_IP_PER_MINUTE + 5; i++) crowd.push(await ask('acme', key));
check(`${PHOTOS_PER_IP_PER_MINUTE} a minute from one address, then 429 with Retry-After and nothing cached`, crowd.slice(0, PHOTOS_PER_IP_PER_MINUTE).every((x) => x.statusCode === 200) && crowd.slice(PHOTOS_PER_IP_PER_MINUTE).every((x) => x.statusCode === 429 && x.headers['retry-after'] === '60' && x.headers['cache-control'] === 'no-store'), crowd.map((x) => x.statusCode).join());
const other = await call(pageHandler, { query: { p: 'acme', k: key }, headers: { 'x-forwarded-for': '198.51.100.77' } });
check('another address is not affected', other.statusCode === 200);
const callsBefore = calls.wiki.length;
await ask('acme', emailHash(ids.sam));
check('refused asks reach neither Graph nor the wiki', calls.wiki.length === callsBefore);
const T = 1_800_000_000_000;
check('the window is a minute: the next one starts clean', (await overPhotoLimit('t', 'w', 2, T)) === false && (await overPhotoLimit('t', 'w', 2, T + 100)) === false && (await overPhotoLimit('t', 'w', 2, T + 200)) === true && (await overPhotoLimit('t', 'w', 2, T + 61_000)) === false);

// The shared counter, when there is one; and a counter that breaks is the instance's own, never none.
const counts = new Map<string, number>();
const expiries = new Map<string, number>();
setPhotoLimitStore({
  async set() {
    return 'OK';
  },
  async incr(k: string) {
    counts.set(k, (counts.get(k) ?? 0) + 1);
    return counts.get(k)!;
  },
  async expire(k: string, s: number) {
    expiries.set(k, s);
    return 1;
  },
} as never);
check('the shared counter: counts per hashed address and minute, expires, limits', (await overPhotoLimit('ip', '203.0.113.50', 1, T)) === false && (await overPhotoLimit('ip', '203.0.113.50', 1, T)) === true && [...counts.keys()].every((k) => !k.includes('203.0.113.50')) && [...expiries.values()].every((s) => s <= 120) && expiries.size === 1, { counts: [...counts.keys()] });
setPhotoLimitStore({
  async set() {
    throw new Error('down');
  },
  async incr() {
    throw new Error('down');
  },
  async expire() {
    throw new Error('down');
  },
} as never);
check('a counter that fails is this instance\'s own: the limit stands', (await overPhotoLimit('ip', 'x', 1, T)) === false && (await overPhotoLimit('ip', 'x', 1, T)) === true);
setPhotoLimitStore(null);

/* ---------- 3h. A person page ---------- */

reset();
r = await ask('acme/pat', emailHash(ids.signer));
check('a person page\'s team (and so the person who signed the note): served', r.statusCode === 200 && asBytes(r).equals(PNG2) && calls.wiki[0]?.email === ids.signer && r.headers['vercel-cache-tag'] === pageTag('key-acme-pat'), { s: r.statusCode, w: calls.wiki });
await never('a role title with an Optimizely address, which the page does not draw', 'acme/pat', ids.placeholder);
await never('an account page\'s person asked on a person page', 'acme/pat', ids.ae);

/* ---------- 3i. An offer page's hosts, through Limitless ---------- */

reset();
r = await ask('vb/spring-dinner', emailHash(OFFER_HOSTS.h1));
check('an offer host: served from Limitless', r.statusCode === 200 && asBytes(r).equals(PNG) && calls.wiki.length === 0, { s: r.statusCode, b: r.body });
check('asked at the offer and the host\'s Limitless key with the machine token, nothing else', calls.limitless.length === 1 && calls.limitless[0].path === `/api/machine/showcase/offers/offer-1/hosts/${hostKey(OFFER_HOSTS.h1)}/photo` && calls.limitless[0].auth === 'Bearer showcase-token', calls.limitless);
check('and the browser\'s key is not Limitless\'s', !calls.limitless[0].path.includes(emailHash(OFFER_HOSTS.h1)));
check("tagged with the offer page's own key", r.headers['vercel-cache-tag'] === pageTag('key-offer-offer-1'));
await never('a partner on the offer page', 'vb/spring-dinner', OFFER_HOSTS.h2);
await never('a host whose card has no address (no key exists to ask for)', 'vb/spring-dinner', 'nobody@optimizely.com');
r = await ask('vb/spring-dinner', emailHash(OFFER_HOSTS.h4));
check('a host Limitless does not hold on the offer: 404 no-photo', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-photo');
reset();
behaviour.limitless = 'html404';
r = await ask('vb/spring-dinner', emailHash(OFFER_HOSTS.h1));
check('a Limitless without the route yet (an HTML 404): none, initials', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-photo');
reset();
behaviour.limitless = 'unauthorized';
r = await ask('vb/spring-dinner', emailHash(OFFER_HOSTS.h1));
check('Limitless refusing the token: 502, seen in the logs', r.statusCode === 502 && r.headers['cache-control'] === 'no-store');
reset();
env({ ALDUS_SHOWCASE_TOKEN: undefined });
r = await ask('vb/spring-dinner', emailHash(OFFER_HOSTS.h1));
check('Limitless not configured: none, and it is not called', r.statusCode === 404 && calls.limitless.length === 0);
env({ ALDUS_SHOWCASE_TOKEN: 'showcase-token' });
reset();
r = await ask('vb/no-plan', emailHash(OFFER_HOSTS.h1));
check('a page with no offer behind it is not an offer page of hosts: 404 no-page, nobody asked', r.statusCode === 404 && (r.body as { code?: string }).code === 'no-page' && calls.limitless.length === 0 && calls.wiki.length === 0, r.body);
r = await ask('vb/nosuch', emailHash(OFFER_HOSTS.h1));
check('no such offer page: 404 no-page', r.statusCode === 404);

/* ---------- 3j. Over everything ---------- */

check('the wiki was only ever sent @optimizely.com addresses', everyWikiEmail.length > 0 && everyWikiEmail.every((e) => /^[a-z0-9._%+-]+@optimizely\.com$/.test(e)), everyWikiEmail.filter((e) => !/@optimizely\.com$/.test(e)));
check('Limitless was only ever sent the key of an Optimizely host (never a partner\'s)', everyLimitlessKey.length > 0 && everyLimitlessKey.every((k) => k === hostKey(OFFER_HOSTS.h1) || k === hostKey(OFFER_HOSTS.h4)) && !everyLimitlessKey.includes(hostKey(OFFER_HOSTS.h2)), everyLimitlessKey);
check('no customer address was ever sent anywhere', !everyWikiEmail.some((e) => /acme\.com|velir|example\.test/.test(e)));

/* ---------- 4. api/me-photo ---------- */

reset();
const cookieFor = (email: string): Record<string, string> => {
  const out: Record<string, string | string[]> = {};
  const res = { getHeader: (k: string) => out[k], setHeader: (k: string, v: string | string[]) => (out[k] = v) };
  setSessionCookie(res as never, { sub: `sub:${email}`, email, env: 'prod' });
  const m = /showcase_session=([^;]+)/.exec(([] as string[]).concat(out['Set-Cookie']).join('\n'));
  return { showcase_session: m![1] };
};
let me = await call(meHandler, {});
check('no session: 401, never a photo', me.statusCode === 401 && calls.wiki.length === 0);
me = await call(meHandler, { cookies: cookieFor('pat@optimizely.com') });
check('signed in: their own photo, with the wiki asked for them', me.statusCode === 200 && asBytes(me).equals(PNG) && calls.wiki.length === 1 && calls.wiki[0].email === 'pat@optimizely.com', { s: me.statusCode, w: calls.wiki });
check('private to that browser: follows the cookie, never a shared cache', me.headers['cache-control'] === 'private, max-age=300' && me.headers.vary === 'Cookie' && /^"[0-9a-f]{32}"$/.test(me.headers.etag));
me = await call(meHandler, { cookies: cookieFor('pat@optimizely.com'), query: { email: ids.ceo, p: 'acme', k: photoKeyOf(ids.ceo) } });
check('a request cannot name someone else: the session decides, whatever it carries', me.statusCode === 200 && calls.wiki.every((c) => c.email === 'pat@optimizely.com'), calls.wiki);
const before = calls.wiki.length;
me = await call(meHandler, { cookies: cookieFor('someone@customer.example') });
check('an identity that is not Optimizely\'s: 404, and the wiki is not asked', me.statusCode === 404 && calls.wiki.length === before);
me = await call(meHandler, { cookies: cookieFor('pat@optimizely.com'), method: 'POST' });
check('POST: 405', me.statusCode === 405);
env({ PAGE_PEOPLE_PHOTOS: undefined });
me = await call(meHandler, { cookies: cookieFor('pat@optimizely.com') });
check('switch off: none', me.statusCode === 404 && calls.wiki.length === before);
env({ PAGE_PEOPLE_PHOTOS: 'on' });
reset();
let own = 0;
for (let i = 0; i < OWN_PHOTOS_PER_MINUTE + 3; i++) if ((await call(meHandler, { cookies: cookieFor('pat@optimizely.com') })).statusCode === 429) own++;
check(`${OWN_PHOTOS_PER_MINUTE} a minute for one person, then 429`, own === 3, own);

/* ---------- 5. Wiring, read from the sources ---------- */

const files = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? (f === 'node_modules' || f === 'vendor' ? [] : files(join(dir, f))) : [join(dir, f)]));
const browser = files('src').filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__'));
const leaks = browser.filter((f) => /OPTIID_RELAY_SECRET|ALDUS_SHOWCASE_TOKEN|ALDUS_UI_URL|PAGE_PEOPLE_PHOTOS|people-call|people-api|auth\/people/.test(read(f)));
check('no browser code holds the secret, the token, the switch or the wiki\'s address', leaks.length === 0, leaks);
check('the wiki\'s signed photo link is never used (the bytes are fetched with the token, and nothing is held that dies in hours)', !/photo_url|\/api\/auth\/people\?|signedPhotoUrl/.test(read('api/_lib/teams-photo.ts') + read('api/page-photo.ts') + read('api/me-photo.ts')));
check('in api/, the relay secret is read by sign-in and by the wiki client, and by nothing else', files('api').filter((f) => /\.ts$/.test(f) && read(f).includes('OPTIID_RELAY_SECRET')).sort().join() === ['api/_lib/auth.ts', 'api/_lib/teams-photo.ts', 'api/auth/optimizely/callback.ts'].join());
check('the page tag is the one the CMS publish purges', /Vercel-Cache-Tag': `page:\$\{people\.key\}`/.test(read('api/page-photo.ts')) && pageTag('abc') === 'page:abc');
const avatar = read('src/components/GravatarAvatar.tsx');
check('the avatar goes Gravatar, then Teams, then initials, on the image\'s own error', /avatarSources\(/.test(avatar) && /onError=\{next\}/.test(avatar) && /window\.location\.pathname/.test(avatar) && !/useEffect\([^)]*fetch/.test(avatar));
check('the avatar never fetches the photo itself: it is an <img>, so drawing waits on nothing', !/fetch\(|XMLHttpRequest|await /.test(avatar));
check('the avatar defaults to what it always did (Gravatar for any address)', /others = 'gravatar'/.test(avatar));
const aldusUse = (f: string) => read(f).match(/<GravatarAvatar[^>]*>/g) ?? [];
check('cards that never drew Gravatar for anyone say so (initials for other addresses)', aldusUse('src/www/OfferPage.tsx').every((t) => /others="initials"/.test(t)) && aldusUse('src/www/AgentPlatformPage.tsx').every((t) => /others="initials"/.test(t)) && aldusUse('src/www/PersonPage.tsx').filter((t) => /www-initials/.test(t)).every((t) => /others="initials"/.test(t)), { offer: aldusUse('src/www/OfferPage.tsx'), ap: aldusUse('src/www/AgentPlatformPage.tsx') });
check('cards that always drew Gravatar are as they were', aldusUse('src/www/AccountPage.tsx').every((t) => !/others=/.test(t)) && aldusUse('src/www/ConnectModal.tsx').every((t) => !/others=/.test(t)));
check('the profile menu goes Gravatar, then the signed-in person\'s own photo', /OWN_PHOTO = '\/api\/me-photo'/.test(read('src/components/ProfileMenu.tsx')) && /optimizelyAddress\(identity\.email\)/.test(read('src/components/ProfileMenu.tsx')));
check('the route is a function of its own, in vercel.json\'s rewrite scope (api/ is never rewritten to the page renderer)', /\(\?!api\/\|_vercel\/\)/.test(read('vercel.json')));
check('.env.example names the switch', /^PAGE_PEOPLE_PHOTOS=/m.test(read('.env.example')));

check('the logs hold no address, no token and no photo link', logs.length > 0 && logs.every((l) => !/@|Bearer|eyJ|photo_url|showcase-token|test-relay-secret/.test(l)), logs.filter((l) => /@|Bearer|eyJ|showcase-token|test-relay-secret/.test(l)));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
