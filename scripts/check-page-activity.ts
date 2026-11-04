/**
 * check-page-activity — Activity mode (src/lib/page-activity.ts, src/lib/activity-dom.ts,
 * api/page-activity.ts, api/page-visit.ts, api/_lib/odp-events.ts, api/_lib/page-activity-store.ts,
 * src/hooks/useOdpTracking.ts).
 *
 *   1. Keys: page keys and ODP visitor ids as ODP and the site spell them.
 *   2. Elements, from real `html_element_path` values captured on 4 Nov 2026: the key survives the
 *      classes the page toggles and ODP's cut-off selector; booth chrome and dialogs are dropped;
 *      a click on text is told apart from a click on a link. Control: keeping classes splits one
 *      button into two keys.
 *   3. Who is who: signed-in, office, internal referrer, four pages → team; machine networks → bot.
 *   4. CTAs: labels without icon words, connect clicks by id/type, booth buttons never counted.
 *   5. The report, on a fixture of real-shaped events: visits, median, reach, final scroll only
 *      (ODP's load-time 25–100% ignored), clicks and rage, CTAs, sources, the account's network,
 *      team kept out of "visitors", other pages and other periods kept out.
 *   6. Finding the element again on a page (resolveElement on a stand-in DOM).
 *   7. The API: page-visit accepts only its shape, from the site, at a rate, and marks signed-in
 *      visitors as team; page-activity needs sign-in, asks ODP only what ODP accepts (stand-in that
 *      refuses dashed ids, unknown fields and a bare `page`), and never returns a visitor id.
 *   8. Wiring, read from the sources: the ODP key is read in one server file; the hook skips the
 *      booth tools; the connect panel's tiles are named.
 *
 * No network, no credentials.
 *
 *   npx tsx scripts/check-page-activity.ts
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  accountTerms,
  benchmarkFrom,
  buildActivityReport,
  classifyVisitors,
  ctaKind,
  ctaLabel,
  elementRef,
  isAccountNetwork,
  isBoothLabel,
  isPageKey,
  normalizeVuid,
  pageKey,
  sourceOf,
  type ActivityEvent,
} from '../src/lib/page-activity.js';
import { resolveElement } from '../src/lib/activity-dom.js';
import { pathFilter, type OdpClient } from '../api/_lib/odp-events.js';
import type { ActivityStore } from '../api/_lib/page-activity-store.js';
import visitHandler, { setVisitStore } from '../api/page-visit.js';
import activityHandler, { historyOf, summarizeDeal, setActivitySources } from '../api/page-activity.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail: unknown = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail !== '' ? `\n     ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

/* ---------- 1. Keys ---------- */

check('page key: slashes, case and locale', pageKey('/Lenovo/') === 'lenovo' && pageKey('/en/lenovo') === 'lenovo' && pageKey('lenovo?x=1#y') === 'lenovo');
check('page key: offer pages keep /vb/', pageKey('/vb/offer-x/') === 'vb/offer-x');
check('a page key is an account or offer page', isPageKey('lenovo') && isPageKey('lenovo-2') && isPageKey('vb/the-north-face-lvmh'));
check('…and never the site\'s own routes or anything else', !isPageKey('search') && !isPageKey('preview') && !isPageKey('api') && !isPageKey('a/b') && !isPageKey("x' or 1=1") && !isPageKey(''));
check('vuid: ODP wants 32 hex without dashes', normalizeVuid('63066a45-fbc6-4017-82b6-dcfe90d43b84') === '63066a45fbc6401782b6dcfe90d43b84');
check('vuid: anything else is refused', normalizeVuid('63066a45') === null && normalizeVuid('zz066a45fbc6401782b6dcfe90d43b84') === null && normalizeVuid(42) === null);

/* ---------- 2. Elements ---------- */

