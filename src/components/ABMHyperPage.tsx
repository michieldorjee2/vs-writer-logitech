import React, { useEffect } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import { initABMAnimations, cleanupABMAnimations } from '../lib/abm-animations';
import { initABMInteractions, cleanupABMInteractions } from '../lib/abm-interactions';
import { initStickyCTA, cleanupStickyCTA } from '../lib/abm-sticky-cta';
import { initWarpCTA, cleanupWarpCTA } from '../lib/abm-warp-cta';
import { initHero3D, cleanupHero3D } from '../lib/abm-hero-3d';

interface Props {
  page: CompetitorComparisonPage;
}

const fallbackLogos = [
  { url: 'https://www.optimizely.com/contentassets/f58ea35175bd4e25bf399e36d284d6f9/logo_salesforce_white_100x300.svg', alt: 'Salesforce' },
  { url: 'https://www.optimizely.com/contentassets/854ad08b9a5642f1bbda87fdfe6b81d4/nike-logo-icon_light.svg', alt: 'Nike' },
  { url: 'https://www.optimizely.com/contentassets/638fd78be5cc45978c7d8b42bf0d31eb/zoom-logo-white.svg', alt: 'Zoom' },
  { url: 'https://www.optimizely.com/contentassets/04dd25ba79f04298a76e1fb50742a117/shell-logo-light.svg', alt: 'Shell' },
  { url: 'https://www.optimizely.com/contentassets/71dcdc4b907a414ba7057d2624c2883b/dolby-logo-white.svg', alt: 'Dolby' },
  { url: 'https://www.optimizely.com/contentassets/c3fc7cbd589947cbb8579ce42d6bf8ec/logo_new-era_white_100x300.svg', alt: 'NEW ERA' },
];

/* LinkedIn icon SVG reused across stakeholder cards */
const LinkedInIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

/** Render a rating icon based on the cell value */
function RatingIcon({ value }: { value: string | null }) {
  if (!value) return <span className="rating-icon rating-icon--none" />;
  const v = value.trim().toLowerCase();
  if (v === 'yes') return <span className="rating-icon rating-icon--full" />;
  if (v === 'no') return <span className="rating-icon rating-icon--none" />;
  if (v === 'limited') return <span className="rating-icon rating-icon--partial" />;
  return null; // descriptive text — no icon needed
}

/** Determine the CSS modifier for the rating cell */
function ratingClass(value: string | null): string {
  if (!value) return 'comparison__rating comparison__rating--none';
  const v = value.trim().toLowerCase();
  if (v === 'yes') return 'comparison__rating comparison__rating--full';
  if (v === 'no') return 'comparison__rating comparison__rating--none';
  if (v === 'limited') return 'comparison__rating comparison__rating--partial';
  return 'comparison__rating comparison__rating--full';
}

