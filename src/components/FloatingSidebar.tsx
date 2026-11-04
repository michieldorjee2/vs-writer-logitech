import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import { useAuth, type Identity } from '../lib/auth';
import { pageKey } from '../lib/page-activity';
import { usePageActivity, type ActivityLoad } from '../hooks/usePageActivity';
import XrayMode from './XrayMode';
import ActivityMode from './ActivityMode';
import EditMode from './EditMode';
import '../styles/floating-sidebar.css';
import '../styles/booth-rail.css';

interface Props {
  page: CompetitorComparisonPage;
  /** Which default section registry to use when CMS hasn't set overrides. */
  variant: 'abm' | 'person';
}

/* ------------ "Working…" countdown helpers ------------
 *
 * After the user hits Send Feedback, Opal needs ~a few minutes to
 * process. We disable resubmission for that window so booth visitors
 * don't pile up overlapping requests. The expiry is per-slug and
 * persisted to localStorage so it survives reloads / tab switches.
 *
 * Alongside the timer we poll /api/edit-status for the page's
 * `published` timestamp. When it moves past the baseline we captured
 * at submit time, the lockout drops early and we show a "Your edits
 * landed" toast.
 */
const WORKING_DURATION_MS = 3 * 60 * 1000;
const WORKING_KEY_PREFIX = 'opti.editmode.working.';
const BASELINE_KEY_PREFIX = 'opti.editmode.baseline.';
/** Polls don't start immediately — the first ~25s the AI is still
 *  reading the request, so polling earlier just wastes calls. */
const POLL_INITIAL_DELAY_MS = 25_000;
const POLL_INTERVAL_MS = 15_000;

function workingKey(): string {
  // The slug here is the visible URL — same key whether the visitor
  // refreshes or re-opens the tab from the search page.
  return WORKING_KEY_PREFIX + window.location.pathname;
}

function baselineKey(): string {
  return BASELINE_KEY_PREFIX + window.location.pathname;
}

/** Polling needs both the CMS content key (so we can ask Graph for
 *  *this* exact piece of content regardless of slug shape) and the
 *  baseline `published` timestamp to compare against. We persist
 *  them together as JSON. */
type Baseline = { key: string; published: string; lastModified?: string | null };

function readBaseline(): Baseline | null {
  try {
    const raw = localStorage.getItem(baselineKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Baseline>;
    if (!parsed?.key || !parsed?.published) return null;
    return { key: parsed.key, published: parsed.published, lastModified: parsed.lastModified ?? null };
  } catch {
    return null;
  }
}

function writeBaseline(v: Baseline): void {
  try { localStorage.setItem(baselineKey(), JSON.stringify(v)); } catch { /* ignore */ }
}

function clearBaseline(): void {
  try { localStorage.removeItem(baselineKey()); } catch { /* ignore */ }
}

function readWorkingUntil(): number {
  try {
    const raw = localStorage.getItem(workingKey());
    if (!raw) return 0;
    const t = parseInt(raw, 10);
    if (!Number.isFinite(t) || t <= Date.now()) {
      localStorage.removeItem(workingKey());
      return 0;
    }
    return t;
  } catch {
    return 0;
  }
}

function writeWorkingUntil(t: number): void {
  try { localStorage.setItem(workingKey(), String(t)); } catch { /* ignore */ }
}

function clearWorking(): void {
  try { localStorage.removeItem(workingKey()); } catch { /* ignore */ }
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** This page as a visitor sees it: the same URL without the booth flag. */
function livePageHref(): string {
  const u = new URL(window.location.href);
  u.searchParams.delete('search');
  return u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '') + u.hash;
}

/** Long enough to read the alert's two lines before the page moves. */
const REDIRECT_DELAY_MS = 5000;

/**
 * Mounted by App.tsx ONLY when `?search=1` is present in the URL — the
 * caller owns that gate.
 *
 * `?search=1` is the employee link, and a link travels: an employee copies
 * the address bar into an email and a prospect opens the employee URL. So
 * the tools mount only for someone signed in with Optimizely
 * (src/lib/auth.ts). Anyone else is told what this link is and moved to the
 * public URL, so the address they copy next is the one to share. Getting
 * the tools back is the search page's job: it signs the employee in.
 *
 * Nothing renders while /api/auth/me is answering, so neither a signed-in
 * rep nor a prospect sees the other's version flash.
 */
function FloatingSidebar({ page, variant }: Props) {
  const auth = useAuth();
  if (auth.status === 'signed-in') return <BoothTools page={page} variant={variant} identity={auth.identity} />;
  if (auth.status === 'signed-out') return <EmployeeLinkRedirect />;
  return null;
}

/**
 * The signed-out half: a short alert, then the same page at its public URL.
 * A client-side replace, not a reload: the page on screen is already the
 * public page, so only the address and the history entry need to change —
 * and once `?search=1` is gone, App.tsx unmounts this component.
 */
function EmployeeLinkRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setTimeout(() => navigate(livePageHref(), { replace: true }), REDIRECT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [navigate]);

  return (
    <div
      className="employee-link-alert"
      role="alert"
      style={{ '--employee-link-delay': `${REDIRECT_DELAY_MS}ms` } as CSSProperties}
    >
      <span className="employee-link-alert__icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </span>
      <div className="employee-link-alert__copy">
        <strong>You&rsquo;re viewing the employee URL</strong>
        <span>
          Redirecting you to the public version of this page. Employees: sign in from the search page to use the page tools.
        </span>
      </div>
      <span className="employee-link-alert__timer" aria-hidden="true" />
    </div>
  );
}