// Captured on /lenovo/ and /cdw/, 4 Nov 2026 (the selector part is cut by ODP at ~150 characters).
const HERO_CTA =
  'html.www-js > body > div#root > main > div.www-page.bg-primary-1.text-secondary-darkfir.font-body.flex.min-h-screen.w-full.flex-col.www-ap > div#main-content > section#hero.www-hero.is-in.is-current > div.www-hero__card.www-hero__card--darkfir > div.www-hero__copy > div.www-hero__body > div.flex.flex-wrap.gap-3 > a.inline-flex.items-center.justify-center.gap-3.font-button.font-(--font-weight-button).text-center.transition-all.cursor-pointer.border-solid.focus-v';
const CARD_TEXT =
  'html.www-js > body > div#root > main > div.www-page.bg-primary-1.text-secondary-darkfir.font-body.flex.min-h-screen.w-full.flex-col.www-ap > div#main-content > section#usecases.www-scene.www-scene--neutral.is-in.is-current > div.www-scene__inner.vb-container.mx-auto.w-full.px-4.lg:px-8 > div > div.grid.gap-3.md:grid-cols-2 > div.www-card.www-card--white.www-usecase:nth-child(2) > p.www-body.mt-2';
const hero = elementRef(HERO_CTA);
check('a CTA click anchors on its scene', hero?.section === 'hero' && hero.key.startsWith('section#hero>'), hero);
check('…and is interactive (a link)', hero?.interactive === true && hero.tag === 'a');
check('…and the cut-off last class is not required to find it', !hero?.segments.at(-1)!.classes.some((c) => c.startsWith('focus-v')));
const card = elementRef(CARD_TEXT);
check('a click on card text is a click that cannot do anything', card?.interactive === false && card.section === 'usecases');
check('…and keeps its position among siblings', card?.key.includes('div:2>p') === true, card?.key);
const later = elementRef(CARD_TEXT.replace('.is-in.is-current', '.is-in'));
check('the classes the page toggles never split an element', later?.key === card?.key);
const keyWithClasses = (p: string) => p.split(' > ').slice(6).join('>');
check('control: keeping classes would split it', keyWithClasses(CARD_TEXT) !== keyWithClasses(CARD_TEXT.replace('.is-in.is-current', '.is-in')));
check('booth chrome is not the page', elementRef('html.www-js > body > div#root > aside.xray-sidebar > button.xray-sidebar__btn.xray-sidebar__btn--xray > span.xray-sidebar__label') === null);
check('…nor a click while Activity is open', elementRef(HERO_CTA.replace('> body >', '> body.activity-active >')) === null);
check('a dialog (the connect panel) cannot be placed', elementRef('html.www-js > body > div#radix-_r_0_ > div > button > span') === null);
check('no id on the path: no element', elementRef('html > body > div > p') === null);

/* ---------- 3. Who is who ---------- */

const V = (n: number) => n.toString(16).padStart(32, '0');
const ev = (vuid: string, ts: number, x: Partial<ActivityEvent>): ActivityEvent => ({ vuid, ts, event_type: null, action: null, session_id: 's1', page: '/cdw/', ...x });
const kinds = classifyVisitors(
  [
    ev(V(1), 1, { action: 'pageview', isp: 'Comcast Cable' }),
    ev(V(2), 1, { action: 'pageview', isp: 'Comcast Cable' }),
    ev(V(3), 1, { action: 'pageview', isp: 'Pilot Fiber Inc.' }),
    ev(V(4), 1, { action: 'pageview', referral_host: 'optimizely.lightning.force.com' }),
    ...['a', 'b', 'c', 'd'].map((p) => ev(V(5), 1, { action: 'pageview', page: `/${p}/` })),
    ...['a', 'b', 'c'].map((p) => ev(V(6), 1, { action: 'pageview', page: `/${p}/` })),
    ev(V(7), 1, { action: 'pageview', isp: 'Google Inc.' }),
    ev(V(8), 1, { action: 'pageview', likely_machine_generated: true }),
  ],
  new Set([V(2)]),
);
check('a visitor is a visitor', kinds.get(V(1)) === 'visitor');
check('signed in on the site: team', kinds.get(V(2)) === 'team');
check('the office network: team', kinds.get(V(3)) === 'team');
check('arriving from Salesforce: team', kinds.get(V(4)) === 'team');
check('four companies\' pages: team; three: not', kinds.get(V(5)) === 'team' && kinds.get(V(6)) === 'visitor');
check('Googlebot and ODP\'s machine flag: bot', kinds.get(V(7)) === 'bot' && kinds.get(V(8)) === 'bot');
const terms = accountTerms('lenovo.com', 'Personalized for Lenovo Group Ltd');
check('the account\'s network: its name or domain as a word', isAccountNetwork('Lenovo (Beijing) Ltd', terms) && isAccountNetwork('LENOVO-NET', terms));
check('…not a word inside another', !isAccountNetwork('Comcast Cable', terms) && !isAccountNetwork('Novolenovox', terms));
check('…and never on a label too short to mean anything', !isAccountNetwork('HP Inc', accountTerms('hp.com', 'HP')));

