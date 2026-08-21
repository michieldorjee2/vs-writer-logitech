/**
 * FinServHero — full-bleed photographic hero with Brightstream's navy+gold
 * gradient overlay. Personalization pill ("Welcome · Jordan Miller"), Playfair
 * headline (allows an <em> gold emphasis), subhead, dual CTA, and a trust-stats
 * row. Primary CTA opens the modal when `onPrimary` is provided.
 */

import type { FinServHeroBlock, FinServStat } from '../../lib/graph-types';

interface Props {
  block: FinServHeroBlock;
  heroTag?: string | null;
  targetName?: string | null;
  imageUrl?: string | null;
  stats?: FinServStat[] | null;
  onPrimary?: () => void;
}

export default function FinServHero({ block, heroTag, targetName, imageUrl, stats, onPrimary }: Props) {
  return (
    <section className="finserv-hero" data-finserv-reveal>
      {imageUrl && (
        <div
          className="finserv-hero__bg"
          style={{ backgroundImage: `url(${imageUrl})` }}
          aria-hidden="true"
        />
      )}
      <div className="finserv-hero__inner">
        {(heroTag || targetName) && (
          <div className="finserv-hero__pill">
            {heroTag && <span className="finserv-hero__pill-tag">{heroTag}</span>}
            {targetName && <span>{targetName}</span>}
          </div>
        )}
        <h1
          className="finserv-hero__headline"
          dangerouslySetInnerHTML={{ __html: block.headline }}
        />
        {block.subhead && <p className="finserv-hero__sub">{block.subhead}</p>}
        {block.cta && (
          <div className="finserv-hero__cta">
            <a
              className="finserv-btn finserv-btn--primary"
              href={block.cta.href}
              onClick={
                onPrimary
                  ? (e) => {
                      e.preventDefault();
                      onPrimary();
                    }
                  : undefined
              }
            >
              {block.cta.label}
            </a>
            <a className="finserv-btn finserv-btn--ghost" href="#how">
              See how it works
            </a>
            {block.cta.note && <p className="finserv-hero__cta-note">{block.cta.note}</p>}
          </div>
        )}
        {stats && stats.length > 0 && (
          <div className="finserv-hero__stats">
            {stats.map((s, i) => (
              <div key={i} className="finserv-stat">
                <div className="finserv-stat__value">{s.value}</div>
                <div className="finserv-stat__label">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
