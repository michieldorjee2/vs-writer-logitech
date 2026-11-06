import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  activitySlots,
  channelName,
  factsOf,
  journeyOf,
  JOURNEY_STAGES,
  salesforceAccountUrl,
  type ActivityResponse,
  type Journey,
  type JourneyStage,
  type SlotUnit,
  type VisitRow,
} from '../lib/page-activity';
import type { ActivityLoad } from '../hooks/usePageActivity';
import type { ShareLinksLoad } from '../hooks/useShareLinks';
import SharedLinks from './SharedLinks';
import '../styles/activity-mode.css';

/**
 * The booth's Report: one page's story from ODP, on a card over the page (the rail's Report
 * button, FloatingSidebar.tsx). Journey: when the page was built, first viewed, first engaged
 * with, first had a CTA pressed; the step it is at opens to the visits behind it. Data: the
 * facts a rep asks for first. Activity: visits in seven slots up to today. Shared links: the
 * page's personal links (ShareSheet.tsx), and whether each was opened and a CTA clicked after.
 *
 * Prospects only (Optimizely people and machines are left out by the API), over the page's whole
 * history. The data is asked for when the booth tools mount (usePageActivity), not on open.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  load: ActivityLoad;
  retry: () => void;
  links?: ShareLinksLoad;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/** "Today", "Yesterday", "Oct 29" (with the year when it is not this one). `relative: false` for the chart's narrow labels. */
