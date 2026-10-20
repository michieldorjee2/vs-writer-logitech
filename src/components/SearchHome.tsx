import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { signInHref, useAuth } from '../lib/auth';
import { cutoutPath, easeOut, type CutoutBox } from '../lib/home-cutout';
import type { HomeIndexBody, PersonItem } from '../lib/home-index';
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
import { sceneSizes, sceneSrc, sceneSrcSet, TALL_MEDIA, type Scene } from '../lib/home-scenes';
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
const LEAVE_MS = 240; // rows drop out before the next view's rows rise
const START_DEPTH = -24; // the cut-out starts just below the scene's bottom edge
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

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** Stagger slot for the rise and drop animations: rows down a column, columns slightly apart. */
const slot = (row: number, col: number) => ({ '--i': row + col * 0.7 }) as CSSProperties;

export default function SearchHome({ scene }: { scene: Scene }) {
  const heroRef = useRef<HTMLElement | null>(null);
  const liftRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* The server already sent anyone signed out to Opti ID (server/ssr-handler.tsx).
     This catches a session that ended while the tab stayed open. */
  const auth = useAuth();
  const identity = auth.status === 'signed-in' ? auth.identity : null;
  useEffect(() => {
    if (auth.status === 'signed-out') window.location.replace(signInHref());
  }, [auth.status]);

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
  const req = usePageRequest();

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
        Math.min(MAX_SEARCH_ROWS, Math.floor((box.h - rhythm.above - panelHeight(0, rhythm)) / (rhythm.row + rhythm.gap))),
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
    if (liftRef.current) liftRef.current.style.transform = `translate3d(0, ${-Math.max(0, d)}px, 0)`;
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

  /* Rows trail the cut-out up. Data that is here almost at once rides the first
     rise; later data waits for the loading line to drop, then the cut-out grows
     again from the line's height and the rows trail that. */
  const [intro, setIntro] = useState({ base: INTRO_DELAY + 70, travel: panelHeight(IDLE_ROWS, RHYTHM.regular) + 64 });
  useEffect(() => {
    if (!loaded || ready || introAt.current === null) return;
    const since = performance.now() - introAt.current;
    const full = panelHeight(IDLE_ROWS, rhythm);
    if (since < LOADING_GLANCE_MS) {
      setIntro({ base: Math.max(0, 70 - since), travel: full + 64 });
      setReady(true);
      return;
    }
    setLoadingOut(true);
    const t = window.setTimeout(() => {
      setIntro({ base: 70, travel: full - loadingHeight(rhythm) + 64 });
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

    if (view === 'search') {
      const q = query.trim();
      const cs = rankCompanies(companies, q, recentSlugs, rows).map((entry) => asRow({ kind: 'company', entry }, true));
      const ps = rankPeople(people, q, recentSlugs, rows).map((person) => asRow({ kind: 'person', person }, true));
      return [
        { title: 'Companies', rows: q && !cs.length ? [{ key: 'add:account', kind: 'add', add: 'account' }] : cs, empty: null },
        { title: 'People', rows: q && !ps.length ? [{ key: 'add:person', kind: 'add', add: 'person' }] : ps, empty: null },
      ];
    }
    if (view === 'idle') {
      return [
        {
          title: 'Recently opened',
          rows: recentItems.slice(0, rows).map((i) => asRow(i, false)),
          empty: 'Pages you open show up here.',
        },
        {
          title: 'My accounts',
          rows: mine.slice(0, rows).map((entry) => asRow({ kind: 'company', entry }, false)),
          empty: 'No account page lists you on its team yet.',
        },
      ];
    }
    return [];
  }, [view, query, companies, people, recentSlugs, recentItems, mine, rows]);

  // Nothing to walk (or offer to add) until the lists are on screen.
  const navRows = ready ? columns.flatMap((c) => c.rows) : [];

  const pick = (row: Row) => {
    if (row.kind === 'add') {
      req.start(row.add, query);
      inputRef.current?.focus();
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
      ? "We'll message you on Teams when it's live."
      : req.phase === 'person'
        ? "Mark builds a page for this person and messages you on Teams when it's ready."
        : req.kind === 'person'
          ? 'First the company they work at, then their name.'
          : `Mark builds the page from the company's website and messages you on Teams${
              identity ? ` at ${identity.email}` : ''
            } when it's ready, in about 15 minutes.`);

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
        <div className="sh-scene" aria-hidden="true" style={{ '--sh-lqip': `url("${scene.lqip}")` } as CSSProperties}>
          <picture>
            <source media={TALL_MEDIA} type="image/avif" srcSet={sceneSrcSet(scene.id, 'tall', 'avif')} sizes={sceneSizes(scene, 'tall')} />
            <source media={TALL_MEDIA} type="image/webp" srcSet={sceneSrcSet(scene.id, 'tall', 'webp')} sizes={sceneSizes(scene, 'tall')} />
            <source type="image/avif" srcSet={sceneSrcSet(scene.id, 'wide', 'avif')} sizes={sceneSizes(scene, 'wide')} />
            <img
              className="sh-scene__img"
              src={sceneSrc(scene.id, 'wide', 1600, 'webp')}
              srcSet={sceneSrcSet(scene.id, 'wide', 'webp')}
              sizes={sceneSizes(scene, 'wide')}
              alt=""
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <div className="sh-scene__shade" />
        </div>

        <header className="sh-top">
          <OptimizelyWordmark className="sh-top__logo" />
          {identity && <ProfileMenu identity={identity} />}
        </header>

        <div className="sh-lift" ref={liftRef}>
          <h1 className="sh-h1">
            Every brand deserves
            <br />
            <em>its own</em> story
          </h1>
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
            '--sh-travel': `${intro.travel}px`,
            '--sh-base': `${intro.base}ms`,
          } as CSSProperties
        }
        aria-busy={!ready}
      >
        <div className="sh-panel__body">
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
                        <button
                          key={row.key}
                          {...common}
                          className={'sh-row sh-row--add' + (active ? ' is-active' : '')}
                          disabled={req.inCooldown}
                        >
                          <span className="sh-tile" aria-hidden="true">
                            <PlusIcon />
                          </span>
                          <span className="sh-row__text">
                            <span className="sh-row__name">{row.add === 'account' ? 'Add company' : 'Add person'}</span>
                            <span className="sh-row__meta">
                              {req.inCooldown
                                ? `One request a minute. Try again in ${req.cooldownRemaining}s.`
                                : `Ask Mark to build a page for “${query.trim()}”`}
                            </span>
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
