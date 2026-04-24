import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startSearchStarfield } from '../lib/search-starfield';
import { brandLogoTypeUrl } from '../lib/brand-logo';
import '../styles/search.css';

type IndexItem = {
  _metadata: { url: { default: string; hierarchical: string }; published: string | null };
  headline: string | null;
  eyebrow: string | null;
  competitorName: string | null;
  brandDomain: string | null;
  brandAccentColor: string | null;
  customerLogo: string | null;
  intelHeadline: string | null;
};

type Entry = {
  slug: string;          // path the router should navigate to (no leading slash)
  name: string;          // display name
  domain: string;        // display domain
  industry: string;      // e.g. eyebrow text
  color: string;         // hex brand accent (or default)
  logoUrl: string | null;
};

const RECENT_KEY = 'showcase.recent-searches.v1';
const MAX_RECENT = 6;

function hexToRgb(hex: string | null): [number, number, number] {
  const fallback: [number, number, number] = [0, 55, 255];
  if (!hex) return fallback;
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return fallback;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** "vs-writer-ai-logitech" or "/en/vs-writer-ai-logitech/" → "Logitech" */
function prettyFromSlug(slug: string): string {
  const base = slug
    .replace(/^\/+|\/+$/g, '')
    .replace(/^en\//, '')
    .replace(/^vs-writer-ai-/, '')
    .replace(/^vs-writer-/, '')
    .replace(/^hyper-/, '');
  return base
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function cleanSlug(url: string): string {
  // Graph returns `/en/vs-writer-ai-logitech/`. Strip locale + slashes.
  return url.replace(/^\/+|\/+$/g, '').replace(/^en\//, '');
}

/** Pull the target company name out of intelHeadline's first <em>.
 *  e.g. "We know <em>Aruba Bank</em>" → "Aruba Bank" */
function nameFromIntel(intel: string | null): string | null {
  if (!intel) return null;
  const m = intel.match(/<em[^>]*>([^<]+)<\/em>/i);
  return m?.[1]?.trim() || null;
}

function toEntry(item: IndexItem): Entry {
  const slug = cleanSlug(item._metadata?.url?.hierarchical || item._metadata?.url?.default || '');
  // Preferred: the brand the page was built FOR (Aruba Bank), not the
  // competitor we're fighting against (Sitecore).
  const name =
    nameFromIntel(item.intelHeadline) ||
    prettyFromSlug(slug);
  const domain = item.brandDomain || `${slug}.com`;
  // Use the competitor as secondary context ("vs Sitecore") when present.
  const industry = item.competitorName
    ? `vs ${item.competitorName}`
    : item.eyebrow || 'Comparison page';
  const color = item.brandAccentColor || '#0037ff';
  // Prefer the square brand *icon* over the wordmark — fills the circular/
  // squircle chip without leaving whitespace bars around it.
  const logoUrl =
    item.customerLogo ||
    (item.brandDomain ? brandLogoTypeUrl(item.brandDomain, 'icon') : null);
  return { slug, name, domain, industry, color, logoUrl };
}

function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(slugs: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(slugs.slice(0, MAX_RECENT)));
  } catch {
    // Swallow — private mode, quota, etc.
  }
}

function highlight(str: string, q: string): ReactNode[] {
  if (!q) return [str];
  const i = str.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return [str];
  return [
    str.slice(0, i),
    <mark key="hl">{str.slice(i, i + q.length)}</mark>,
    str.slice(i + q.length),
  ];
}

function OptLogo({ entry }: { entry: Entry }) {
  if (entry.logoUrl) {
    return (
      <span className="search-page__opt-logo">
        <img src={entry.logoUrl} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="search-page__opt-logo" style={{ color: entry.color }}>
      {entry.name.slice(0, 1)}
    </span>
  );
}

function PillLogo({ entry }: { entry: Entry }) {
  if (entry.logoUrl) {
    return (
      <span className="search-page__pill-logo">
        <img src={entry.logoUrl} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="search-page__pill-logo" style={{ color: entry.color }}>
      {entry.name.slice(0, 1)}
    </span>
  );
}

function SearchPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const starRef = useRef<{
    destroy: () => void;
    setPalette: (rgbs: [number, number, number][]) => void;
    setBoost: (target: number) => void;
  } | null>(null);

  const [entries, setEntries] = useState<Entry[]>([]);
  /** Raw page count from Graph (pre-dedupe). Used as the placeholder metric. */
  const [totalPages, setTotalPages] = useState<number | null>(null);
  /** Animated count-up target for the placeholder. Eases toward totalPages. */
  const [displayCount, setDisplayCount] = useState(0);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recentSlugs, setRecentSlugs] = useState<string[]>(readRecent);

  /* Load the search index on mount, then refresh silently every 5 min so
     the count stays fresh on a booth-mode iPad without a full reload. */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch('/api/search-index', { cache: 'no-store' });
        if (!r.ok) throw new Error(`${r.status}`);
        const json = (await r.json()) as { items: IndexItem[]; total?: number };
        if (cancelled) return;

        if (typeof json.total === 'number') setTotalPages(json.total);
        else if (Array.isArray(json.items)) setTotalPages(json.items.length);

        const mapped = (json.items || [])
          .map(toEntry)
          .filter((e) => e.slug); // skip anything without a URL
        // Dedupe by company name (case-insensitive). Multiple comparison
        // pages can exist per company (e.g. vs-Sitecore / vs-Adobe) — keep
        // the first and hide the rest so the dropdown isn't noisy.
        const seen = new Set<string>();
        const deduped = mapped.filter((e) => {
          const key = e.name.trim().toLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setEntries(deduped);
      } catch {
        /* Empty index is fine — UI still renders. Next refresh will retry. */
      }
    }

    load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  /* Count-up animation. Runs from displayCount → totalPages every time the
     target changes (initial load and each 5-min refresh). Uses RAF so we
     don't kick the React reconciler once per number. */
  useEffect(() => {
    if (totalPages === null) return;
    const from = displayCount;
    const to = totalPages;
    if (from === to) return;

    // Initial load gets a longer, more satisfying ramp. Background refreshes
    // just tick from the old value to the new — usually small deltas.
    const duration = from === 0 ? 1600 : 600;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast start, gentle settle
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayCount(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Intentionally omit displayCount — we want this to fire only when
    // totalPages changes (target update), not on each intermediate step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  /* Starfield lifecycle. */
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctrl = startSearchStarfield(canvasRef.current, [[0, 55, 255]]);
    starRef.current = ctrl;
    return () => {
      ctrl.destroy();
      starRef.current = null;
    };
  }, []);

  const results = useMemo(
    () => computeResults(entries, query, recentSlugs),
    [entries, query, recentSlugs],
  );

  /* Build the accent palette from the user's recent picks. The default
   * Aldus blue anchors the palette so the field doesn't lose its identity
   * before anyone has searched. */
  const palette = useMemo<[number, number, number][]>(() => {
    const byId = new Map(entries.map((e) => [e.slug, e]));
    const recentColors = recentSlugs
      .map((s) => byId.get(s))
      .filter((e): e is Entry => !!e)
      .map((e) => hexToRgb(e.color));
    // Dedupe exact colour matches so accent distribution stays even.
    const seen = new Set<string>();
    const combined: [number, number, number][] = [[0, 55, 255], ...recentColors];
    return combined.filter((rgb) => {
      const key = rgb.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [entries, recentSlugs]);

  useEffect(() => {
    starRef.current?.setPalette(palette);
  }, [palette]);

  /* Boost the starfield while the user is interacting with search. */
  useEffect(() => {
    starRef.current?.setBoost(focused ? 1 : 0);
  }, [focused]);

  const select = useCallback((entry: Entry) => {
    // Persist recent
    const next = [entry.slug, ...recentSlugs.filter((s) => s !== entry.slug)].slice(0, MAX_RECENT);
    setRecentSlugs(next);
    writeRecent(next);
    // Always open in a new tab — booth iPads keep /search as the "home"
    // surface so attendees can run more searches without a back-button trip.
    window.open(`/${entry.slug}`, '_blank', 'noopener,noreferrer');
  }, [recentSlugs]);

  const ghostText = useMemo(() => {
    if (!query) return null;
    const top = results[activeIdx];
    if (!top) return null;
    if (!top.name.toLowerCase().startsWith(query.toLowerCase())) return null;
    return { typed: query, rest: top.name.slice(query.length) };
  }, [query, results, activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = results[activeIdx];
      if (entry) select(entry);
    } else if (e.key === 'Tab' && ghostText) {
      // Tab-complete the ghost suggestion
      e.preventDefault();
      setQuery(ghostText.typed + ghostText.rest);
    } else if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  // Global `/` shortcut — keep it from the design, even with HUD removed
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

  const recentEntries = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.slug, e]));
    return recentSlugs.map((s) => byId.get(s)).filter((e): e is Entry => !!e);
  }, [entries, recentSlugs]);

  const showSearchResults = focused || query.length > 0;

  return (
    <div className="search-page">
      <canvas ref={canvasRef} className="search-page__starfield" />
      <div className="search-page__orb" />

      <div className="search-page__app">
        <div className="search-page__brand">
          <img src="/optimizely-logo.svg" alt="Optimizely" />
        </div>

        <h1 className="search-page__headline">
          Every brand deserves <em>its own</em> story.
        </h1>

        <div
          className={
            'search-page__searchwrap' +
            (focused ? ' search-page__searchwrap--focused' : '')
          }
        >
          <div className="search-page__search">
            <svg
              className="search-page__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.35-4.35" />
            </svg>

            <div className="search-page__field">
              {ghostText && (
                <div className="search-page__ghost" aria-hidden="true">
                  <b>{ghostText.typed}</b>
                  {ghostText.rest}
                </div>
              )}
              <input
                ref={inputRef}
                className="search-page__input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  totalPages !== null
                    ? `${displayCount.toLocaleString()} brands and counting…`
                    : 'Search a company…'
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIdx(0);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                  // Defer so click-on-option fires first
                  setTimeout(() => setFocused(false), 150);
                }}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              className="search-page__action"
              type="button"
              disabled={!results.length}
              onClick={() => {
                const entry = results[activeIdx] || results[0];
                if (entry) select(entry);
              }}
            >
              <span>Open</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div
            className={
              'search-page__dropdown' + (showSearchResults ? ' search-page__dropdown--open' : '')
            }
          >
            {results.length === 0 ? (
              <div className="search-page__empty">
                No match for <b>{query}</b>.
                <span className="search-page__empty-hint">Try a company name or domain.</span>
              </div>
            ) : (
              <>
                <div className="search-page__section">
                  {query ? 'Matches' : 'Recently viewed'}
                </div>
                {results.map((entry, i) => (
                  <div
                    key={entry.slug}
                    role="button"
                    tabIndex={-1}
                    className={
                      'search-page__opt' + (i === activeIdx ? ' search-page__opt--active' : '')
                    }
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseDown={(e) => {
                      // Prevent blur before click
                      e.preventDefault();
                    }}
                    onClick={() => select(entry)}
                  >
                    <OptLogo entry={entry} />
                    <div className="search-page__opt-body">
                      <div className="search-page__opt-title">
                        {highlight(entry.name, query)}
                      </div>
                      <div className="search-page__opt-meta">
                        <span>{entry.domain}</span>
                        <span className="search-page__opt-dot" />
                        <span>{entry.industry}</span>
                      </div>
                    </div>
                    <span className="search-page__opt-chip">{query ? 'Open' : 'Reopen'}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {!query && recentEntries.length > 0 && (
          <div
            className="search-page__pill-row"
            style={focused ? { opacity: 0.25 } : undefined}
          >
            <span className="search-page__pill-label">Recent</span>
            {recentEntries.map((entry) => (
              <button
                key={entry.slug}
                type="button"
                className="search-page__pill"
                onClick={() => select(entry)}
              >
                <PillLogo entry={entry} />
                {entry.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Score + rank: prefix matches on name / domain first, then substring
 * matches across name / domain / industry.
 * When the query is empty, show the first N entries alphabetically so the
 * dropdown is never blank on first focus.
 */
function computeResults(entries: Entry[], rawQuery: string, recentSlugs: string[]): Entry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    if (recentSlugs.length) {
      const byId = new Map(entries.map((e) => [e.slug, e]));
      const ordered = recentSlugs.map((s) => byId.get(s)).filter((e): e is Entry => !!e);
      if (ordered.length) return ordered.slice(0, 8);
    }
    return [...entries].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
  }

  const starts: Entry[] = [];
  const contains: Entry[] = [];
  for (const e of entries) {
    const n = e.name.toLowerCase();
    const d = e.domain.toLowerCase();
    const ind = e.industry.toLowerCase();
    if (n.startsWith(q) || d.startsWith(q)) starts.push(e);
    else if (n.includes(q) || d.includes(q) || ind.includes(q)) contains.push(e);
  }
  return [...starts, ...contains].slice(0, 8);
}

export default SearchPage;