/* ---------- 4. CTAs ---------- */

check('icon words and "(opens in new tab)" are not the label', ctaLabel('bolt Arrange a session') === 'Arrange a session' && ctaLabel('Read → (opens in new tab)') === 'Read →');
check('a connect click by type and position', JSON.stringify(ctaKind({ cta_type: 'connect', position: 'sticky', label: 'Map your next use case' })) === '{"type":"connect","position":"sticky"}');
check('an older connect click by its words', ctaKind({ element: 'cta', label: 'Arrange a session with Chuck' }).type === 'connect');
check('any other button is a button', ctaKind({ element: 'cta', label: 'See where agents start' }).type === 'cta');
check('the booth\'s own buttons are never CTAs', isBoothLabel('X-ray') && isBoothLabel('Edit') && isBoothLabel("You're all set") && !isBoothLabel('Arrange a session'));
check('sources: campaign, then referrer kind, then direct', sourceOf({ source: 'outreach', referral_host: 'x.com' }) === 'outreach' && sourceOf({ referral_host: 'www.linkedin.com' }) === 'linkedin' && sourceOf({ referral_host: 'outlook.office.com' }) === 'email' && sourceOf({}) === 'direct');

/* ---------- 5. The report ---------- */

const NOW = 1_793_800_000;
const day = 86400;
const P = '/cdw/';
const fixture: ActivityEvent[] = [
  // Visitor 1: Lenovo's own network, from LinkedIn, reads to the end, presses the hero connect.
  ev(V(1), NOW - 2 * day, { action: 'pageview', event_type: 'pageview', session_id: 'a', isp: 'Lenovo (Beijing) Ltd', country: 'usa', device_type: 'PC', referral_host: 'www.linkedin.com' }),
  ev(V(1), NOW - 2 * day + 1, { action: 'section_view', section: 'hero', session_id: 'a' }),
  ev(V(1), NOW - 2 * day + 5, { action: 'section_view', section: 'who', session_id: 'a' }),
  ev(V(1), NOW - 2 * day + 9, { event_type: 'scroll_depth', scroll_depth_percentage: 100, is_final_depth: false, session_id: 'a' }),
  ev(V(1), NOW - 2 * day + 30, { event_type: 'click', html_element_path: HERO_CTA, is_rage_click: false, session_id: 'a' }),
  ev(V(1), NOW - 2 * day + 30, { action: 'cta_click', element: 'connect', cta_type: 'connect', position: 'hero', label: 'Arrange a session', session_id: 'a' }),
  ev(V(1), NOW - 2 * day + 90, { action: 'page_exit', time_on_page_sec: 90, max_scroll_pct: 100, session_id: 'a' }),
  // Visitor 2: two quick visits, rage-clicks card text, ODP's load-time scroll noise only.
  ev(V(2), NOW - day, { action: 'pageview', event_type: 'pageview', session_id: 'b', isp: 'Comcast Cable', country: 'can', device_type: 'Mobile' }),
  ev(V(2), NOW - day, { event_type: 'scroll_depth', scroll_depth_percentage: 100, is_final_depth: false, session_id: 'b' }),
  ev(V(2), NOW - day + 3, { action: 'section_view', section: 'hero', session_id: 'b' }),
  ev(V(2), NOW - day + 4, { event_type: 'click', html_element_path: CARD_TEXT, is_rage_click: true, session_id: 'b' }),
  ev(V(2), NOW - day + 5, { event_type: 'click', html_element_path: CARD_TEXT.replace('.is-current', ''), is_rage_click: true, session_id: 'b' }),
  ev(V(2), NOW - day + 10, { event_type: 'scroll_depth', scroll_depth_percentage: 30, is_final_depth: true, session_id: 'b' }),
  ev(V(2), NOW - 3600, { action: 'pageview', event_type: 'pageview', session_id: 'c', isp: 'Comcast Cable' }),
  ev(V(2), NOW - 3600 + 20, { action: 'page_exit', time_on_page_sec: 20, max_scroll_pct: 10, session_id: 'c' }),
  // Team: a signed-in rep, and their X-ray click in the old tracking.
  ev(V(9), NOW - 3 * day, { action: 'pageview', event_type: 'pageview', session_id: 't', isp: 'Fontainebleau Las Vegas' }),
  ev(V(9), NOW - 3 * day + 2, { action: 'cta_click', element: 'cta', label: 'X-ray', session_id: 't' }),
  ev(V(9), NOW - 3 * day + 4, { action: 'section_view', section: 'hero', session_id: 't' }),
  // Out of the period, and another page.
  ev(V(1), NOW - 60 * day, { action: 'pageview', event_type: 'pageview', session_id: 'old' }),
  ev(V(1), NOW - day, { action: 'pageview', event_type: 'pageview', session_id: 'z', page: '/lenovo/' }),
];
const rep = buildActivityReport({ page: P, range: '30d', nowS: NOW, events: fixture, teamVuids: new Set([V(9)]), accountTerms: terms });
const v = rep.visitors;
check('visitors and visits: two people, three visits on this page in the period', v.visitors === 2 && v.visits === 3, { visitors: v.visitors, visits: v.visits });
check('team is counted apart and left out of visitors', rep.teamCount === 1 && rep.everyone.visitors === 3);
check('median time on page from page_exit, else the visit\'s span', v.medianSec === 20, v.medianSec);
check('reach: visitors per scene', v.sections.hero === 2 && v.sections.who === 1);
check('scroll: only final depths count (load-time 100% ignored)', JSON.stringify(v.scroll) === '[1,1,0,0,1]', v.scroll);
const cardStat = v.elements.find((e) => e.section === 'usecases');
check('clicks on one element across class changes: one element, two clicks, two rage', cardStat?.clicks === 2 && cardStat.rage === 2 && cardStat.visitors === 1 && cardStat.dead === true, cardStat);
check('the hero link click is not a dead click', v.elements.find((e) => e.section === 'hero')?.dead === false);
check('CTA: one connect from the hero', v.ctas.length === 1 && v.ctas[0].type === 'connect' && v.ctas[0].position === 'hero' && v.connectVisitors === 1 && v.ctaClicks === 1, v.ctas);
check('the rep\'s X-ray click never counts, even for everyone', rep.everyone.ctaClicks === 1);
check('sources per visit', JSON.stringify(v.sources) === '[{"name":"direct","n":2},{"name":"linkedin","n":1}]', v.sources);
check('the account\'s own network is marked', v.networks.find((n) => n.name.startsWith('Lenovo'))?.account === true && v.networks.find((n) => n.name === 'Comcast Cable')?.account === false);
check('visits by day, last bin is today', v.series.counts.reduce((a, b) => a + b, 0) === 3 && v.series.counts.at(-1) === 1, v.series.counts.slice(-3));
check('last visit', v.lastTs === NOW - 3600);
const empty = buildActivityReport({ page: '/nobody/', range: '7d', nowS: NOW, events: fixture, teamVuids: new Set(), accountTerms: [] });
check('a page nobody visited is zeros, not an error', empty.visitors.visitors === 0 && empty.visitors.medianSec === null);
const bench = benchmarkFrom([v, empty.visitors], new Date(NOW * 1000).toISOString());
check('averages count only pages with visitors', bench.pages === 1 && bench.sectionReach.hero === 1 && bench.sectionReach.who === 0.5 && bench.connectRate === 0.5, bench);

