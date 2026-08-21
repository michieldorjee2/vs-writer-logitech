/**
 * PersonPageView — the markup for a 1:1 buyer page, with no hooks and no CSS
 * import, so it renders identically under `renderToString` and in the browser.
 * `PersonPage` wraps it with scroll-reveal; `PersonPage.server` renders it bare.
 *
 * A 1:1 landing page for one named buyer at a target account.
 *
 * Sits underneath that account's ABM page (/{companySlug}/{personSlug}) and
 * argues to the individual rather than the company. The company page already
 * makes the "we know your business" case; this one makes the "we know your
 * job, and here is where we left off" case.
 *
 * The engagement tier does most of the editorial work:
 *   key / engaged → the page opens with the existing relationship, shows the
 *                   real touchpoint timeline, and names the people already in
 *                   the thread. It reads as a continuation.
 *   known         → no relationship is claimed. The timeline is absent
 *                   entirely rather than rendered empty, and the page opens
 *                   with an introduction.
 *
 * Everything is CMS-first with graceful per-field absence: a section whose
 * content is missing does not render, so a thin page still looks deliberate.
 * Matches the ABM page's Greenfield palette and its scroll-reveal behaviour,
 * which is progressive enhancement only — the server renders it all visible.
 */

import type { PersonPage as PersonPageType, EngagementTier } from '../lib/graph-types';
import { resolveUrl } from '../lib/graph-types';

interface Props {
    page: PersonPageType;
    /** Forwarded by the client wrapper so it can drive the scroll-reveal
     *  observer. Absent under SSR, where there are no effects. */
    rootRef?: React.Ref<HTMLElement>;
}

const TIER_LABEL: Record<EngagementTier, string> = {
    key: 'Active opportunity',
    engaged: 'In conversation',
    known: 'Introduction',
};

const KIND_LABEL: Record<string, string> = {
    meeting: 'Meeting',
    call: 'Call',
    email: 'Email',
    demo: 'Demo',
    event: 'Event',
};

/** "2026-03-14" → "14 Mar 2026". Returns the raw string if it isn't a date,
 *  so a hand-entered value never renders as "Invalid Date". */
function formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LinkedInIcon() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.02 8h4.96v14H.02V8zm7.44 0h4.76v1.9h.07c.66-1.25 2.28-2.57 4.7-2.57 5.02 0 5.95 3.3 5.95 7.6V22h-4.96v-6.16c0-1.47-.03-3.36-2.05-3.36-2.05 0-2.37 1.6-2.37 3.25V22H7.46V8z" />
        </svg>
    );
}