/** The rail folded away stays folded on the next page (this browser only). */
const RAIL_KEY = 'opti.booth.rail';
function readRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === 'collapsed';
  } catch {
    return false;
  }
}
function writeRailCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(RAIL_KEY, 'collapsed');
    else localStorage.removeItem(RAIL_KEY);
  } catch {
    /* private window: the rail just opens again next time */
  }
}

/** Puts the public address on the clipboard, with the old copy route for browsers that refuse. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

type ReportState = 'loading' | 'ready' | 'empty' | 'error';
function reportState(load: ActivityLoad): ReportState {
  if (load.state !== 'ready') return load.state;
  return load.data.report.visitors.visits > 0 ? 'ready' : 'empty';
}

/**
 * The Report glyph: a wave while the page's data loads, bars once it is in (lime when the page has
 * visits, quiet when it has none), the wave held still if ODP did not answer.
 */
function ReportIcon({ state }: { state: ReportState }) {
  return (
    <svg className={`booth-report-icon is-${state}`} viewBox="0 0 20 20" width="20" height="20" fill="none" strokeWidth="1.67" strokeLinecap="round" aria-hidden="true">
      <path
        className="booth-report-icon__wave"
        d="M15.83 10C15.83 10 14.42 11.5 12.92 11.5C11.42 11.5 10 10 10 10C10 10 8.58 8.5 7.08 8.5C5.58 8.5 4.17 10 4.17 10"
        stroke="currentColor"
        strokeLinejoin="round"
      />
      <path className="booth-report-icon__bar" style={{ '--b': 0 } as CSSProperties} d="M3.84 16.17V13.84" />
      <path className="booth-report-icon__bar" style={{ '--b': 1 } as CSSProperties} d="M7.84 16.17V10.84" />
      <path className="booth-report-icon__bar" style={{ '--b': 2 } as CSSProperties} d="M11.84 16.17V7.84" />
      <path className="booth-report-icon__bar booth-report-icon__bar--rest" style={{ '--b': 3 } as CSSProperties} d="M15.84 16.17V3.84" />
    </svg>
  );
}