/* ---------- 6. Finding the element again ---------- */

type FakeEl = { tagName: string; id?: string; classList: { contains: (c: string) => boolean }; children: FakeEl[] };
const el = (tag: string, cls: string[] = [], children: FakeEl[] = [], id?: string): FakeEl => ({ tagName: tag.toUpperCase(), id, classList: { contains: (c) => cls.includes(c) }, children });
const p2 = el('p', ['www-body', 'mt-2']);
const cardA = el('div', ['www-card', 'www-usecase'], [el('p', ['www-body'])]);
const cardB = el('div', ['www-card', 'www-usecase'], [el('h3'), p2]);
const usecases = el('section', ['www-scene'], [el('div', ['www-scene__inner'], [el('div', [], [el('div', ['grid'], [cardA, cardB])])])], 'usecases');
const doc = { getElementById: (id: string) => (id === 'usecases' ? usecases : null) } as unknown as Document;
check('found again by its path from the scene', resolveElement(card!.segments, doc) === (p2 as unknown));
check('a scene not on the page: not found, no guess', resolveElement(hero!.segments, doc) === null);

/* ---------- 7. The API ---------- */

type Res = { statusCode: number; body: unknown; headers: Record<string, string> };
function call(handler: (req: never, res: never) => unknown, req: Record<string, unknown>): Promise<Res> {
  const out: Res = { statusCode: 200, body: undefined, headers: {} };
  const res = {
    setHeader: (k: string, v: string) => (out.headers[k.toLowerCase()] = v),
    status(c: number) { out.statusCode = c; return res; },
    json(b: unknown) { out.body = b; return res; },
    end() { return res; },
  };
  return Promise.resolve(handler({ headers: { host: 'showcase.optimizely.com' }, cookies: {}, query: {}, ...req } as never, res as never)).then(() => out);
}

