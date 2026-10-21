import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { signInHref, useAuth } from '../lib/auth';
import { cutoutPath, easeOut, type CutoutBox } from '../lib/home-cutout';
import type { HomeIndexBody, PersonItem } from '../lib/home-index';
import { slugify, type BuildSummary } from '../lib/page-builds';
import {
  cleanSlug,
  dedupeByName,
  MAX_RECENT,
  prettyFromSlug,
  readRecent,
  toEntry,
  writeRecent,
  type Entry,
} from '../lib/search-entries';
import { usePageRequest } from '../hooks/usePageRequest';
import { clearOfflineCopies, INDEX_URL, keepIndex, readKeptIndex } from '../lib/home-offline';
import { sceneBackdrop, sceneSizes, TALL_MEDIA, type Backdrop, type Scene } from '../lib/home-scenes';
import {
  headlineParts,
  isOfferId,
  logoSrc,
  lookBackdrop,
  OFFER_COOKIE,
  type LookJob,
  type LookTool,
  type OfferPage,
  type RunningOffer,
  type ShownOffer,
} from '../lib/offer-looks';
import OptimizelyWordmark from './OptimizelyWordmark';
import ProfileMenu from './ProfileMenu';
import '../styles/search-home.css';

/*
 * /search — the search page as a home screen.
 *
 * A scene (one of three photographs, lib/home-scenes.ts) fills the frame. The
 * server renders the page with it, so it paints before any script runs; the
 * offline copy (lib/home-offline.ts) makes the next visit instant. Its lower-left is cut out and the
 * lists live in the cut-out: what you opened recently and the accounts you are
 * on the team for. Focusing search swaps those for Companies and People, and
 * typing filters them in place; a column with nothing for the query offers to
 * have Mark build the page.
 *
 * The cut-out rises in on load and grows when search opens, carrying the
 * headline and the search bar up with it. That motion is one number — the
 * cut-out's depth — animated outside React: the scene's clip-path and the
 * headline's transform are written straight to the DOM each frame.
 */

/* Panel rhythm. Desktop is the design's: 21px top, an 18px heading and 8px
   under it, 50px rows on a 15px gap, 18px bottom; three rows make its 260px.
   Phones get a tighter set. The page writes these to CSS too, so the cut-out's
   depth and the rows it reveals are the same numbers. `above` is the room the
   logo, headline and search bar need over the cut-out. */
type Rhythm = { top: number; headGap: number; gap: number; row: number; bottom: number; above: number };
const RHYTHM: Record<'regular' | 'compact', Rhythm> = {
  regular: { top: 21, headGap: 8, gap: 15, row: 50, bottom: 18, above: 330 },
  compact: { top: 18, headGap: 6, gap: 12, row: 48, bottom: 16, above: 250 },
};
const panelHeight = (rows: number, r: Rhythm) => r.top + 18 + r.headGap + rows * (r.gap + r.row) + r.bottom;
/* While the lists load, the cut-out holds just the one loading line. */
const loadingHeight = (r: Rhythm) => r.top + 18 + r.bottom;
const IDLE_ROWS = 3;
const MAX_SEARCH_ROWS = 5;
/* Below 800px the cut-out spans the whole scene (phones). The CSS switches on
   the same query, so the server-rendered first paint is already right. */
const COMPACT_MEDIA = '(max-width: 799.98px)';

const INTRO_DELAY = 250; // let the first frame paint before anything moves
const INTRO_MS = 1250;
const SWAP_MS = 750;
const LEAVE_MS = 160; // rows drop out before the next view's rows rise (search-home.css: the drop fits inside it)
const START_DEPTH = -24; // the cut-out starts just below the scene's bottom edge
/* How far below their place the rows start on the way in, behind the rising edge. */
const INTRO_TRAIL = 110;
/* Data that lands this soon after the rise begins skips the loading line's exit. */
const LOADING_GLANCE_MS = 200;

type View = 'idle' | 'search' | 'request';

type Person = {
  slug: string;
  name: string;
  title: string;
  company: string;
  initials: string;
  logoUrl: string | null;
};

type Item = { kind: 'company'; entry: Entry } | { kind: 'person'; person: Person };

function toPerson(p: PersonItem): Person {
  const slug = cleanSlug(p._metadata?.url?.hierarchical || p._metadata?.url?.default || '');
  const name = p.personName?.trim() || prettyFromSlug(slug.split('/').pop() || slug);
  const initials =
    p.personInitials?.trim() ||
    name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  return {
    slug,
    name,
    title: p.personTitle?.trim() || '',
    company: p.companyName?.trim() || '',
    initials,
    logoUrl: p.companyLogo?.default || null,
  };
}

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 1)).toUpperCase();
}

