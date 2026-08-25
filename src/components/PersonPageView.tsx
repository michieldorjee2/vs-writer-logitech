/**
 * PersonPageView — the 1:1 buyer page, one level in from the company page.
 *
 * Rebuilt 2026-08-25. The version before this spent 47% of its words on our own
 * analysis of the reader — a section on what we crawled, then a table of our
 * conclusions about their job — and 21% on the product. It read as a dossier
 * about someone rather than a pitch to them. The order now is:
 *
 *   1  the opening        who it's for, the claim, and their own words as warrant
 *   2  the problem        what a seat like theirs is scored on
 *   3  your operation     their business as the REASON the product matters
 *   4  in practice        the product as a change to how their team works
 *   5  how it works       mechanism, four steps, identical on every page
 *   6  proof              one cited figure, and peers in the same seat
 *   7  the ask            named humans, one booking link
 *   8  why you see this   the working, demoted to a strip
 *
 * Two rules govern what may appear here, and both are load-bearing:
 *
 *   SALESFORCE IS AN INPUT TO REASONING, NEVER AN OUTPUT TO THE PAGE. It can
 *   decide what we argue and at what altitude; it never appears as a citation.
 *   The old "thread" section rendered an itemised log of our own outreach —
 *   who emailed whom, when slots were offered — plus the open opportunity's
 *   name and stage. All of it is gone. If a real interaction the reader took
 *   part in is worth naming, it belongs in a sentence in the opening, never as
 *   a timeline.
 *
 *   THE WORKING STAYS VISIBLE, JUST QUIETLY. This page names an individual.
 *   Naming someone and showing no working at all is where personalisation
 *   turns creepy, so the `assumed` register survives at the foot of the page
 *   with its invitation to correct us intact. It is what earns everything
 *   above it.
 *
 * No hooks and no CSS import, so `renderToString` and the browser produce the
 * same tree. `PersonPage` wraps it with the reveal timeline and the galaxy;
 * `PersonPage.server` renders it bare.
 */

import type {
    PersonPage as PersonPageType,
    EngagementTier,
} from '../lib/graph-types';
import { resolveUrl } from '../lib/graph-types';
import { readableAccentOnFir } from '../lib/brand-accent';

interface Props {
    page: PersonPageType;
    rootRef?: React.Ref<HTMLElement>;
}

/**
 * The badge is the page's register, and it has to be phrased from the reader's
 * side. `key` used to render "Active opportunity" — which quietly tells someone
 * we hold an open deal record against their name. That is a CRM stage on a
 * customer-facing page, exactly what the policy above forbids, so the labels
 * now describe the conversation rather than the pipeline.
 */
const TIER_LABEL: Record<EngagementTier, string> = {
    key: 'Continuing our conversation',
    engaged: 'In conversation',
    known: 'An introduction',
};

/**
 * Full product names, never acronyms — these are read by people outside the
 * building, and "CMP" means nothing to them. The names match optimizely.com's
 * own product pages, which is what the nav and footer link to.
 */
export const PRODUCT_LABEL: Record<string, string> = {
    cms: 'Content Management',
    opal: 'Opal',
    experimentation: 'Experimentation',
    cmp: 'Content Marketing',
    commerce: 'Commerce',
};

const PRODUCT_HREF: Record<string, string> = {
    cms: 'https://www.optimizely.com/products/content-management',
    opal: 'https://www.optimizely.com/products/opal',
    experimentation: 'https://www.optimizely.com/products/experimentation',
    cmp: 'https://www.optimizely.com/products/content-marketing',
    commerce: 'https://www.optimizely.com/products/commerce',
};

/**
 * How the platform works, in four steps. Deliberately identical on every person
 * page: it is the one section about the product rather than the reader, so
 * repeating it verbatim is what makes a set of these read as one product rather
 * than a pile of bespoke microsites. It describes mechanism, not outcome — the
 * previous page asserted results with nothing behind them.
 */
