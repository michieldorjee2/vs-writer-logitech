/**
 * PersonPageView — the 1:1 buyer page, one level in from the company page.
 *
 * Seven beats, against the company page's ten. Shorter, but each does work the
 * company page structurally cannot:
 *
 *   1  the note          a message, signed and dated, over the zoomed system
 *   2  what we looked at a counted claim, then provenance with its register
 *   3  the scorecard     what a seat like theirs is measured on — as a hypothesis
 *   4  the solutions     the same product story, entered through that scorecard
 *   5  someone in your seat  peer proof matched on role first
 *   6  the one number    a single figure from their scorecard, counted up
 *   7  the ask           named humans, one booking link
 *
 * The register on each provenance item is the thing that keeps this page the
 * right side of creepy: `told` is their own words back, `read` is public and
 * linked so they can see what we saw, and `assumed` is an inference about the
 * ROLE, labelled as an assumption and open to correction. Showing the working
 * is the opposite of watching someone.
 *
 * No hooks and no CSS import, so `renderToString` and the browser produce the
 * same tree. `PersonPage` wraps it with the reveal observer and the canvas;
 * `PersonPage.server` renders it bare.
 */

import type {
    PersonPage as PersonPageType,
    EngagementTier,
    ProvenanceRegister,
} from '../lib/graph-types';
import { resolveUrl } from '../lib/graph-types';
import { readableAccentOnFir } from '../lib/brand-accent';

interface Props {
    page: PersonPageType;
    rootRef?: React.Ref<HTMLElement>;
}

const TIER_LABEL: Record<EngagementTier, string> = {
    key: 'Active opportunity',
    engaged: 'In conversation',
    known: 'Introduction',
};

const REGISTER_LABEL: Record<ProvenanceRegister, string> = {
    told: 'You told us',
    read: 'We read',
    assumed: 'We assumed',
};

const PRODUCT_LABEL: Record<string, string> = {
    cms: 'CMS',
    opal: 'Opal',
    experimentation: 'Experimentation',
    cmp: 'CMP',
    commerce: 'Commerce',
};

const KIND_LABEL: Record<string, string> = {
    meeting: 'Meeting',
    call: 'Call',
    email: 'Email',
    demo: 'Demo',
    event: 'Event',
};

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LinkedInIcon() {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.02 8h4.96v14H.02V8zm7.44 0h4.76v1.9h.07c.66-1.25 2.28-2.57 4.7-2.57 5.02 0 5.95 3.3 5.95 7.6V22h-4.96v-6.16c0-1.47-.03-3.36-2.05-3.36-2.05 0-2.37 1.6-2.37 3.25V22H7.46V8z" />
        </svg>
    );
}