/** The folded-rail glyph (the rail's own collapse button). */
function PanelIcon() {
  return (
    <svg viewBox="26 978 20 20" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M28.2113 998C27.6113 998 27.0927 997.781 26.6556 997.344C26.2185 996.907 26 996.389 26 995.789V980.211C26 979.611 26.2185 979.093 26.6556 978.656C27.0927 978.219 27.6113 978 28.2113 978H43.7887C44.3887 978 44.9073 978.219 45.3444 978.656C45.7815 979.093 46 979.611 46 980.211V995.789C46 996.389 45.7815 996.907 45.3444 997.344C44.9073 997.781 44.3887 998 43.7887 998H28.2113ZM36 996.129H43.7887C43.874 996.129 43.9521 996.094 44.0231 996.023C44.094 995.952 44.1294 995.874 44.1294 995.789V980.211C44.1294 980.126 44.094 980.048 44.0231 979.977C43.9521 979.906 43.874 979.871 43.7887 979.871H36V996.129Z"
      />
    </svg>
  );
}

interface RailButtonProps {
  i: number;
  label: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  modifier: string;
  pressed?: boolean;
  on?: boolean;
}

function RailButton({ i, label, icon, onClick, ariaLabel, modifier, pressed, on }: RailButtonProps) {
  return (
    <button
      type="button"
      className={`booth-rail__btn booth-rail__btn--${modifier}` + (on ? ' is-on' : '')}
      style={{ '--i': i } as CSSProperties}
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="booth-rail__icon">{icon}</span>
      <span className="booth-rail__label">{label}</span>
    </button>
  );
}

/**
 * The booth rail: a full-height column down the left, the page set in beside it with rounded
 * corners, in the search page's surfaces (search-home.css: Axiom tokens, light or dark with the
 * system). Top to bottom:
 *   • Search: back to /search.
 *   • Edit: feedback mode, routed to Mark. After feedback is sent the button counts down
 *     ("Working…"); pressing it then explains instead of letting them resubmit.
 *   • X-ray: the per-section data overlay.
 *   • Share: copies the page's public address (without ?search=1).
 *   • Report (account pages): the page's story from ODP. Its data loads as the rail mounts; the
 *     icon waves until it is in, then turns to bars.
 * The button at the foot folds the rail away; a single Report button stays at the bottom left to
 * bring it back. The rail slides, its buttons cascade in from the left. X-ray and Edit take the
 * whole screen, so the rail steps aside while they run.
 *
 * Rendered only for a signed-in employee (see FloatingSidebar above). The
 * routes behind the tools check the session themselves; mounting the
 * buttons only for a session is the courtesy, not the enforcement.
 */
