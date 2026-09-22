import { useOdpTracking } from '../hooks/useOdpTracking';
import {
  COMPONENTS,
  includes,
  navItems,
  suppressed,
  unmetInclusions,
  unrenderableInclusions,
  type ComponentId,
  variantOf,
  type ComponentPlan,
} from '../lib/limitless/component-plan';
import {
  readLanes,
  readPills,
  readRailMeta,
  readThesis,
  splitEmphasis,
  stagedContentPresence,
  type UseCasePage as UseCasePageContent,
} from '../lib/limitless/use-case-content';

/**
 * The use-case account page — the third renderer over the
 * CompetitorComparisonPage content type, alongside ABMHyperPage (competitive
 * takeout) and DynamicComparisonPage (plain comparison).
 *
 * Shape taken from Laura Perez Riau's "Siemens — Account Page (Use Case
 * Template v2)" artifact (Opal artifact da1k38a9io6g009he560, 17 Aug 2026).
 * Siemens is a USE-CASE page, not a takeout: it names no competitor, shows no
 * comparison table, makes no ROI projection and proposes no migration. That is
 * the whole reason it is worth building — it is what the ladder's
 * `use-case-default` rung (rank 99, the guaranteed default, and therefore the
 * most common resolution) has had no renderer for.
 *
 * WHAT MAKES IT DYNAMIC
 * ---------------------
 * Every section is gated on the PLAN, not on its own content:
 *
 *     {includes(plan, 'why-now-thesis') && <Thesis/>}      // this file
 *     {page.roiTitle && <Roi/>}                            // the old way
 *
 * The consequences are the point. A plan can withhold a section and say why.
 * A plan can ask for a section in a named variant. A plan that asks for a
 * section the page has no content for is a DEFECT, reported by
 * unmetInclusions() — under field-sniffing that case is indistinguishable from
 * "this account didn't need that section".
 *
 * Copy is never generated here. The variant is passed through as a data
 * attribute for CSS and analytics; it does not pick between hardcoded
 * sentences. Whatever writes the page writes the words — the renderer's job is
 * which blocks exist, in what order, with what emphasis.
 *
 * Design note: this deliberately keeps Laura's inverted section rhythm (fir
 * hero -> white offer card breaking out of it -> sage thesis -> fir gaps ->
 * white close) rather than the all-dark `.cmp-takeout` skin, because that
 * rhythm is what carries the "your need first, our product second" argument.
 * It uses the repo's self-hosted brand faces (VC Nudge / Die Grotesk / Roboto
 * Mono) instead of the artifact's Outfit + IBM Plex Mono, which were a
 * Google-Fonts substitute in a standalone HTML file.
 */

/** This file's identity in the component registry's renderedBy lists. */
const RENDERER = 'use-case' as const;

interface Props {
  page: UseCasePageContent;
  plan: ComponentPlan;
  /** Company name for the rail lockup. Falls back to the page title's first
   *  segment, which is how every account page in this CMS is titled
   *  ("Siemens - See why Optimizely beats AEM"). */
  companyName?: string;
  /** Render the plan as an on-page panel. Local/preview only — never on a
   *  public render, which is why it defaults off rather than reading a query
   *  param here. */
  showPlan?: boolean;
}

function companyFrom(page: UseCasePageContent, override?: string): string {
  if (override) return override;
  const title = page.PageTitle ?? '';
  return title.split(/\s+[-|–—]\s+/)[0].trim() || 'This account';
}

