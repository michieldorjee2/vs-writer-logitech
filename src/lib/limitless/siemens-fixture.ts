import type { ComponentPlan } from './component-plan';
import type { UseCasePage } from './use-case-content';

/**
 * Laura Perez Riau's Siemens page, as content.
 *
 * Source: Opal artifact `da1k38a9io6g009he560` in space `da1j5o29io6g00d6gieg`,
 * "Siemens — Account Page (Use Case Template v2)", 17 Aug 2026. The artifact is
 * a standalone HTML file; this is the same copy expressed as
 * CompetitorComparisonPage fields, so the showcase can render it through the
 * registered content type rather than as a one-off page.
 *
 * It exists to prove the template end to end with no dependency on the CMS
 * (the two staged fields are not registered yet) and none on Aldus running
 * locally. Same role as finserv-demo-content.ts and retail-demo-content.ts.
 *
 * TWO DELIBERATE DIVERGENCES FROM THE ARTIFACT, both worth knowing:
 *
 * 1. The three Siemens contacts keep their names and titles and LOSE their
 *    email addresses. The artifact is `noindex,nofollow` and was made to be
 *    brought into an internal session; these account pages are published on a
 *    public host and the person pages beneath them are customer-facing. Three
 *    named prospects' work emails on a public URL is a privacy exposure, not a
 *    content decision, and `ABMStakeholderProperty` has no Email field to put
 *    them in anyway. If the emails are wanted, that needs a field AND access
 *    control on the route — flagged rather than quietly shipped either way.
 *
 * 2. Laura's subhead bolds "Siemens Xcelerator" with a <b> tag. Here it is
 *    marked with *asterisks* and rendered as an accented span, the same
 *    convention the headline uses — see splitEmphasis() for why these fields
 *    do not take raw HTML.
 */

const PUBLISHED = '2026-08-17T17:15:13.000Z';
const SLUG = '/siemens-use-case/';

