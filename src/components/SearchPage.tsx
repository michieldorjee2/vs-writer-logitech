import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startSearchStarfield } from '../lib/search-starfield';
import { brandLogoTypeUrl } from '../lib/brand-logo';
import {
  isValidOptimizelyEmail,
  loadStoredEmail,
  saveStoredEmail,
} from '../lib/stored-email';
import '../styles/search.css';

const CREATE_PAGE_ENDPOINT = '/api/opal-create-page';
const CREATE_PERSON_PAGE_ENDPOINT = '/api/opal-create-person-page';
const MAX_COMPANY_NAME_LEN = 120;
const COOLDOWN_MS = 60 * 1000;
const COOLDOWN_KEY = 'opti.add-new.last-sent.v1';

/** Inline "add new" phases: replaces the search input + Open button while active. */
type AddPhase = null | 'email' | 'company' | 'person' | 'sent';

/* Which kind of page the rep is asking for. An account page is the company
   pitch we have always offered; a person page is the 1:1 one built for a named
   buyer, and it needs one more field. The workflow behind it creates the
   account page first when the company has none, so "person" is safe to pick
   even for a company we have never touched. */
type AddKind = 'account' | 'person';

function readLastSent(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(COOLDOWN_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLastSent(t: number): void {
  try {
    window.localStorage.setItem(COOLDOWN_KEY, String(t));
  } catch {
    /* ignore */
  }
}

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

/* Dropdown sizing. The panel hangs off the bottom of the search bar, which
   sits low in a vertically centred hero — on a laptop the old flat 440px
   already ran a pixel past the fold, taking the create actions with it. The
   hero is exactly one viewport tall and the page does not scroll, so there
   is no floor here on purpose: a short window gets a cramped panel that
   scrolls internally, never one whose bottom is unreachable. 12px of gutter
   keeps the panel's shadow off the edge. */
const DROPDOWN_MAX_H = 440;
const DROPDOWN_GUTTER = 12;

function hexToRgb(hex: string | null): [number, number, number] {
  const fallback: [number, number, number] = [171, 255, 68];
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
  const color = item.brandAccentColor || '#abff44';
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

/** The "we don't have this one — build it" pair.
 *
 *  Shown in the empty state and again pinned under a hit list. A short query
 *  like "ERM" is a substring of half a dozen real company names, so the list
 *  is never empty and the create actions would otherwise be unreachable —
 *  exactly when a rep needs them. `baseIdx` is where the pair sits in the
 *  arrow-key walk: straight after the last result.
 */
function CreateActions({
  query,
  inCooldown,
  cooldownRemaining,
  baseIdx,
  activeIdx,
  onHover,
  onPick,
}: {
  query: string;
  inCooldown: boolean;
  cooldownRemaining: number;
  baseIdx: number;
  activeIdx: number;
  onHover: (idx: number) => void;
  onPick: (kind: AddKind) => void;
}) {
  // The countdown pill is inert, so it never takes the selection with it.
  const cls = (extra: string, idx: number) =>
    'search-page__empty-cta' +
    extra +
    (!inCooldown && activeIdx === idx ? ' search-page__empty-cta--active' : '');

  return (
    <div className="search-page__empty-actions">
      <button
        type="button"
        data-nav-idx={inCooldown ? undefined : baseIdx}
        className={cls(inCooldown ? ' search-page__empty-cta--cooldown' : '', baseIdx)}
        onClick={() => onPick('account')}
        disabled={inCooldown}
        onMouseEnter={() => onHover(baseIdx)}
        onMouseDown={(e) => e.preventDefault()}
      >
        {inCooldown ? (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span>One company per minute — try again in {cooldownRemaining}s</span>
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span>
              Create a page for <b>{query.trim()}</b>
            </span>
          </>
        )}
      </button>
      {/* The account page is the default because it is what most
          searches are after. But a rep often has a named buyer rather
          than just a logo, and the workflow behind this creates the
          account page first when the company has none — so asking for
          a person is safe even for a company we have never built. */}
      {!inCooldown && (
        <button
          type="button"
          data-nav-idx={baseIdx + 1}
          className={cls(' search-page__empty-cta--person', baseIdx + 1)}
          onClick={() => onPick('person')}
          onMouseEnter={() => onHover(baseIdx + 1)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </svg>
          <span>
            Or build one for a <b>person</b> there
          </span>
        </button>
      )}
    </div>
  );
}

function SearchPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const starRef = useRef<{
    destroy: () => void;
    setPalette: (rgbs: [number, number, number][]) => void;
    setBoost: (target: number) => void;
  } | null>(null);

  // `?q=` support: browsers that register us via OpenSearch drop the
  // user's query into the address bar → hit /search?q=their+term. We
  // read it once on mount and pre-fill the input.
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [entries, setEntries] = useState<Entry[]>([]);
  /** Raw page count from Graph (pre-dedupe). Used as the placeholder metric. */
  const [totalPages, setTotalPages] = useState<number | null>(null);
  /** Animated count-up target for the placeholder. Eases toward totalPages. */
  const [displayCount, setDisplayCount] = useState(0);
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recentSlugs, setRecentSlugs] = useState<string[]>(readRecent);

  // "Add new" flow — inline takeover of the search bar.
  const [addPhase, setAddPhase] = useState<AddPhase>(null);
  const [addKind, setAddKind] = useState<AddKind>('account');
  const [addPerson, setAddPerson] = useState('');
  const [addCompany, setAddCompany] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastSent, setLastSent] = useState<number>(() => readLastSent());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const addInputRef = useRef<HTMLInputElement | null>(null);

  // Email-edit popup, opened by clicking the address in the hint line.
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [emailEditDraft, setEmailEditDraft] = useState('');
  const [emailEditError, setEmailEditError] = useState<string | null>(null);
  const emailEditRef = useRef<HTMLInputElement | null>(null);

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
    const ctrl = startSearchStarfield(canvasRef.current, [[171, 255, 68]]);
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

  /* Build the accent palette from the user's recent picks. The brand
   * lime/grass/teal triad anchors the palette so the field reads as the
   * Optimizely 2026 "living field" even before anyone has searched. */
  const palette = useMemo<[number, number, number][]>(() => {
    const byId = new Map(entries.map((e) => [e.slug, e]));
    const recentColors = recentSlugs
      .map((s) => byId.get(s))
      .filter((e): e is Entry => !!e)
      .map((e) => hexToRgb(e.color));
    // Dedupe exact colour matches so accent distribution stays even.
    const seen = new Set<string>();
    const brandAnchors: [number, number, number][] = [
      [171, 255, 68],   // lime
      [125, 221, 61],   // grass
      [145, 219, 218],  // teal
    ];
    const combined: [number, number, number][] = [...brandAnchors, ...recentColors];
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

  /* OpenSearch hand-off: if we landed with ?q=… in the URL, focus the
     input so results are visible immediately. One-shot, mount only. */
  useEffect(() => {
    if (initialQuery) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback((entry: Entry) => {
    // Persist recent
    const next = [entry.slug, ...recentSlugs.filter((s) => s !== entry.slug)].slice(0, MAX_RECENT);
    setRecentSlugs(next);
    writeRecent(next);
    // Always open in a new tab — booth iPads keep /search as the "home"
    // surface so attendees can run more searches without a back-button trip.
    // `?search=1` marks the tab as search-originated so the destination
    // page can surface a floating "back to search" button.
    window.open(`/${entry.slug}?search=1`, '_blank', 'noopener,noreferrer');
  }, [recentSlugs]);

  const ghostText = useMemo(() => {
    if (!query) return null;
    const top = results[activeIdx];
    if (!top) return null;
    if (!top.name.toLowerCase().startsWith(query.toLowerCase())) return null;
    return { typed: query, rest: top.name.slice(query.length) };
  }, [query, results, activeIdx]);

  /* Move the selection and keep it inside the scroll port. The list is
     capped at a few rows and the create actions sit under the last hit, so
     arrowing down there has to bring them into view. */
  const focusNav = (next: number) => {
    setActiveIdx(next);
    dropdownRef.current
      ?.querySelector<HTMLElement>(`[data-nav-idx="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNav(Math.min(Math.max(0, navCount - 1), activeIdx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNav(Math.max(0, activeIdx - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx < results.length) {
        const entry = results[activeIdx];
        if (entry) select(entry);
      } else if (createActionCount) {
        // Past the last hit: the create pair, account page first.
        enterAddMode(query, activeIdx - results.length === 1 ? 'person' : 'account');
      }
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

  /* Keep the panel inside the fold. iOS reports the soft keyboard through
     `visualViewport` and not through `innerHeight`, so on a booth iPad with
     the keyboard up that is the only measurement that sees the real room. */
  useEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;

    const fitDropdown = () => {
      const vv = window.visualViewport;
      const viewportH = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      // Measure the panel's layout position, not its rect: it opens with a
      // -6px translate that is still mid-transition when this first runs,
      // which would report 6px more room than the panel actually has.
      const anchor = el.offsetParent as HTMLElement | null;
      const layoutTop = (anchor ? anchor.getBoundingClientRect().top : 0) + el.offsetTop;
      const top = layoutTop - offsetTop;
      const room = viewportH - top - DROPDOWN_GUTTER;
      const h = Math.max(0, Math.min(DROPDOWN_MAX_H, Math.round(room)));
      el.style.setProperty('--sp-dd-max', `${h}px`);
    };

    fitDropdown();
    window.addEventListener('resize', fitDropdown);
    window.addEventListener('scroll', fitDropdown, { passive: true });
    window.visualViewport?.addEventListener('resize', fitDropdown);
    window.visualViewport?.addEventListener('scroll', fitDropdown);
    return () => {
      window.removeEventListener('resize', fitDropdown);
      window.removeEventListener('scroll', fitDropdown);
      window.visualViewport?.removeEventListener('resize', fitDropdown);
      window.visualViewport?.removeEventListener('scroll', fitDropdown);
    };
    // Re-measure when the bar swaps into add-mode (its height changes) and
    // when the panel opens, which is when the number has to be right.
  }, [showSearchResults, addPhase]);

  /* ---- Cooldown bookkeeping ----
   *
   * We persist the last successful submission so a refresh doesn't bypass
   * the throttle. While a cooldown is active we tick `nowMs` once a second
   * so the button label can count down.
   */
  const cooldownRemaining = Math.max(
    0,
    Math.ceil((lastSent + COOLDOWN_MS - nowMs) / 1000),
  );
  const inCooldown = cooldownRemaining > 0;

  useEffect(() => {
    if (!inCooldown) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [inCooldown]);

  /* The create actions are part of the list the arrow keys walk: the indices
     at and past `results.length` address them (account page, then person).
     Mid-cooldown the primary is an inert countdown pill and the secondary is
     hidden, so there is nothing to walk into. */
  const showCreateActions = query.trim().length > 0;
  const createActionCount = showCreateActions && !inCooldown ? 2 : 0;
  const navCount = results.length + createActionCount;

  /* ---- Add-mode (inline) handlers ----
   *
   * `presetCompany` lets us pre-fill the company name from the user's
   * search query when they hit "Create page" in the empty-state CTA.
   */
  const enterAddMode = useCallback((presetCompany?: string, kind: AddKind = 'account') => {
    if (inCooldown) return;
    const stored = loadStoredEmail();
    setAddKind(kind);
    setAddPerson('');
    setAddCompany(presetCompany?.trim() || '');
    setAddError(null);
    setSubmitting(false);
    if (stored) {
      setAddEmail(stored);
      setAddPhase('company');
    } else {
      setAddEmail('');
      setAddPhase('email');
    }
  }, [inCooldown]);

  const exitAddMode = useCallback(() => {
    if (submitting) return;
    setAddPhase(null);
    setAddError(null);
  }, [submitting]);

  const submitAddEmail = useCallback(() => {
    const v = addEmail.trim();
    if (!isValidOptimizelyEmail(v)) {
      setAddError('Use your @optimizely.com email');
      return;
    }
    saveStoredEmail(v);
    setAddEmail(v);
    setAddError(null);
    setAddPhase('company');
  }, [addEmail]);

  const submitAddCompany = useCallback(async () => {
    const company = addCompany.trim();
    if (!company) {
      setAddError('Enter a company name');
      return;
    }
    if (company.length > MAX_COMPANY_NAME_LEN) {
      setAddError(`Keep it under ${MAX_COMPANY_NAME_LEN} characters`);
      return;
    }

    const email = (loadStoredEmail() || addEmail).trim();
    if (!isValidOptimizelyEmail(email)) {
      // Stored email got cleared / invalidated — fall back to email step.
      setAddEmail('');
      setAddPhase('email');
      setAddError('Use your @optimizely.com email');
      return;
    }

    // A person request needs one more field before it can go anywhere.
    if (addKind === 'person') {
      setAddError(null);
      setAddPhase('person');
      return;
    }

    setSubmitting(true);
    setAddError(null);
    try {
      const r = await fetch(CREATE_PAGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: company,
          edit_user_email: email,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const t = Date.now();
      setLastSent(t);
      setNowMs(t);
      writeLastSent(t);
      setAddPhase('sent');
      window.setTimeout(() => {
        setAddPhase(null);
        setAddError(null);
      }, 2400);
    } catch {
      setAddError("Couldn't reach Opal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [addCompany, addEmail, addKind]);

  const submitAddPerson = useCallback(async () => {
    const person = addPerson.trim();
    const company = addCompany.trim();
    if (!person) {
      setAddError("Enter the person's name");
      return;
    }
    const email = (loadStoredEmail() || addEmail).trim();
    if (!isValidOptimizelyEmail(email)) {
      setAddEmail('');
      setAddPhase('email');
      setAddError('Use your @optimizely.com email');
      return;
    }

    setSubmitting(true);
    setAddError(null);
    try {
      const r = await fetch(CREATE_PERSON_PAGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: company,
          person_name: person,
          edit_user_email: email,
        }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const t = Date.now();
      setLastSent(t);
      setNowMs(t);
      writeLastSent(t);
      setAddPhase('sent');
      window.setTimeout(() => {
        setAddPhase(null);
        setAddError(null);
      }, 2400);
    } catch {
      setAddError("Couldn't reach Opal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [addPerson, addCompany, addEmail]);

  /* ---- Focus the active add-mode input on phase change ---- */
  useEffect(() => {
    if (addPhase !== 'email' && addPhase !== 'company') return;
    if (emailEditOpen) return;
    const t = window.setTimeout(() => addInputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [addPhase, emailEditOpen]);

  /* ---- Email-edit popup handlers ---- */
  const openEmailEdit = useCallback(() => {
    setEmailEditDraft(addEmail);
    setEmailEditError(null);
    setEmailEditOpen(true);
  }, [addEmail]);

  const cancelEmailEdit = useCallback(() => {
    setEmailEditOpen(false);
    setEmailEditError(null);
  }, []);

  const submitEmailEdit = useCallback(() => {
    const v = emailEditDraft.trim();
    if (!isValidOptimizelyEmail(v)) {
      setEmailEditError('Use your @optimizely.com email');
      return;
    }
    saveStoredEmail(v);
    setAddEmail(v);
    setEmailEditOpen(false);
    setEmailEditError(null);
    setAddError(null);
  }, [emailEditDraft]);

  /* Focus the popup input when it opens. */
  useEffect(() => {
    if (!emailEditOpen) return;
    const t = window.setTimeout(() => emailEditRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [emailEditOpen]);

  /* ---- ESC closes the email popup first, otherwise exits add mode ---- */
  useEffect(() => {
    if (!addPhase && !emailEditOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (emailEditOpen) cancelEmailEdit();
      else exitAddMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addPhase, emailEditOpen, exitAddMode, cancelEmailEdit]);

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
            (focused && !addPhase ? ' search-page__searchwrap--focused' : '') +
            (addPhase ? ' search-page__searchwrap--add' : '')
          }
        >
          <div
            className={
              'search-page__search' +
              (addPhase ? ' search-page__search--add' : '') +
              (addPhase === 'sent' ? ' search-page__search--sent' : '')
            }
          >
            {!addPhase ? (
              <>
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
              </>
            ) : addPhase === 'sent' ? (
              <>
                <svg
                  className="search-page__icon search-page__icon--success"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                <div className="search-page__field">
                  <div className="search-page__add-status">
                    Sent to Opal — we'll ping you on Teams when <b>{addCompany.trim() || 'the page'}</b> is ready.
                  </div>
                </div>
              </>
            ) : (
              <>
                <svg
                  className="search-page__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {addPhase === 'email' ? (
                    <>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </>
                  ) : (
                    <>
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </>
                  )}
                </svg>

                <div className="search-page__field">
                  <input
                    key={addPhase}
                    ref={addInputRef}
                    className="search-page__input"
                    type={addPhase === 'email' ? 'email' : 'text'}
                    inputMode={addPhase === 'email' ? 'email' : 'text'}
                    autoComplete={addPhase === 'email' ? 'email' : 'organization'}
                    spellCheck={false}
                    maxLength={addPhase === 'company' ? MAX_COMPANY_NAME_LEN : undefined}
                    placeholder={
                      addPhase === 'email'
                        ? 'you@optimizely.com'
                        : addPhase === 'person'
                          ? `Who at ${addCompany || 'this company'}?`
                          : addKind === 'person'
                            ? 'Company they work at'
                            : 'Company name'
                    }
                    value={
                      addPhase === 'email'
                        ? addEmail
                        : addPhase === 'person'
                          ? addPerson
                          : addCompany
                    }
                    disabled={submitting}
                    onChange={(e) => {
                      if (addPhase === 'email') setAddEmail(e.target.value);
                      else if (addPhase === 'person') setAddPerson(e.target.value);
                      else setAddCompany(e.target.value);
                      if (addError) setAddError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (addPhase === 'email') submitAddEmail();
                        else if (addPhase === 'person') submitAddPerson();
                        else submitAddCompany();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        exitAddMode();
                      }
                    }}
                  />
                </div>

                <button
                  className="search-page__cancel"
                  type="button"
                  onClick={exitAddMode}
                  disabled={submitting}
                  aria-label="Cancel"
                >
                  Never mind…
                </button>

                <button
                  className="search-page__action search-page__action--add"
                  type="button"
                  disabled={
                    submitting ||
                    (addPhase === 'email' && !addEmail.trim()) ||
                    (addPhase === 'company' && !addCompany.trim())
                  }
                  onClick={() => {
                    if (addPhase === 'email') submitAddEmail();
                    else submitAddCompany();
                  }}
                >
                  {submitting ? (
                    <>
                      <span className="search-page__spinner" aria-hidden="true" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>{addPhase === 'email' ? 'Next' : 'Confirm'}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="M13 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          <div
            ref={dropdownRef}
            className={
              'search-page__dropdown' +
              (showSearchResults && !addPhase ? ' search-page__dropdown--open' : '')
            }
          >
            {results.length === 0 ? (
              <div className="search-page__empty">
                <div className="search-page__empty-line">
                  No match for <b>{query}</b>.
                </div>
                {query.trim() && (
                  <CreateActions
                    query={query}
                    inCooldown={inCooldown}
                    cooldownRemaining={cooldownRemaining}
                    baseIdx={0}
                    activeIdx={activeIdx}
                    onHover={setActiveIdx}
                    onPick={(kind) => enterAddMode(query, kind)}
                  />
                )}
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
                    data-nav-idx={i}
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
                {showCreateActions && (
                  <div className="search-page__create-footer">
                    <div className="search-page__create-footer-line">
                      Not seeing the right one?
                    </div>
                    <CreateActions
                      query={query}
                      inCooldown={inCooldown}
                      cooldownRemaining={cooldownRemaining}
                      baseIdx={results.length}
                      activeIdx={activeIdx}
                      onHover={setActiveIdx}
                      onPick={(kind) => enterAddMode(query, kind)}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {addPhase && addPhase !== 'sent' && (
            <div className="search-page__add-hint" role="status">
              {addError ? (
                <span className="search-page__add-hint--error">{addError}</span>
              ) : addPhase === 'email' ? (
                <span>We'll remember this and ping you on Teams when the page is ready.</span>
              ) : (
                <span>
                  Opal will build a fresh comparison page. Sending as{' '}
                  <button
                    type="button"
                    className="search-page__email-link"
                    onClick={openEmailEdit}
                    title="Click to change"
                  >
                    {addEmail}
                  </button>
                  .
                </span>
              )}
            </div>
          )}
        </div>

        {emailEditOpen && (
          <div
            className="search-page__email-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Update your email"
            onClick={cancelEmailEdit}
          >
            <div
              className="search-page__email-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="search-page__email-modal-title">Update email</h3>
              <p className="search-page__email-modal-sub">
                We'll use this address to ping you on Teams when the page is ready.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitEmailEdit();
                }}
              >
                <input
                  ref={emailEditRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className={
                    'search-page__email-modal-input' +
                    (emailEditError ? ' search-page__email-modal-input--error' : '')
                  }
                  value={emailEditDraft}
                  placeholder="you@optimizely.com"
                  onChange={(e) => {
                    setEmailEditDraft(e.target.value);
                    if (emailEditError) setEmailEditError(null);
                  }}
                />
                {emailEditError && (
                  <div className="search-page__email-modal-error">{emailEditError}</div>
                )}
                <div className="search-page__email-modal-actions">
                  <button
                    type="button"
                    className="search-page__email-modal-btn search-page__email-modal-btn--ghost"
                    onClick={cancelEmailEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="search-page__email-modal-btn search-page__email-modal-btn--primary"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!query && !addPhase && recentEntries.length > 0 && (
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
