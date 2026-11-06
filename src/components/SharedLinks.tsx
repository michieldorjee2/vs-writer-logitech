import { useState, type CSSProperties } from 'react';
import type { ShareLinksLoad } from '../hooks/useShareLinks';
import type { ShareLinkRow } from '../lib/share-links';
import '../styles/share-sheet.css';

/**
 * The page's personal links, newest first: who each was for, who sent it and when, and what became
 * of it (not opened yet, opened, a CTA clicked after). A row opens to the note itself. In the Report
 * (account pages) and in the Share sheet on person pages, which have no Report.
 */

const ROWS = 6;

/** "Today", "Yesterday", "Nov 5" (with the year when it isn't this one). */
function dayOf(ts: number | null, nowS: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date(nowS * 1000);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(now) - start(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

function initialsOf(name: string): string {
  // Only words that start with a letter: "Sam Tester (ignore)" is ST.
  const parts = name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

function statusOf(row: ShareLinkRow, now: number): { tone: 'cta' | 'opened' | 'new'; text: string; sub: string } {
  const { opens, lastOpen, ctas } = row.stats;
  const times = opens > 1 ? `${opens} opens` : opens === 1 ? '1 open' : '';
  if (ctas > 0) return { tone: 'cta', text: 'Clicked the CTA', sub: [times, lastOpen ? `last ${dayOf(lastOpen, now)}` : ''].filter(Boolean).join(', ') };
  if (opens > 0) return { tone: 'opened', text: `Opened ${dayOf(lastOpen, now)}`, sub: opens > 1 ? times : '' };
  return { tone: 'new', text: 'Not opened yet', sub: '' };
}

export default function SharedLinks({ load, compact = false }: { load: ShareLinksLoad; compact?: boolean }) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  // When the list was first drawn: "Today" stays today for as long as it is on screen.
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  if (load.state === 'loading') {
    return (
      <ul className="booth-links is-loading" aria-busy="true">
        {[0, 1].map((i) => (
          <li key={i} className="booth-links__row">
            <span className="booth-links__avatar" />
            <span className="activity-skel" style={{ width: `${[180, 140][i]}px` }} />
          </li>
        ))}
      </ul>
    );
  }
  if (load.state === 'error') return <p className="booth-links__empty">The links didn’t load. They’ll be here next time.</p>;
  if (!load.links.length) {
    return <p className="booth-links__empty">No personal links yet. Make one from Share: you’ll see here when it’s opened.</p>;
  }

  const rows = all ? load.links : load.links.slice(0, ROWS);
  return (
    <ul className={'booth-links' + (compact ? ' booth-links--compact' : '')}>
      {rows.map((row, i) => {
        const status = statusOf(row, now);
        const expanded = openCode === row.code;
        return (
          <li key={row.code} className={'booth-links__row is-' + status.tone} style={{ '--i': i } as CSSProperties}>
            <button type="button" className="booth-links__toggle" aria-expanded={expanded} onClick={() => setOpenCode(expanded ? null : row.code)}>
              <span className="booth-links__avatar" aria-hidden="true">
                {initialsOf(row.recipient.name)}
              </span>
              <span className="booth-links__who">
                <span className="booth-links__name">{row.recipient.name}</span>
                <span className="booth-links__meta">
                  {[row.recipient.title, `from ${row.sender.name.split(' ')[0]}`, dayOf(row.created, now)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="booth-links__status">
                <span className="booth-links__pill">{status.text}</span>
                {status.sub && <span className="booth-links__sub">{status.sub}</span>}
              </span>
            </button>
            {expanded && <p className="booth-links__note">{row.message}</p>}
          </li>
        );
      })}
      {load.links.length > ROWS && !all && (
        <li className="booth-links__more">
          <button type="button" onClick={() => setAll(true)}>
            Show all {load.links.length}
          </button>
        </li>
      )}
    </ul>
  );
}