export default function PersonPageView({ page, rootRef }: Props) {

    const tier: EngagementTier = page.engagementTier ?? 'known';
    const hasRelationship = tier === 'key' || tier === 'engaged';
    const accent = page.brandAccentColor || 'var(--optimizely-blue)';
    const companyHref = page.companySlug ? `/${page.companySlug}` : null;
    const logo = resolveUrl(page.companyLogo);
    const linkedIn = resolveUrl(page.personLinkedIn);
    const ctaHref = resolveUrl(page.heroCtaUrl) || '#next';
    const meetingHref = resolveUrl(page.meetingUrl);

    // A 'known' contact has no relationship to show. Render nothing rather
    // than an empty timeline that implies one.
    const touchpoints = hasRelationship ? (page.touchpoints ?? []) : [];
    const remitPoints = page.remitPoints ?? [];
    const peerProof = page.peerProof ?? [];
    const team = page.team ?? [];

    return (
        <article
            ref={rootRef}
            className="person"
            data-tier={tier}
            style={{ '--brand-accent': accent } as React.CSSProperties}
        >
            {/* ---------- Hero ---------- */}
            <header className="person__hero">
                <div className="person__hero-inner">
                    <nav className="person__breadcrumb" aria-label="Breadcrumb">
                        {logo && (
                            <img className="person__company-logo" src={logo} alt="" width={28} height={28} />
                        )}
                        {companyHref ? (
                            <a href={companyHref} className="person__company-link">
                                {page.companyName}
                            </a>
                        ) : (
                            <span className="person__company-link">{page.companyName}</span>
                        )}
                        <span className="person__crumb-sep" aria-hidden="true">/</span>
                        <span className="person__crumb-current">{page.personName}</span>
                    </nav>

                    <div className="person__identity">
                        <div
                            className="person__avatar"
                            style={
                                {
                                    '--av-color': page.personAvatarColor || 'var(--optimizely-blue-60)',
                                } as React.CSSProperties
                            }
                            aria-hidden="true"
                        >
                            {page.personInitials}
                        </div>
                        <div className="person__identity-text">
                            {page.heroEyebrow && <p className="person__eyebrow">{page.heroEyebrow}</p>}
                            <h1 className="person__name">
                                {page.personName}
                                {linkedIn && (
                                    <a
                                        href={linkedIn}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="person__linkedin"
                                        aria-label={`${page.personName ?? 'This person'} on LinkedIn`}
                                    >
                                        <LinkedInIcon />
                                    </a>
                                )}
                            </h1>
                            <p className="person__title">{page.personTitle}</p>
                            <span className="person__tier-badge" data-tier={tier}>
                                {TIER_LABEL[tier]}
                            </span>
                        </div>
                    </div>

                    {page.heroHeadline && <p className="person__headline">{page.heroHeadline}</p>}
                    {page.heroSubheadline && <p className="person__subhead">{page.heroSubheadline}</p>}
                    {page.heroCtaText && (
                        <a href={ctaHref} className="person__cta person__cta--hero">
                            {page.heroCtaText}
                        </a>
                    )}
                </div>
            </header>

            {/* ---------- Where we left off ----------
                Only for people we have actually spoken to. */}
            {hasRelationship && (page.engagementSummary || touchpoints.length > 0) && (
                <section className="person__section person__engagement" data-person-reveal>
                    <div className="person__section-inner">
                        <h2 className="person__section-heading">
                            {page.engagementHeadline || 'Where we left off'}
                        </h2>
                        {page.engagementSummary && (
                            <p className="person__lede">{page.engagementSummary}</p>
                        )}

                        {page.openOpportunityName && (
                            <div className="person__opp">
                                <span className="person__opp-label">Open opportunity</span>
                                <strong className="person__opp-name">{page.openOpportunityName}</strong>
                                {page.openOpportunityStage && (
                                    <span className="person__opp-stage">{page.openOpportunityStage}</span>
                                )}
                                {page.openOpportunityDetail && (
                                    <span className="person__opp-detail">{page.openOpportunityDetail}</span>
                                )}
                            </div>
                        )}

                        {touchpoints.length > 0 && (
                            <ol className="person__timeline">
                                {touchpoints.map((t, i) => (
                                    <li key={i} className="person__touchpoint">
                                        <span className="person__touchpoint-dot" aria-hidden="true" />
                                        <div className="person__touchpoint-body">
                                            <div className="person__touchpoint-meta">
                                                <time dateTime={t.Date ?? undefined}>{formatDate(t.Date)}</time>
                                                {t.Kind && (
                                                    <span className="person__touchpoint-kind">
                                                        {KIND_LABEL[t.Kind] ?? t.Kind}
                                                    </span>
                                                )}
                                            </div>
                                            {t.Summary && <p className="person__touchpoint-summary">{t.Summary}</p>}
                                            {t.OptimizelyPerson && (
                                                <p className="person__touchpoint-who">with {t.OptimizelyPerson}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            )}

            {/* ---------- Their remit ---------- */}
            {remitPoints.length > 0 && (
                <section className="person__section person__remit" data-person-reveal>
                    <div className="person__section-inner">
                        <h2 className="person__section-heading">
                            {page.remitHeadline || 'What sits on your desk'}
                        </h2>
                        {page.remitIntro && <p className="person__lede">{page.remitIntro}</p>}
                        <div className="person__remit-grid">
                            {remitPoints.map((r, i) => (
                                <div key={i} className="person__remit-card">
                                    {r.Metric && <span className="person__remit-metric">{r.Metric}</span>}
                                    <h3 className="person__remit-title">{r.Title}</h3>
                                    <p className="person__remit-desc">{r.Description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ---------- Peer proof ---------- */}
            {peerProof.length > 0 && (
                <section className="person__section person__proof" data-person-reveal>
                    <div className="person__section-inner">
                        <h2 className="person__section-heading">
                            {page.peerProofHeadline || 'Others in your seat'}
                        </h2>
                        <div className="person__proof-grid">
                            {peerProof.map((p, i) => {
                                const src = resolveUrl(p.SourceUrl);
                                return (
                                    <figure key={i} className="person__proof-card">
                                        <blockquote className="person__proof-quote">{p.Quote}</blockquote>
                                        <figcaption className="person__proof-attr">
                                            <strong>{p.PersonName}</strong>
                                            <span>{p.PersonTitle}</span>
                                            <span className="person__proof-company">{p.Company}</span>
                                            {src && (
                                                <a href={src} target="_blank" rel="noopener noreferrer">
                                                    Read the story
                                                </a>
                                            )}
                                        </figcaption>
                                    </figure>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ---------- Account team ---------- */}
            {team.length > 0 && (
                <section className="person__section person__team" data-person-reveal>
                    <div className="person__section-inner">
                        <h2 className="person__section-heading">
                            {page.teamHeadline || 'Who you would be working with'}
                        </h2>
                        <div className="person__team-row">
                            {team.map((m, i) => (
                                <div key={i} className="person__team-card">
                                    <div
                                        className="person__avatar person__avatar--sm"
                                        style={
                                            {
                                                '--av-color': m.AvatarColor || 'var(--optimizely-blue-60)',
                                            } as React.CSSProperties
                                        }
                                        aria-hidden="true"
                                    >
                                        {m.Initials}
                                    </div>
                                    <div className="person__team-info">
                                        <strong>{m.Name}</strong>
                                        <span>{m.Role}</span>
                                        {m.Email && (
                                            <a href={`mailto:${m.Email}`} className="person__team-email">
                                                {m.Email}
                                            </a>
                                        )}
                                        {m.AlreadyMet && (
                                            <span className="person__team-met">You have already met</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ---------- Closing ---------- */}
            {(page.ctaTitle || page.ctaButtonText) && (
                <section className="person__section person__closing" id="next" data-person-reveal>
                    <div className="person__section-inner">
                        {page.ctaTitle && <h2 className="person__closing-title">{page.ctaTitle}</h2>}
                        {page.ctaBody && <p className="person__lede">{page.ctaBody}</p>}
                        {page.ctaButtonText && (
                            <a href={meetingHref || ctaHref} className="person__cta">
                                {page.ctaButtonText}
                            </a>
                        )}
                    </div>
                </section>
            )}

            <footer className="person__footer">
                <div className="person__section-inner">
                    {page.footerLine && <p>{page.footerLine}</p>}
                    {companyHref && (
                        <a href={companyHref} className="person__back">
                            Back to {page.companyName}
                        </a>
                    )}
                </div>
            </footer>
        </article>
    );
}