function ArrowRight() {
    return (
        <svg className="person__cta-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    );
}

export default function PersonPageView({ page, rootRef }: Props) {
    const tier: EngagementTier = page.engagementTier ?? 'known';
    const hasThread = tier === 'key' || tier === 'engaged';

    const accent = page.brandAccentColor ? readableAccentOnFir(page.brandAccentColor) : undefined;
    const companyHref = page.companySlug ? `/${page.companySlug}` : null;
    const logo = resolveUrl(page.companyLogo);
    const linkedIn = resolveUrl(page.personLinkedIn);
    const meetingHref = resolveUrl(page.meetingUrl);
    const ctaHref = meetingHref || resolveUrl(page.heroCtaUrl) || '#next';

    const provenance = page.provenance ?? [];
    const scorecard = page.scorecard ?? [];
    const solutions = page.solutions ?? [];
    const peerProof = page.peerProof ?? [];
    const team = page.team ?? [];
    const touchpoints = hasThread ? (page.touchpoints ?? []) : [];

    return (
        <article
            ref={rootRef}
            className="person"
            data-tier={tier}
            style={accent ? ({ '--brand-accent': accent } as React.CSSProperties) : undefined}
        >
            {/* ═══ 01 · THE NOTE ═══
                The company hero orbits two logos. This one has flown into that
                system: the company is the star, the solutions are in orbit, and
                a short signed message sits over it. */}
            <header className="person__hero">
                <canvas id="person-system" className="person__canvas" aria-hidden="true" />
                <div className="person__hero-inner">
                    <nav className="person__crumb" aria-label="Breadcrumb">
                        {logo && <img className="person__crumb-logo" src={logo} alt="" width={22} height={22} />}
                        {companyHref ? <a href={companyHref}>{page.companyName}</a> : <span>{page.companyName}</span>}
                        <span className="person__crumb-sep" aria-hidden="true">/</span>
                        <span className="person__crumb-here">{page.personName}</span>
                    </nav>

                    <div className="person__ident">
                        <p className="person__eyebrow">
                            {page.heroEyebrow || `Written for ${page.personName}`}
                        </p>
                        <h1 className="person__name">
                            {page.personName}
                            {linkedIn && (
                                <a href={linkedIn} target="_blank" rel="noopener noreferrer"
                                    className="person__linkedin"
                                    aria-label={`${page.personName ?? 'This person'} on LinkedIn (opens in a new tab)`}>
                                    <LinkedInIcon />
                                </a>
                            )}
                        </h1>
                        <p className="person__role">
                            {page.personTitle}
                            {page.roleFrame && <span className="person__frame">{page.roleFrame}</span>}
                        </p>
                    </div>

                    {page.noteBody && (
                        <div className="person__note">
                            <p className="person__note-body">{page.noteBody}</p>
                            <div className="person__sig">
                                <span className="person__sig-mark" aria-hidden="true">
                                    {page.noteSignedByInitials}
                                </span>
                                <span className="person__sig-who">
                                    <strong>{page.noteSignedBy}</strong>
                                    <span>{page.noteSignedByRole}</span>
                                </span>
                                {page.noteDate && (
                                    <time className="person__sig-date" dateTime={page.noteDate}>
                                        {formatDate(page.noteDate)}
                                    </time>
                                )}
                            </div>
                        </div>
                    )}

                    <span className="person__tier" data-tier={tier}>
                        <span className="person__tier-dot" aria-hidden="true" />
                        {TIER_LABEL[tier]}
                    </span>
                </div>
            </header>

            {/* ═══ 02 · WHAT WE LOOKED AT ═══
                Quality over quantity, moved to the person: a counted claim, then
                the handful that mattered — each carrying where it came from. */}
            {(page.researchClaim || provenance.length > 0) && (
                <section className="person__section person__section--research" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">Before writing this</span>
                        <h2 className="person__title">
                            {page.researchHeadline || 'What we looked at'}
                        </h2>
                        {page.researchClaim && <p className="person__lede">{page.researchClaim}</p>}

                        {provenance.length > 0 && (
                            <ul className="person__prov">
                                {provenance.map((p, i) => {
                                    const reg = (p.Register ?? 'assumed') as ProvenanceRegister;
                                    const src = resolveUrl(p.SourceUrl);
                                    return (
                                        <li key={i} className="person__prov-item" data-register={reg}>
                                            <span className="person__prov-reg">{REGISTER_LABEL[reg]}</span>
                                            <p className="person__prov-text">{p.Text}</p>
                                            {p.SourceLabel && (
                                                <p className="person__prov-src">
                                                    {src ? (
                                                        <a href={src} target="_blank" rel="noopener noreferrer">
                                                            {p.SourceLabel}
                                                        </a>
                                                    ) : (
                                                        p.SourceLabel
                                                    )}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ THE THREAD ═══
                Only where the CRM evidences one. A stranger gets no timeline
                rather than an empty one. */}
            {hasThread && (touchpoints.length > 0 || page.openOpportunityName) && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">The thread</span>
                        <h2 className="person__title">{page.engagementHeadline || 'Where we left off'}</h2>
                        {page.engagementSummary && <p className="person__lede">{page.engagementSummary}</p>}

                        {page.openOpportunityName && (
                            <div className="person__opp">
                                <span className="person__opp-label">Open</span>
                                <strong className="person__opp-name">{page.openOpportunityName}</strong>
                                {page.openOpportunityStage && <span className="person__opp-stage">{page.openOpportunityStage}</span>}
                                {page.openOpportunityDetail && <span className="person__opp-detail">{page.openOpportunityDetail}</span>}
                            </div>
                        )}

                        {touchpoints.length > 0 && (
                            <ol className="person__rail">
                                {touchpoints.map((t, i) => (
                                    <li key={i} className="person__stop">
                                        <span className="person__stop-marker" aria-hidden="true">{touchpoints.length - i}</span>
                                        <div className="person__stop-card">
                                            <time className="person__stop-date" dateTime={t.Date ?? undefined}>{formatDate(t.Date)}</time>
                                            {t.Kind && <span className="person__stop-kind">{KIND_LABEL[t.Kind] ?? t.Kind}</span>}
                                            {t.Summary && <p className="person__stop-summary">{t.Summary}</p>}
                                            {t.OptimizelyPerson && <p className="person__stop-who">with {t.OptimizelyPerson}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ 03 · THE SCORECARD ═══
                The layer the company page has no room for. Stated as a
                hypothesis, because that is what it is. */}
            {scorecard.length > 0 && (
                <section className="person__section person__section--scorecard" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">Your scorecard</span>
                        <h2 className="person__title">
                            {page.scorecardHeadline || 'What a seat like yours is measured on'}
                        </h2>
                        {page.scorecardIntro && <p className="person__lede">{page.scorecardIntro}</p>}

                        <div className="person__cards">
                            {scorecard.map((s, i) => (
                                <article key={i} className="person__card">
                                    <span className="person__card-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                                    <h3 className="person__card-measure">{s.Measure}</h3>
                                    {s.WhyHard && (
                                        <p className="person__card-why">
                                            <span className="person__card-tag">Why it's hard here</span>
                                            {s.WhyHard}
                                        </p>
                                    )}
                                    {s.WhatChanges && (
                                        <p className="person__card-change">
                                            <span className="person__card-tag person__card-tag--go">What changes</span>
                                            {s.WhatChanges}
                                        </p>
                                    )}
                                    {s.Metric && <span className="person__card-metric">{s.Metric}</span>}
                                </article>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ 04 · THE SOLUTIONS ═══
                Same claims as the company page, entered through the scorecard.
                The order here is the order in the hero's orbit. */}
            {solutions.length > 0 && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">In your orbit</span>
                        <h2 className="person__title">
                            {page.solutionsHeadline || 'What that means for your stack'}
                        </h2>
                        {page.solutionsIntro && <p className="person__lede">{page.solutionsIntro}</p>}

                        <ol className="person__solutions">
                            {solutions.map((s, i) => (
                                <li key={i} className="person__solution">
                                    <span className="person__solution-badge" aria-hidden="true">
                                        {PRODUCT_LABEL[s.Product ?? ''] ?? s.Product}
                                    </span>
                                    <div className="person__solution-body">
                                        <h3 className="person__solution-headline">{s.Headline}</h3>
                                        {s.Body && <p>{s.Body}</p>}
                                        {s.WhyFirst && <p className="person__solution-why">{s.WhyFirst}</p>}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>
            )}

            {/* ═══ 06 · THE ONE NUMBER ═══
                The company page runs four ROI cards. A person gets one figure,
                drawn from their own scorecard, counted up on scroll. */}
            {page.keyNumberValue && (
                <section className="person__section person__section--number" data-person-anim>
                    <div className="person__inner person__inner--narrow">
                        <span className="person__label">The number that matters to you</span>
                        <p className="person__bignum">
                            {page.keyNumberPrefix && <span className="person__bignum-fix">{page.keyNumberPrefix}</span>}
                            <span className="person__bignum-val" data-person-count={page.keyNumberValue}>0</span>
                            {page.keyNumberSuffix && <span className="person__bignum-fix">{page.keyNumberSuffix}</span>}
                        </p>
                        {page.keyNumberLabel && <p className="person__bignum-label">{page.keyNumberLabel}</p>}
                        {page.keyNumberDetail && (
                            <p className="person__bignum-detail">
                                {page.keyNumberDetail}{' '}
                                {resolveUrl(page.keyNumberCitationUrl) && (
                                    <a href={resolveUrl(page.keyNumberCitationUrl)!} target="_blank" rel="noopener noreferrer">
                                        Source
                                    </a>
                                )}
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ 05 · SOMEONE IN YOUR SEAT ═══
                Matched on role first, industry second — the company page
                matches the other way round. */}
            {peerProof.length > 0 && (
                <section className="person__section" data-person-anim>
                    <div className="person__inner">
                        <span className="person__label">Peer proof</span>
                        <h2 className="person__title">{page.peerProofHeadline || 'Someone in your seat'}</h2>
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
                                            {src && <a href={src} target="_blank" rel="noopener noreferrer">Read the story</a>}
                                        </figcaption>
                                    </figure>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ 07 · THE ASK ═══ */}
            {(page.ctaTitle || team.length > 0) && (
                <section className="person__section person__closing" id="next" data-person-anim>
                    <div className="person__inner person__inner--narrow">
                        {page.ctaTitle && <h2 className="person__question">{page.ctaTitle}</h2>}
                        {page.ctaBody && <p className="person__lede">{page.ctaBody}</p>}

                        {team.length > 0 && (
                            <div className="person__team">
                                {team.map((m, i) => (
                                    <div key={i} className="person__member">
                                        <div className="person__avatar person__avatar--sm"
                                            style={{ '--av-color': m.AvatarColor || 'var(--light-blue)' } as React.CSSProperties}
                                            aria-hidden="true">
                                            {m.Initials}
                                        </div>
                                        <div className="person__member-info">
                                            <strong>{m.Name}</strong>
                                            <span>{m.Role}</span>
                                            {m.AlreadyMet && <span className="person__met">You have met</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {page.ctaButtonText && (
                            <a href={ctaHref} className="person__cta">
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
                        <a href={companyHref} className="person__back">Back to {page.companyName}</a>
                    )}
                </div>
            </footer>
        </article>
    );
}
