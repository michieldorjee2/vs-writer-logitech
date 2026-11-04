import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ACTIVITY_RANGES,
  pageKey,
  type ActivityRange,
  type AudienceReport,
  type ElementStat,
  type ActivityResponse,
  type DealSummary,
  type HistoryMark,
} from '../lib/page-activity';
import { buttonWords, resolveElement } from '../lib/activity-dom';
import '../styles/activity-mode.css';

/**
 * Activity mode: the page's own analytics, drawn on the page. Booth-only, like X-ray and Edit
 * (FloatingSidebar mounts it for signed-in employees). Data: GET /api/page-activity, read from ODP.
 *
 * On the page: each scene's reach (share of visitors who saw it, against the account-page
 * average), and every clicked element outlined with its click count and a heat glow. Clicks on
 * things that are not links or buttons are marked apart. In the panel: the numbers, the visits
 * over time with the page's history on them, CTAs, sources, networks (the account's own network
 * marked), where and on what, and the account's Salesforce opportunities.
 *
 * Positions are measured live in a rAF loop and written straight to the DOM, as X-ray does: the
 * www page keeps moving (reveals, parallax, the sticky bar), and React re-rendering every frame
 * would cost more than the page.
 */

interface Props {
  active: boolean;
  onClose: () => void;
}

type Audience = 'visitors' | 'everyone';
type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: ActivityResponse };

const RANGE_LABEL: Record<ActivityRange, string> = { '7d': '7D', '30d': '30D', '90d': '90D', all: 'All' };
const CONNECT_IDS: Record<string, string> = { hero: 'hero-connect-btn', sticky: 'sticky-connect-btn', close: 'cta-connect-btn' };

// ─── Formatting ──────────────────────────────────────────────────────────────

