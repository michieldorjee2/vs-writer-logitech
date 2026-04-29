import { useCallback, useEffect, useState } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import XrayMode from './XrayMode';
import EditMode from './EditMode';
import '../styles/floating-sidebar.css';

interface Props {
  page: CompetitorComparisonPage;
  /** Which default section registry to use when CMS hasn't set overrides. */
  variant: 'abm' | 'dynamic';
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
type Baseline = { key: string; published: string };

function readBaseline(): Baseline | null {
  try {
    const raw = localStorage.getItem(baselineKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Baseline>;
    if (!parsed?.key || !parsed?.published) return null;
    return { key: parsed.key, published: parsed.published };
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

/**
 * Booth-only floating action column rendered on top of the content page.
 *   • Back-to-search button: returns the visitor to /search.
 *   • X-ray toggle: reveals the per-section data overlay.
 *   • Edit toggle: opens feedback-collection mode so visitors can leave
 *     section-level comments routed to Opal. After feedback is sent,
 *     the button enters a "Working…" countdown — re-clicking surfaces
 *     a "still working" popup instead of letting them resubmit.
 *
 * Mounted by App.tsx ONLY when `?search=1` is present in the URL — the
 * caller owns that gate, so this component always renders both buttons.
 */
function FloatingSidebar({ page, variant }: Props) {
  const [xrayActive, setXrayActive] = useState(false);
  const [editActive, setEditActive] = useState(false);
  const [workingUntil, setWorkingUntil] = useState<number>(() => readWorkingUntil());
  const [now, setNow] = useState<number>(() => Date.now());
  const [showWorkingModal, setShowWorkingModal] = useState(false);
  /** Set when polling detects that Opal republished. Drives the
   *  celebratory "Your edits landed" toast and an early Working-state
   *  exit. Cleared when the user dismisses the toast. */
  const [editsLanded, setEditsLanded] = useState(false);

  const isWorking = workingUntil > now;
  const remaining = Math.max(0, workingUntil - now);
  const sidebarHidden = xrayActive || editActive;

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

  const handleEditClick = useCallback(() => {
    if (isWorking) {
      setShowWorkingModal(true);
      return;
    }
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
      writeBaseline({ key: meta.key, published: meta.published });
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
        const qs =
          'key=' + encodeURIComponent(baseline.key) +
          '&since=' + encodeURIComponent(baseline.published);
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
      <aside
        className={'xray-sidebar' + (sidebarHidden ? ' xray-sidebar--hidden' : '')}
        aria-label="Page tools"
        aria-hidden={sidebarHidden}
      >
        <button
          type="button"
          className="xray-sidebar__btn xray-sidebar__btn--back"
          onClick={handleBack}
          aria-label="Back to search"
          title="Back to search"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span className="xray-sidebar__label">Search</span>
        </button>

        <button
          type="button"
          className={
            'xray-sidebar__btn xray-sidebar__btn--xray' +
            (xrayActive ? ' xray-sidebar__btn--active' : '')
          }
          onClick={() => setXrayActive((v) => !v)}
          aria-pressed={xrayActive}
          aria-label={xrayActive ? 'Exit X-ray mode' : 'Enter X-ray mode'}
          title={xrayActive ? 'Exit X-ray' : 'X-ray this page'}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Four corner brackets framing a scan area */}
            <path d="M4 8V6a2 2 0 0 1 2-2h2" />
            <path d="M16 4h2a2 2 0 0 1 2 2v2" />
            <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
            <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
            {/* Laser sweep line */}
            <line className="xray-sidebar__scan-line" x1="6" y1="12" x2="18" y2="12" />
          </svg>
          <span className="xray-sidebar__label">X-ray</span>
        </button>

        <button
          type="button"
          className={
            'xray-sidebar__btn xray-sidebar__btn--edit' +
            (editActive ? ' xray-sidebar__btn--active' : '') +
            (isWorking ? ' xray-sidebar__btn--working' : '')
          }
          onClick={handleEditClick}
          aria-pressed={editActive}
          aria-label={
            isWorking
              ? `Opal is working on your edits — ${formatRemaining(remaining)} remaining`
              : (editActive ? 'Exit edit mode' : 'Enter edit mode')
          }
          title={isWorking ? 'Working on your edits' : (editActive ? 'Exit edit' : 'Edit this page')}
        >
          {isWorking ? (
            <span className="xray-sidebar__working-wrap" aria-hidden="true">
              {/* Progress ring shrinks toward zero as the timer runs out.
                  pathLength=100 keeps the dasharray-driven offset reading
                  as a simple percentage regardless of circumference. */}
              <svg className="xray-sidebar__ring" viewBox="0 0 36 36" width="32" height="32">
                <circle className="xray-sidebar__ring-track" cx="18" cy="18" r="16" />
                <circle
                  className="xray-sidebar__ring-fill"
                  cx="18"
                  cy="18"
                  r="16"
                  pathLength={100}
                  strokeDashoffset={100 - progressPct * 100}
                />
              </svg>
              <svg
                className="xray-sidebar__working-icon"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          )}
          <span className="xray-sidebar__label">
            {isWorking ? formatRemaining(remaining) : 'Edit'}
          </span>
        </button>
      </aside>

      <XrayMode
        active={xrayActive}
        onClose={() => setXrayActive(false)}
        page={page}
        variant={variant}
      />

      <EditMode
        active={editActive}
        onClose={() => setEditActive(false)}
        onSent={handleSent}
        page={page}
        variant={variant}
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
            <span>Opal just republished this page. Refresh to see them.</span>
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
              Opal is processing your previous feedback right now. You'll get a
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