const HOW_IT_WORKS = [
    {
        title: 'Connect what you already run',
        body: 'Content, data and audiences come from the systems you have in place today. Nothing has to be migrated to get started.',
    },
    {
        title: 'Build without a release',
        body: 'Marketers work in a visual editor against approved components, so engineering stays on product work instead of page requests.',
    },
    {
        title: 'Keep the guardrails',
        body: 'Brand, legal and approval checkpoints stay inside the flow, so moving faster does not cost you control of what ships.',
    },
    {
        title: 'Measure, then keep the wins',
        body: 'Every change is tested against real behaviour, and what works feeds the next decision rather than an end-of-quarter report.',
    },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "2026-03-14" -> "14 Mar 2026", parsed off the string rather than through a
 * Date. `toLocaleDateString` resolves against the runtime's timezone and
 * locale, so the server (UTC) and the reader's browser can format the same ISO
 * date differently — which React reports as a hydration mismatch and then
 * throws away the server-rendered tree to recover from.
 */
function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    if (!m) return iso;
    const month = MONTHS[Number(m[2]) - 1];
    if (!month) return iso;
    return `${Number(m[3])} ${month} ${m[1]}`;
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    );
}

/**
 * The company page's section header — label, title, description, centred — so
 * both surfaces open every section on the same beat.
 */
function SectionHead({ label, title, lede }: { label: string; title: string; lede?: string | null }) {
    return (
        <div className="person__head" data-person-anim>
            <span className="person__label">{label}</span>
            <h2 className="person__title">{title}</h2>
            {lede && <p className="person__lede">{lede}</p>}
        </div>
    );
}