function dayLabel(ts: number | null, nowS: number, relative = true): string {
  if (ts === null) return '–';
  const d = new Date(ts * 1000);
  const now = new Date(nowS * 1000);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (relative && days === 0) return 'Today';
  if (relative && days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

function duration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

const STAGE_LABEL: Record<JourneyStage, string> = {
  created: 'Page created',
  viewed: 'Viewed page',
  engaged: 'Engaged',
  cta: 'CTA clicked',
};

const SLOT_NOW: Record<SlotUnit, string> = { day: 'Today', week: 'This week', month: 'This month' };

// ─── The card ────────────────────────────────────────────────────────────────

export default function ActivityMode({ open, onClose, load, retry, links }: Props) {
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // The page under the report stays where it was.
    document.documentElement.classList.add('activity-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('activity-open');
      before?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  const data = load.state === 'ready' ? load.data : null;
  const sfUrl = salesforceAccountUrl(data?.account?.id);

  return createPortal(
    <div
      className={'activity-view' + (open ? ' is-open' : '')}
      inert={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section ref={card} className={'activity-card is-' + load.state} role="dialog" aria-modal="true" aria-labelledby="activity-card-title" tabIndex={-1}>
        <header className="activity-card__head">
          <h2 id="activity-card-title" className="activity-card__title">
            Report
          </h2>
          {sfUrl && (
            <a className="activity-card__sf" href={sfUrl} target="_blank" rel="noopener noreferrer">
              Open in Salesforce
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4.5 11.5l7-7M5.5 4.5h6v6" />
              </svg>
            </a>
          )}
          {load.state === 'error' && (
            <button type="button" className="activity-card__retry" onClick={retry}>
              ODP did not answer. Try again
            </button>
          )}
        </header>
        <div className="activity-card__cols">
          <div className="activity-card__col">
            <h3 className="activity-card__h">Journey</h3>
            <JourneyList data={data} />
            <ActivityChart data={data} />
          </div>
          <div className="activity-card__col">
            <h3 className="activity-card__h">Data</h3>
            <Facts data={data} />
          </div>
        </div>
        {/* Only once the page has links: no empty lists. */}
        {links?.state === 'ready' && links.links.length > 0 && (
          <section className="activity-card__links" aria-labelledby="activity-links-title">
            <h3 id="activity-links-title" className="activity-card__h">
              Shared links
            </h3>
            <SharedLinks load={links} />
          </section>
        )}
      </section>
    </div>,
    document.body,
  );
}

// ─── Journey ─────────────────────────────────────────────────────────────────

function JourneyList({ data }: { data: ActivityResponse | null }) {
  const journey = useMemo(() => (data ? journeyOf(data.report.visitors, data.history) : null), [data]);
  const [expanded, setExpanded] = useState(false);
  const now = data?.report.to ?? 0;
  const current = journey ? JOURNEY_STAGES.indexOf(journey.stage) : -1;

  return (
    <ol className="activity-journey">
      {JOURNEY_STAGES.map((stage, i) => {
        const state = !journey ? 'pending' : i < current ? 'past' : i === current ? 'current' : 'next';
        const ts = journey ? stageTs(journey, stage) : null;
        const date = ts === null ? null : dayLabel(ts, now);
        // "Last update" only for a save after the build.
        const updated = stage === 'created' && journey?.updated && journey.updated !== journey.created ? dayLabel(journey.updated, now) : null;
        const rows = state === 'current' && journey ? journey.visits : [];
        return (
          <li key={stage} className={`activity-step is-${state}`} style={{ '--i': i } as CSSProperties}>
            {state === 'current' && rows.length > 0 ? (
              <button type="button" className="activity-step__toggle" aria-expanded={expanded} onClick={() => setExpanded((x) => !x)}>
                <span className="activity-step__text">
                  {date ? `${date}, ` : ''}
                  {STAGE_LABEL[stage]}
                </span>
                <svg className="activity-step__chev" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12.67 4L6.83 9.83L1 4" />
                </svg>
              </button>
            ) : (
              <span className="activity-step__text">
                {state === 'pending' ? (
                  <span className="activity-skel" style={{ width: `${[220, 150, 110, 90][i]}px` }} />
                ) : state === 'next' ? (
                  STAGE_LABEL[stage]
                ) : state === 'current' ? (
                  <>
                    {date ? `${date}, ` : ''}
                    {STAGE_LABEL[stage]}
                    {updated ? `. Last update ${updated}` : ''}
                  </>
                ) : (
                  <>
                    {date && <b>{date}</b>}
                    {date ? ' - ' : ''}
                    {STAGE_LABEL[stage]}
                    {updated && (
                      <>
                        . Last update <b>{updated}</b>
                      </>
                    )}
                  </>
                )}
              </span>
            )}
            {state === 'current' && rows.length > 0 && expanded && <Visits rows={rows} stage={stage} now={now} />}
          </li>
        );
      })}
    </ol>
  );
}

function stageTs(j: Journey, stage: JourneyStage): number | null {
  return stage === 'created' ? j.created : stage === 'viewed' ? j.viewed : stage === 'engaged' ? j.engaged : j.cta;
}

const VISIT_ROWS = 6;

/** The visits behind the current step, newest first. */
function Visits({ rows, stage, now }: { rows: VisitRow[]; stage: JourneyStage; now: number }) {
  const shown = rows.slice(0, VISIT_ROWS);
  return (
    <ul className="activity-visits">
      {shown.map((v, i) => (
        <li key={`${v.ts}-${i}`} className={'activity-visit' + (stage === 'cta' ? ' activity-visit--cta' : '')} style={{ '--i': i } as CSSProperties}>
          <span className="activity-visit__day">{dayLabel(v.ts, now)}</span>
          {stage === 'cta' ? (
            <span className="activity-visit__what">{v.ctas.join(', ')}</span>
          ) : (
            <>
              <span>{duration(v.sec)}</span>
              <span>{v.scroll === null ? '–' : `${Math.round(v.scroll)}%`}</span>
              <span className="activity-visit__what">{channelName(v.source)}</span>
            </>
          )}
        </li>
      ))}
      {rows.length > VISIT_ROWS && <li className="activity-visit activity-visit--more">+{rows.length - VISIT_ROWS}</li>}
    </ul>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

function Facts({ data }: { data: ActivityResponse | null }) {
  const f = data ? factsOf(data.report.visitors) : null;
  const now = data?.report.to ?? 0;
  const rows: Array<[string, string | null]> = [
    ['First seen', f ? dayLabel(f.firstSeen, now) : null],
    ['Last seen', f ? dayLabel(f.lastSeen, now) : null],
    ['Most engaged', f ? dayLabel(f.mostEngaged, now) : null],
    ['CTA clicks', f ? String(f.ctaClicks) : null],
    ['Stage', data ? (data.account?.stage ?? '–') : null],
    ['Last channel', f ? (channelName(f.lastChannel) ?? '–') : null],
    ['Last country', f ? (f.lastCountry ?? '–') : null],
  ];
  return (
    <dl className="activity-data">
      {rows.map(([label, value], i) => (
        <div key={label} className="activity-data__row" style={{ '--i': i } as CSSProperties}>
          <dt>{label}</dt>
          <dd>{value ?? <span className="activity-skel" style={{ width: '64px' }} />}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────

function ActivityChart({ data }: { data: ActivityResponse | null }) {
  const chart = useMemo(() => {
    if (!data) return null;
    const v = data.report.visitors;
    const visits = v.visitList ?? [];
    const first = visits[0]?.ts ?? v.firstTs ?? null;
    return activitySlots(
      visits.map((x) => x.ts),
      first,
      data.report.to,
      new Date(data.report.to * 1000).getTimezoneOffset(),
    );
  }, [data]);
  const now = data?.report.to ?? 0;
  const slots = chart?.slots ?? Array.from({ length: 7 }, () => ({ start: 0, n: 0 }));
  const max = Math.max(1, ...slots.map((s) => s.n));
  const firstIdx = slots.findIndex((s) => s.n > 0);
  const latestIdx = slots.reduce((at, s, i) => (s.n > 0 ? i : at), -1);
  const lastIdx = slots.length - 1;
  const unit = chart?.unit ?? 'day';

  return (
    <div className={'activity-chart' + (chart ? '' : ' is-pending')}>
      <h4 className="activity-chart__title">Activity</h4>
      <div className="activity-chart__plot" role="img" aria-label={chart ? `Visits per ${unit}, most recent ${slots[lastIdx].n}` : 'Loading'}>
        {slots.map((s, i) => {
          // The first and latest slots with visits are named by date; the last slot is now.
          const label = !chart ? null : i === lastIdx ? SLOT_NOW[unit] : i === firstIdx || i === latestIdx ? dayLabel(s.start, now, false) : null;
          const latest = i === latestIdx;
          return (
            <div key={i} className="activity-chart__slot" style={{ '--i': i } as CSSProperties}>
              <span
                className={'activity-chart__bar' + (s.n ? '' : ' is-empty') + (latest ? ' is-latest' : '') + (i === lastIdx ? ' is-now' : '')}
                style={{ '--h': s.n ? Math.max(0.1, s.n / max) : 0 } as CSSProperties}
                title={chart ? `${dayLabel(s.start, now)}: ${s.n} visit${s.n === 1 ? '' : 's'}` : undefined}
              >
                {latest && s.n / max >= 0.6 && (
                  <span className="activity-chart__latest" aria-hidden="true">
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
                      <path d="M5 1.2l1.1 2.4 2.5.2-1.9 1.7.6 2.5L5 6.7 2.7 8l.6-2.5L1.4 3.8l2.5-.2z" strokeLinejoin="round" />
                    </svg>
                    Latest
                  </span>
                )}
              </span>
              <span className="activity-chart__label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