/** Prefix matches on name or domain first, then anything containing the query. */
function rankCompanies(entries: Entry[], rawQuery: string, recent: string[], limit: number): Entry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    // Recently opened first, then the newest pages (the index is newest-first).
    const bySlug = new Map(entries.map((e) => [e.slug, e]));
    const first = recent.map((s) => bySlug.get(s)).filter((e): e is Entry => !!e);
    const seen = new Set(first.map((e) => e.slug));
    return [...first, ...entries.filter((e) => !seen.has(e.slug))].slice(0, limit);
  }
  const starts: Entry[] = [];
  const contains: Entry[] = [];
  for (const e of entries) {
    const n = e.name.toLowerCase();
    const d = e.domain.toLowerCase();
    if (n.startsWith(q) || d.startsWith(q)) starts.push(e);
    else if (n.includes(q) || d.includes(q) || e.industry.toLowerCase().includes(q)) contains.push(e);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Name prefix first, then a match anywhere in the name, title or company. */
function rankPeople(people: Person[], rawQuery: string, recent: string[], limit: number): Person[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    const bySlug = new Map(people.map((p) => [p.slug, p]));
    const first = recent.map((s) => bySlug.get(s)).filter((p): p is Person => !!p);
    const seen = new Set(first.map((p) => p.slug));
    return [...first, ...people.filter((p) => !seen.has(p.slug))].slice(0, limit);
  }
  const starts: Person[] = [];
  const contains: Person[] = [];
  for (const p of people) {
    const n = p.name.toLowerCase();
    if (n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q))) starts.push(p);
    else if (n.includes(q) || p.title.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

function highlight(str: string, q: string): ReactNode {
  const query = q.trim();
  if (!query) return str;
  const i = str.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return str;
  return (
    <>
      {str.slice(0, i)}
      <mark>{str.slice(i, i + query.length)}</mark>
      {str.slice(i + query.length)}
    </>
  );
}

/** The first of `sources` that loads, or the initials when none does. */
function Tile({ sources, label }: { sources: Array<string | null>; label: string }) {
  const urls = sources.filter((s): s is string => !!s);
  const [failed, setFailed] = useState(0);
  const src = urls[failed];
  return (
    <span className="sh-tile" aria-hidden="true">
      {src ? <img key={src} src={src} alt="" loading="lazy" onError={() => setFailed((n) => n + 1)} /> : label}
    </span>
  );
}

const BADGE: Record<BuildSummary['status'], string> = {
  waiting: 'Queued',
  running: 'Generating',
  done: 'Ready',
  failed: 'Not built',
};

/** The logo's place while Mark builds the page: a ring that fills with the run. */
function BuildTile({ build }: { build: BuildSummary }) {
  const r = 18;
  const around = 2 * Math.PI * r;
  return (
    <span className={`sh-tile sh-tile--build is-${build.status}`} aria-hidden="true">
      <svg className="sh-ring" viewBox="0 0 44 44">
        <circle className="sh-ring__track" cx="22" cy="22" r={r} />
        <circle
          className="sh-ring__arc"
          cx="22"
          cy="22"
          r={r}
          strokeDasharray={around}
          strokeDashoffset={around * (1 - (build.status === 'done' ? 1 : build.progress))}
        />
      </svg>
      <span className="sh-ring__label">
        {build.status === 'done' ? '✓' : build.status === 'failed' ? '!' : `${Math.round(build.progress * 100)}%`}
      </span>
    </span>
  );
}

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ---------- Running the page as an offer (lib/offer-looks.ts) ---------- */

function readOfferCookie(): string | null {
  const m = new RegExp(`(?:^|;\\s*)${OFFER_COOKIE}=([^;]*)`).exec(document.cookie);
  const id = m ? decodeURIComponent(m[1]) : null;
  return isOfferId(id) ? id : null;
}

/** The server draws /search with it on the next load; the offline copy is asked to fetch that one. */
function writeOfferCookie(id: string | null) {
  document.cookie = id
    ? `${OFFER_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    : `${OFFER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  navigator.serviceWorker?.controller?.postMessage({ refreshPage: true });
}

/**
 * The scene's photograph. A new one (an offer picked, or its look just made)
 * is laid over the last and fades in once it has loaded.
 */
function SceneLayer({ backdrop, fresh, onShown }: { backdrop: Backdrop; fresh: boolean; onShown?: () => void }) {
  const [loaded, setLoaded] = useState(!fresh);
  return (
    <div
      className={'sh-scene__layer' + (fresh ? ' is-new' : '') + (loaded ? ' is-in' : '')}
      style={{ '--sh-lqip': `url("${backdrop.lqip}")` } as CSSProperties}
      onTransitionEnd={(e) => e.target === e.currentTarget && onShown?.()}
    >
      <picture>
        <source media={TALL_MEDIA} type="image/avif" srcSet={backdrop.srcSet('tall', 'avif')} sizes={sceneSizes(backdrop, 'tall')} />
        <source media={TALL_MEDIA} type="image/webp" srcSet={backdrop.srcSet('tall', 'webp')} sizes={sceneSizes(backdrop, 'tall')} />
        <source type="image/avif" srcSet={backdrop.srcSet('wide', 'avif')} sizes={sceneSizes(backdrop, 'wide')} />
        <img
          className="sh-scene__img"
          src={backdrop.fallback}
          srcSet={backdrop.srcSet('wide', 'webp')}
          sizes={sceneSizes(backdrop, 'wide')}
          alt=""
          fetchPriority={fresh ? 'auto' : 'high'}
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      </picture>
    </div>
  );
}

/* A step's icon: what the tool does, at 14px in the step's colour. */
const TOOL_ICON: Record<LookTool, ReactNode> = {
  search: <path d="M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM21 21l-5.2-5.2" />,
  photos: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5L6 20" />
    </>
  ),
  browse: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  trace: (
    <>
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.6 7.6" />
      <circle cx="11" cy="11" r="2" />
    </>
  ),
  generate: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />,
  cut: (
    <>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </>
  ),
};

/** Mark at work on the offer's look: its last few steps, each a few words with its tool's icon, and a bar. */
function LookCard({ job, title, onRetry }: { job: LookJob; title: string; onRetry: () => void }) {
  const steps = job.steps.slice(-4);
  const working = job.status === 'making' || job.status === 'cutting';
  const heading =
    job.status === 'done' ? `Ready: ${title}` : job.status === 'failed' ? 'Mark could not finish the look' : `Mark is setting up the page for ${title}`;
  return (
    <aside className={`sh-look is-${job.status}`} aria-live="polite" aria-label="Mark setting up the page">
      <p className="sh-look__head">{heading}</p>
      <div className="sh-look__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(0.03, job.progress)})` }} />
      </div>
      {job.status === 'failed' ? (
        <>
          <p className="sh-look__line">{job.error || job.statusLine}</p>
          <button type="button" className="sh-look__retry" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : (
        <ol className={'sh-look__steps' + (working ? ' is-working' : '')}>
          {steps.map((step) => (
            <li key={step.id} className="sh-look__step">
              <span className="sh-look__icon" aria-hidden="true">
                {step.tool ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {TOOL_ICON[step.tool]}
                  </svg>
                ) : (
                  <span className="sh-look__dot" />
                )}
              </span>
              <span className="sh-look__label">{step.text}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

/** Stagger slot for the rise and drop animations: rows down a column, columns slightly apart. */
const slot = (row: number, col: number) => ({ '--i': row + col * 0.7 }) as CSSProperties;

export default function SearchHome({ scene, offer: servedOffer = null }: { scene: Scene; offer?: ShownOffer | null }) {
  const heroRef = useRef<HTMLElement | null>(null);
  const liftRef = useRef<HTMLDivElement | null>(null);
  const listsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* The server already sent anyone signed out to Opti ID (server/ssr-handler.tsx).
     This catches a session that ended while the tab stayed open. */
  const auth = useAuth();
  const identity = auth.status === 'signed-in' ? auth.identity : null;
  useEffect(() => {
    if (auth.status === 'signed-out') window.location.replace(signInHref());
  }, [auth.status]);

  /* ---------- Running as an offer ---------- */

  /* The offer the page is run as: as the server drew it, then as this browser's
     cookie says once the running offers are read (an offline copy of the page can
     be a pick behind). Its look, once Mark has made one, is the scene and headline. */
  const [asOffer, setAsOffer] = useState<ShownOffer | null>(servedOffer);
  const [offers, setOffers] = useState<RunningOffer[] | null>(null);
  const [job, setJob] = useState<LookJob | null>(null);
  const look = asOffer?.look ?? null;
  const running = useMemo(() => (asOffer ? (offers?.find((o) => o.id === asOffer.id) ?? null) : null), [offers, asOffer]);

  const signedInEmail = identity?.email ?? null;
  useEffect(() => {
    if (!signedInEmail) return;
    let cancelled = false;
    fetch('/api/offers', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ offers: RunningOffer[] }>) : null))
      .then((body) => {
        if (cancelled || !body) return;
        setOffers(body.offers);
        const wanted = readOfferCookie();
        const offer = wanted ? body.offers.find((o) => o.id === wanted) : undefined;
        if (wanted && !offer) writeOfferCookie(null); // it stopped running
        setAsOffer(offer ? { id: offer.id, title: offer.title, look: offer.look } : null);
      })
      .catch(() => {
        /* Offline: the page stays as it was drawn. */
      });
    return () => {
      cancelled = true;
    };
  }, [signedInEmail]);

  /* An offer with no look yet: Mark makes one (or the run already under way is followed). */
  /* While a start is on its way, polls wait: one could still read the run before it. */
  const starting = useRef(false);
  const makeLook = useCallback(async (offerId: string, how: 'start' | 'follow' | 'retry' | 'remake') => {
    if (how !== 'follow') starting.current = true;
    try {
      const path = `/api/offers/${encodeURIComponent(offerId)}/look${how === 'retry' ? '?retry=1' : how === 'remake' ? '?remake=1' : ''}`;
      const r = await fetch(path, { method: how === 'follow' ? 'GET' : 'POST', cache: 'no-store' });
      const body = (await r.json()) as LookJob & { look?: RunningOffer['look']; error?: string };
      if (r.status === 409 && body.look) {
        setAsOffer((cur) => (cur?.id === offerId ? { ...cur, look: body.look ?? null } : cur));
        return;
      }
      if (!r.ok) throw new Error(body.error || String(r.status));
      setJob(body);
    } catch (err) {
      setJob({ offerId, status: 'failed', startedAt: Date.now(), statusLine: '', progress: 0, steps: [], look: null, error: err instanceof Error ? err.message : String(err) });
    } finally {
      if (how !== 'follow') starting.current = false;
    }
  }, []);
  const needsLook = Boolean(asOffer && !asOffer.look && offers?.some((o) => o.id === asOffer.id));
  useEffect(() => {
    if (needsLook && asOffer && job?.offerId !== asOffer.id) void makeLook(asOffer.id, 'start');
  }, [needsLook, asOffer, job?.offerId, makeLook]);

  /* Follow the run; when it is done the look is the page's. */
  useEffect(() => {
    if (!job || (job.status !== 'making' && job.status !== 'cutting')) return;
    const timer = window.setTimeout(() => {
      // A start under way answers with the run itself, which sets the job and polls again.
      if (!starting.current) void makeLook(job.offerId, 'follow');
    }, document.hidden ? 15_000 : 2500);
    return () => window.clearTimeout(timer);
  }, [job, makeLook]);
  useEffect(() => {
    if (job?.status !== 'done' || !job.look) return;
    const made = job.look;
    setAsOffer((cur) => (cur?.id === job.offerId ? { ...cur, look: made } : cur));
    setOffers((list) => list?.map((o) => (o.id === job.offerId ? { ...o, look: made } : o)) ?? list);
    // The offline copy was kept before the look existed: the next visit should open on it.
    navigator.serviceWorker?.controller?.postMessage({ refreshPage: true });
    const timer = window.setTimeout(() => setJob(null), 4000);
    return () => window.clearTimeout(timer);
  }, [job]);

  const chooseOffer = useCallback(
    (offerId: string | null) => {
      writeOfferCookie(offerId);
      const offer = offerId ? offers?.find((o) => o.id === offerId) : undefined;
      setJob(null);
      setAsOffer(offer ? { id: offer.id, title: offer.title, look: offer.look } : null);
    },
    [offers],
  );

  /* Try again: the look goes, and Mark makes a new one (the Offers menu's refresh). */
  const remakeLook = useCallback(
    (offerId: string) => {
      setAsOffer((cur) => (cur?.id === offerId ? { ...cur, look: null } : cur));
      setOffers((list) => list?.map((o) => (o.id === offerId ? { ...o, look: null } : o)) ?? list);
      setJob({ offerId, status: 'making', startedAt: Date.now(), statusLine: 'Starting', progress: 0.03, steps: [], look: null });
      void makeLook(offerId, 'remake');
    },
    [makeLook],
  );

  /* The scene's layers: the photograph drawn first, and the one replacing it. */
  const backdrop = useMemo(() => (look ? lookBackdrop(look) : sceneBackdrop(scene)), [look, scene]);
  const [layers, setLayers] = useState<Array<{ backdrop: Backdrop; fresh: boolean }>>(() => [{ backdrop, fresh: false }]);
  if (layers[layers.length - 1].backdrop.key !== backdrop.key) {
    setLayers([...layers.slice(-1), { backdrop, fresh: true }]);
  }

  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  /* ---------- Data ---------- */

  const [index, setIndex] = useState<HomeIndexBody | null>(null);
  const [recentSlugs, setRecentSlugs] = useState<string[]>(readRecent);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(INDEX_URL, { cache: 'no-store' });
        if (r.status === 401) {
          // The session is over: what this browser kept of it goes too.
          await clearOfflineCopies();
          window.location.replace(signInHref());
          return;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        void keepIndex(r.clone());
        const body = (await r.json()) as HomeIndexBody;
        if (!cancelled) setIndex(body);
      } catch {
        /* Offline, or Graph hiccuped: keep what we have; the next refresh retries. */
      }
    }
    load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  /* Last visit's lists, so they are there at once while the network answers; only once
     it is clear they were this person's (a shared browser can change hands between
     sessions). /api/auth/me answers from the offline copy too, so this works offline. */
  const viewer = identity?.email.trim().toLowerCase() ?? null;
  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    readKeptIndex<HomeIndexBody>().then((kept) => {
      if (!cancelled && kept?.viewer === viewer) setIndex((current) => current ?? kept);
    });
    return () => {
      cancelled = true;
    };
  }, [viewer]);

  const { companies, bySlug, mine, people, peopleBySlug } = useMemo(() => {
    const all = (index?.companies ?? []).map(toEntry).filter((e) => e.slug);
    const mineSet = new Set((index?.mine ?? []).map(cleanSlug));
    const persons = (index?.people ?? []).map(toPerson).filter((p) => p.slug);
    const entryBySlug = new Map(all.map((e) => [e.slug, e]));
    // A person page without its own logo borrows its account page's: the route's first segment.
    for (const p of persons) p.logoUrl ??= entryBySlug.get(p.slug.split('/')[0])?.logoUrl ?? null;
    return {
      companies: dedupeByName(all),
      bySlug: entryBySlug,
      mine: dedupeByName(all.filter((e) => mineSet.has(e.slug))),
      people: persons,
      peopleBySlug: new Map(persons.map((p) => [p.slug, p])),
    };
  }, [index]);
  const loaded = index !== null;
  /* The lists take over from the loading line once the data is in: the line
     drops out first, then the cut-out grows to make room. */
  const [ready, setReady] = useState(false);
  const [loadingOut, setLoadingOut] = useState(false);

  const recentItems = useMemo<Item[]>(
    () =>
      recentSlugs
        .map((s): Item | null => {
          const entry = bySlug.get(s);
          if (entry) return { kind: 'company', entry };
          const person = peopleBySlug.get(s);
          return person ? { kind: 'person', person } : null;
        })
        .filter((i): i is Item => !!i),
    [recentSlugs, bySlug, peopleBySlug],
  );

  /* "2.785 companies and counting…" counts up once the index arrives. */
  const [shownCount, setShownCount] = useState(0);
  useEffect(() => {
    if (!loaded) return;
    const from = shownCount;
    const to = companies.length;
    if (from === to) return;
    const duration = from === 0 ? 1600 : 600;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShownCount(Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Only a new target restarts the count, not each step of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, companies.length]);

  /* ---------- What the panel shows ---------- */

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  /* ---------- Pages Mark is building (api/page-builds) ---------- */

  /* The rep's builds: polled while one is under way, so each row's ring and line
     move with the run. A row stays a while after it finishes (Ready, or why not). */
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [buildsAsked, setBuildsAsked] = useState(0);
  const addBuilds = useCallback((started: BuildSummary[]) => {
    setBuilds((current) => [...started, ...current.filter((b) => !started.some((s) => s.id === b.id))]);
    setBuildsAsked((n) => n + 1);
  }, []);
  const signedInAs = identity?.email ?? null;
  useEffect(() => {
    if (!signedInAs) return;
    let cancelled = false;
    let timer = 0;
    async function poll() {
      try {
        const r = await fetch('/api/page-builds', { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const body = (await r.json()) as { builds: BuildSummary[] };
        if (cancelled) return;
        setBuilds(body.builds);
        if (body.builds.some((b) => b.status === 'running' || b.status === 'waiting')) {
          timer = window.setTimeout(poll, document.hidden ? 30_000 : 5000);
        }
      } catch {
        if (!cancelled) timer = window.setTimeout(poll, 30_000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [signedInAs, buildsAsked]);
  const shownBuilds = useMemo(
    () =>
      builds.filter(
        (b) =>
          b.status === 'running' ||
          b.status === 'waiting' ||
          // Finished: until the index lists the page itself.
          (Date.now() - (b.finishedAt ?? 0) < 30 * 60 * 1000 && !bySlug.has(b.route) && !peopleBySlug.has(b.route)),
      ),
    [builds, bySlug, peopleBySlug],
  );

  /* A company the index has a page for, by name, website or address. */
  const findCompany = useCallback(
    (text: string) => {
      const t = text.trim().toLowerCase();
      const domain = t.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const hit = companies.find((e) => e.name.toLowerCase() === t || e.domain.toLowerCase() === domain || e.slug === t);
      return hit ? { route: hit.slug, name: hit.name } : null;
    },
    [companies],
  );
  const req = usePageRequest({ findCompany, onStarted: addBuilds });

  /* `?q=`: the browser's "search Showcase" entry (public/opensearch.xml) lands here
     with the query. Filled in after the first render, so the server's HTML and the
     browser's first render agree; focusing the field opens search. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')?.trim();
    if (!q) return;
    setQuery(q);
    inputRef.current?.focus();
  }, []);

  const wanted: View = req.phase ? 'request' : focused || query ? 'search' : 'idle';
  const [shown, setShown] = useState<View>('idle');
  const [leaving, setLeaving] = useState<View | null>(null);
  /* Which entrance the rows play: the load-in, a view swap, or none (typing). */
  const [enter, setEnter] = useState<'intro' | 'swap' | null>('intro');

  useEffect(() => {
    if (wanted === shown) {
      setLeaving(null);
      return;
    }
    setLeaving(shown);
    const t = window.setTimeout(() => {
      setLeaving(null);
      setShown(wanted);
      setEnter('swap');
      setActiveIdx(0);
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
  }, [wanted, shown]);

  useEffect(() => {
    if (!enter || (enter === 'intro' && !ready)) return;
    const t = window.setTimeout(() => setEnter(null), 1600);
    return () => window.clearTimeout(t);
  }, [enter, ready]);

  /* ---------- Geometry and the cut-out's motion ---------- */

  const [box, setBox] = useState<(CutoutBox & { compact: boolean }) | null>(null);
  const boxRef = useRef<CutoutBox | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = heroRef.current;
      if (!el) return;
      const compact = window.matchMedia(COMPACT_MEDIA).matches;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const next = { w, h, right: compact ? w : Math.round(w / 2), compact };
      // Phones fire resize for toolbar changes that leave the scene as it was.
      const prev = boxRef.current;
      if (prev && prev.w === w && prev.h === h && prev.right === next.right) return;
      boxRef.current = next;
      setBox(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const rhythm = RHYTHM[box?.compact ? 'compact' : 'regular'];
  const searchRows = box
    ? Math.max(
        IDLE_ROWS,
        Math.min(MAX_SEARCH_ROWS, Math.floor((box.h - rhythm.above - (look?.location || look?.dates ? 34 : 0) - panelHeight(0, rhythm)) / (rhythm.row + rhythm.gap))),
      )
    : IDLE_ROWS;
  const rowsFor = (v: View) => (v === 'search' ? searchRows : IDLE_ROWS);
  const depth = !ready && wanted !== 'request' ? loadingHeight(rhythm) : panelHeight(rowsFor(wanted), rhythm);

  const motion = useRef({ depth: START_DEPTH, from: START_DEPTH, to: START_DEPTH, start: 0, dur: 1, raf: 0 });
  const introAt = useRef<number | null>(null);

  const draw = useCallback(() => {
    const b = boxRef.current;
    const hero = heroRef.current;
    if (!b || !hero) return;
    const d = motion.current.depth;
    hero.style.clipPath = `path("${cutoutPath(b, d)}")`;
    // On phones the cut-out spans the scene, so the photograph is sized to what shows above it (search-home.css).
    hero.style.setProperty('--sh-cut', `${Math.max(0, d)}px`);
    if (liftRef.current) liftRef.current.style.transform = `translate3d(0, ${-Math.max(0, d)}px, 0)`;
    // The lists hang from the same edge, frame by frame. Placed at the target depth
    // instead, they jumped the whole distance the moment search opened or closed.
    if (listsRef.current) listsRef.current.style.transform = `translate3d(0, ${b.h - Math.max(0, d)}px, 0)`;
  }, []);

  const animateTo = useCallback(
    (to: number, dur: number, delay = 0) => {
      const m = motion.current;
      cancelAnimationFrame(m.raf);
      if (reduceMotion) {
        m.depth = m.to = to;
        draw();
        return;
      }
      m.from = m.depth;
      m.to = to;
      m.dur = dur;
      m.start = performance.now() + delay;
      const step = (now: number) => {
        const p = (now - m.start) / m.dur;
        m.depth = m.from + (m.to - m.from) * easeOut(p);
        draw();
        if (p < 1) m.raf = requestAnimationFrame(step);
      };
      m.raf = requestAnimationFrame(step);
    },
    [draw, reduceMotion],
  );

  const wasReady = useRef(false);
  useEffect(() => {
    if (!box) return;
    const now = performance.now();
    const grew = ready && !wasReady.current;
    wasReady.current = ready;
    if (introAt.current === null) {
      introAt.current = now + INTRO_DELAY;
      animateTo(depth, INTRO_MS, INTRO_DELAY);
    } else if (now < introAt.current) {
      // The data beat the rise: the same rise, to the new depth.
      animateTo(depth, INTRO_MS, introAt.current - now);
    } else if (depth !== motion.current.to) {
      // The lists arriving get the rise's long landing; a view swap is quicker.
      animateTo(depth, grew ? INTRO_MS : SWAP_MS);
    } else {
      // A new size at the same depth: redraw, and let a move in flight carry on.
      draw();
    }
  }, [box, depth, ready, animateTo, draw]);

  useEffect(() => () => cancelAnimationFrame(motion.current.raf), []);

  /* Rows trail the cut-out up: they ride its edge (draw()) and rise INTRO_TRAIL
     further behind it. Data that is here almost at once rides the first rise;
     later data waits for the loading line to drop, then the cut-out grows again
     from the line's height and the rows trail that. */
  const [introBase, setIntroBase] = useState(INTRO_DELAY + 70);
  useEffect(() => {
    if (!loaded || ready || introAt.current === null) return;
    const since = performance.now() - introAt.current;
    if (since < LOADING_GLANCE_MS) {
      setIntroBase(Math.max(0, 70 - since));
      setReady(true);
      return;
    }
    setLoadingOut(true);
    const t = window.setTimeout(() => {
      setIntroBase(70);
      setEnter('intro');
      setReady(true);
    }, LEAVE_MS);
    return () => window.clearTimeout(t);
    // Once, when the data first lands (the box only so the rise has a start time).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, box]);

  /* ---------- Actions ---------- */

  const open = useCallback(
    (slug: string) => {
      const next = [slug, ...recentSlugs.filter((s) => s !== slug)].slice(0, MAX_RECENT);
      setRecentSlugs(next);
      writeRecent(next);
      // A new tab, so this page stays where it was; `?search=1` gives the page its "back to search" button.
      window.open(`/${slug}?search=1`, '_blank', 'noopener,noreferrer');
    },
    [recentSlugs],
  );

  const view = leaving ?? shown;
  const rows = rowsFor(view);

  /* The two columns for the current view, and the arrow keys' walk through them. */
  type Row =
    | { key: string; kind: 'item'; item: Item; meta: string | null }
    | { key: string; kind: 'build'; build: BuildSummary }
    | { key: string; kind: 'offer'; page: OfferPage }
    | { key: string; kind: 'add'; add: 'account' | 'person' };
  const columns = useMemo((): Array<{ title: string; rows: Row[]; empty: string | null }> => {
    const asRow = (item: Item, withMeta: boolean): Row =>
      item.kind === 'company'
        ? { key: `c:${item.entry.slug}`, kind: 'item', item, meta: withMeta ? item.entry.domain : null }
        : {
            key: `p:${item.person.slug}`,
            kind: 'item',
            item,
            meta: withMeta ? [item.person.title, item.person.company].filter(Boolean).join(' · ') : null,
          };

    const buildRow = (build: BuildSummary): Row => ({ key: `b:${build.id}`, kind: 'build', build });
    const offerRow = (page: OfferPage): Row => ({ key: `o:${page.route}`, kind: 'offer', page });
    const offerPages = running?.pages ?? [];
    if (view === 'search') {
      const q = query.trim();
      // Run as an offer, its page for a company is the first answer to a search for that company.
      const ql = q.toLowerCase();
      const offerHits = q ? offerPages.filter((p) => p.companyName.toLowerCase().includes(ql) || p.route.includes(slugify(q))) : offerPages;
      // A page being built is the best answer to a search for it, so it leads its column.
      // A person queued under a company matches the company too (its address starts with it).
      const building = (kind: BuildSummary['kind']) =>
        shownBuilds
          .filter((b) => b.kind === kind && (!q || b.name.toLowerCase().includes(q.toLowerCase()) || b.route.includes(slugify(q))))
          .map(buildRow);
      const cs = [
        ...building('account'),
        ...offerHits.map(offerRow),
        ...rankCompanies(companies, q, recentSlugs, rows).map((entry) => asRow({ kind: 'company', entry }, true)),
      ].slice(0, rows);
      const ps = [
        ...building('person'),
        ...rankPeople(people, q, recentSlugs, rows).map((person) => asRow({ kind: 'person', person }, true)),
      ].slice(0, rows);
      return [
        { title: 'Companies', rows: q && !cs.length ? [{ key: 'add:account', kind: 'add', add: 'account' }] : cs, empty: null },
        { title: 'People', rows: q && !ps.length ? [{ key: 'add:person', kind: 'add', add: 'person' }] : ps, empty: null },
      ];
    }
    if (view === 'idle' && running) {
      // Run as an offer: its pages first; what you opened recently stays, the way back to everything else.
      return [
        {
          title: 'Companies',
          rows: offerPages.slice(0, rows).map(offerRow),
          empty: 'No pages for this offer yet.',
        },
        {
          title: 'Recently opened',
          rows: [...shownBuilds.map(buildRow), ...recentItems.map((i) => asRow(i, false))].slice(0, rows),
          empty: 'Pages you open show up here.',
        },
      ];
    }
    if (view === 'idle') {
      const recent = [...shownBuilds.map(buildRow), ...recentItems.map((i) => asRow(i, false))].slice(0, rows);
      // An account opened from here moves to Recently opened: it is never listed twice.
      const shownSlugs = new Set(recentItems.slice(0, rows).map((i) => (i.kind === 'company' ? i.entry.slug : i.person.slug)));
      return [
        {
          title: 'Recently opened',
          rows: recent,
          empty: 'Pages you open show up here.',
        },
        {
          title: 'My accounts',
          rows: mine
            .filter((entry) => !shownSlugs.has(entry.slug))
            .slice(0, rows)
            .map((entry) => asRow({ kind: 'company', entry }, false)),
          empty: mine.length ? 'Your accounts are all in Recently opened.' : 'No account page lists you on its team yet.',
        },
      ];
    }
    return [];
  }, [view, query, companies, people, recentSlugs, recentItems, mine, rows, shownBuilds, running]);

  // Nothing to walk (or offer to add) until the lists are on screen.
  const navRows = ready ? columns.flatMap((c) => c.rows) : [];

  const pick = (row: Row) => {
    if (row.kind === 'add') {
      req.start(row.add, query);
      inputRef.current?.focus();
      return;
    }
    if (row.kind === 'build') {
      // The page's own address: Mark's build while it works, the page once it is done.
      window.open(`/${row.build.route}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (row.kind === 'offer') {
      window.open(`/${row.page.route}`, '_blank', 'noopener,noreferrer');
      return;
    }
    open(row.item.kind === 'company' ? row.item.entry.slug : row.item.person.slug);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (req.phase) {
      if (e.key === 'Escape') {
        e.preventDefault();
        req.cancel();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, Math.min(navRows.length - 1, activeIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      setActiveIdx(next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = navRows[activeIdx];
      if (row) pick(row);
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  /* Search was open when the person left for a result's tab, so it is open when
     they come back. Desktop browsers put the caret back themselves; iOS Safari
     may not. */
  useEffect(() => {
    if (!focused) return;
    const onReturn = () => {
      const input = inputRef.current;
      if (input && document.activeElement !== input) input.focus({ preventScroll: true });
    };
    window.addEventListener('focus', onReturn);
    return () => window.removeEventListener('focus', onReturn);
  }, [focused]);

  // `/` focuses search from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- Render ---------- */

  const placeholder = req.phase
    ? req.placeholder
    : loaded
      ? `${shownCount.toLocaleString()} companies and counting…`
      : 'Search companies and people…';

  const requestHint =
    req.error ??
    (req.phase === 'sent'
      ? 'It shows up in your list while Mark works; open it to watch.'
      : req.phase === 'person'
        ? req.companyIsNew
          ? "Mark builds the company's page first (about 15 minutes), then this person's (about 4 more)."
          : 'Mark builds a page for this person in about 4 minutes. It shows up in your list while it works.'
        : req.kind === 'person'
          ? 'First the company they work at: one that has a page, or its website if it has none yet. Then their name.'
          : `Mark finds the company by its website, researches it and builds the page in about 15 minutes. It shows up in your list while it works, and Mark messages you on Teams${
              identity ? ` at ${identity.email}` : ''
            } when it's live.`);

  /* The go button turns into a + when what it would do is ask Mark for a page. */
  const activeRow = view === 'search' && !leaving ? navRows[activeIdx] : undefined;
  const addRow = activeRow?.kind === 'add' ? activeRow : null;
  const adding = req.phase === 'company' || req.phase === 'person' || !!addRow;
  const goLabel = req.phase ? 'Send to Mark' : addRow ? (addRow.add === 'account' ? 'Add company' : 'Add person') : 'Open';

  /* What a screen reader hears as the results change, rather than the whole panel again. */
  const hits = (c: number) => columns[c]?.rows.filter((r) => r.kind === 'item').length ?? 0;
  const resultsNote =
    view === 'search' && ready && query.trim()
      ? `${hits(0)} ${hits(0) === 1 ? 'company' : 'companies'} and ${hits(1)} ${hits(1) === 1 ? 'person' : 'people'} shown`
      : '';

  const anim = leaving ? 'leave' : enter;
  let navIdx = 0;

  return (
    <main className="sh">
      <section className="sh-hero" ref={heroRef} aria-label="Search">
        {/* Decorative. A blurred 24px preview holds the place until the photograph
            arrives; portrait screens get a 3:4 slice instead of the whole frame. */}
        <div className="sh-scene" aria-hidden="true">
          {layers.map((layer, i) => (
            <SceneLayer
              key={layer.backdrop.key}
              backdrop={layer.backdrop}
              fresh={layer.fresh}
              // Once the new one is in, the one under it goes.
              onShown={i === layers.length - 1 && layers.length > 1 ? () => setLayers((l) => l.slice(-1)) : undefined}
            />
          ))}
          <div className="sh-scene__shade" />
        </div>

        <header className="sh-top">
          <div className="sh-top__brand">
            <OptimizelyWordmark className="sh-top__logo" />
            {look?.logo && (
              <>
                <span className="sh-top__rule" aria-hidden="true" />
                <img className="sh-top__event" key={look.logo.sourceUrl} src={logoSrc(look.logo.svg)} alt={asOffer?.title ?? ''} />
              </>
            )}
          </div>
          {identity && <ProfileMenu identity={identity} offers={offers} chosen={asOffer?.id ?? null} onChoose={chooseOffer} onRemake={remakeLook} />}
        </header>
        {job && asOffer && job.offerId === asOffer.id && (
          <LookCard job={job} title={asOffer.title} onRetry={() => void makeLook(asOffer.id, 'retry')} />
        )}

        <div className="sh-lift" ref={liftRef}>
          {look ? (
            <div className="sh-headline is-offer" key={`look:${look.headline}`}>
              {(look.location || look.dates) && <p className="sh-eyebrow">{[look.location, look.dates].filter(Boolean).join(' · ')}</p>}
              <h1 className="sh-h1">
                {headlineParts(look)[0]}
                {look.accent && <em>{headlineParts(look)[1]}</em>}
                {headlineParts(look)[2]}
              </h1>
            </div>
          ) : (
            <h1 className="sh-h1">
              Every brand deserves
              <br />
              <em>its own</em> story
            </h1>
          )}
          <form
            className={'sh-search' + (req.phase ? ' is-request' : '')}
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (req.phase) {
                if (req.phase !== 'sent') req.submit();
                return;
              }
              const row = navRows[activeIdx];
              if (row) pick(row);
              else inputRef.current?.focus();
            }}
          >
            {req.phase === 'sent' ? (
              <p className="sh-search__status" role="status">
                {req.sentNote}
              </p>
            ) : (
              <input
                ref={inputRef}
                id="sh-q"
                className="sh-search__input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-label={req.phase ? req.placeholder : 'Search companies and people'}
                placeholder={placeholder}
                value={req.phase ? req.value : query}
                disabled={req.submitting}
                onChange={(e) => {
                  if (req.phase) req.setValue(e.target.value);
                  else {
                    setQuery(e.target.value);
                    setActiveIdx(0);
                  }
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                  // Leaving the tab (a result opens in a new one) blurs the field
                  // too, and coming back focuses it again: neither closes search.
                  if (!document.hasFocus()) return;
                  // Deferred so a click on a row lands first.
                  window.setTimeout(() => {
                    if (document.activeElement !== inputRef.current) setFocused(false);
                  }, 150);
                }}
                onKeyDown={onKeyDown}
              />
            )}
            {req.phase && req.phase !== 'sent' && (
              <button type="button" className="sh-search__cancel" onClick={req.cancel} disabled={req.submitting}>
                Cancel
              </button>
            )}
            {req.phase !== 'sent' && (
              <button
                type="submit"
                className="sh-search__go"
                data-icon={adding ? 'add' : 'go'}
                aria-label={goLabel}
                disabled={req.submitting}
              >
                {req.submitting ? (
                  <span className="sh-spinner" aria-hidden="true" />
                ) : (
                  <>
                    <svg className="sh-search__arrow" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path d="M3 9h11M10 4.5 14.5 9 10 13.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <svg className="sh-search__plus" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path d="M9 3.5v11M3.5 9h11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </form>
        </div>
      </section>

      <div
        className="sh-panel"
        style={
          {
            '--sh-panel-h': `${depth}px`,
            '--sh-pad-t': `${rhythm.top}px`,
            '--sh-pad-b': `${rhythm.bottom}px`,
            '--sh-head-gap': `${rhythm.headGap}px`,
            '--sh-row': `${rhythm.row}px`,
            '--sh-row-gap': `${rhythm.gap}px`,
            '--sh-travel': `${INTRO_TRAIL}px`,
            '--sh-base': `${introBase}ms`,
          } as CSSProperties
        }
        aria-busy={!ready}
      >
        <div className="sh-panel__body" ref={listsRef}>
          {!ready && view !== 'request' ? (
            <p className={'sh-loading' + (loadingOut ? ' is-leaving' : '')}>Finding recent &amp; your brands…</p>
          ) : view === 'request' ? (
            <div className="sh-cols sh-cols--single" data-anim={anim ?? undefined} key="request">
              <div className="sh-col">
                <h2 style={slot(0, 0)}>{req.kind === 'person' ? 'New person page' : 'New company page'}</h2>
                <p className={'sh-note' + (req.error ? ' sh-note--error' : '')} style={slot(1, 0)}>
                  {requestHint}
                </p>
              </div>
            </div>
          ) : (
            <div className="sh-cols" data-anim={anim ?? undefined} key={view}>
              {columns.map((col, c) => (
                <div className="sh-col" key={col.title}>
                  <h2 style={slot(0, c)}>{col.title}</h2>
                  {col.rows.length === 0 && col.empty && (
                    <p className="sh-note" style={slot(1, c)}>
                      {col.empty}
                    </p>
                  )}
                  {col.rows.map((row, r) => {
                    const idx = navIdx++;
                    const active = view === 'search' && idx === activeIdx;
                    const common = {
                      type: 'button' as const,
                      style: slot(r + 1, c),
                      onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
                      onMouseEnter: () => setActiveIdx(idx),
                      onClick: () => pick(row),
                    };
                    if (row.kind === 'add') {
                      return (
                        <button key={row.key} {...common} className={'sh-row sh-row--add' + (active ? ' is-active' : '')}>
                          <span className="sh-tile" aria-hidden="true">
                            <PlusIcon />
                          </span>
                          <span className="sh-row__text">
                            <span className="sh-row__name">{row.add === 'account' ? 'Add company' : 'Add person'}</span>
                            <span className="sh-row__meta">{`Ask Mark to build a page for “${query.trim()}”`}</span>
                          </span>
                        </button>
                      );
                    }
                    if (row.kind === 'offer') {
                      const { page } = row;
                      const logo = page.logoUrl ?? companies.find((e) => e.name === page.companyName)?.logoUrl ?? null;
                      return (
                        <button key={row.key} {...common} className={'sh-row sh-row--offer' + (active ? ' is-active' : '')}>
                          <Tile sources={[logo]} label={initialsOf(page.companyName)} />
                          <span className="sh-row__text">
                            <span className="sh-row__name">
                              {view === 'search' ? highlight(page.companyName, query) : page.companyName}
                              {view === 'search' && <span className="sh-badge">Offer</span>}
                            </span>
                            <span className="sh-row__meta">{page.domain || `/${page.route}`}</span>
                          </span>
                        </button>
                      );
                    }
                    if (row.kind === 'build') {
                      const { build } = row;
                      return (
                        <button
                          key={row.key}
                          {...common}
                          className={`sh-row sh-row--build is-${build.status}` + (active ? ' is-active' : '')}
                        >
                          <BuildTile build={build} />
                          <span className="sh-row__text">
                            <span className="sh-row__name">
                              {build.name}
                              <span className="sh-badge">{BADGE[build.status]}</span>
                            </span>
                            <span className="sh-row__meta">{build.statusLine}</span>
                          </span>
                        </button>
                      );
                    }
                    const { item } = row;
                    const name = item.kind === 'company' ? item.entry.name : item.person.name;
                    return (
                      <button
                        key={row.key}
                        {...common}
                        className={'sh-row' + (row.meta ? '' : ' sh-row--plain') + (active ? ' is-active' : '')}
                      >
                        {item.kind === 'company' ? (
                          <Tile sources={[item.entry.logoUrl]} label={initialsOf(item.entry.name)} />
                        ) : (
                          // Their company's logo: person pages carry no email to find a Gravatar by.
                          <Tile sources={[item.person.logoUrl]} label={item.person.initials} />
                        )}
                        <span className="sh-row__text">
                          <span className="sh-row__name">{view === 'search' ? highlight(name, query) : name}</span>
                          {row.meta && <span className="sh-row__meta">{row.meta}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="sh-sr" role="status">
        {resultsNote}
      </p>
    </main>
  );
}
