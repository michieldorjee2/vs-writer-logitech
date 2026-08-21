/**
 * PersonPageView — markup for the 1:1 buyer page. No hooks, no CSS import,
 * so `renderToString` and the browser produce the same tree. `PersonPage`
 * wraps it with the reveal observer; `PersonPage.server` renders it bare.
 *
 * The arc is deliberately not the company page's. That page opens on a 3D
 * canvas and argues in grids — stat ribbon, three-column dossier, comparison
 * tabs — because it is making a case about an organisation. A page about one
 * person earns its keep by being linear and specific:
 *
 *   identity plate → the thread → the ledger → peer proof → team → one question
 *
 * The engagement tier decides what the second section even is. `key` and
 * `engaged` get the thread: a horizontal rail of interactions that actually
 * happened, drawn from Salesforce. `known` gets a cold open that says plainly
 * that we have not spoken, and shows what the page was built from instead.
 * Rendering an empty timeline for a stranger would imply a relationship that
 * does not exist, which is the one mistake this page cannot make — it may be
 * read by the person it names.
 */

import type { PersonPage as PersonPageType, EngagementTier } from '../lib/graph-types';
import { resolveUrl } from '../lib/graph-types';
import { readableAccentOnFir } from '../lib/brand-accent';

interface Props {
    page: PersonPageType;
    /** Forwarded by the client wrapper to drive the reveal observer. Absent
     *  under SSR, where there are no effects. */
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

/** "2026-03-14" → "14 Mar 2026". Falls back to the raw string so a
 *  hand-entered value never renders as "Invalid Date". */
function formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LinkedInIcon() {
    return (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.02 8h4.96v14H.02V8zm7.44 0h4.76v1.9h.07c.66-1.25 2.28-2.57 4.7-2.57 5.02 0 5.95 3.3 5.95 7.6V22h-4.96v-6.16c0-1.47-.03-3.36-2.05-3.36-2.05 0-2.37 1.6-2.37 3.25V22H7.46V8z" />
        </svg>
    );
}

function ArrowRight() {
    return (
        <svg
            className="person__cta-arrow"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
        >
            <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
    );
}

export default function PersonPageView({ page, rootRef }: Props) {
    const tier: EngagementTier = page.engagementTier ?? 'known';
    const hasThread = tier === 'key' || tier === 'engaged';

    // Customer brand colours are often near-black (AtriCure is #123663), which
    // disappears on fir. Same clamp the company page applies: keep the hue,
    // lift the lightness into a legible band.
    const accent = page.brandAccentColor ? readableAccentOnFir(page.brandAccentColor) : undefined;
    const companyHref = page.companySlug ? `/${page.companySlug}` : null;
    const logo = resolveUrl(page.companyLogo);
    const linkedIn = resolveUrl(page.personLinkedIn);
    const ctaHref = resolveUrl(page.heroCtaUrl) || '#one-question';
    const meetingHref = resolveUrl(page.meetingUrl);

    // A stranger gets no timeline at all, not an empty one.
    const touchpoints = hasThread ? (page.touchpoints ?? []) : [];
    const remitPoints = page.remitPoints ?? [];
    const peerProof = page.peerProof ?? [];
    const team = page.team ?? [];
    const firstName = (page.personName ?? '').trim().split(/\s+/)[0] || 'you';

    return (
        <article
            ref={rootRef}
            className="person"
            data-tier={tier}
            style={accent ? ({ '--brand-accent': accent } as React.CSSProperties) : undefined}
        >
            {/* ============ IDENTITY PLATE ============ */}
            <header className="person__hero">
                <div className="person__inner">
                    <nav className="person__crumb" aria-label="Breadcrumb">
                        {logo && <img className="person__crumb-logo" src={logo} alt="" width={24} height={24} />}
                        {companyHref ? (
                            <a href={companyHref}>{page.companyName}</a>
                        ) : (
                            <span>{page.companyName}</span>
                        )}
                        <span className="person__crumb-sep" aria-hidden="true">/</span>
                        <span className="person__crumb-here">{page.personName}</span>
                    </nav>

                    <div className="person__plate">
                        <div
                            className="person__avatar"
                            style={{ '--av-color': page.personAvatarColor || 'var(--color-primary-lfgreen)' } as React.CSSProperties}
                            aria-hidden="true"
                        >
                            {page.personInitials}
                        </div>

                        <div>
                            {page.heroEyebrow && <p className="person__eyebrow">{page.heroEyebrow}</p>}
                            <h1 className="person__name">
                                {page.personName}
                                {linkedIn && (
                                    <a
                                        href={linkedIn}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="person__linkedin"
                                        aria-label={`${page.personName ?? 'This person'} on LinkedIn (opens in a new tab)`}
                                    >
                                        <LinkedInIcon />
                                    </a>
                                )}
                            </h1>
                            <p className="person__role">{page.personTitle}</p>
                            <span className="person__tier">
                                <span className="person__tier-dot" aria-hidden="true" />
                                {TIER_LABEL[tier]}
                            </span>
                        </div>
                    </div>

                    {(page.heroHeadline || page.heroSubheadline) && (
                        <div className="person__pitch">
                            {page.heroHeadline && <p className="person__headline">{page.heroHeadline}</p>}
                            {page.heroSubheadline && <p className="person__subhead">{page.heroSubheadline}</p>}
                            {page.heroCtaText && (
                                <a href={ctaHref} className="person__cta">
                                    {page.heroCtaText}
                                    <ArrowRight />
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* ============ THE THREAD ============
                Only for people we have actually spoken to. */}
            {hasThread && (page.engagementSummary || touchpoints.length > 0 || page.openOpportunityName) && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">The thread</span>
                        <h2 className="person__title">{page.engagementHeadline || 'Where we left off'}</h2>
                        {page.engagementSummary && <p className="person__lede">{page.engagementSummary}</p>}

                        {page.openOpportunityName && (
                            <div className="person__opp">
                                <span className="person__opp-label">Open</span>
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
                            <ol className="person__rail">
                                {touchpoints.map((t, i) => (
                                    <li key={i} className="person__stop">
                                        <span className="person__stop-marker" aria-hidden="true">
                                            {touchpoints.length - i}
                                        </span>
                                        <div className="person__stop-card">
                                            <time className="person__stop-date" dateTime={t.Date ?? undefined}>
                                                {formatDate(t.Date)}
                                            </time>
                                            {t.Kind && (
                                                <span className="person__stop-kind">{KIND_LABEL[t.Kind] ?? t.Kind}</span>
                                            )}
                                            {t.Summary && <p className="person__stop-summary">{t.Summary}</p>}
                                            {t.OptimizelyPerson && (
                                                <p className="person__stop-who">with {t.OptimizelyPerson}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            )}

            {/* ============ COLD OPEN ============
                What a stranger gets instead: the truth, and our working. */}
            {!hasThread && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <div className="person__coldopen">
                            <span className="person__label">Why this exists</span>
                            <h2 className="person__title">{page.engagementHeadline || 'We have not met yet'}</h2>
                            <p className="person__lede">
                                {page.engagementSummary ||
                                    `No one at Optimizely has spoken with ${firstName} yet, so nothing on this page is a callback to a conversation. It was built from public information about the role and what ${page.companyName ?? 'the company'} has said about its own plans.`}
                            </p>
                            <div className="person__sources">
                                <span className="person__source">Public role</span>
                                <span className="person__source">{page.companyName ?? 'Company'} newsroom</span>
                                <span className="person__source">Published customer stories</span>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ============ THE LEDGER ============ */}
            {remitPoints.length > 0 && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">Your remit</span>
                        <h2 className="person__title">{page.remitHeadline || 'What sits on your desk'}</h2>
                        {page.remitIntro && <p className="person__lede">{page.remitIntro}</p>}

                        <div className="person__ledger">
                            {remitPoints.map((r, i) => (
                                <div key={i} className="person__row">
                                    <span className="person__row-num" aria-hidden="true">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="person__row-own">{r.Title}</h3>
                                    <div className="person__row-answer">
                                        {r.Description && <p>{r.Description}</p>}
                                        {r.Metric && <span className="person__row-metric">{r.Metric}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ============ PEER PROOF ============ */}
            {peerProof.length > 0 && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">Peer proof</span>
                        <h2 className="person__title">{page.peerProofHeadline || 'Others in your seat'}</h2>
                        <div className="person__proof">
                            {peerProof.map((p, i) => {
                                const src = resolveUrl(p.SourceUrl);
                                return (
                                    <figure key={i} className="person__quote-card">
                                        <blockquote className="person__quote">{p.Quote}</blockquote>
                                        <figcaption className="person__attr">
                                            <strong>{p.PersonName}</strong>
                                            <span className="person__attr-role">{p.PersonTitle}</span>
                                            <span>{p.Company}</span>
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

            {/* ============ TEAM ============ */}
            {team.length > 0 && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">Your team</span>
                        <h2 className="person__title">{page.teamHeadline || 'Who you would be working with'}</h2>
                        <div className="person__team">
                            {team.map((m, i) => (
                                <div key={i} className="person__member">
                                    <div
                                        className="person__avatar person__avatar--sm"
                                        style={{ '--av-color': m.AvatarColor || 'var(--light-blue)' } as React.CSSProperties}
                                        aria-hidden="true"
                                    >
                                        {m.Initials}
                                    </div>
                                    <div className="person__member-info">
                                        <strong>{m.Name}</strong>
                                        <span>{m.Role}</span>
                                        {m.Email && (
                                            <a href={`mailto:${m.Email}`} className="person__member-email">
                                                {m.Email}
                                            </a>
                                        )}
                                        {m.AlreadyMet && <span className="person__met">You have met</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ============ ONE QUESTION ============ */}
            {(page.ctaTitle || page.ctaButtonText) && (
                <section className="person__section person__closing" id="one-question" data-person-anim>
                    <div className="person__inner person__inner--narrow">
                        <span className="person__label">One question</span>
                        {page.ctaTitle && <h2 className="person__question">{page.ctaTitle}</h2>}
                        {page.ctaBody && <p className="person__lede">{page.ctaBody}</p>}
                        {page.ctaButtonText && (
                            <a href={meetingHref || ctaHref} className="person__cta">
                                {page.ctaButtonText}
                                <ArrowRight />
                            </a>
                        )}
                    </div>
                </section>
            )}

            <footer className="person__footer">
                <div className="person__inner">
                    <span>{page.footerLine}</span>
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