export default function UseCasePage({ page, plan, companyName, showPlan = false }: Props) {
  useOdpTracking('use-case');

  const company = companyFrom(page, companyName);
  const pills = readPills(page);
  const lanes = readLanes(page);
  const thesis = readThesis(page);
  const rail = readRailMeta(page, company);
  const nav = navItems(plan, RENDERER);
  // Two different problems, kept apart on purpose: `defects` is "the plan asked
  // for a section and the page has no content for it" (a build failure);
  // `notDrawn` is "the plan asked for a section this renderer has none of" (a
  // coverage gap in the code). See component-plan.ts's RendererId.
  const defects = unmetInclusions(plan, page, RENDERER, stagedContentPresence(page));
  const notDrawn = unrenderableInclusions(plan, RENDERER);

  const heroVariant = variantOf(plan, 'hero');
  const headlineParts = splitEmphasis(page.headline ?? '');
  const subheadParts = splitEmphasis(page.subheadline ?? '');

  const contactEmail = page.teamMembers?.[0]?.Email ?? null;
  const scheduleUrl = page.modalScheduleUrl?.default ?? null;

  return (
    <main className="uc-page" id="main-content" data-plan-source={plan.source} data-rung={plan.rungId ?? 'unknown'}>
      {includes(plan, 'nav-rail') && (
        <aside className="uc-rail" id="rail">
          <div className="uc-rail__brand">
            {company}
            <span className="uc-rail__slash">/</span>
            <span className="uc-rail__opti">Optimizely</span>
          </div>
          {nav.length > 0 && (
            <nav className="uc-rail__nav" aria-label="On this page">
              {nav.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          )}
          {rail.length > 0 && (
            <div className="uc-rail__foot">
              {rail.map((line, i) => (
                <span key={i}>{line}</span>
              ))}
            </div>
          )}
        </aside>
      )}

      <div className="uc-main">
        {/* ======== HERO + the use-case card that breaks out of it ======== */}
        {includes(plan, 'hero') && (
          <section className="uc-hero" id="hero" data-variant={heroVariant ?? 'default'}>
            <div className="uc-wrap">
              {page.eyebrow && <p className="uc-eyebrow">{page.eyebrow}</p>}
              {page.headline && (
                <h1 className="uc-h1">
                  {headlineParts.map((part, i) =>
                    part.emphasis ? (
                      <span className="uc-extrude" key={i}>
                        {part.text}
                      </span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </h1>
              )}
              {page.subheadline && (
                <p className="uc-subhead">
                  {subheadParts.map((part, i) =>
                    part.emphasis ? (
                      <b className="uc-em" key={i}>
                        {part.text}
                      </b>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
              )}

              {includes(plan, 'signal-pills') && pills.length > 0 && (
                <ul className="uc-pills" id="pills">
                  {pills.map((pill, i) => (
                    <li className="uc-pill" key={i}>
                      {pill.text}
                    </li>
                  ))}
                </ul>
              )}

              {includes(plan, 'use-case-matrix') && lanes.length > 0 && (
                <div className="uc-offer" id="use-cases">
                  <h2 className="uc-offer__title">
                    {page.useCaseHeading ?? `What we’d put to work at ${company}`}
                  </h2>
                  <p className="uc-offer__sub">
                    {lanes.length} active need{lanes.length === 1 ? '' : 's'} &middot; {lanes.length} solution
                    {lanes.length === 1 ? '' : 's'} &middot; ranked by signal strength
                  </p>
                  {page.useCaseNote && <p className="uc-offer__note">{page.useCaseNote}</p>}

                  <div className="uc-lanes" data-count={lanes.length}>
                    {lanes.map((lane, i) => (
                      <article className="uc-lane" key={i}>
                        <p className="uc-lane__lane">{lane.Lane}</p>
                        <h3 className="uc-lane__need">{lane.Need}</h3>
                        <p className="uc-lane__label">We&rsquo;d use</p>
                        <span className="uc-lane__solution">{lane.Solution}</span>
                        <p className="uc-lane__outcome">{lane.Outcome}</p>
                      </article>
                    ))}
                  </div>

                  {page.useCaseFooter && <p className="uc-offer__foot">{page.useCaseFooter}</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======== WHY NOW ======== */}
        {includes(plan, 'why-now-thesis') && thesis && (
          <section className="uc-thesis" id="why">
            <div className="uc-wrap">
              <p className="uc-label">Why now</p>
              {thesis.Headline && <h2 className="uc-h2">{thesis.Headline}</h2>}
              <div className="uc-thesis__grid">
                <div className="uc-thesis__body">
                  {thesis.Paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                {thesis.Quote && (
                  <aside className="uc-quote">
                    <p className="uc-quote__q">&ldquo;{thesis.Quote}&rdquo;</p>
                    {thesis.Attribution && <p className="uc-quote__attr">{thesis.Attribution}</p>}
                  </aside>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ======== WHERE IT BREAKS ======== */}
        {includes(plan, 'friction-points') && page.painPoints && page.painPoints.length > 0 && (
          <section className="uc-gaps" id="gaps">
            <div className="uc-wrap">
              <p className="uc-label">Where it breaks</p>
              {page.challengeHeadline && <h2 className="uc-h2">{page.challengeHeadline}</h2>}
              {page.comparisonDescription && <p className="uc-gaps__lead">{page.comparisonDescription}</p>}
              <div className="uc-gaps__grid" data-count={page.painPoints.length}>
                {page.painPoints.map((point, i) => (
                  <article className="uc-gap" key={i}>
                    <p className="uc-gap__num">{String(i + 1).padStart(2, '0')}</p>
                    <h3 className="uc-gap__title">{point.Title}</h3>
                    <p className="uc-gap__body">{point.Description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ======== WHO TO TALK TO ======== */}
        {includes(plan, 'contact-close') && (
          <section className="uc-close" id="close">
            <div className="uc-wrap">
              <p className="uc-label">Who to talk to</p>
              <div className="uc-close__card">
                <div className="uc-close__top">
                  {page.ctaTitle && <h2 className="uc-h2">{page.ctaTitle}</h2>}
                  {page.ctaDescription && <p className="uc-close__lead">{page.ctaDescription}</p>}
                </div>

                <div className="uc-close__team">
                  {page.teamMembers && page.teamMembers.length > 0 && (
                    <div className="uc-slot">
                      {page.teamMembers.map((member, i) => (
                        <div className="uc-who" key={i}>
                          <span className="uc-ini" aria-hidden="true">
                            {member.Initials}
                          </span>
                          <div>
                            <p className="uc-who__name">{member.Name}</p>
                            <p className="uc-who__role">{member.Role}</p>
                            {member.Email && <a href={`mailto:${member.Email}`}>{member.Email}</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {page.stakeholders && page.stakeholders.length > 0 && (
                    <div className="uc-slot">
                      <p className="uc-kc__head">Key contacts at {company}</p>
                      <ul className="uc-kc">
                        {page.stakeholders.map((person, i) => (
                          <li key={i}>
                            <p className="uc-kc__name">{person.Name}</p>
                            <p className="uc-kc__role">{person.Role}</p>
                            {/* A stakeholder card links to that person's own
                                page once one exists — PersonSlug is set by the
                                person_page agent, so the link appears without
                                this renderer knowing anything about routing. */}
                            {person.PersonSlug ? (
                              <a href={`${page._metadata.url.hierarchical}${person.PersonSlug}/`}>See their page</a>
                            ) : person.LinkedInUrl?.default ? (
                              <a href={person.LinkedInUrl.default} target="_blank" rel="noopener noreferrer">
                                LinkedIn
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {(page.ctaButtonText || contactEmail || scheduleUrl) && (
                  <div className="uc-close__cta">
                    {page.endHeadline && <p className="uc-close__ct">{page.endHeadline}</p>}
                    <div className="uc-btns">
                      {page.ctaButtonText && (contactEmail || scheduleUrl) && (
                        <a
                          className="uc-btn uc-btn--primary"
                          href={scheduleUrl ?? `mailto:${contactEmail}?subject=${encodeURIComponent(`${company} · Optimizely`)}`}
                        >
                          {page.ctaButtonText}
                        </a>
                      )}
                      {page.endCTA && page.endCTALink?.default && (
                        <a className="uc-btn uc-btn--secondary" href={page.endCTALink.default} target="_blank" rel="noopener noreferrer">
                          {page.endCTA}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <footer className="uc-foot">
          <div className="uc-wrap">
            <span>{page.footerTagline ?? `Built for ${company} · Optimizely`}</span>
            {page._metadata?.published && (
              <span>
                Updated{' '}
                {new Date(page._metadata.published).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </span>
            )}
          </div>
        </footer>

        {showPlan && <PlanPanel plan={plan} defects={defects} notDrawn={notDrawn} />}
      </div>
    </main>
  );
}

/**
 * The decision, on the page.
 *
 * Preview-only. It exists because the argument for carrying a plan is that the
 * plan is auditable, and an audit trail nobody can read is not one. It shows
 * the rung, the fit, what was included with which variant, what was WITHHELD
 * and why, and any component the plan asked for that has no content.
 */
function PlanPanel({
  plan,
  defects,
  notDrawn,
}: {
  plan: ComponentPlan;
  defects: ComponentId[];
  notDrawn: ComponentId[];
}) {
  const withheld = suppressed(plan);
  return (
    <section className="uc-plan" aria-label="Component plan">
      <div className="uc-wrap">
        <p className="uc-label">The decision behind this page</p>
        <dl className="uc-plan__meta">
          <div>
            <dt>Plan source</dt>
            <dd>{plan.source}</dd>
          </div>
          <div>
            <dt>Rung</dt>
            <dd>{plan.rungLabel ?? plan.rungId ?? '— (a derived plan has no rung)'}</dd>
          </div>
          {plan.fit && (
            <div>
              <dt>Fit</dt>
              <dd>
                {plan.fit.verdict} ({plan.fit.by}) &mdash; {plan.fit.why}
              </dd>
            </div>
          )}
        </dl>

        {defects.length > 0 && (
          <p className="uc-plan__defect">
            <strong>{defects.length} planned component(s) have no content:</strong>{' '}
            {defects.map((id) => COMPONENTS[id].label).join(', ')}. That is a build defect — the
            decision committed to a section and nothing wrote it. Under field-sniffing it would be
            invisible.
          </p>
        )}

        {notDrawn.length > 0 && (
          <p className="uc-plan__gap">
            <strong>{notDrawn.length} planned component(s) have no section in this renderer:</strong>{' '}
            {notDrawn.map((id) => COMPONENTS[id].label).join(', ')}. Not a content problem — the
            use-case template has nowhere to put them. On a takeout plan that is expected; a
            component that keeps appearing here is the queue for what to build next.
          </p>
        )}

        <table className="uc-plan__table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Shown</th>
              <th>Variant</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {plan.entries.map((entry) => (
              <tr key={entry.id} data-include={entry.include}>
                <td>{COMPONENTS[entry.id].label}</td>
                <td>{entry.include ? 'yes' : 'no'}</td>
                <td>{entry.variant ?? '—'}</td>
                <td>{entry.why}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {withheld.length > 0 && (
          <p className="uc-plan__note">
            {withheld.length} of {plan.entries.length} components were withheld. On a takeout page the
            comparison table would be here; this rung names no competitor.
          </p>
        )}
      </div>
    </section>
  );
}