function memoryStore() {
  const z = new Map<string, Map<string, number>>();
  const h = new Map<string, Record<string, unknown>>();
  const kv = new Map<string, unknown>();
  const store = {
    async zadd(key: string, m: { score: number; member: string }) { const s = z.get(key) ?? new Map(); s.set(m.member, m.score); z.set(key, s); return 1; },
    async zremrangebyrank() { return 0; },
    async zrange(key: string, max: string, min: number) { return [...(z.get(key) ?? new Map())].filter(([, s]) => s >= Number(min) && (max === '+inf' || s <= Number(max))).sort((a, b) => b[1] - a[1]).map(([m]) => m); },
    async expire() { return 1; },
    async hset(key: string, o: Record<string, unknown>) { h.set(key, { ...(h.get(key) ?? {}), ...o }); return 1; },
    async hmget(key: string, ...f: string[]) { const o = h.get(key) ?? {}; return Object.fromEntries(f.map((k) => [k, o[k] ?? null])); },
    async incr(key: string) { const n = Number(kv.get(key) ?? 0) + 1; kv.set(key, n); return n; },
    async set(key: string, v: unknown) { kv.set(key, v); return 'OK'; },
    async get(key: string) { return kv.get(key) ?? null; },
  };
  return { store: store as unknown as ActivityStore, z, h, kv };
}

