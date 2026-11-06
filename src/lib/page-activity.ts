/**
 * Page activity: what visitors did on one showcase page, built from ODP events.
 *
 * Where the events come from (api/_lib/odp-events.ts): ODP answers events one visitor (vuid) at a
 * time, never "everyone on this page", so the site keeps a small index of which visitors saw which
 * page (api/_lib/page-activity-store.ts) and reads each visitor's events from ODP. Two tags write
 * the events this file reads:
 *
 *   - ODP's universal tag (oiq.min.js) records every click with the element's path in the page
 *     (`html_element_path`, e.g. `… > section#usecases.www-scene > div … > p.www-body`), whether
 *     it was a rage click, and the final scroll depth of a visit.
 *   - Our own hook (src/hooks/useOdpTracking.ts) records the pageview, each scene seen
 *     (`section_view`), CTA clicks with a label and position, and a `page_exit` summary.
 *
 * Everything here is pure (no I/O), shared by the API, the scripts and the checks.
 */

// ─── Events, as read from ODP ────────────────────────────────────────────────

/** One ODP event, with only the fields this report reads. Numbers may arrive as strings. */
export interface ActivityEvent {
  vuid: string;
  ts: number;
  event_type: string | null;
  action: string | null;
  session_id: string | null;
  /** The path the event was sent from (ODP's `page { page }`). */
  page: string | null;
  section?: string | null;
  element?: string | null;
  label?: string | null;
  position?: string | null;
  cta_type?: string | null;
  time_on_page_sec?: number | null;
  max_scroll_pct?: number | null;
  html_element_path?: string | null;
  html_element_tag?: string | null;
  is_rage_click?: boolean | null;
  scroll_depth_percentage?: number | null;
  is_final_depth?: boolean | null;
  isp?: string | null;
  country?: string | null;
  device_type?: string | null;
  referral_host?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  likely_machine_generated?: boolean | null;
}

// ─── Pages and visitors ──────────────────────────────────────────────────────

