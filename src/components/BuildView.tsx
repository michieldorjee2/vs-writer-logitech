import { useEffect, useMemo, useRef, useState } from 'react';
import type { BuildDetail, BuildEvent } from '../lib/page-builds';
import { signInHref } from '../lib/auth';
import OptimizelyWordmark from './OptimizelyWordmark';
import '../styles/build-view.css';

/*
 * A page's own address while Mark builds it (server/ssr-handler.tsx serves this
 * instead of the page until the build is done): the steps of the run, Mark's
 * narration, reasoning and tool calls as they happen, and the page itself once
 * Mark has written it. When the build is done the address becomes the page:
 * this view reloads into it.
 */

const POLL_MS = 3000;
const POLL_HIDDEN_MS = 15000;

function ago(from: number, at: number): string {
  const s = Math.max(0, Math.round((at - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const ICONS: Record<string, string> = {
  get_learning: 'M5 4h10a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2V4Zm2 14h10M8 8h6M8 11h6',
  get_page: 'M7 3h7l4 4v14H7V3Zm7 0v4h4',
  list_page_templates: 'M4 5h16v4H4zM4 11h7v8H4zM13 11h7v8h-7z',
  browse_web: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  search_web: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM15.5 15.5 20 20',
  take_webpage_screenshot: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z',
  write_file_to_library: 'M12 16V4m0 0-4 4m4-4 4 4M5 20h14',
  create_page: 'M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4',
  update_page: 'M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4',
};
const ToolIcon = ({ tool }: { tool?: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d={ICONS[tool ?? ''] ?? 'M12 5v14M5 12h14'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Thought({ event }: { event: BuildEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className={'bv-thought' + (open ? ' is-open' : '')} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
      <span className="bv-thought__label">Thinking</span>
      <span className="bv-thought__text">{event.text}</span>
    </button>
  );
}

export default function BuildView({ buildId, route }: { buildId: string; route: string }) {
  const [build, setBuild] = useState<BuildDetail | null>(null);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const feedRef = useRef<HTMLOListElement | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function poll() {
      try {
        const r = await fetch(`/api/page-builds/${encodeURIComponent(buildId)}`, { cache: 'no-store' });
        if (r.status === 401) {
          window.location.replace(signInHref());
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const next = (await r.json()) as BuildDetail;
        if (cancelled) return;
        setBuild(next);
        setFailedToLoad(false);
        if (next.status === 'done' || next.status === 'failed') return;
      } catch {
        if (!cancelled) setFailedToLoad(true);
      }
      timer = window.setTimeout(poll, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
    }
    poll();
    const onVisible = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [buildId]);

  // Done: the address is the page now.
  useEffect(() => {
    if (build?.status !== 'done') return;
    const t = window.setTimeout(() => window.location.replace(`/${build.route}`), 2500);
    return () => window.clearTimeout(t);
  }, [build?.status, build?.route]);

  // Follow the feed as it grows, unless the reader has scrolled up to read.
  const events = useMemo(() => build?.events ?? [], [build]);
  useEffect(() => {
    const el = feedRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  /* The page so far, refreshed each time Mark writes to it. */
  const writes = useMemo(() => events.filter((e) => e.tool === 'create_page' || e.tool === 'update_page').length, [events]);
  const address = `showcase.optimizely.com/${build?.route ?? route}`;
  const pct = Math.round((build?.progress ?? 0.02) * 100);
  const state = build?.status ?? 'running';

  return (
    <main className="bv" data-state={state}>
      <header className="bv-top">
        <a className="bv-top__home" href="/search" aria-label="Optimizely Showcase search">
          <OptimizelyWordmark className="bv-top__logo" />
        </a>
        <a className="bv-top__back" href="/search">
          Back to search
        </a>
      </header>

      <section className="bv-hero" aria-live="polite">
        <p className="bv-eyebrow">
          {state === 'done' ? 'Ready' : state === 'failed' ? 'Mark could not build this page' : state === 'waiting' ? 'Waiting for the company page' : 'Mark is building'}
        </p>
        <h1 className="bv-title">{build?.name ?? 'This page'}</h1>
        <p className="bv-address">
          <span>{address}</span>
        </p>
        <div className="bv-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Build progress">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="bv-status">
          {state === 'failed' ? build?.error || build?.statusLine : state === 'done' ? 'Opening the page…' : build?.statusLine ?? 'Starting…'}
          {failedToLoad && state !== 'failed' && <span className="bv-status__warn"> · reconnecting</span>}
        </p>
      </section>

      <div className="bv-grid">
        <section className="bv-card bv-steps" aria-label="Steps">
          <h2>Steps</h2>
          <ol>
            {(build?.steps ?? []).map((s) => (
              <li key={s.id} className={`bv-step is-${s.status}`}>
                <span className="bv-step__dot" aria-hidden="true" />
                <span className="bv-step__label">{s.label}</span>
                {s.startedAt && s.endedAt && <span className="bv-step__time">{ago(s.startedAt, s.endedAt)}</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="bv-card bv-feed" aria-label="What Mark is doing">
          <h2>What Mark is doing</h2>
          {events.length === 0 ? (
            <p className="bv-empty">{state === 'waiting' ? 'Starts when the company page is ready.' : 'Mark is getting started…'}</p>
          ) : (
            <ol
              ref={feedRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
              }}
            >
              {events.map((e) => (
                <li key={e.seq} className={`bv-event is-${e.kind}`}>
                  <span className="bv-event__time">{ago(build?.startedAt ?? e.at, e.at)}</span>
                  {e.kind === 'tool' ? (
                    <span className="bv-tool">
                      <ToolIcon tool={e.tool} />
                      {e.text}
                    </span>
                  ) : e.kind === 'thinking' ? (
                    <Thought event={e} />
                  ) : (
                    <p className="bv-say">{e.text}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {build?.pageWritten && (
        <section className="bv-card bv-preview" aria-label="The page so far">
          <h2>The page so far</h2>
          <div className="bv-preview__frame">
            <iframe key={writes} title={`${build.name}: the page so far`} src={`/${build.route}?view=page&w=${writes}`} loading="lazy" />
          </div>
        </section>
      )}
    </main>
  );
}
