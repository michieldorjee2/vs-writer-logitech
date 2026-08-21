/**
 * CareTimeline — the maison's quiet promise: the pieces you've bought
 * here continue to live with us. A horizontal docket of care moments
 * (re-lining, resole, conditioning, monogramming, alteration, archive
 * registration) — each entry: monogram seal, item name, kind, timing,
 * status pill, an editorial note about the maker.
 *
 * Designed to feel like a couturier's order book rather than a
 * customer-service dashboard.
 */

import { resolveUrl, type CareTimelineEntry } from '../../lib/graph-types';
import OpalStamp from './OpalStamp';

interface Props {
  label?: string | null;
  entries: CareTimelineEntry[];
  makerNote?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  Held:        'is-held',
  Ready:       'is-ready',
  Scheduled:   'is-scheduled',
  'In atelier':'is-active',
  Active:      'is-active',
  Upcoming:    'is-upcoming',
};

export default function CareTimeline({ label, entries, makerNote }: Props) {
  if (!entries?.length) return null;

  return (
    <section className="retail-care" id="care" aria-labelledby="care-heading">
      <header className="retail-care__head">
        {label && (
          <span className="retail-care__eyebrow" data-retail-hairline>
            {label}
          </span>
        )}
        <h2 id="care-heading" className="retail-care__heading">
          What we are keeping for you
        </h2>
        {makerNote ? (
          <p className="retail-care__lede retail-dropcap">{makerNote}</p>
        ) : (
          <p className="retail-care__lede retail-dropcap">
            Maison Aurelle holds a record for every piece sold here — the maker, the date,
            the moment it last came back for care. May is the month we sort the docket: what
            is due for service, what is being held against the autumn, what is waiting in
            the atelier for the next visit.
          </p>
        )}
      </header>

      <ol className="retail-care__list">
        {entries.map((e, i) => {
          const statusKey = (e.status || '').trim();
          const toneClass = STATUS_TONE[statusKey] || (statusKey ? 'is-active' : '');
          const imgUrl = resolveUrl(e.imageUrl);
          return (
            <li key={i} className="retail-care__entry" data-retail-reveal data-retail-delay={`${i * 80}`}>
              <div className="retail-care__rail" aria-hidden="true">
                <span className="retail-care__rail-dot" />
                {i < entries.length - 1 && <span className="retail-care__rail-line" />}
              </div>

              <div className="retail-care__seal" aria-hidden="true">
                {imgUrl ? (
                  <div
                    className="retail-care__seal-photo"
                    style={{ backgroundImage: `url(${imgUrl})` }}
                    role="img"
                  />
                ) : (
                  <OpalStamp size={56} />
                )}
              </div>

              <div className="retail-care__body">
                <div className="retail-care__row">
                  <h3 className="retail-care__item">{e.itemName}</h3>
                  {e.status && (
                    <span className={`retail-care__status ${toneClass}`}>{e.status}</span>
                  )}
                </div>
                <div className="retail-care__meta">
                  {e.kind && <span className="retail-care__kind">{e.kind}</span>}
                  {e.dueLine && <span className="retail-care__due">{e.dueLine}</span>}
                  {e.maker && <span className="retail-care__maker">{e.maker}</span>}
                </div>
                {e.note && <p className="retail-care__note">{e.note}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