/** "/Lenovo/", "/en/lenovo", "lenovo?x=1" -> "lenovo"; "/vb/offer-x/" -> "vb/offer-x". */
export function pageKey(path: string | null | undefined): string {
  const p = (path ?? '').split('?')[0].split('#')[0].toLowerCase().trim();
  // A locale prefix (/en/…) is dropped; /vb/ is not a locale, it is where offer pages live.
  return p.replace(/^\/+|\/+$/g, '').replace(/^(?!vb\/)[a-z]{2}(-[a-z]{2})?\//, '');
}

/** A page this report can be asked about: an account page or an offer page, nothing else. */
const PAGE_KEY_RE = /^(vb\/)?[a-z0-9][a-z0-9-]{0,119}$/;
export function isPageKey(key: string): boolean {
  return PAGE_KEY_RE.test(key) && key !== 'search' && key !== 'preview' && key !== 'api';
}

/** ODP's visitor id as its API accepts it: 32 lowercase hex, no dashes. */
export function normalizeVuid(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(v) ? v : null;
}

/**
 * Networks whose "visitors" are machines (aldus-ui lib/showcase-metrics/compute.ts, measured on
 * this site): Googlebot rendering pages, Microsoft and Amazon mail-link scanners. Fastly,
 * Cloudflare and Akamai are NOT here: those are iCloud Private Relay, i.e. people.
 */
export const BOT_ISPS = new Set([
  'google inc.',
  'google cloud',
  'google llc',
  'microsoft corp',
  'microsoft corporation',
  'microsoft limited',
  'amazon technologies inc.',
  'amazon.com inc.',
  'amazon data services northern virginia',
  'm247 europe srl',
  'leaseweb usa inc.',
]);
/** Optimizely's NYC office network. */
const OFFICE_ISPS = new Set(['pilot fiber inc.']);
/** Arriving from one of these means an Optimizely employee (or a CMS editor). */
const INTERNAL_REFERRER =
  /(cms\.optimizely\.com|optimizelyedit|optimizelystaging|localhost|vercel\.app|episerver\.net|lightning\.force\.com|gtmbuddy|outreach\.io|usergems|login\.optimizely\.com|app\.optimizely\.com|opal\.optimizely\.com|showcase\.optimizely\.com)/i;
/** A prospect reads their own page; someone reading four companies' pages works here. */
export const MULTI_PAGE_THRESHOLD = 4;

export type VisitorKind = 'visitor' | 'team' | 'bot';

/**
 * Who each visitor is. `team` is someone signed in on the site (`teamVuids`, recorded when an
 * employee's browser visits) or who looks like one: the office network, arriving from an internal
 * tool, or reading four or more companies' pages. `bot` is a machine network or ODP's own flag.
 * Everyone else is a visitor.
 */
export function classifyVisitors(events: ActivityEvent[], teamVuids: Set<string>): Map<string, VisitorKind> {
  const pages = new Map<string, Set<string>>();
  const isps = new Map<string, string>();
  const internal = new Set<string>();
  const machine = new Set<string>();
  for (const e of events) {
    const key = pageKey(e.page);
    if (e.action === 'pageview' && key && key !== 'search' && key !== 'preview') {
      // An offer page counts as its own company page here; four distinct pages is the rule.
      const s = pages.get(e.vuid) ?? new Set<string>();
      s.add(key.replace(/^vb\//, ''));
      pages.set(e.vuid, s);
    }
    if (e.isp && !isps.has(e.vuid)) isps.set(e.vuid, e.isp.toLowerCase());
    if (e.referral_host && INTERNAL_REFERRER.test(e.referral_host)) internal.add(e.vuid);
    if (key === 'preview' || key === 'search') internal.add(e.vuid);
    if (e.likely_machine_generated) machine.add(e.vuid);
  }
  const out = new Map<string, VisitorKind>();
  for (const e of events) {
    if (out.has(e.vuid)) continue;
    const v = e.vuid;
    const isp = isps.get(v) ?? '';
    if (teamVuids.has(v) || OFFICE_ISPS.has(isp) || internal.has(v) || (pages.get(v)?.size ?? 0) >= MULTI_PAGE_THRESHOLD) {
      out.set(v, 'team');
    } else if (BOT_ISPS.has(isp) || machine.has(v)) {
      out.set(v, 'bot');
    } else {
      out.set(v, 'visitor');
    }
  }
  return out;
}

/**
 * Whether a network name is the account's own: "Lenovo (Beijing) Ltd" for lenovo.com. Matches the
 * domain's label or the company name as a whole word, and ignores labels too short to mean anything.
 */
export function isAccountNetwork(isp: string | null | undefined, terms: string[]): boolean {
  const n = ` ${(isp ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return terms.some((t) => t.length >= 3 && n.includes(` ${t} `));
}

/** "lenovo.com" + "Personalized for Lenovo Group" -> ["lenovo", "lenovo group"]. */
export function accountTerms(domain: string | null | undefined, name: string | null | undefined): string[] {
  const out = new Set<string>();
  const label = (domain ?? '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[./]/)[0];
  if (label) out.add(label.replace(/[^a-z0-9]+/g, ' ').trim());
  const clean = (name ?? '')
    .replace(/^personali[sz]ed for\s+/i, '')
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|plc|corp|corporation|co|gmbh|ag|sa|nv|bv|group|holdings|the)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (clean) out.add(clean);
  return [...out].filter(Boolean);
}

// ─── Elements ────────────────────────────────────────────────────────────────

/** Classes the page toggles at run time; never part of an element's identity. */
const DYNAMIC_CLASS = /^(is-|live-changed|www-js$|focus|hover|active$)/;
/** ODP's tag cuts the last segment (the selector) at about 150 characters. */
const SELECTOR_CUT = 140;
/**
 * The booth chrome's own class prefixes (booth-rail.css, floating-sidebar.css, edit-mode.css,
 * activity-mode.css). `xray-sidebar` was the rail's name until Nov 2026 and is in older data.
 */
const BOOTH_CLASS = /^(booth|xray|edit|activity|employee-link)-/;
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'option']);

export interface PathSegment {
  tag: string;
  id: string | null;
  classes: string[];
  nth: number | null;
}

/** Splits one segment: `div.www-card.www-usecase:nth-child(2)`, `section#usecases.www-scene`. */
export function parseSegment(raw: string, last = false): PathSegment | null {
  let s = raw.trim();
  if (!s) return null;
  let nth: number | null = null;
  const m = s.match(/:nth-child\((\d+)\)$/);
  if (m) {
    nth = Number(m[1]);
    s = s.slice(0, m.index);
  }
  const tag = (s.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? '').toLowerCase();
  if (!tag) return null;
  let rest = s.slice(tag.length);
  let id: string | null = null;
  const idm = rest.match(/^#([A-Za-z][\w-]*)/);
  if (idm) {
    id = idm[1];
    rest = rest.slice(idm[0].length);
  }
  // Classes are separated by dots, but a Tailwind class can hold one (`py-1.5`, `leading-[1.3]`):
  // a token that continues a number or an open bracket is joined back to the one before.
  let classes: string[] = [];
  for (const t of rest.split('.')) {
    const prev = classes[classes.length - 1];
    if (prev !== undefined && /^\d/.test(t) && !t.includes(':') && (/\d$/.test(prev) || (prev.split('[').length > prev.split(']').length))) classes[classes.length - 1] = `${prev}.${t}`;
    else if (t) classes.push(t);
  }
  if (last && raw.length >= SELECTOR_CUT) classes = classes.slice(0, -1);
  classes = classes.filter((c) => !DYNAMIC_CLASS.test(c));
  return { tag, id, classes, nth };
}

/** Ids that are page chrome, not a place to anchor an element path. */
const CHROME_IDS = new Set(['root', 'main-content']);

export interface ElementRef {
  /** Stable identity for counting: tag, id and position from the nearest scene down. */
  key: string;
  /** The scene the element is in (`usecases`), or null. */
  section: string | null;
  /** The segments from the anchor (the nearest element with an id) down to the element. */
  segments: PathSegment[];
  tag: string;
  /** False when nothing on the path is a link or button: a click that cannot do anything. */
  interactive: boolean;
}

/**
 * Reads ODP's `html_element_path` into a stable element reference. The key keeps tag, id and
 * nth-child only, so classes the page adds and removes (`is-in`, `is-current`) or a re-styled
 * button never split one element into two.
 */
export function elementRef(path: string | null | undefined): ElementRef | null {
  const raw = (path ?? '').split(' > ');
  if (raw.length < 2) return null;
  const segs = raw.map((r, i) => parseSegment(r, i === raw.length - 1));
  if (segs.some((s) => !s)) return null;
  const all = segs as PathSegment[];
  let anchor = -1;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].id && !CHROME_IDS.has(all[i].id!)) {
      anchor = i;
      break;
    }
  }
  if (anchor < 0) return null;
  // The booth tools (sidebar, X-ray, Edit, Activity) are ours, not the page's; Radix dialogs (the
  // connect panel) are only on screen after a click, so a click in one cannot be placed.
  if (all.some((s) => s.classes.some((c) => BOOTH_CLASS.test(c)))) return null;
  if (all[anchor].id!.startsWith('radix-')) return null;
  const segments = all.slice(anchor);
  const section = [...all].reverse().find((s) => s.tag === 'section' && s.id)?.id ?? (segments[0].tag === 'section' ? segments[0].id : null);
  const key = segments.map((s) => s.tag + (s.id ? `#${s.id}` : '') + (s.nth ? `:${s.nth}` : '')).join('>');
  const interactive = all.some((s) => INTERACTIVE_TAGS.has(s.tag));
  return { key, section, segments, tag: segments[segments.length - 1].tag, interactive };
}

// ─── The report ──────────────────────────────────────────────────────────────

export type ActivityRange = '7d' | '30d' | '90d' | 'all';
export const ACTIVITY_RANGES: ActivityRange[] = ['7d', '30d', '90d', 'all'];
/** The site's ODP tracking began on 15 Apr 2026 (aldus-ui showcase metrics). */
export const TRACKING_START_TS = Date.UTC(2026, 3, 15) / 1000;

export function rangeStart(range: ActivityRange, nowS: number): number {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 0;
  return days ? Math.max(TRACKING_START_TS, nowS - days * 86400) : TRACKING_START_TS;
}

export interface ElementStat {
  key: string;
  section: string | null;
  /** Segments for the client to find the element again (see resolveElement in ActivityMode). */
  segments: PathSegment[];
  tag: string;
  clicks: number;
  visitors: number;
  rage: number;
  last: number;
  dead: boolean;
}

export interface Count {
  name: string;
  n: number;
}

export interface CtaStat {
  /** `connect`, `schedule`, `contact`, or `cta` for any other button. */
  type: string;
  /** `hero`, `sticky`, `close`, `panel`, or null when the click predates positions. */
  position: string | null;
  label: string;
  clicks: number;
  visitors: number;
  last: number;
}

/** A visit counts as engaged from this long on the page, this deep a scroll, or any click. */
export const ENGAGED_SEC = 30;
export const ENGAGED_SCROLL = 50;
/** The visits a report lists, newest kept: enough for any account page's whole history. */
export const MAX_VISIT_ROWS = 400;

/** One visit, as the report's Journey and Activity chart read it. Never who: no visitor id. */
export interface VisitRow {
  /** The visit's first pageview. */
  ts: number;
  /** Seconds on the page (page_exit's own timer, else first to last event; at most 30 min). */
  sec: number;
  /** Deepest scroll, percent, when the visit reported one. */
  scroll: number | null;
  /** Clicks on the page itself (ODP's tag), the booth tools left out. */
  clicks: number;
  /** The CTAs pressed in this visit, by their words. */
  ctas: string[];
  /** Where it came from (sourceOf). */
  source: string;
  country: string | null;
  engaged: boolean;
}

export interface AudienceReport {
  visitors: number;
  visits: number;
  /** Median seconds on the page per visit, or null with no visits. */
  medianSec: number | null;
  ctaClicks: number;
  /** Visitors who pressed a connect button ("Arrange a session"): the page's conversion. */
  connectVisitors: number;
  firstTs: number | null;
  lastTs: number | null;
  /** Every visit in the period, oldest first (the newest MAX_VISIT_ROWS). */
  visitList: VisitRow[];
  /** Visits per bin, oldest first: daily for 7d/30d/90d, weekly for all. */
  series: { start: number; step: number; counts: number[] };
  /** Visitors who saw each scene (by scene id). */
  sections: Record<string, number>;
  /** Visits by deepest scroll: <25, 25–49, 50–74, 75–99, 100. */
  scroll: [number, number, number, number, number];
  elements: ElementStat[];
  ctas: CtaStat[];
  sources: Count[];
  networks: Array<Count & { account: boolean }>;
  countries: Count[];
  devices: Count[];
}

export interface ActivityReport {
  page: string;
  range: ActivityRange;
  from: number;
  to: number;
  generatedAt: string;
  /** People outside Optimizely. */
  visitors: AudienceReport;
  /** Visitors and Optimizely people together. */
  everyone: AudienceReport;
  teamCount: number;
  botCount: number;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

function top(map: Map<string, number>, limit: number): Count[] {
  return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, n]) => ({ name, n }));
}