function duration(sec: number | null): string {
  if (sec === null) return '–';
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

function ago(ts: number | null, now: number): string {
  if (!ts) return '–';
  const d = Math.max(0, now - ts);
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))}m`;
  if (d < 86400) return `${Math.round(d / 3600)}h`;
  return `${Math.round(d / 86400)}d`;
}

function day(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  } catch {
    return `${Math.round(amount / 1000)}K ${currency}`;
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function delta(value: number, bench: number | undefined | null, unit: 'pts' | 'sec'): { text: string; dir: 'up' | 'down' | 'flat' } | null {
  if (bench === undefined || bench === null) return null;
  const d = unit === 'pts' ? Math.round((value - bench) * 100) : Math.round(value - bench);
  if (d === 0) return { text: '±0', dir: 'flat' };
  return { text: `${d > 0 ? '+' : '−'}${Math.abs(d)}${unit === 'sec' ? 's' : ''}`, dir: d > 0 ? 'up' : 'down' };
}

interface Marked {
  id: string;
  el: Element;
  clicks: number;
  visitors: number;
  rage: number;
  last: number;
  dead: boolean;
  cta: boolean;
}

/**
 * Every element to mark, with its counts. ODP's tag records each click on the element itself; our
 * CTA events (older than the tag on some pages) record buttons by label and position. A button
 * counted both ways shows the larger count, never the sum: it is the same click.
 */
function markedElements(r: AudienceReport): Marked[] {
  const byEl = new Map<Element, Marked>();
  let n = 0;
  const put = (el: Element | null, s: Partial<Marked> & { clicks: number }, cta: boolean) => {
    if (!el) return;
    const cur = byEl.get(el);
    if (cur) {
      if (s.clicks > cur.clicks) Object.assign(cur, { clicks: s.clicks, visitors: Math.max(cur.visitors, s.visitors ?? 0) });
      cur.cta ||= cta;
      cur.dead &&= Boolean(s.dead);
      cur.rage += s.rage ?? 0;
      cur.last = Math.max(cur.last, s.last ?? 0);
      return;
    }
    byEl.set(el, { id: `a${n++}`, el, clicks: s.clicks, visitors: s.visitors ?? 0, rage: s.rage ?? 0, last: s.last ?? 0, dead: Boolean(s.dead), cta });
  };
  for (const e of r.elements as ElementStat[]) {
    const el = resolveElement(e.segments);
    // A click on the text inside a button is a click on the button.
    const target = el?.closest('a, button') ?? el;
    put(target, { clicks: e.clicks, visitors: e.visitors, rage: e.rage, last: e.last, dead: e.dead && !el?.closest('a, button') }, false);
  }
  const buttons = Array.from(document.querySelectorAll('#main-content a[class*="btn"], #main-content button[class*="btn"], .www-sticky button, .www-sticky a'));
  for (const c of r.ctas) {
    const el =
      (c.type === 'connect' && c.position && document.getElementById(CONNECT_IDS[c.position] ?? '')) ||
      (c.label ? buttons.find((b) => buttonWords(b) === c.label.toLowerCase()) : undefined) ||
      null;
    put(el, { clicks: c.clicks, visitors: c.visitors, last: c.last }, true);
  }
  return [...byEl.values()].sort((a, b) => b.clicks - a.clicks);
}

interface Scene {
  id: string;
  el: HTMLElement;
  name: string;
}

function scenesOnPage(): Scene[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#main-content > section[id]')).map((el) => ({
    id: el.id,
    el,
    name: el.id === 'hero' ? 'Hero' : (el.querySelector('.www-eyebrow')?.textContent?.trim() || el.id),
  }));
}

// ─── Data ────────────────────────────────────────────────────────────────────

function useActivity(page: string, range: ActivityRange, active: boolean) {
  const [loads, setLoads] = useState<Record<string, Load>>({});
  const inflight = useRef(new Set<string>());
  const fetchRange = useCallback(
    (r: ActivityRange, fresh: boolean) => {
      if (inflight.current.has(r)) return;
      inflight.current.add(r);
      fetch(`/api/page-activity?page=${encodeURIComponent(page)}&range=${r}${fresh ? '&fresh=1' : ''}`, { cache: 'no-store' })
        .then((res) => (res.ok ? (res.json() as Promise<ActivityResponse>) : Promise.reject(new Error(String(res.status)))))
        .then((data) => setLoads((l) => ({ ...l, [r]: { state: 'ready', data } })))
        .catch(() => setLoads((l) => ({ ...l, [r]: { state: 'error' } })))
        .finally(() => inflight.current.delete(r));
    },
    [page],
  );
  const current = loads[range];
  // Nothing loaded for this period yet: ask. (A missing entry reads as loading below.)
  useEffect(() => {
    if (active && !current) fetchRange(range, false);
  }, [active, current, range, fetchRange]);
  const reload = useCallback(() => {
    setLoads((l) => ({ ...l, [range]: { state: 'loading' } }));
    fetchRange(range, true);
  }, [range, fetchRange]);
  return { load: current ?? ({ state: 'loading' } as Load), reload };
}

// ─── The mode ────────────────────────────────────────────────────────────────

export default function ActivityMode({ active, onClose }: Props) {
  const page = useMemo(() => (typeof window === 'undefined' ? '' : pageKey(window.location.pathname)), []);
  const [range, setRange] = useState<ActivityRange>('30d');
  const [audience, setAudience] = useState<Audience>('visitors');
  const { load, reload } = useActivity(page, range, active);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('activity-active');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('activity-active');
    };
  }, [active, onClose]);

  if (!active || typeof document === 'undefined') return null;
  const data = load.state === 'ready' ? load.data : null;
  const r = data ? data.report[audience] : null;

  return createPortal(
    <>
      {r && <PageLayer report={r} bench={data!.bench?.sectionReach ?? null} now={data!.report.to} />}
      <div className="activity-fixed">
        <div className="activity-hud" role="toolbar" aria-label="Activity">
          <span className={'activity-hud__dot' + (load.state === 'loading' ? ' activity-hud__dot--busy' : load.state === 'error' ? ' activity-hud__dot--error' : '')} />
          <span className="activity-hud__title">Activity</span>
          <div className="activity-seg" role="group" aria-label="Period">
            {ACTIVITY_RANGES.map((x) => (
              <button key={x} type="button" className={'activity-seg__btn' + (x === range ? ' is-on' : '')} aria-pressed={x === range} onClick={() => setRange(x)}>
                {RANGE_LABEL[x]}
              </button>
            ))}
          </div>
          <div className="activity-seg" role="group" aria-label="Who">
            <button type="button" className={'activity-seg__btn' + (audience === 'visitors' ? ' is-on' : '')} aria-pressed={audience === 'visitors'} onClick={() => setAudience('visitors')}>
              Visitors
            </button>
            <button type="button" className={'activity-seg__btn' + (audience === 'everyone' ? ' is-on' : '')} aria-pressed={audience === 'everyone'} onClick={() => setAudience('everyone')}>
              + Team{data ? <span className="activity-seg__n">{data.report.teamCount}</span> : null}
            </button>
          </div>
          <button type="button" className="activity-hud__icon" onClick={reload} aria-label="Reload from ODP" title="Reload from ODP">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
          <button type="button" className="activity-hud__close" onClick={onClose} aria-label="Exit Activity">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Exit
          </button>
        </div>
        <Panel load={load} audience={audience} />
      </div>
    </>,
    document.body,
  );
}

// ─── On the page ─────────────────────────────────────────────────────────────

function PageLayer({ report, bench, now }: { report: AudienceReport; bench: Record<string, number> | null; now: number }) {
  // The page is already on screen when Activity opens (it mounts after the sidebar), so the
  // scenes and the elements can be found while rendering; the loop below keeps them placed.
  const scenes = useMemo(() => scenesOnPage(), []);
  const marks = useMemo(() => markedElements(report), [report]);
  const [hover, setHover] = useState<string | null>(null);
  const layer = useRef<HTMLDivElement>(null);

  // Measure and place every frame; write only what moved.
  useEffect(() => {
    let raf = 0;
    const last = new Map<string, string>();
    const place = (node: HTMLElement | null, key: string, r: DOMRect, pad = 0) => {
      if (!node) return;
      const visible = r.width > 0 && r.height > 0;
      const css = visible
        ? `translate(${Math.round(r.left + window.scrollX - pad)}px, ${Math.round(r.top + window.scrollY - pad)}px)|${Math.round(r.width + 2 * pad)}|${Math.round(r.height + 2 * pad)}`
        : 'hidden';
      if (last.get(key) === css) return;
      last.set(key, css);
      if (!visible) {
        node.style.visibility = 'hidden';
        return;
      }
      const [t, w, h] = css.split('|');
      node.style.visibility = '';
      node.style.transform = t;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
    };
    const tick = () => {
      const root = layer.current;
      if (root) {
        const doc = document.documentElement;
        root.style.height = `${Math.max(doc.scrollHeight, doc.clientHeight)}px`;
        for (const s of scenes) place(root.querySelector<HTMLElement>(`[data-scene-id="${s.id}"]`), `s:${s.id}`, s.el.getBoundingClientRect());
        for (const m of marks) {
          // The sticky bar is still laid out when it slides away (aria-hidden), and the page hides
          // some parts until scrolled to: only mark what a visitor could see right now.
          const shown = !m.el.closest('[aria-hidden="true"]') && (m.el as HTMLElement).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false;
          place(root.querySelector<HTMLElement>(`[data-mark="${m.id}"]`), `m:${m.id}`, shown ? m.el.getBoundingClientRect() : new DOMRect(), 6);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scenes, marks]);

  const max = Math.max(1, ...marks.map((m) => m.clicks));
  return (
    <div className="activity-layer" ref={layer} aria-hidden="false">
      {scenes.map((s, i) => {
        const seen = report.sections[s.id] ?? 0;
        // No one saw this scene, yet visitors saw one further down: the scene was not on the page
        // when they came (the template changed on 2 Nov 2026). That is no data, not 0%.
        const absent = !seen && scenes.slice(i + 1).some((later) => (report.sections[later.id] ?? 0) > 0);
        const known = report.visitors > 0 && !absent;
        const reached = known ? seen / report.visitors : 0;
        const d = known ? delta(reached, bench?.[s.id], 'pts') : null;
        return (
          <div key={s.id} className={'activity-scene' + (known ? '' : ' activity-scene--none')} data-scene-id={s.id} style={{ '--reach': reached, '--i': i } as CSSProperties}>
            <div className="activity-scene__rail" aria-hidden="true">
              <span className="activity-scene__fill" />
            </div>
            <div className="activity-scene__chip">
              <span className="activity-scene__row">
                <span className="activity-scene__value">{known ? pct(reached) : '–'}</span>
                {d && <span className={`activity-delta activity-delta--${d.dir}`} title="Against account pages on average">{d.text}</span>}
              </span>
              <span className="activity-scene__name">{s.name}</span>
            </div>
          </div>
        );
      })}
      {marks.map((m, i) => {
        const heat = m.clicks / max;
        return (
          <div
            key={m.id}
            className={'activity-mark' + (m.dead ? ' activity-mark--dead' : '') + (m.cta ? ' activity-mark--cta' : '') + (hover === m.id ? ' is-hover' : '')}
            data-mark={m.id}
            style={{ '--heat': heat, '--i': i } as CSSProperties}
          >
            <span className="activity-mark__heat" aria-hidden="true" />
            <span className="activity-mark__box" aria-hidden="true" />
            <button
              type="button"
              className="activity-mark__badge"
              onMouseEnter={() => setHover(m.id)}
              onMouseLeave={() => setHover((h) => (h === m.id ? null : h))}
              onFocus={() => setHover(m.id)}
              onBlur={() => setHover((h) => (h === m.id ? null : h))}
              aria-label={`${m.clicks} clicks`}
            >
              {m.clicks}
              {m.rage > 0 && <span className="activity-mark__rage" aria-hidden="true" />}
            </button>
            {hover === m.id && (
              <div className="activity-tip" role="tooltip">
                <Stat label="Clicks" value={String(m.clicks)} />
                <Stat label="Visitors" value={String(m.visitors || '–')} />
                <Stat label="Rage" value={String(m.rage)} tone={m.rage ? 'warn' : undefined} />
                <Stat label="Last" value={m.last ? ago(m.last, now) : '–'} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── The panel ───────────────────────────────────────────────────────────────

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: { text: string; dir: string } | null; tone?: 'warn' }) {
  return (
    <div className={'activity-stat' + (tone ? ` activity-stat--${tone}` : '')}>
      <span className="activity-stat__label">{label}</span>
      <span className="activity-stat__value">
        {value}
        {sub && <span className={`activity-delta activity-delta--${sub.dir}`}>{sub.text}</span>}
      </span>
    </div>
  );
}

function Bars({ title, rows, total, accent }: { title: string; rows: Array<{ name: string; n: number; mark?: boolean }>; total: number; accent?: (name: string) => boolean }) {
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section className="activity-block">
      <h3 className="activity-block__title">{title}</h3>
      <ul className="activity-bars">
        {rows.map((r) => (
          <li key={r.name} className={'activity-bars__row' + (r.mark || accent?.(r.name) ? ' is-mark' : '')}>
            <span className="activity-bars__name">{r.name}</span>
            <span className="activity-bars__track" aria-hidden="true">
              <span className="activity-bars__fill" style={{ width: `${(r.n / max) * 100}%` }} />
            </span>
            <span className="activity-bars__n">{r.n}</span>
            <span className="sr-only"> of {total}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Series({ r, history }: { r: AudienceReport; history: HistoryMark[] }) {
  const { start, step, counts } = r.series;
  const max = Math.max(1, ...counts);
  const end = start + step * counts.length;
  const at = (ts: number) => ((ts - start) / (end - start)) * 100;
  return (
    <section className="activity-block">
      <h3 className="activity-block__title">
        Visits
        <span className="activity-legend" aria-hidden="true">
          <i className="activity-legend__built" /> Built <i className="activity-legend__saved" /> Saved <i className="activity-legend__copy" /> Copy
        </span>
      </h3>
      <div className="activity-series" role="img" aria-label={`Visits per ${step > 86400 ? 'week' : 'day'}, peak ${max}`}>
        {counts.map((c, i) => (
          <span key={i} className="activity-series__bar" style={{ height: `${c ? Math.max(8, (c / max) * 100) : 0}%` }} title={`${day(start + i * step)} · ${c}`} />
        ))}
        {history
          .filter((h) => h.ts >= start && h.ts <= end)
          .map((h, i) => (
            <span key={i} className={`activity-series__mark activity-series__mark--${h.kind}`} style={{ left: `${at(h.ts)}%` }} title={`${h.kind} · ${day(h.ts)}`} />
          ))}
      </div>
      <div className="activity-series__axis" aria-hidden="true">
        <span>{day(start)}</span>
        <span>{day(end - 1)}</span>
      </div>
    </section>
  );
}

function Scroll({ r }: { r: AudienceReport }) {
  const total = r.scroll.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const labels = ['<25', '25', '50', '75', '100'];
  const max = Math.max(1, ...r.scroll);
  return (
    <section className="activity-block">
      <h3 className="activity-block__title">Scroll depth</h3>
      <div className="activity-cols">
        {r.scroll.map((n, i) => (
          <div key={i} className="activity-cols__col">
            <span className="activity-cols__bar" style={{ height: `${(n / max) * 100}%` }} />
            <span className="activity-cols__n">{n}</span>
            <span className="activity-cols__label">{labels[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const CTA_NAME: Record<string, string> = { connect: 'Connect', schedule: 'Schedule', contact: 'Contact', cta: 'Button' };
const POSITION_NAME: Record<string, string> = { hero: 'Hero', sticky: 'Sticky', close: 'Close', panel: 'Panel' };

function Ctas({ r }: { r: AudienceReport }) {
  if (!r.ctas.length) return null;
  return (
    <section className="activity-block">
      <h3 className="activity-block__title">CTA clicks</h3>
      <ul className="activity-list">
        {r.ctas.map((c, i) => (
          <li key={i} className={'activity-list__row' + (c.type === 'connect' ? ' is-mark' : '')}>
            <span className="activity-chip">{CTA_NAME[c.type] ?? c.type}</span>
            {c.position && <span className="activity-chip activity-chip--quiet">{POSITION_NAME[c.position] ?? c.position}</span>}
            <span className="activity-list__label">{c.label}</span>
            <span className="activity-list__n">{c.clicks}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Deal({ deal }: { deal: DealSummary | null }) {
  if (!deal) return null;
  return (
    <section className="activity-block">
      <h3 className="activity-block__title">Salesforce</h3>
      <div className="activity-grid">
        <Stat label="Open" value={String(deal.open)} />
        <Stat label="Pipeline" value={deal.openAmounts.length ? deal.openAmounts.map((a) => money(a.amount, a.currency)).join(' · ') : '–'} />
        <Stat label="Won" value={String(deal.won)} />
        <Stat label="Lost" value={String(deal.lost)} />
      </div>
      {deal.next && (
        <div className="activity-list__row is-mark">
          <span className="activity-chip">{deal.next.stage}</span>
          <span className="activity-list__label">Close</span>
          <span className="activity-list__n">{deal.next.closeDate ? day(Date.parse(deal.next.closeDate) / 1000) : '–'}</span>
        </div>
      )}
      {!deal.next && deal.lastClosed && (
        <div className="activity-list__row">
          <span className={'activity-chip' + (deal.lastClosed.won ? '' : ' activity-chip--quiet')}>{deal.lastClosed.stage}</span>
          <span className="activity-list__label">Last</span>
          <span className="activity-list__n">{deal.lastClosed.closeDate ? new Date(deal.lastClosed.closeDate).getFullYear() : '–'}</span>
        </div>
      )}
    </section>
  );
}

function Panel({ load, audience }: { load: Load; audience: Audience }) {
  const [open, setOpen] = useState(true);
  if (load.state !== 'ready') {
    return (
      <aside className={'activity-panel' + (load.state === 'error' ? ' activity-panel--error' : ' activity-panel--loading')} aria-busy={load.state === 'loading'}>
        {load.state === 'error' ? (
          <div className="activity-grid">
            <Stat label="ODP" value="Unavailable" tone="warn" />
          </div>
        ) : (
          <div className="activity-skeleton" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
        )}
      </aside>
    );
  }
  const { report, history, deal, bench } = load.data;
  const r = report[audience];
  // "Ago" is measured from when the report was read from ODP, not from this render.
  const now = report.to;
  const connectRate = r.visitors ? r.connectVisitors / r.visitors : 0;
  return (
    <aside className={'activity-panel' + (open ? '' : ' activity-panel--closed')} aria-label="Page activity">
      <button type="button" className="activity-panel__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Hide numbers' : 'Show numbers'}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
        </svg>
      </button>
      <div className="activity-panel__body">
        <div className="activity-grid activity-grid--kpi">
          <Stat label="Visitors" value={String(r.visitors)} />
          <Stat label="Visits" value={String(r.visits)} />
          <Stat label="Median time" value={duration(r.medianSec)} sub={r.medianSec !== null ? delta(r.medianSec, bench?.medianSec, 'sec') : null} />
          <Stat label="Connect" value={r.visitors ? pct(connectRate) : '–'} sub={r.visitors ? delta(connectRate, bench?.connectRate, 'pts') : null} />
          <Stat label="CTA clicks" value={String(r.ctaClicks)} />
          <Stat label="Last visit" value={ago(r.lastTs, now)} />
        </div>
        <Series r={r} history={history} />
        <Ctas r={r} />
        <Scroll r={r} />
        <Bars title="Sources" rows={r.sources} total={r.visits} />
        <Bars title="Networks" rows={r.networks.map((n) => ({ name: n.name, n: n.n, mark: n.account }))} total={r.visitors} />
        <div className="activity-split">
          <Bars title="Countries" rows={r.countries} total={r.visitors} />
          <Bars title="Devices" rows={r.devices} total={r.visitors} />
        </div>
        <Deal deal={deal} />
        <div className="activity-foot">
          <span>ODP</span>
          <span>{ago(Math.floor(Date.parse(report.generatedAt) / 1000), now)}</span>
        </div>
      </div>
    </aside>
  );
}