delete process.env.OPTIID_RELAY_SECRET;
delete process.env.DEV_AUTH_EMAIL;
const mem = memoryStore();
setVisitStore(mem.store);
const vuid = '63066a45-fbc6-4017-82b6-dcfe90d43b84';
check('page-visit: POST only', (await call(visitHandler, { method: 'GET' })).statusCode === 405);
check('page-visit: refused from another site', (await call(visitHandler, { method: 'POST', headers: { host: 'showcase.optimizely.com', origin: 'https://evil.example' }, body: { page: '/cdw/', vuid } })).statusCode === 403);
check('page-visit: refused cross-site even without Origin', (await call(visitHandler, { method: 'POST', headers: { host: 'showcase.optimizely.com', 'sec-fetch-site': 'cross-site' }, body: { page: '/cdw/', vuid } })).statusCode === 403);
check('page-visit: a bad id or page is refused', (await call(visitHandler, { method: 'POST', body: { page: '/cdw/', vuid: 'x' } })).statusCode === 400 && (await call(visitHandler, { method: 'POST', body: { page: '/search', vuid } })).statusCode === 400);
const ok = await call(visitHandler, { method: 'POST', headers: { host: 'showcase.optimizely.com', origin: 'https://showcase.optimizely.com', 'sec-fetch-site': 'same-origin', 'x-forwarded-for': '1.2.3.4' }, body: { page: '/CDW/', vuid } });
check('page-visit: records the visitor on the page, without dashes', ok.statusCode === 204 && mem.z.get('pa:v:cdw')?.has('63066a45fbc6401782b6dcfe90d43b84') === true);
check('…signed out: not team', !mem.h.get('pa:team'));
process.env.DEV_AUTH_EMAIL = 'rep@optimizely.com';
await call(visitHandler, { method: 'POST', headers: { host: 'showcase.optimizely.com', 'x-forwarded-for': '1.2.3.5' }, body: { page: '/cdw/', vuid } });
check('…signed in: team', mem.h.get('pa:team')?.['63066a45fbc6401782b6dcfe90d43b84'] != null);
let status = 0;
for (let i = 0; i < 61; i++) status = (await call(visitHandler, { method: 'POST', headers: { host: 'showcase.optimizely.com', 'x-forwarded-for': '9.9.9.9' }, body: { page: '/cdw/', vuid } })).statusCode;
check('page-visit: the 61st visit in a minute from one address is refused', status === 429);

// A stand-in ODP that refuses what the real one refuses (probed 4 Nov 2026).
const EVENT_FIELDS = new Set('ts event_type action session_id section element label position cta_type time_on_page_sec max_scroll_pct html_element_path html_element_tag is_rage_click scroll_depth_percentage is_final_depth isp country device_type referral_host source medium campaign likely_machine_generated'.split(' '));
const asked: string[] = [];
const odp: OdpClient = {
  async query(q) {
    asked.push(q);
    if (/vuid: "[^"]*-/.test(q)) return { errors: [{ message: 'could not resolve any of the supplied identifiers' }], data: null };
    if (/\bpage\b(?!\s*\{)(?!\s*=)/.test(q.replace(/page \{ page \}/g, '').replace(/pageInfo/g, ''))) throw new Error('Subselection required for type Page');
    const fields = [...q.matchAll(/node \{ ([^{}]+?) page \{/g)].flatMap((m) => m[1].trim().split(/\s+/));
    const unknown = fields.filter((f) => !EVENT_FIELDS.has(f));
    if (unknown.length) throw new Error(`FieldUndefined: ${unknown.join(',')}`);
    const data: Record<string, unknown> = {};
    for (const m of q.matchAll(/(\w+): events\(vuid: "([0-9a-f]{32})"[^)]*filter: "([^"]*)"/g)) {
      const [, alias, id, filter] = m;
      const mine = fixture.filter((e) => e.vuid === id && e.page === P && (!filter.includes("action = 'pageview'") || e.action === 'pageview'));
      data[alias] = { edges: mine.map((e) => ({ node: { ...e, page: { page: e.page } } })), pageInfo: { hasNextPage: false, endCursor: null } };
    }
    return { data: data as never };
  },
};
const store2 = memoryStore();
for (const id of [V(1), V(2), V(9)]) await store2.store.zadd('pa:v:cdw', { score: NOW, member: id });
await store2.store.hset('pa:team', { [V(9)]: NOW });
setActivitySources({ store: store2.store, odp });
process.env.OPTIID_RELAY_SECRET = 'x'.repeat(32);
check('page-activity: signed out is refused', (await call(activityHandler, { method: 'GET', query: { page: 'cdw' } })).statusCode === 401);
delete process.env.OPTIID_RELAY_SECRET;
check('page-activity: an unknown page shape is refused', (await call(activityHandler, { method: 'GET', query: { page: '../../etc' } })).statusCode === 400);
const realNow = Date.now;
Date.now = () => NOW * 1000;
const got = await call(activityHandler, { method: 'GET', query: { page: 'cdw', range: '30d' } });
Date.now = realNow;
const body = got.body as { report?: { visitors: { visitors: number }; teamCount: number } };
check('page-activity: answers the report', got.statusCode === 200 && body.report?.visitors.visitors === 2 && body.report.teamCount === 1, got);
check('…asked ODP only for dash-free ids, known fields and `page { page }`', asked.length > 0 && !asked.some((q) => /vuid: "[^"]*-/.test(q)));
check('…with the page in both forms it is sent in', asked.some((q) => q.includes(pathFilter('cdw'))) && pathFilter('cdw').includes("page = '/cdw/' or page = '/cdw'"));
check('…and never returns a visitor id', !JSON.stringify(got.body).match(/[0-9a-f]{32}/));
check('…nor caches anything a browser could share', got.headers['cache-control'] === 'no-store');
setActivitySources({});