/**
 * Where a visit came from: the campaign source, else the kind of referring site, else direct.
 * Without a campaign, ODP's SDK puts the referring host in `source` itself
 * (reference: zaius-min.js trafficSources), so a `source` that is a host name is read as one.
 */
export function sourceOf(e: Pick<ActivityEvent, 'source' | 'medium' | 'referral_host'>): string {
  const src = (e.source ?? '').trim().toLowerCase();
  if (src && src !== 'direct' && src !== '(direct)' && !src.includes('.')) return src;
  const host = (src.includes('.') ? src : (e.referral_host ?? '').toLowerCase()).replace(/^www\./, '');
  if (host && !/showcase\.optimizely\.com$/.test(host)) {
    if (/(^|\.)linkedin\.com$|lnkd\.in/.test(host)) return 'linkedin';
    if (/outlook|office\.com|office365|mail\.google|gmail/.test(host)) return 'email';
    if (/(^|\.)teams\.|onecdn|slack/.test(host)) return 'chat';
    if (/(^|\.)google\.|bing\.com|duckduckgo|yahoo\./.test(host)) return 'search';
    return host;
  }
  return 'direct';
}

/** The clean words on a CTA: icon ligatures ("bolt"), "(opens in new tab)" and spacing removed. */
export function ctaLabel(raw: string | null | undefined): string {
  return (raw ?? '')
    .replace(/\(opens in new tab\)/gi, '')
    .replace(/^(bolt|arrow_forward|calendar_month|mail|north_east|open_in_new)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * The booth sidebar's own buttons. Until Nov 2026 the tracking hook took any button with "btn" in
 * its class for a CTA, the sidebar's `xray-sidebar__btn` included, so these labels are in the data.
 */
const BOOTH_LABELS = new Set(['x-ray', 'edit', 'search', 'activity', 'exit', 'exit edit', 'exit x-ray', 'send feedback', 'refresh', 'ok, got it', 'cancel', 'comment']);
/** Not actions: the connect panel's confirmation tile ("You're all set") answers a click already counted. */
const NOT_CTA_LABELS = new Set(["you're all set", 'you’re all set']);
export function isBoothLabel(label: string | null | undefined): boolean {
  const l = ctaLabel(label).toLowerCase();
  return BOOTH_LABELS.has(l) || NOT_CTA_LABELS.has(l);
}

const CONNECT_POSITION: Record<string, string> = {
  'hero-connect-btn': 'hero',
  'sticky-connect-btn': 'sticky',
  'cta-connect-btn': 'close',
};

/** A CTA click's type and position, for events sent before and after positions were added. */
export function ctaKind(e: Pick<ActivityEvent, 'element' | 'cta_type' | 'position' | 'label'>): { type: string; position: string | null } {
  const type = (e.cta_type || '').toLowerCase();
  if (type) return { type, position: e.position ? (CONNECT_POSITION[e.position] ?? e.position) : null };
  // Before 11-2026 every button went as element "cta" with its text; the connect button's text
  // varies per page (the page's ctaButtonText), so only the standard wording is recognised.
  const label = ctaLabel(e.label).toLowerCase();
  if (/arrange a session|talk to your team|connect with|book a|let'?s talk/.test(label)) return { type: 'connect', position: null };
  if (/schedule a call|fast track/.test(label)) return { type: 'schedule', position: 'panel' };
  return { type: 'cta', position: null };
}

export interface ReportInput {
  page: string;
  range: ActivityRange;
  nowS: number;
  events: ActivityEvent[];
  teamVuids: Set<string>;
  accountTerms: string[];
}

/**
 * The report for one page. Events may include the same visitors' events on other pages (ODP
 * answers per visitor); only this page's count, but all of them decide who is team.
 */
export function buildActivityReport(input: ReportInput): ActivityReport {
  const page = pageKey(input.page);
  const from = rangeStart(input.range, input.nowS);
  const kinds = classifyVisitors(input.events, input.teamVuids);
  const here = input.events.filter((e) => pageKey(e.page) === page && e.ts >= from && e.ts <= input.nowS + 300);
  const kindCount = (k: VisitorKind) => new Set(here.filter((e) => kinds.get(e.vuid) === k).map((e) => e.vuid)).size;
  const audience = (keep: (k: VisitorKind) => boolean) =>
    audienceReport(here.filter((e) => keep(kinds.get(e.vuid) ?? 'visitor')), input.range, from, input.nowS, input.accountTerms);
  return {
    page,
    range: input.range,
    from,
    to: input.nowS,
    generatedAt: new Date(input.nowS * 1000).toISOString(),
    visitors: audience((k) => k === 'visitor'),
    everyone: audience((k) => k !== 'bot'),
    teamCount: kindCount('team'),
    botCount: kindCount('bot'),
  };
}

function seriesFor(range: ActivityRange, from: number, now: number) {
  const step = range === 'all' ? 7 * 86400 : 86400;
  const dayStart = (t: number) => Math.floor(t / 86400) * 86400;
  const start = dayStart(from);
  const bins = Math.max(1, Math.ceil((dayStart(now) + 86400 - start) / step));
  return { start, step, counts: new Array<number>(bins).fill(0) };
}

function audienceReport(events: ActivityEvent[], range: ActivityRange, from: number, now: number, terms: string[]): AudienceReport {
  const visitorsSeen = new Set<string>();
  // A visit is a (visitor, ODP session) with a pageview on this page.
  type Visit = { first: number; last: number; exitSec: number | null; scroll: number | null; clicks: number; ctas: Set<string>; source: string; country: string | null };
  const visits = new Map<string, Visit>();
  const visitKey = (e: ActivityEvent) => `${e.vuid}|${e.session_id ?? Math.floor(e.ts / 1800)}`;
  const sections = new Map<string, Set<string>>();
  const elements = new Map<string, ElementStat & { who: Set<string> }>();
  const ctas = new Map<string, CtaStat & { who: Set<string> }>();
  const connectWho = new Set<string>();
  let ctaClicks = 0;
  const sources = new Map<string, number>();
  const networks = new Map<string, Set<string>>();
  const countries = new Map<string, Set<string>>();
  const devices = new Map<string, Set<string>>();
  const series = seriesFor(range, from, now);
  let firstTs: number | null = null;
  let lastTs: number | null = null;

  const sorted = [...events].sort((a, b) => a.ts - b.ts);
  for (const e of sorted) {
    const k = visitKey(e);
    if (e.action === 'pageview') {
      visitorsSeen.add(e.vuid);
      if (!visits.has(k)) {
        visits.set(k, { first: e.ts, last: e.ts, exitSec: null, scroll: null, clicks: 0, ctas: new Set(), source: sourceOf(e), country: e.country ? e.country.toUpperCase() : null });
        const bin = Math.floor((e.ts - series.start) / series.step);
        if (bin >= 0 && bin < series.counts.length) series.counts[bin]++;
        sources.set(sourceOf(e), (sources.get(sourceOf(e)) ?? 0) + 1);
      }
      firstTs = firstTs ?? e.ts;
      lastTs = Math.max(lastTs ?? 0, e.ts);
    }
    const v = visits.get(k);
    if (v) v.last = Math.max(v.last, e.ts);
    if (e.isp) add(networks, e.isp, e.vuid);
    if (e.country) add(countries, e.country.toUpperCase(), e.vuid);
    if (e.device_type) add(devices, e.device_type, e.vuid);

    if (e.action === 'section_view' && e.section) add(sections, e.section, e.vuid);
    if (e.action === 'page_exit' && v) {
      const sec = num(e.time_on_page_sec);
      const pct = num(e.max_scroll_pct);
      if (sec !== null) v.exitSec = Math.max(v.exitSec ?? 0, sec);
      if (pct !== null) v.scroll = Math.max(v.scroll ?? 0, pct);
    }
    // ODP's own scroll reading is only right at the end of a visit: at page load it reports
    // 25-100% at once, measured against the not-yet-rendered page.
    if (e.event_type === 'scroll_depth' && e.is_final_depth && v) {
      const pct = num(e.scroll_depth_percentage);
      if (pct !== null) v.scroll = Math.max(v.scroll ?? 0, pct);
    }
    if (e.event_type === 'click' && e.html_element_path) {
      const ref = elementRef(e.html_element_path);
      if (ref) {
        if (v) v.clicks++;
        const s = elements.get(ref.key) ?? { key: ref.key, section: ref.section, segments: ref.segments, tag: ref.tag, clicks: 0, visitors: 0, rage: 0, last: 0, dead: !ref.interactive, who: new Set<string>() };
        s.clicks++;
        s.who.add(e.vuid);
        if (e.is_rage_click) s.rage++;
        s.last = Math.max(s.last, e.ts);
        elements.set(ref.key, s);
      }
    }
    if (e.action === 'cta_click' && !isBoothLabel(e.label)) {
      ctaClicks++;
      const kind = ctaKind(e);
      const label = ctaLabel(e.label);
      const ck = `${kind.type}|${kind.position ?? ''}|${label.toLowerCase()}`;
      const c = ctas.get(ck) ?? { type: kind.type, position: kind.position, label, clicks: 0, visitors: 0, last: 0, who: new Set<string>() };
      c.clicks++;
      c.last = Math.max(c.last, e.ts);
      c.who.add(e.vuid);
      ctas.set(ck, c);
      if (kind.type === 'connect') connectWho.add(e.vuid);
      if (v && label) v.ctas.add(label);
    }
  }

  const scroll: AudienceReport['scroll'] = [0, 0, 0, 0, 0];
  const durations: number[] = [];
  const visitList: VisitRow[] = [];
  for (const v of visits.values()) {
    // page_exit's own timer when it arrived; else the span between the visit's first and last event.
    const sec = Math.min(v.exitSec ?? v.last - v.first, 30 * 60);
    durations.push(sec);
    if (v.scroll !== null) scroll[v.scroll >= 100 ? 4 : v.scroll >= 75 ? 3 : v.scroll >= 50 ? 2 : v.scroll >= 25 ? 1 : 0]++;
    const engaged = sec >= ENGAGED_SEC || (v.scroll ?? 0) >= ENGAGED_SCROLL || v.clicks > 0 || v.ctas.size > 0;
    visitList.push({ ts: v.first, sec: Math.round(sec), scroll: v.scroll, clicks: v.clicks, ctas: [...v.ctas], source: v.source, country: v.country, engaged });
  }
  visitList.sort((a, b) => a.ts - b.ts);
  const sizes = (m: Map<string, Set<string>>) => new Map([...m].map(([k, s]) => [k, s.size]));
  return {
    visitors: visitorsSeen.size,
    visits: visits.size,
    medianSec: median(durations),
    ctaClicks,
    connectVisitors: connectWho.size,
    firstTs,
    lastTs,
    visitList: visitList.slice(-MAX_VISIT_ROWS),
    series,
    sections: Object.fromEntries([...sections].map(([k, s]) => [k, s.size])),
    scroll,
    elements: [...elements.values()]
      .map(({ who, ...s }) => ({ ...s, visitors: who.size }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 60),
    ctas: [...ctas.values()].map(({ who, ...c }) => ({ ...c, visitors: who.size })).sort((a, b) => b.clicks - a.clicks),
    sources: top(sources, 8),
    networks: top(sizes(networks), 8).map((c) => ({ ...c, account: isAccountNetwork(c.name, terms) })),
    countries: top(sizes(countries), 6),
    devices: top(sizes(devices), 4),
  };
}

function add(m: Map<string, Set<string>>, k: string, v: string) {
  const s = m.get(k) ?? new Set<string>();
  s.add(v);
  m.set(k, s);
}

// ─── What the API answers (api/page-activity.ts) ─────────────────────────────

export interface HistoryMark {
  kind: 'built' | 'saved' | 'copy';
  ts: number;
}

/** The Salesforce Account the page was built for, as ODP's Salesforce sync holds it. */
export interface AccountSummary {
  id: string;
  /** ODP's account_stage: Prospect, Active Customer or Ex-Customer. */
  stage: string | null;
}

export interface ActivityResponse {
  report: ActivityReport;
  history: HistoryMark[];
  bench: ActivityBenchmark | null;
  account: AccountSummary | null;
}

/** Optimizely's Salesforce (the host its record links use). */
const SALESFORCE_ORIGIN = 'https://optimizely.lightning.force.com';
export function salesforceAccountUrl(id: string | null | undefined): string | null {
  return id && /^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/.test(id) ? `${SALESFORCE_ORIGIN}/lightning/r/Account/${id}/view` : null;
}

// ─── What the report card shows (src/components/ActivityMode.tsx) ───────────

export type JourneyStage = 'created' | 'viewed' | 'engaged' | 'cta';
export const JOURNEY_STAGES: JourneyStage[] = ['created', 'viewed', 'engaged', 'cta'];

/** When the page reached each step, and the step it is at now (the last one reached). */
export interface Journey {
  created: number | null;
  /** The last save or copy edit after the build; the build itself when there is none. */
  updated: number | null;
  viewed: number | null;
  engaged: number | null;
  cta: number | null;
  stage: JourneyStage;
  /** The visits behind the current step, newest first. */
  visits: VisitRow[];
}

export function journeyOf(r: AudienceReport, history: HistoryMark[]): Journey {
  const built = history.find((h) => h.kind === 'built')?.ts ?? null;
  const updated = history.reduce<number | null>((t, h) => Math.max(t ?? 0, h.ts) || null, built);
  const visits = r.visitList ?? [];
  const engagedVisits = visits.filter((v) => v.engaged);
  const ctaVisits = visits.filter((v) => v.ctas.length > 0);
  const j = {
    created: built,
    updated,
    viewed: visits[0]?.ts ?? r.firstTs ?? null,
    engaged: engagedVisits[0]?.ts ?? null,
    cta: ctaVisits[0]?.ts ?? null,
  };
  const stage: JourneyStage = j.cta !== null ? 'cta' : j.engaged !== null ? 'engaged' : j.viewed !== null ? 'viewed' : 'created';
  const behind = stage === 'cta' ? ctaVisits : stage === 'engaged' ? engagedVisits : stage === 'viewed' ? visits : [];
  return { ...j, stage, visits: [...behind].reverse() };
}

/** The Data column. */
export interface ReportFacts {
  firstSeen: number | null;
  lastSeen: number | null;
  /** The visit that spent longest on the page (the later one on a tie). */
  mostEngaged: number | null;
  ctaClicks: number;
  lastChannel: string | null;
  /** The country of the latest visit that reported one. */
  lastCountry: string | null;
}

export function factsOf(r: AudienceReport): ReportFacts {
  const visits = r.visitList ?? [];
  const last = visits[visits.length - 1];
  const most = visits.reduce<VisitRow | null>((best, v) => (!best || v.sec >= best.sec ? v : best), null);
  // Not every pageview carries a country: the latest one that did.
  const located = [...visits].reverse().find((v) => v.country);
  return {
    firstSeen: visits[0]?.ts ?? r.firstTs ?? null,
    lastSeen: last?.ts ?? r.lastTs ?? null,
    mostEngaged: most && most.sec > 0 ? most.ts : null,
    ctaClicks: r.ctaClicks,
    lastChannel: last ? last.source : null,
    lastCountry: located?.country ?? null,
  };
}

const CHANNEL_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  chat: 'Teams or Slack',
  search: 'Search',
  direct: 'Direct',
  marketo: 'Marketo',
  outreach: 'Outreach',
};
/** "linkedin" -> "LinkedIn"; a campaign source as sent, capitalised; a referring host as is. */
export function channelName(source: string | null | undefined): string | null {
  if (!source) return null;
  if (CHANNEL_NAMES[source]) return CHANNEL_NAMES[source];
  return source.includes('.') ? source : source.charAt(0).toUpperCase() + source.slice(1);
}

export type SlotUnit = 'day' | 'week' | 'month';
export interface ActivitySlot {
  start: number;
  n: number;
}
export const ACTIVITY_SLOTS = 7;

/**
 * Visits in ACTIVITY_SLOTS slots ending with the one that holds `nowS`: days when the page's first
 * visit is under a week old, else weeks, else 30-day months. Slots are local days, so "today" is
 * the viewer's today (`tzOffsetMin` is Date#getTimezoneOffset).
 */
export function activitySlots(visitTs: number[], firstTs: number | null, nowS: number, tzOffsetMin = 0): { unit: SlotUnit; slots: ActivitySlot[] } {
  const off = tzOffsetMin * 60;
  const dayStart = (t: number) => Math.floor((t - off) / 86400) * 86400 + off;
  const today = dayStart(nowS);
  const age = firstTs === null ? 0 : today - dayStart(firstTs);
  const unit: SlotUnit = age < ACTIVITY_SLOTS * 86400 ? 'day' : age < ACTIVITY_SLOTS * 7 * 86400 ? 'week' : 'month';
  const days = unit === 'day' ? 1 : unit === 'week' ? 7 : 30;
  // The last slot ends with today; each slot starts `days` before the next.
  const end = today + 86400;
  const slots: ActivitySlot[] = Array.from({ length: ACTIVITY_SLOTS }, (_, i) => ({ start: end - (ACTIVITY_SLOTS - i) * days * 86400, n: 0 }));
  for (const t of visitTs) {
    const i = Math.floor((t - slots[0].start) / (days * 86400));
    if (i >= 0 && i < ACTIVITY_SLOTS) slots[i].n++;
  }
  return { unit, slots };
}

// ─── Benchmark across account pages ─────────────────────────────────────────

/** Account pages on average, for the same audience (visitors), so a page can be read against them. */
export interface ActivityBenchmark {
  generatedAt: string;
  pages: number;
  /** Share of a page's visitors who saw each scene, averaged over pages with visitors. */
  sectionReach: Record<string, number>;
  medianSec: number | null;
  /** Share of visitors who pressed a connect button. */
  connectRate: number;
}

export function benchmarkFrom(reports: AudienceReport[], nowIso: string): ActivityBenchmark {
  const withVisitors = reports.filter((r) => r.visitors > 0);
  const reach: Record<string, number[]> = {};
  for (const r of withVisitors) for (const [s, n] of Object.entries(r.sections)) (reach[s] ??= []).push(n / r.visitors);
  // A scene a page never logged counts as 0 for that page, not as missing.
  const sectionReach = Object.fromEntries(
    Object.entries(reach).map(([s, xs]) => [s, Math.round((xs.reduce((a, b) => a + b, 0) / withVisitors.length) * 1000) / 1000]),
  );
  const visitors = withVisitors.reduce((a, r) => a + r.visitors, 0);
  const connects = withVisitors.reduce((a, r) => a + r.connectVisitors, 0);
  return {
    generatedAt: nowIso,
    pages: withVisitors.length,
    sectionReach,
    medianSec: median(withVisitors.map((r) => r.medianSec).filter((x): x is number => x !== null)),
    connectRate: visitors ? Math.round((connects / visitors) * 1000) / 1000 : 0,
  };
}