function BoothTools({ page, variant, identity }: Props & { identity: Identity }) {
  const [xrayActive, setXrayActive] = useState(false);
  const [editActive, setEditActive] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => readRailCollapsed());
  /** False for the first frame, so the rail slides in and its buttons cascade on arrival. */
  const [entered, setEntered] = useState(false);
  const [shared, setShared] = useState<'idle' | 'copied' | 'failed'>('idle');
  const sharedTimer = useRef<number | undefined>(undefined);
  const hasReport = variant === 'abm';
  const reportPage = useMemo(() => (typeof window === 'undefined' ? '' : pageKey(window.location.pathname)), []);
  const { load, retry } = usePageActivity(reportPage, hasReport);
  const report = reportState(load);
  const [workingUntil, setWorkingUntil] = useState<number>(() => readWorkingUntil());
  const [now, setNow] = useState<number>(() => Date.now());
  const [showWorkingModal, setShowWorkingModal] = useState(false);
  /** Set when polling detects that Opal republished. Drives the
   *  celebratory "Your edits landed" toast and an early Working-state
   *  exit. Cleared when the user dismisses the toast. */
  const [editsLanded, setEditsLanded] = useState(false);

  const isWorking = workingUntil > now;
  const remaining = Math.max(0, workingUntil - now);
  const modeTakesScreen = xrayActive || editActive;
  const railShown = entered && !collapsed && !modeTakesScreen;
  const miniShown = entered && collapsed && !modeTakesScreen;

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* The page moves over for the rail (booth-rail.css); the class lives on <html> so the page's
   * own fixed parts can follow it. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('booth-page');
    root.classList.toggle('booth-page--rail', railShown);
    return () => root.classList.remove('booth-page', 'booth-page--rail');
  }, [railShown]);

  useEffect(() => () => window.clearTimeout(sharedTimer.current), []);

  /* Strip the `?refresh=…` cache-buster the toast Refresh button
   * appends so the address bar doesn't keep the timestamp once the
   * visitor has landed. By the time React mounts, the response is
   * already in the tab — so it's safe to clean up the URL without
   * affecting cache routing. */
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.has('refresh')) {
      u.searchParams.delete('refresh');
      const cleanUrl =
        u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '') + u.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  /* Tick every second while the working window is open. We avoid a
   * permanent interval — the timer only runs when there's something
   * to count down. */
  useEffect(() => {
    if (!isWorking) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= workingUntil) {
        clearWorking();
        setWorkingUntil(0);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isWorking, workingUntil]);

  const handleBack = useCallback(() => {
    if (document.referrer && document.referrer.includes('/search')) {
      window.history.back();
    } else {
      window.location.href = '/search';
    }
  }, []);

  const handleXrayClick = useCallback(() => {
    setReportOpen(false);
    setXrayActive((v) => !v);
  }, []);

  const handleReportClick = useCallback(() => setReportOpen((v) => !v), []);
  const closeReport = useCallback(() => setReportOpen(false), []);

  const handleShareClick = useCallback(() => {
    void copyText(window.location.origin + livePageHref()).then((ok) => {
      setShared(ok ? 'copied' : 'failed');
      window.clearTimeout(sharedTimer.current);
      sharedTimer.current = window.setTimeout(() => setShared('idle'), 1800);
    });
  }, []);

  const collapseRail = useCallback(() => {
    setCollapsed(true);
    writeRailCollapsed(true);
  }, []);
  const expandRail = useCallback(() => {
    setCollapsed(false);
    writeRailCollapsed(false);
  }, []);

  const handleEditClick = useCallback(() => {
    if (isWorking) {
      setShowWorkingModal(true);
      return;
    }
    setReportOpen(false);
    setEditActive((v) => !v);
  }, [isWorking]);

  /* Called by EditMode after the webhook resolves. Latches the
   * Working… timer for WORKING_DURATION_MS from now and snapshots
   * the page key + current `published` as the baseline polling will
   * compare against. */
  const handleSent = useCallback(() => {
    const until = Date.now() + WORKING_DURATION_MS;
    writeWorkingUntil(until);
    setWorkingUntil(until);
    setNow(Date.now());
    const meta = page._metadata;
    if (meta?.key && meta?.published) {
      writeBaseline({ key: meta.key, published: meta.published, lastModified: meta.lastModified ?? null });
    }
    setEditsLanded(false);
  }, [page]);

  /* Polling loop: while the Working window is open, hit
   * /api/edit-status by content key (stable across slug shapes) and
   * compare the returned `published` against the baseline we
   * captured at submit time. First poll waits POLL_INITIAL_DELAY_MS
   * so we don't spam Graph during the AI's first read. */
  useEffect(() => {
    if (!isWorking) return;
    const baseline = readBaseline();
    if (!baseline) return; // submit happened on a different visit / device

    let canceled = false;
    let intervalId: number | null = null;

    const poll = async () => {
      try {
        // lastModified moves on every save; published only on the first publish.
        const qs =
          'key=' + encodeURIComponent(baseline.key) +
          (baseline.lastModified
            ? '&modifiedSince=' + encodeURIComponent(baseline.lastModified)
            : '&since=' + encodeURIComponent(baseline.published));
        const res = await fetch('/api/edit-status?' + qs, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { changed?: boolean };
        if (canceled || !data?.changed) return;
        // The endpoint already purged the Vercel edge cache for this
        // page's Cache-Tag, so a plain reload below will hit fresh
        // HTML on the first try.
        clearWorking();
        clearBaseline();
        setWorkingUntil(0);
        setEditsLanded(true);
        setShowWorkingModal(false);
      } catch {
        /* network blip — try again next interval */
      }
    };

    const timeoutId = window.setTimeout(() => {
      if (canceled) return;
      poll();
      intervalId = window.setInterval(poll, POLL_INTERVAL_MS);
    }, POLL_INITIAL_DELAY_MS);

    return () => {
      canceled = true;
      window.clearTimeout(timeoutId);
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [isWorking]);

  /* Progress ring fraction — full at start, empty when the timer
   * runs out. Strokes the working button with a dwindling halo. */
  const progressPct = isWorking ? remaining / WORKING_DURATION_MS : 0;

  return (
    <>
      <nav
        className={'booth-rail' + (railShown ? ' is-open' : '')}
        aria-label="Page tools"
        inert={!railShown}
        style={{ '--n': hasReport ? 6 : 5 } as CSSProperties}
      >
        <div className="booth-rail__items">
          <RailButton
            i={0}
            modifier="back"
            onClick={handleBack}
            ariaLabel="Back to search"
            label="Search"
            icon={
              <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15.83 10H4.17" />
                <path d="M10 15.83L4.17 10L10 4.17" />
              </svg>
            }
          />
          <RailButton
            i={1}
            modifier={isWorking ? 'edit is-working' : 'edit'}
            onClick={handleEditClick}
            pressed={editActive}
            on={editActive}
            ariaLabel={isWorking ? `Mark is working on your edits, ${formatRemaining(remaining)} left` : editActive ? 'Exit edit mode' : 'Edit this page'}
            label={isWorking ? formatRemaining(remaining) : 'Edit'}
            icon={
              isWorking ? (
                <span className="booth-rail__working" aria-hidden="true">
                  {/* The ring empties as the timer runs out; pathLength=100 makes the offset a percentage. */}
                  <svg className="booth-rail__ring" viewBox="0 0 36 36" width="26" height="26">
                    <circle className="booth-rail__ring-track" cx="18" cy="18" r="16" />
                    <circle className="booth-rail__ring-fill" cx="18" cy="18" r="16" pathLength={100} strokeDashoffset={100 - progressPct * 100} />
                  </svg>
                </span>
              ) : (
                <svg viewBox="27.5 64.5 20 20" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M31.5217 82C31.1088 82 30.752 81.8499 30.4512 81.5496C30.1504 81.2494 30 80.8931 30 80.481V69.7801C30 69.3679 30.1504 69.0117 30.4512 68.7114C30.752 68.4112 31.1088 68.261 31.5217 68.261H37.259C37.4757 68.261 37.6382 68.3282 37.7465 68.4624C37.8548 68.5966 37.909 68.7432 37.909 68.9023C37.909 69.0615 37.8543 69.2086 37.7448 69.3436C37.6354 69.4785 37.4785 69.546 37.2742 69.546H31.5217C31.463 69.546 31.4093 69.5704 31.3604 69.619C31.3116 69.6678 31.2872 69.7215 31.2872 69.7801V80.481C31.2872 80.5395 31.3116 80.5932 31.3604 80.642C31.4093 80.6907 31.463 80.715 31.5217 80.715H42.2413C42.3 80.715 42.3538 80.6907 42.4026 80.642C42.4514 80.5932 42.4758 80.5395 42.4758 80.481V74.6889C42.4758 74.4725 42.5438 74.3103 42.6798 74.2022C42.8156 74.0941 42.9641 74.04 43.1252 74.04C43.2832 74.04 43.429 74.0941 43.5627 74.2022C43.6962 74.3103 43.763 74.4725 43.763 74.6889V80.481C43.763 80.8931 43.6126 81.2494 43.3119 81.5496C43.0111 81.8499 42.6542 82 42.2413 82H31.5217ZM34.8184 76.437V74.975C34.8184 74.7673 34.8575 74.5689 34.9357 74.3799C35.014 74.1908 35.1279 74.0265 35.2774 73.887L41.8107 67.365C41.9322 67.2354 42.0698 67.1421 42.2234 67.0852C42.3771 67.0284 42.5332 67 42.6918 67C42.86 67 43.024 67.0329 43.1837 67.0987C43.3433 67.1645 43.4908 67.2572 43.6263 67.3768L44.6107 68.3692C44.7412 68.5018 44.8388 68.6471 44.9033 68.8052C44.9678 68.9633 45 69.1262 45 69.2938C45 69.4612 44.9679 69.623 44.9036 69.7793C44.8394 69.9355 44.7445 70.0784 44.6191 70.208L38.0907 76.7518C37.9471 76.893 37.7812 77.0013 37.593 77.0767C37.4049 77.1523 37.2074 77.1901 37.0007 77.1901H35.5727C35.3645 77.1901 35.1867 77.1165 35.0393 76.9695C34.892 76.8224 34.8184 76.6449 34.8184 76.437ZM36.1056 75.9051H37.0969L41.886 71.1434L41.3824 70.6375L40.861 70.128L36.1056 74.8672V75.9051Z"
                  />
                </svg>
              )
            }
          />
          <RailButton
            i={2}
            modifier="xray"
            onClick={handleXrayClick}
            pressed={xrayActive}
            on={xrayActive}
            ariaLabel={xrayActive ? 'Exit X-ray' : 'X-ray this page'}
            label="X-ray"
            icon={
              <svg viewBox="27 111 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M30.3335 117.667V116C30.3335 115.558 30.5091 115.134 30.8217 114.822C31.1342 114.509 31.5581 114.333 32.0002 114.333H33.6668" />
                <path d="M40.3335 114.333H42.0002C42.4422 114.333 42.8661 114.509 43.1787 114.822C43.4912 115.134 43.6668 115.558 43.6668 116V117.667" />
                <path d="M43.6668 124.333V126C43.6668 126.442 43.4912 126.866 43.1787 127.179C42.8661 127.491 42.4422 127.667 42.0002 127.667H40.3335" />
                <path d="M33.6668 127.667H32.0002C31.5581 127.667 31.1342 127.491 30.8217 127.179C30.5091 126.866 30.3335 126.442 30.3335 126V124.333" />
                <path className="booth-rail__scan" d="M32 121H42" />
              </svg>
            }
          />
          <RailButton
            i={3}
            modifier={'share' + (shared !== 'idle' ? ` is-${shared}` : '')}
            onClick={handleShareClick}
            ariaLabel={shared === 'copied' ? 'Public link copied' : shared === 'failed' ? 'Could not copy the link' : 'Copy the public link'}
            label={shared === 'copied' ? 'Copied' : shared === 'failed' ? 'No access' : 'Share'}
            icon={
              shared === 'copied' ? (
                <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                </svg>
              ) : (
                <svg viewBox="27 157.5 20 20" width="20" height="20" aria-hidden="true">
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M36.249 162.236L33.7746 164.667C33.4793 164.957 33.004 164.953 32.7143 164.657C32.4239 164.362 32.4281 163.887 32.7234 163.597L35.9481 160.43C36.5317 159.857 37.4676 159.857 38.0513 160.43L41.2759 163.597C41.5712 163.887 41.5755 164.362 41.285 164.657C40.9946 164.953 40.5193 164.957 40.2247 164.667L37.7503 162.236V169.753C37.7503 170.167 37.4142 170.503 37 170.503C36.5859 170.503 36.2498 170.167 36.2498 169.753V162.236H36.249ZM34.7492 166.759C34.7492 166.958 34.6697 167.149 34.5284 167.29C34.387 167.43 34.1951 167.509 33.9961 167.508L33.2494 167.505C33.0504 167.505 32.8598 167.584 32.7192 167.724C32.5786 167.865 32.4998 168.056 32.4998 168.254V172.751C32.4998 173.165 32.8352 173.5 33.2501 173.5H40.7506C41.1648 173.5 41.5002 173.165 41.5002 172.751V168.254C41.5002 168.055 41.4214 167.865 41.2808 167.724C41.1401 167.584 40.9489 167.505 40.7506 167.505H40.0053C39.8056 167.505 39.6136 167.425 39.473 167.284C39.3323 167.142 39.2536 166.95 39.255 166.75C39.2578 166.338 39.5925 166.005 40.0046 166.005H40.7499C41.3469 166.005 41.9193 166.242 42.3411 166.664C42.763 167.085 43 167.657 43 168.254V172.751C43 173.993 41.9924 175 40.7499 175H33.2501C32.0076 175 31 173.993 31 172.751V168.254C31 167.657 31.237 167.085 31.6589 166.664C32.0808 166.242 32.6531 166.005 33.2501 166.005L34.0018 166.007C34.4152 166.007 34.7499 166.343 34.7499 166.756V166.758L34.7492 166.759Z"
                  />
                </svg>
              )
            }
          />
          {hasReport && (
            <RailButton
              i={4}
              modifier="report"
              onClick={handleReportClick}
              pressed={reportOpen}
              on={reportOpen}
              ariaLabel={report === 'loading' ? 'Report (loading)' : reportOpen ? 'Close the report' : 'Open the report'}
              label="Report"
              icon={<ReportIcon state={report} />}
            />
          )}
        </div>
        <button
          type="button"
          className="booth-rail__fold"
          style={{ '--i': hasReport ? 5 : 4 } as CSSProperties}
          onClick={collapseRail}
          aria-label="Hide the tools"
          title="Hide the tools"
        >
          <PanelIcon />
        </button>
      </nav>

      <button
        type="button"
        className={'booth-rail-mini' + (miniShown ? ' is-shown' : '')}
        onClick={expandRail}
        inert={!miniShown}
        aria-label="Show the tools"
        title="Show the tools"
      >
        {hasReport ? <ReportIcon state={report} /> : <PanelIcon />}
      </button>

      <XrayMode
        active={xrayActive}
        onClose={() => setXrayActive(false)}
        page={page}
        variant={variant}
      />

      {hasReport && <ActivityMode open={reportOpen} onClose={closeReport} load={load} retry={retry} />}

      <EditMode
        active={editActive}
        onClose={() => setEditActive(false)}
        onSent={handleSent}
        page={page}
        variant={variant}
        editorEmail={identity.email}
      />

      {editsLanded && (
        <div
          className="edit-landed-toast"
          role="status"
          aria-live="polite"
        >
          <div className="edit-landed-toast__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className="edit-landed-toast__copy">
            <strong>Your edits are live</strong>
            <span>Mark just republished this page. Refresh to see them.</span>
          </div>
          <div className="edit-landed-toast__actions">
            <button
              type="button"
              className="edit-landed-toast__btn"
              onClick={() => {
                /* Belt and braces with the server-side Cache-Tag
                 * purge: that's eventually consistent (Vercel's
                 * tag eviction can lag 30s+), but THIS click needs
                 * to land on fresh HTML the very first time. A
                 * unique `?refresh=…` query param routes to a
                 * separate edge cache key — guaranteed miss → fresh
                 * SSR fetch from Graph. The param is stripped from
                 * the address bar after mount via history.replaceState. */
                const u = new URL(window.location.href);
                u.searchParams.set('refresh', String(Date.now()));
                window.location.href = u.toString();
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              className="edit-landed-toast__close"
              onClick={() => setEditsLanded(false)}
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {showWorkingModal && (
        <div
          className="edit-working-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-working-title"
          onClick={() => setShowWorkingModal(false)}
        >
          <div
            className="edit-working-modal__card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="edit-working-modal__close"
              onClick={() => setShowWorkingModal(false)}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="edit-working-modal__icon" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <h3 id="edit-working-title" className="edit-working-modal__title">
              Still working on it
            </h3>
            <p className="edit-working-modal__sub">
              Mark is processing your previous feedback right now. You'll get a
              Teams message as soon as the changes are ready.
            </p>
            <div className="edit-working-modal__chip" aria-hidden="true">
              <span className="edit-working-modal__chip-dot" />
              {formatRemaining(remaining)} estimated
            </div>
            <div className="edit-working-modal__actions">
              <button
                type="button"
                className="edit-working-modal__btn"
                onClick={() => setShowWorkingModal(false)}
              >
                OK, got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingSidebar;