export const SIEMENS_USE_CASE_PAGE: UseCasePage = {
  __typename: 'CompetitorComparisonPage',
  _metadata: {
    key: 'fixture-siemens-use-case',
    url: { default: SLUG, hierarchical: SLUG },
    published: PUBLISHED,
  },
  PageTitle: 'Siemens — Complex engineering requires simple software',
  MetaDescription:
    'Three active needs at Siemens, and what we would put to work against each one.',

  // ---- Hero ----
  eyebrow: 'Industrial Automation · 385,000 employees · North America',
  headline: 'Complex engineering requires *simple software.*',
  subheadline:
    "4.8M engineers, operators and partners land on Siemens's U.S. digital properties every month. Translating the scale of the *Siemens Xcelerator* portfolio into speed is a content problem before it's an engineering one.",
  cta: null,
  link: null,

  // ---- Hero pills (existing registered field) ----
  intelStats: [
    { Value: '4.8M', Label: 'monthly digital visitors' },
    { Value: 'Strategic focus:', Label: 'Modernizing U.S. shipyards with AI' },
    { Value: 'Historic $1B', Label: 'U.S. manufacturing investment achieved' },
  ],

  // ---- The use-case matrix (STAGED field) ----
  useCaseHeading: 'What we’d put to work at Siemens',
  useCaseNote: 'Your need on top. What we’d use underneath. No product tour.',
  useCaseFooter: 'All three are in active evaluation. Ranked by signal strength.',
  useCaseLanes: [
    {
      Lane: 'Drive revenue',
      Need: 'Validate the customer journeys that connect heavy machinery to SaaS subscriptions',
      Solution: 'Agentic Experimentation',
      Outcome:
        'At 4.8M monthly visits, testing new market offerings and industrial SaaS models is how Siemens accelerates direct pipeline. We’d start with your primary Xcelerator entry paths — where most buyers are currently served a static page.',
    },
    {
      Lane: 'Modernize for AI',
      Need: 'Model complex industrial and IoT content for human, machine and LLM discovery',
      Solution: 'Agentic CMS',
      Outcome:
        'Structure your extensive documentation and partner resources so answer engines can parse, trust and cite Siemens first — whether supporting the HD Hyundai shipyard collaboration or general municipal bids.',
    },
    {
      Lane: 'Scale execution',
      Need: 'Coordinate product, marketing and agency campaigns on one centralized calendar',
      Solution: 'Agent Orchestration',
      Outcome:
        'Move your cross-functional, highly localized campaign briefing and review out of fragmented email and Slack threads and into a single governed content factory.',
    },
  ],

  // ---- Why now (STAGED fields) ----
  thesisHeadline: 'Industrial velocity is dictated by the speed of the content model',
  thesisBody: [
    'For a global industrial giant, the bottleneck is rarely physical engineering. It is digital friction. Launching an AI-powered shipyard or scaling a $1B manufacturing footprint requires dozens of localized onboarding paths, compliance documents and product briefs.',
    'When product marketing teams must wait on technical sprints to modify these resources, the digital estate stalls. In the Xcelerator era, digital operations are the entire product.',
    'Optimizely decouples these experience layers from core engineering. Product teams build, test and optimize journeys natively, while your developers focus on complex heavy-industry integrations.',
  ].join('\n\n'),
  thesisQuote:
    'The scale of Siemens’s industrial expansion is set by your factories. The speed of that expansion is set by your content stack.',
  // Attributed to the page's own argument, not to a person. The artifact does
  // this too, and it is the right instinct: no invented spokesperson.
  thesisAttribution: 'The argument this page makes',

  // ---- Where it breaks (existing registered fields) ----
  challengeHeadline: 'Four places the industrial customer journey stalls',
  comparisonDescription:
    'True of any highly technical, legacy B2B estate trying to scale complex services on decentralized legacy infrastructure.',
  painPoints: [
    {
      Title: 'The technical buyer gets a generic page',
      Description:
        'An operator seeking precise specs for power grid equipment sees the same high-level corporate overview as a general job seeker.',
    },
    {
      Title: 'Experimentation runs at development speed',
      Description:
        'Validating new digital service models requires fast, low-friction tests. If every experiment requires a developer, testing drops from hours to quarters.',
    },
    {
      Title: 'Localized launches run through manual workflows',
      Description:
        'Expanding physical capacity across Pennsylvania, Illinois and Texas means localized marketing. Managing these variations in static templates slows time-to-market.',
    },
    {
      Title: 'Partner portals remain disconnected silos',
      Description:
        'The strategic shipyards and technology centers require deeply integrated experience paths. Fragmented platforms make cohesive journey mapping impossible.',
    },
  ],

  // ---- Who to talk to (existing registered fields) ----
  ctaTitle: 'Former partnership. A conversation already in flight.',
  ctaDescription:
    'We’re not introducing ourselves. Siemens has run on our Web Experimentation platform in the past, and there are active conversations across your digital practices on OptiOne. This page represents the fuller platform picture: how modernized content and native testing run together in a single system. Bring this to your next internal session, or connect with our account team below.',
  ctaButtonText: 'Continue the conversation',
  teamMembers: [
    { Initials: 'MM', Name: 'Mike Martiny', Role: 'Account Executive · Enterprise', Email: 'mike.martiny@optimizely.com' },
  ],
  stakeholders: [
    { Initials: 'DD', Name: 'Dusty DiMercurio', Role: 'Senior Director, Digital Experience', LinkedInUrl: null, AvatarColor: null },
    { Initials: 'SM', Name: 'Sally Mellinger', Role: 'Head of Content Marketing, US', LinkedInUrl: null, AvatarColor: null },
    { Initials: 'JA', Name: 'Josh Angel', Role: 'Vice President, Digital Transformation', LinkedInUrl: null, AvatarColor: null },
  ],
  endHeadline: 'Start where it helps. There’s already context in the room.',
  endCTA: 'See manufacturing stories',
  endCTALink: { default: 'https://www.optimizely.com/insights/customer-stories/' },
  modalScheduleUrl: null,

  // ---- Rail + footer ----
  railMeta: ['Industrial · Xcelerator Era', 'Prepared for Siemens', 'NA · 2026'],
  intelEyebrow: 'Industrial · Xcelerator Era',
  footerTagline: 'Built for Siemens Corporation · Optimizely',
  footerLegal: null,

  // ---- Everything a use-case page deliberately does NOT have ----
  // Left null rather than omitted: the plan is what withholds these sections,
  // and a reader comparing this fixture to a takeout page should be able to see
  // that the fields exist and are empty on purpose.
  competitorName: null,
  comparisonHeadline: null,
  comparisonTableRows: null,
  roiTitle: null,
  roiDescription: null,
  roiProjectionValue: null,
  roiProjectionLabel: null,
  roiProjectionDetail: null,
  roiCards: null,
  migrationTitle: null,
  migrationDescription: null,
  timelinePhases: null,
  challengeScreenshotUrl: null,
  challengeScreenshotAlt: null,
  challengeBrowserUrl: null,
  analystHeadline: null,
  analystQuote: null,
  analystSource: null,
  analystCTA: null,
  analystCTALink: null,
  analystCards: null,
  promoEyebrow: null,
  promoHeading: null,
  promoDescription: null,
  promoCTA: null,
  promoCTALink: null,
  testimonial1: null,
  testimonial1JobTitle: null,
  testimonial1Company: null,
  testimonial2: null,
  testimonial2JobTitle: null,
  testimonial2Company: null,
  stickyCTAText: null,
  endSubheadline: null,
  customerLogo: null,
  brandDomain: 'siemens.com',
  brandAccentColor: null,
  intelHeadline: null,
  logoWallCustomerSlot: null,
  techStack: null,
  investments: null,
  newsItems: null,
  footerLinks: null,
  Logos: null,
  Testimonials: null,
  xraySections: null,
  componentPlan: null,
};