const ABMHyperPage = ({ page }: Props) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      initHero3D();
      initABMAnimations();
      initABMInteractions();
      initStickyCTA();
      initWarpCTA();
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanupHero3D();
      cleanupABMAnimations();
      cleanupABMInteractions();
      cleanupStickyCTA();
      cleanupWarpCTA();
    };
  }, []);

  // Derive hero title lines from headline
  const heroLine1 = page.headline?.split(' ').slice(0, 1).join(' ') || 'Built';
  const heroLine2 = page.headline
    ? page.headline.split(' ').slice(1).join(' ')
    : '';

  // Split first 3 logos left, last 3 right for the logo wall
  const leftLogos = fallbackLogos.slice(0, 3);
  const rightLogos = fallbackLogos.slice(3);

  return (
    <main className="abm-page" id="main-content">
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>
      {/* ======== HERO ======== */}
      <section id="hero" className="section section--hero">
        <canvas id="hero-canvas" width={1920} height={1080} />
        <div className="hero__light-sweep" />

        <div className="hero__content">
          {page.eyebrow && (
            <div className="hero__badge hero__badge--hidden">
              <span className="hero__badge-dot" />
              {page.eyebrow}
            </div>
          )}
          <h1 className="hero__title" data-split-text>
            <span className="hero__title-line">{heroLine1}</span>
            {heroLine2 && (
              <span className="hero__title-line hero__title-line--accent">
                {heroLine2}
              </span>
            )}
          </h1>
          {page.subheadline && (
            <p className="hero__subtitle hero__subtitle--hidden">
              {page.subheadline}
            </p>
          )}
        </div>

        <div className="hero__scroll-indicator hero__scroll-indicator--hidden">
          <span>Scroll to explore</span>
          <div className="hero__scroll-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ======== INTEL ======== */}
      <section id="intel" className="section section--intel">
        <div className="section__inner">
          <div className="intel__hero" data-animate="fade-up">
            {page.intelEyebrow && (
              <span className="intel__eyebrow">{page.intelEyebrow}</span>
            )}
            {page.intelHeadline && (
              <h2
                className="intel__headline"
                dangerouslySetInnerHTML={{ __html: page.intelHeadline }}
              />
            )}
          </div>

          {/* Stat ribbon */}
          {page.intelStats && page.intelStats.length > 0 && (
            <div className="intel__stats" data-animate="fade-up" data-delay="0.1">
              {page.intelStats.map((stat, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className="intel__stat-divider" />}
                  <div className="intel__stat-item">
                    <span className="intel__stat-number">{stat.Value}</span>
                    <span className="intel__stat-label">{stat.Label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Stakeholders */}
          {page.stakeholders && page.stakeholders.length > 0 && (
            <div className="intel__people-row" data-animate="fan-out" data-delay="0.15">
              <h3 className="intel__section-label">Key Stakeholders</h3>
              <div className="intel__people-cards">
                {page.stakeholders.map((person, i) => (
                  <React.Fragment key={i}>
                    {i === 1 && (
                      <span className="intel__fan-emoji intel__fan-emoji--highfive" aria-hidden="true">
                        &#x1F64C;
                      </span>
                    )}
                    {i === 2 && (
                      <span className="intel__fan-emoji intel__fan-emoji--confetti" aria-hidden="true">
                        &#x1F389;
                        <span className="intel__confetti-piece" style={{ '--c': '#ff6b6b' } as React.CSSProperties}>&#x25CF;</span>
                        <span className="intel__confetti-piece" style={{ '--c': '#ffd93d' } as React.CSSProperties}>&#x25CF;</span>
                        <span className="intel__confetti-piece" style={{ '--c': '#6bcb77' } as React.CSSProperties}>&#x25CF;</span>
                        <span className="intel__confetti-piece" style={{ '--c': '#4d96ff' } as React.CSSProperties}>&#x25CF;</span>
                        <span className="intel__confetti-piece" style={{ '--c': '#ff6bcb' } as React.CSSProperties}>&#x25CF;</span>
                        <span className="intel__confetti-piece" style={{ '--c': '#ffa94d' } as React.CSSProperties}>&#x25CF;</span>
                      </span>
                    )}
                    <div className="intel__person-card">
                      <div
                        className="intel__avatar"
                        style={{ '--av-color': person.AvatarColor || 'var(--optimizely-blue-60)' } as React.CSSProperties}
                      >
                        {person.Initials}
                      </div>
                      <div className="intel__person-info">
                        <div className="intel__person-name">
                          <strong>{person.Name}</strong>
                          {person.LinkedInUrl?.default && (
                            <a
                              href={person.LinkedInUrl.default}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="intel__linkedin-icon"
                              aria-label={`${person.Name} on LinkedIn`}
                            >
                              <LinkedInIcon />
                              <span className="sr-only">(opens in new tab)</span>
                            </a>
                          )}
                        </div>
                        <span className="intel__person-role">{person.Role}</span>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Three-column dossier */}
          <div className="intel__dossier" data-animate="fade-up" data-delay="0.2">
            {/* Tech Stack */}
            {page.techStack && page.techStack.length > 0 && (
              <div className="intel__dossier-block">
                <h3 className="intel__section-label">Current Tech Stack</h3>
                <ul className="intel__tech-stack" role="list">
                  {page.techStack.map((tech, i) => (
                    <li key={i} className={`tech-tag${tech.ColorTag ? ` tech-tag--${tech.ColorTag}` : ''}`}>
                      {tech.Name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Investments */}
            {page.investments && page.investments.length > 0 && (
              <div className="intel__dossier-block intel__dossier-block--card">
                <h3 className="intel__section-label">Strategic Investments</h3>
                <p className="intel__block-sub">Based on recent job postings &amp; public initiatives</p>
                <ul className="intel__invest-list" role="list">
                  {page.investments.map((inv, i) => (
                    <li
                      key={i}
                      className={`intel__invest-item${inv.IsPrimary ? ' intel__invest-item--primary' : ''}`}
                    >
                      {inv.Name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* News */}
            {page.newsItems && page.newsItems.length > 0 && (
              <div className="intel__dossier-block intel__dossier-block--card">
                <h3 className="intel__section-label">In the News</h3>
                <div className="intel__news">
                  {page.newsItems.map((news, i) => (
                    <div key={i} className="intel__news-row">
                      <time>{news.Date}</time>
                      {news.Url?.default ? (
                        <a href={news.Url.default} target="_blank" rel="noopener noreferrer">
                          {news.Headline} <span className="intel__news-arrow">&rarr;</span>
                          <span className="sr-only"> (opens in new tab)</span>
                        </a>
                      ) : (
                        <span>{news.Headline}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ======== CHALLENGE ======== */}
      {page.challengeHeadline && (
        <section id="challenge" className="section section--challenge">
          <div className="section__inner">
            <div className="challenge__layout">
              <div className="challenge__left" data-animate="fade-right">
                <span className="section__label">The challenge</span>
                <h2
                  className="challenge__headline"
                  dangerouslySetInnerHTML={{ __html: page.challengeHeadline }}
                />
                {page.challengeScreenshotUrl && (
                  <div className="challenge__screenshot">
                    <div className="challenge__browser-chrome">
                      <span className="challenge__browser-dot" />
                      <span className="challenge__browser-dot" />
                      <span className="challenge__browser-dot" />
                      <span className="challenge__browser-url">
                        {page.challengeBrowserUrl || ''}
                      </span>
                    </div>
                    <div className="challenge__screenshot-body">
                      <img
                        src={page.challengeScreenshotUrl.default}
                        alt={page.challengeScreenshotAlt || 'Current website screenshot'}
                        loading="lazy"
                        width={560}
                        height={340}
                      />
                    </div>
                  </div>
                )}
              </div>

              {page.painPoints && page.painPoints.length > 0 && (
                <div className="challenge__right">
                  <div className="challenge__pain-points">
                    {page.painPoints.map((pain, i) => (
                      <div
                        key={i}
                        className="challenge__pain"
                        data-animate="fade-up"
                        data-delay={`${(i + 1) * 0.1}`}
                      >
                        <div className="challenge__pain-number">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <div className="challenge__pain-content">
                          <h3>{pain.Title}</h3>
                          <p>{pain.Description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ======== COMPARISON ======== */}
      {page.comparisonTableRows && page.comparisonTableRows.length > 0 && (
        <section id="comparison" className="section section--comparison">
          <div className="section__inner">
            <div className="section__header" data-animate="fade-up">
              <span className="section__label">The Optimizely advantage</span>
              {page.comparisonHeadline ? (
                <h2 className="section__title">{page.comparisonHeadline}</h2>
              ) : (
                <h2 className="section__title">Side by side</h2>
              )}
              {page.comparisonDescription && (
                <p className="section__description">{page.comparisonDescription}</p>
              )}
            </div>

            <div className="comparison__table" data-animate="fade-up" data-delay="0.2">
              <div className="comparison__header-row">
                <div className="comparison__feature-label">Feature</div>
                <div className="comparison__competitor-label">
                  {page.competitorName || 'Competitor'}
                </div>
                <div className="comparison__optimizely-label">Optimizely</div>
              </div>

              <div className="comparison__group">
                {page.comparisonTableRows.map((row, i) => (
                  <div
                    key={i}
                    className={`comparison__row${row.OurHighlight ? ' comparison__row--highlight' : ''}`}
                    data-animate="fade-up"
                  >
                    <div className="comparison__feature">
                      <strong>{row.Category}</strong>
                    </div>
                    <div className={ratingClass(row.CompetitorValue)}>
                      <RatingIcon value={row.CompetitorValue} />
                      {row.CompetitorValue &&
                        !['yes', 'no', 'limited'].includes(row.CompetitorValue.trim().toLowerCase()) &&
                        row.CompetitorValue}
                      {['yes', 'no', 'limited'].includes((row.CompetitorValue || '').trim().toLowerCase()) &&
                        row.CompetitorValue}
                    </div>
                    <div className={ratingClass(row.OurValue)}>
                      <RatingIcon value={row.OurValue} />
                      {row.OurValue &&
                        !['yes', 'no', 'limited'].includes(row.OurValue.trim().toLowerCase()) &&
                        row.OurValue}
                      {['yes', 'no', 'limited'].includes((row.OurValue || '').trim().toLowerCase()) &&
                        row.OurValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======== PROOF ======== */}
      <section id="proof" className="section section--proof">
        <div className="section__inner">
          <div className="section__header" data-animate="fade-up">
            <span className="section__label">Proof it works</span>
            <h2 className="section__title">Trusted by teams like yours</h2>
          </div>

          {/* Logo Wall */}
          <div className="proof__logos" id="proof-logos" data-animate="fade-up" data-delay="0.1">
            {leftLogos.map((logo, i) => (
              <div key={`left-${i}`} className="proof__logo-item" data-logo-side="left">
                <img src={logo.url} alt={logo.alt} loading="lazy" width="300" height="100" />
              </div>
            ))}
            <div className="proof__logo-you" id="proof-logo-you">
              <span>{page.logoWallCustomerSlot || 'You?'}</span>
            </div>
            {rightLogos.map((logo, i) => (
              <div key={`right-${i}`} className="proof__logo-item" data-logo-side="right">
                <img src={logo.url} alt={logo.alt} loading="lazy" width="300" height="100" />
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="proof__testimonials">
            {page.testimonial1 && (
              <div className="proof__testimonial" data-animate="fade-up" data-delay="0.15">
                <blockquote className="proof__quote">
                  <p>&ldquo;{page.testimonial1}&rdquo;</p>
                  <footer className="proof__author">
                    <div className="proof__author-avatar">
                      {(page.testimonial1JobTitle || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || 'T1'}
                    </div>
                    <div className="proof__author-info">
                      <cite><strong>{page.testimonial1JobTitle || ''}</strong></cite>
                      <span>{page.testimonial1Company || ''}</span>
                    </div>
                  </footer>
                </blockquote>
              </div>
            )}
            {page.testimonial2 && (
              <div className="proof__testimonial" data-animate="fade-up" data-delay="0.25">
                <blockquote className="proof__quote">
                  <p>&ldquo;{page.testimonial2}&rdquo;</p>
                  <footer className="proof__author">
                    <div className="proof__author-avatar proof__author-avatar--blue">
                      {(page.testimonial2JobTitle || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase() || 'T2'}
                    </div>
                    <div className="proof__author-info">
                      <cite><strong>{page.testimonial2JobTitle || ''}</strong></cite>
                      <span>{page.testimonial2Company || ''}</span>
                    </div>
                  </footer>
                </blockquote>
              </div>
            )}
          </div>

          {/* Analyst Recognition */}
          {page.analystCards && page.analystCards.length > 0 && (
            <div className="proof__analysts" data-animate="fade-up" data-delay="0.3">
              {page.analystCards.map((card, i) => (
                <a
                  key={i}
                  href={card.Url?.default || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="proof__analyst-card"
                >
                  <div className="proof__analyst-badge">{card.Badge}</div>
                  <div className="proof__analyst-source">{card.Source}</div>
                  <div className="proof__analyst-category">{card.Category}</div>
                  <div className="proof__analyst-link">Read report &rarr;</div>
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ======== ROI ======== */}
      {(page.roiTitle || (page.roiCards && page.roiCards.length > 0)) && (
        <section id="roi" className="section section--roi">
          <div className="section__inner">
            <div className="section__header" data-animate="fade-up">
              <span className="section__label">Your team&apos;s impact</span>
              {page.roiTitle && <h2 className="section__title">{page.roiTitle}</h2>}
              {page.roiDescription && (
                <p className="section__description">{page.roiDescription}</p>
              )}
            </div>

            {page.roiCards && page.roiCards.length > 0 && (
              <div className="roi__grid">
                {page.roiCards.map((card, i) => (
                  <div
                    key={i}
                    className="roi__card"
                    data-animate="fade-up"
                    data-delay={`${(i + 1) * 0.1}`}
                  >
                    <div className="roi__metric" data-count={card.Metric.replace(/[^0-9.]/g, '')}>
                      0
                    </div>
                    <div className="roi__unit">{card.Unit}</div>
                    <div className="roi__label">{card.Label}</div>
                    {card.CitationText && (
                      <div className="roi__citation">{card.CitationText}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {page.roiProjectionValue && (
              <div className="roi__projection" data-animate="fade-up" data-delay="0.5">
                <div className="roi__value-stage">
                  <div className="roi__value-3d" aria-label={page.roiProjectionValue}>
                    {Array.from({ length: 20 }, (_, d) => (
                      <span
                        key={d}
                        className="roi__extrude"
                        aria-hidden="true"
                        style={{ '--d': 20 - d } as React.CSSProperties}
                      >
                        {page.roiProjectionValue}
                      </span>
                    ))}
                    <span className="roi__face">{page.roiProjectionValue}</span>
                  </div>
                </div>
                {page.roiProjectionLabel && (
                  <div className="roi__projection-label">{page.roiProjectionLabel}</div>
                )}
                {page.roiProjectionDetail && (
                  <div className="roi__projection-detail">{page.roiProjectionDetail}</div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======== MIGRATION ======== */}
      {(page.migrationTitle || (page.timelinePhases && page.timelinePhases.length > 0)) && (
        <section id="migration" className="section">
          <div className="section__inner">
            <div className="section__header" data-animate="fade-up">
              <span className="section__label">The path forward</span>
              {page.migrationTitle && <h2 className="section__title">{page.migrationTitle}</h2>}
              {page.migrationDescription && (
                <p className="section__description">{page.migrationDescription}</p>
              )}
            </div>

            {page.timelinePhases && page.timelinePhases.length > 0 && (
              <div className="timeline">
                <div className="timeline__track" aria-hidden="true">
                  <div className="timeline__line" />
                </div>
                {page.timelinePhases.map((phase, i) => (
                  <div
                    key={i}
                    className="timeline__phase"
                    data-animate="fade-up"
                    data-delay={String(i)}
                  >
                    <div
                      className={`timeline__marker${phase.MarkerColor ? ` timeline__marker--${phase.MarkerColor}` : ''}`}
                    >
                      {i + 1}
                    </div>
                    <div className="timeline__card">
                      <span className="timeline__weeks">{phase.Weeks}</span>
                      <h3 className="timeline__title">{phase.Title}</h3>
                      <p className="timeline__desc">{phase.Description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {page.teamMembers && page.teamMembers.length > 0 && (
              <div className="migration-team" data-animate="fade-up" data-delay="4">
                <h3 className="migration-team__title">Your dedicated Optimizely team</h3>
                <div className="migration-team__grid">
                  {page.teamMembers.map((member, i) => (
                    <div key={i} className="migration-team__member">
                      <div
                        className={`migration-team__avatar${i === 1 ? ' migration-team__avatar--blue' : ''}${i === 2 ? ' migration-team__avatar--green' : ''}`}
                      >
                        {member.Initials}
                      </div>
                      <strong>{member.Name}</strong>
                      <span>{member.Role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======== STICKY CTA ======== */}
      <div className="sticky-cta" id="sticky-cta">
        <span className="sticky-cta__text" id="sticky-cta-text">
          {page.stickyCTAText || 'Explore what Optimizely can do'}
        </span>
        <button className="warp-btn warp-btn--compact" id="sticky-connect-btn">
          <span className="warp-btn__content">
            <span className="warp-btn__main">Get in touch</span>
          </span>
          <span className="warp-btn__arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>

      {/* ======== CTA ======== */}
      <section id="cta" className="section section--cta">
        <div className="section__inner">
          <div className="cta__content" data-animate="fade-up">
            {page.ctaTitle ? (
              <h2 className="cta__title" dangerouslySetInnerHTML={{ __html: page.ctaTitle }} />
            ) : (
              <h2 className="cta__title">Let&apos;s build the next chapter together</h2>
            )}
            {page.ctaDescription && <p className="cta__description">{page.ctaDescription}</p>}
            <div className="warp-btn-wrap">
              <button className="warp-btn" id="cta-connect-btn">
                <span className="warp-btn__content">
                  <span className="warp-btn__eyebrow">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}>
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    One-click action
                  </span>
                  <span className="warp-btn__main">
                    {page.ctaButtonText || 'Get in touch with your Optimizely team'}
                  </span>
                </span>
                <span className="warp-btn__arrow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ======== MODAL ======== */}
      <div className="modal-overlay" id="connect-modal" aria-hidden="true">
        <div className="modal" role="dialog" aria-labelledby="modal-title">
          <button type="button" className="modal__close" id="modal-close-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div className="bento-grid">
            {/* Confirmation bento */}
            <div className="bento bento--confirm">
              <div className="check-3d">
                {Array.from({ length: 9 }, (_, d) => (
                  <svg key={d} className="check-3d__layer" style={{ '--d': 9 - d } as React.CSSProperties} viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ))}
                <svg className="check-3d__face" viewBox="0 0 24 24">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="bento__title" id="modal-title">You&apos;re all set</h3>
              <p className="bento__sub">We&apos;ve notified your team — expect a reply within 24 hours.</p>
            </div>

            {/* Schedule bento */}
            <a
              href={page.modalScheduleUrl?.default || '#'}
              className="bento bento--schedule"
            >
              <span className="bento__schedule-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </span>
              <span className="bento__schedule-label">Fast track</span>
              <strong className="bento__schedule-cta">Schedule a call</strong>
              <span className="bento__schedule-hint">Pick a 30-min slot</span>
              <span className="bento__schedule-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>

            {/* Team contacts */}
            {page.teamMembers?.map((member, i) => (
              <a
                key={i}
                href={member.Email ? `mailto:${member.Email}` : '#'}
                className="bento bento--person"
              >
                <div
                  className={`bento__avatar${i === 1 ? ' bento__avatar--blue' : ''}${i === 2 ? ' bento__avatar--green' : ''}`}
                >
                  {member.Initials}
                </div>
                <strong>{member.Name}</strong>
                <span className="bento__role">{member.Role}</span>
                <span className="bento__email-action">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Send email
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ======== WARP CANVAS ======== */}
      <canvas id="warp-canvas" width={1920} height={1080} />

      {/* ======== FOOTER ======== */}
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand">
            <strong>Optimizely</strong>
            {page.footerTagline && <span>{page.footerTagline}</span>}
          </div>
          {page.footerLinks && page.footerLinks.length > 0 && (
            <nav aria-label="Footer" className="footer__links">
              {page.footerLinks.map((link, i) => (
                <a key={i} href={link.Url?.default || '#'}>
                  {link.Text}
                </a>
              ))}
            </nav>
          )}
          {page.footerLegal && (
            <div className="footer__legal">
              <p>{page.footerLegal}</p>
            </div>
          )}
        </div>
      </footer>
    </main>
  );
};

export default ABMHyperPage;