check('deal: open pipeline per currency, next close, won and lost', JSON.stringify(summarizeDeal([
  { StageName: 'Discovery', Amount: 100, CurrencyIsoCode: 'USD', CloseDate: '2027-01-01', IsClosed: false },
  { StageName: 'Negotiation', Amount: 50, CurrencyIsoCode: 'USD', CloseDate: '2026-12-01', IsClosed: false },
  { StageName: 'Closed Won', Amount: 10, CurrencyIsoCode: 'GBP', CloseDate: '2025-01-01', IsClosed: true, IsWon: true },
])) === JSON.stringify({ open: 2, openAmounts: [{ currency: 'USD', amount: 150 }], next: { stage: 'Negotiation', closeDate: '2026-12-01' }, won: 1, lost: 0, lastClosed: { stage: 'Closed Won', closeDate: '2025-01-01', won: true } }));
const hist = historyOf({ created: '2026-10-29T20:44:07Z', published: null, lastModified: '2026-10-29T20:50:00Z', salesforceAccountID: null, brandDomain: null, eyebrow: null }, [{ at: '2026-11-02T10:00:10Z' }, { at: '2026-11-02T10:00:40Z' }]);
check('history: built; a save minutes after the build is the build; one copy edit per minute', hist.map((h) => h.kind).join() === 'built,copy', hist);

/* ---------- 8. Wiring ---------- */

const files = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((f) => (statSync(join(root, dir, f)).isDirectory() ? (f === 'node_modules' || f === 'vendor' ? [] : files(join(dir, f))) : [join(dir, f)]));
const keyReaders = [...files('src'), ...files('api'), ...files('server')].filter((f) => /\.(ts|tsx)$/.test(f) && read(f).includes('ODP_PRIVATE_KEY'));
check('the ODP key is read in one server file and nowhere in the browser code', keyReaders.join() === 'api/_lib/odp-events.ts', keyReaders);
const hook = read('src/hooks/useOdpTracking.ts');
check('the tracking hook skips the booth tools', hook.includes('target.closest(BOOTH_CHROME)') && /\.xray-sidebar/.test(hook) && /\.activity-fixed/.test(hook));
check('the hook records the visit, never in the CMS preview', /if \(!inCmsPreview\(\)\) recordVisit\(/.test(hook));
check('the connect panel\'s tiles are named for tracking', /data-cta="schedule"/.test(read('src/www/ConnectModal.tsx')) && /data-cta="contact"/.test(read('src/www/ConnectModal.tsx')));
check('Activity is offered on account pages only', /variant === 'abm' && \(/.test(read('src/components/FloatingSidebar.tsx')));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