export default function PersonPageView({ page, rootRef }: Props) {
    const tier: EngagementTier = page.engagementTier ?? 'known';

    const accent = page.brandAccentColor ? readableAccentOnFir(page.brandAccentColor) : undefined;
    const companyHref = page.companySlug ? `/${page.companySlug}` : null;
    const logo = resolveUrl(page.companyLogo);
    const linkedIn = resolveUrl(page.personLinkedIn);
    const meetingHref = resolveUrl(page.meetingUrl);
    const ctaHref = meetingHref || resolveUrl(page.heroCtaUrl) || '#next';

    const provenance = page.provenance ?? [];
    const solutions = page.solutions ?? [];
    const peerProof = page.peerProof ?? [];
    const team = page.team ?? [];

    /* What a seat like theirs is scored on. `scorecard` is the current shape;
       `remitPoints` is the previous generation's, and it is still the only
       content the two oldest pages carry — without this fallback they render
       nothing at all where their argument should be. */
    const measures = (page.scorecard ?? []).length
        ? (page.scorecard ?? []).map((s) => ({ title: s.Measure, note: s.WhyHard, metric: s.Metric }))
        : (page.remitPoints ?? []).map((r) => ({ title: r.Title, note: r.Description, metric: r.Metric }));

    /* The `read` register is public fact about their business. It used to be
       presented as evidence of our research — "WE READ", with the source given
       more weight than the finding. Same material, reframed: these are the
       conditions the product has to work inside, and the source shrinks to an
       attribution. */
    const operation = provenance.filter((p) => (p.Register ?? 'assumed') === 'read');

    /* `told` and `assumed` are the honesty register — their own words back to
       them, and our inference about the role labelled as inference. Both stay,
       at the foot of the page. */
    const working = provenance.filter((p) => (p.Register ?? 'assumed') !== 'read');

    const keyNumberText =
        `${page.keyNumberPrefix ?? ''}${Number(page.keyNumberValue ?? 0).toLocaleString('en-US')}${page.keyNumberSuffix ?? ''}`;

    const ctaEyebrow = meetingHref ? 'Straight to a calendar' : 'One step';

    const galaxyProducts = solutions
        .map((s) => PRODUCT_LABEL[s.Product ?? ''] ?? s.Product)
        .filter(Boolean);
    const galaxyDescription = page.siteScreenshotAlt
        ? `${page.siteScreenshotAlt}${galaxyProducts.length ? `, with ${galaxyProducts.join(', ')} shown in orbit around it.` : '.'}`
        : `An illustration of ${page.companyName}'s site${galaxyProducts.length ? ` with ${galaxyProducts.join(', ')} in orbit around it.` : '.'}`;

    return (
        <article
            ref={rootRef}
            className="person"
            data-tier={tier}
            style={accent ? ({ '--brand-accent': accent } as React.CSSProperties) : undefined}
        >
            {/* Fixed to the viewport and first in the tree, so every section
                paints over it. This is the whole page's sky. */}
            <canvas id="person-galaxy" className="person__sky" aria-hidden="true" />

            {/* ═══ CHROME ═══
                Real product nav. It costs almost nothing, and it is most of why
                a page like this reads as Optimizely showing you something rather
                than as a one-off someone built in a deck. */}
            <nav className="person__nav" aria-label="Optimizely">
                <a className="person__nav-brand" href="https://www.optimizely.com">Optimizely</a>
                <div className="person__nav-links">
                    <a href="https://www.optimizely.com/products/content-management">Content Management</a>
                    <a href="https://www.optimizely.com/products/experimentation">Experimentation</a>
                    <a href="https://www.optimizely.com/products/opal">Opal</a>
                    <a href="https://www.optimizely.com/plans">Plans</a>
                </div>
                <a className="person__nav-cta" href={ctaHref}>{page.ctaButtonText || 'Book a call'}</a>
            </nav>

            {/* ═══ 01 · THE OPENING ═══ */}
            <header className="person__hero" id="person-hero">
                <div className="person__sweep" />
                <div className="person__hero-inner">
                    <nav className="person__crumb" aria-label="Breadcrumb">
                        {logo && <img className="person__crumb-logo" src={logo} alt="" width={22} height={22} />}
                        {companyHref ? <a href={companyHref}>{page.companyName}</a> : <span>{page.companyName}</span>}
                        <span className="person__crumb-sep" aria-hidden="true">/</span>
                        <span className="person__crumb-here">{page.personName}</span>
                    </nav>

                    <div className="person__hero-grid">
                        <div className="person__intro">
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

                            {page.noteBody && (
                                <div className="person__opening">
                                    <p className="person__opening-body">{page.noteBody}</p>
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

                        {/* The galaxy owns this box: person-galaxy.ts projects its
                            rect into the scene each frame, which is what keeps the
                            slab and the products beside the copy and scrolls them
                            away with the hero. */}
                        <div className="person__galaxy" id="person-stage">
                            <p className="sr-only">{galaxyDescription}</p>
                        </div>
                    </div>
                </div>

                <div className="person__scroll">
                    <span>Scroll to read</span>
                    <div className="person__scroll-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" aria-hidden="true">
                            <path d="M12 5v14M19 12l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </header>

            {/* ═══ 02 · THE PROBLEM ═══
                What the job is scored on, stated compactly. This was a full
                section of our conclusions headed "your scorecard" — same
                substance, a third of the words, framed as the problem rather
                than as our analysis of them. */}
            {measures.length > 0 && (
                <section className="person__section person__section--problem" id="person-problem">
                    <div className="person__inner">
                        {/* The intro is deliberately dropped. The CMS copy behind it
                            reads "this is our hypothesis about your scorecard, built
                            from your published role…" — the dossier voice, and it
                            duplicates the correction invitation that now lives at the
                            foot of the page. The measures speak for themselves. */}
                        <SectionHead
                            label="What the job is scored on"
                            title={page.scorecardHeadline || page.remitHeadline || 'Where this gets hard'}
                        />
                        <ol className="person__measures" data-person-stagger>
                            {measures.map((m, i) => (
                                <li key={i} className="person__measure">
                                    <span className="person__measure-n" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                                    <h3 className="person__measure-title">{m.title}</h3>
                                    {m.note && <p className="person__measure-note">{m.note}</p>}
                                    {m.metric && <span className="person__measure-metric">{m.metric}</span>}
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>
            )}

            {/* ═══ 03 · YOUR OPERATION ═══ */}
            {operation.length > 0 && (
                <section className="person__section" id="person-operation">
                    <div className="person__inner">
                        {/* `researchHeadline` and `researchClaim` are ignored on
                            purpose. They hold copy like "What we looked at before
                            writing this" and a list of the interviews we read —
                            which is the exact voice this rebuild exists to remove.
                            The agent will fill a field that means "your operation";
                            until then a derived headline is more honest than reusing
                            the old one under a new heading. */}
                        <SectionHead
                            label="Your operation"
                            title={`What ${page.companyName} is running today`}
                        />
                        <div className="person__facts" data-person-stagger>
                            {operation.map((p, i) => {
                                const src = resolveUrl(p.SourceUrl);
                                return (
                                    <div key={i} className="person__fact">
                                        <p className="person__fact-text">{p.Text}</p>
                                        {p.SourceLabel && (
                                            <p className="person__fact-src">
                                                {src ? (
                                                    <a href={src} target="_blank" rel="noopener noreferrer">{p.SourceLabel}</a>
                                                ) : p.SourceLabel}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ 04 · IN PRACTICE ═══
                The pitch. Each product shown as a change to how their team
                works, tied back to the measure it answers. */}
            {solutions.length > 0 && (
                <section className="person__section" id="person-practice">
                    <div className="person__inner">
                        <SectionHead
                            label="In practice"
                            title={page.solutionsHeadline || 'What changes for your team'}
                            lede={page.solutionsIntro}
                        />
                        <div className="person__practice" data-person-stagger>
                            {solutions.map((s, i) => {
                                const key = s.Product ?? '';
                                const href = PRODUCT_HREF[key];
                                return (
                                    <article key={i} className="person__case">
                                        <div className="person__case-top">
                                            <span className="person__case-badge">
                                                {PRODUCT_LABEL[key] ?? s.Product}
                                            </span>
                                            {href && (
                                                <a className="person__case-link" href={href} target="_blank" rel="noopener noreferrer">
                                                    Product overview
                                                </a>
                                            )}
                                        </div>
                                        <h3 className="person__case-title">{s.Headline}</h3>
                                        {s.Body && <p className="person__case-body">{s.Body}</p>}
                                        {s.WhyFirst && <p className="person__case-answers">{s.WhyFirst}</p>}
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>
            )}

            {/* ═══ 05 · HOW IT WORKS ═══ */}
            <section className="person__section" id="person-how">
                <div className="person__inner">
                    <SectionHead
                        label="How it works"
                        title="Four steps, and none of them start with a migration"
                    />
                    <ol className="person__steps" data-person-stagger>
                        {HOW_IT_WORKS.map((s, i) => (
                            <li key={i} className="person__step">
                                <span className="person__step-n" aria-hidden="true">{i + 1}</span>
                                <h3 className="person__step-title">{s.title}</h3>
                                <p className="person__step-body">{s.body}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ═══ 06 · PROOF ═══
                One cited figure, and peers in the same seat. The figure is a
                third party's with a source link, never our own arithmetic. */}
            {(page.keyNumberValue || peerProof.length > 0) && (
                <section className="person__section person__section--number" id="person-proof">
                    <div className="person__inner">
                        {page.keyNumberValue && (
                            <div className="person__inner--narrow">
                                <span className="person__label" data-person-anim>The number that matters to you</span>

                                {/* The company page's projection figure, reused:
                                    twenty extrusion layers behind a lime neon face. */}
                                <div className="roi__value-stage" data-person-anim data-person-delay="0.2">
                                    <div className="roi__value-3d" aria-label={keyNumberText}>
                                        {Array.from({ length: 20 }, (_, d) => (
                                            <span
                                                key={d}
                                                className="roi__extrude"
                                                aria-hidden="true"
                                                data-person-count-layer
                                                style={{ '--d': 20 - d } as React.CSSProperties}
                                            >
                                                {keyNumberText}
                                            </span>
                                        ))}
                                        <span
                                            className="roi__face"
                                            data-person-count={page.keyNumberValue}
                                            data-person-count-prefix={page.keyNumberPrefix || ''}
                                            data-person-count-suffix={page.keyNumberSuffix || ''}
                                        >
                                            {keyNumberText}
                                        </span>
                                    </div>
                                </div>

                                {page.keyNumberLabel && (
                                    <p className="person__bignum-label" data-person-anim data-person-delay="0.4">{page.keyNumberLabel}</p>
                                )}
                                {page.keyNumberDetail && (
                                    <p className="person__bignum-detail" data-person-anim data-person-delay="0.6">
                                        {page.keyNumberDetail}{' '}
                                        {resolveUrl(page.keyNumberCitationUrl) && (
                                            <a href={resolveUrl(page.keyNumberCitationUrl)!} target="_blank" rel="noopener noreferrer">
                                                Source
                                            </a>
                                        )}
                                    </p>
                                )}
                            </div>
                        )}

                        {peerProof.length > 0 && (
                            <>
                                <div className="person__head person__head--tight" data-person-anim>
                                    <span className="person__label">Peer proof</span>
                                    <h2 className="person__title">{page.peerProofHeadline || 'Others who hold a seat like yours'}</h2>
                                </div>
                                <div className="person__proof" data-person-stagger>
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
                            </>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ 07 · THE ASK ═══ */}
            {(page.ctaTitle || team.length > 0) && (
                <section className="person__section person__closing" id="next">
                    <div className="person__inner person__inner--narrow">
                        <div data-person-anim>
                            {page.ctaTitle && <h2 className="person__question">{page.ctaTitle}</h2>}
                            {page.ctaBody && <p className="person__lede">{page.ctaBody}</p>}
                        </div>

                        {team.length > 0 && (
                            <div className="person__team" data-person-stagger>
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
                            <div className="warp-btn-wrap" data-person-anim>
                                <a href={ctaHref} className="warp-btn" id="person-cta-btn">
                                    <span className="warp-btn__content">
                                        <span className="warp-btn__eyebrow">{ctaEyebrow}</span>
                                        <span className="warp-btn__main">{page.ctaButtonText}</span>
                                    </span>
                                    <span className="warp-btn__arrow">
                                        <ArrowRight />
                                    </span>
                                </a>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ═══ 08 · WHY YOU'RE SEEING THIS ═══
                The working, demoted to a strip. It was a full section headed
                "what we looked at before writing this", which made our research
                the subject of the page. What survives is the part that does real
                work: what we assumed about the role, and the invitation to
                correct it. */}
            {working.length > 0 && (
                <section className="person__section person__section--working" id="person-working">
                    <div className="person__inner person__inner--narrow" data-person-anim>
                        <span className="person__label">Why you&rsquo;re seeing this</span>
                        <ul className="person__working">
                            {working.map((p, i) => {
                                const src = resolveUrl(p.SourceUrl);
                                const assumed = (p.Register ?? 'assumed') === 'assumed';
                                return (
                                    <li key={i} className="person__working-item" data-register={p.Register ?? 'assumed'}>
                                        <span className="person__working-reg">{assumed ? 'We assumed' : 'You told us'}</span>
                                        <span className="person__working-text">
                                            {p.Text}
                                            {p.SourceLabel && !assumed && (
                                                <span className="person__working-src">
                                                    {' — '}
                                                    {src ? (
                                                        <a href={src} target="_blank" rel="noopener noreferrer">{p.SourceLabel}</a>
                                                    ) : p.SourceLabel}
                                                </span>
                                            )}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="person__working-note">
                            If any of that is wrong, tell {page.noteSignedBy || 'us'} and we&rsquo;ll rewrite it.
                        </p>
                    </div>
                </section>
            )}

            {/* ═══ STICKY BAR ═══ */}
            {page.ctaButtonText && (
                <div className="sticky-cta" id="person-sticky-cta" aria-hidden="true">
                    <span className="sticky-cta__text" id="person-sticky-cta-text">
                        {page.ctaTitle || `Written for ${page.personName}`}
                    </span>
                    <a className="warp-btn warp-btn--compact" href={ctaHref}>
                        <span className="warp-btn__content">
                            <span className="warp-btn__main">{page.ctaButtonText}</span>
                        </span>
                        <span className="warp-btn__arrow">
                            <ArrowRight />
                        </span>
                    </a>
                </div>
            )}

            {/* ═══ FOOTER ═══ the company page's, so the page ends on the same rule. */}
            <footer className="footer">
                <div className="footer__inner">
                    <div className="footer__brand">
                        <strong>Optimizely</strong>
                        {page.footerLine && <span>{page.footerLine}</span>}
                    </div>
                    <nav aria-label="Footer" className="footer__links">
                        {companyHref && (
                            <a href={companyHref} className="person__back">Back to {page.companyName}</a>
                        )}
                        <a href="https://www.optimizely.com/products" target="_blank" rel="noopener noreferrer">Products</a>
                        <a href="https://www.optimizely.com/plans" target="_blank" rel="noopener noreferrer">Plans</a>
                        <a href="https://www.optimizely.com/field-notes/customer-stories" target="_blank" rel="noopener noreferrer">Customer stories</a>
                    </nav>
                </div>
            </footer>
        </article>
    );
}