/**
 * The plan that produces the artifact's section set.
 *
 * Marked `source: 'fixture'` so nothing mistakes it for a resolved decision.
 * The `why` strings are the reasons the ladder WOULD give — this is the shape
 * `/api/intelligence/plan` returns for an account on the `use-case-default`
 * rung, hand-written here because Siemens is not one of Aldus's ten demo
 * accounts.
 *
 * Note which components are withheld and why. The suppressed comparison table
 * is the whole argument: Siemens has no confirmed-competitor TECH signal, so
 * naming one would be the exact mistake the pilot made.
 */
export const SIEMENS_USE_CASE_PLAN: ComponentPlan = {
  source: 'fixture',
  rungId: 'use-case-default',
  rungLabel: 'Use-case focused (default)',
  fit: {
    verdict: 'blend',
    by: 'rule-fallback',
    why: 'three solution areas in play (EO, EC, AO) with no single dominant signal — the page argues the platform, not one product',
  },
  resolvedAt: PUBLISHED,
  entries: [
    { id: 'nav-rail', include: true, why: 'rung default for "use-case-default"' },
    {
      id: 'hero',
      include: true,
      variant: 'platform-suite-argument',
      why: 'multi-solution intent: EO, EC and AO are all in active evaluation, so the hero argues the connected platform rather than one product',
    },
    { id: 'signal-pills', include: true, why: 'three account-level facts survived staleness checks' },
    {
      id: 'use-case-matrix',
      include: true,
      why: 'signals.multiSolutionIntent — three needs with distinct solution areas, ranked by signal strength',
    },
    { id: 'why-now-thesis', include: true, why: 'rung default for "use-case-default"' },
    { id: 'friction-points', include: true, why: 'rung default for "use-case-default"' },
    { id: 'contact-close', include: true, why: 'an assigned AE and three mapped stakeholders are on file' },
    {
      id: 'comparison-table',
      include: false,
      why: 'precondition not met: no TECH-confirmed competitor install, and the chosen rung is "use-case-default", not takeout-confirmed',
    },
    {
      id: 'roi-projection',
      include: false,
      why: 'withheld: no baseline conversion or traffic-value figure on file for this account, so any projection would be invented',
    },
    { id: 'migration-timeline', include: false, why: 'withheld: a migration plan presumes a platform to migrate from, and none is confirmed' },
    { id: 'challenge-shot', include: false, why: 'withheld: no captured screenshot of the account’s own estate' },
    { id: 'account-intel', include: false, why: 'withheld: the intel is carried by the hero pills on this rung, not a separate section' },
    { id: 'proof-wall', include: false, why: 'withheld: a logo wall dilutes a page whose argument is the account’s own three needs' },
    { id: 'analyst-proof', include: false, why: 'withheld: no analyst placement mapped to these three solution areas' },
    { id: 'customer-stories', include: false, why: 'withheld: the close links to manufacturing stories instead of embedding a quote' },
    { id: 'offer-card', include: false, why: 'no eligible offer in window for EO/EC/AO at the time of resolution' },
    { id: 'sticky-cta', include: false, why: 'withheld: the close section carries the only ask' },
  ],
};
