/* ============================================================
   X-ray mode — per-component annotations.

   Each entry describes ONE visible UI component on an Aldus 1:1
   landing page and lists which Optimizely-stack tools / data
   sources actually populated it. Tool names are drawn from a
   curated set that maps 1:1 to icons in `xray-tool-icons.tsx`:

     Salesforce, BuiltWith, Opal, ODP, CMS, Web browsing,
     Sitemap, LinkedIn, 6sense, Gravatar, Brandfetch

   When the CMS supplies overrides via `xraySections`, those win
   for any matching `id` — see `resolveXraySections`.
   ============================================================ */

export type XraySectionInfo = {
  /** Stable identifier — used to match CMS overrides. */
  id: string;
  /**
   * CSS selector pointing at the component(s) to outline. May match
   * multiple elements (e.g. each .roi__card); the X-ray unions their
   * bounding boxes into a single outline.
   */
  selector: string;
  /** Display title shown on the annotation card. */
  title: string;
  /** Tools / services that produced the component. Keep names in
   *  sync with the ICONS map in xray-tool-icons.tsx. */
  tools: string[];
  /** Raw data inputs the component was built from. */
  sources: string[];
  /** Optional short note shown in italics. */
  notes?: string;
};

/* ABM / Aldus 1:1 landing page — granular per-component breakdown. */
export const ABM_XRAY_DEFAULTS: XraySectionInfo[] = [
  {
    id: 'hero-3d',
    selector: '#hero-canvas',
    title: 'Hero brand mark',
    tools: ['Brandfetch'],
    sources: ['Brand logo', 'Brand colours', 'Brand description'],
    notes: 'Logo extruded in real-time from the brand SVG.',
  },
  {
    id: 'hero-title',
    selector: '.hero__title',
    title: 'Hero headline',
    tools: ['Opal'],
    sources: ['Custom pitch copy', 'Persona-targeted messaging', 'Approved terms'],
  },
  {
    id: 'hero-subtitle',
    selector: '.hero__subtitle',
    title: 'Hero subtitle',
    tools: ['Opal'],
    sources: ['Personalised supporting line', 'Approved messaging frameworks'],
  },
  {
    id: 'intel-headline',
    selector: '.intel__headline',
    title: 'Account intel headline',
    tools: ['Opal', '6sense'],
    sources: ['Account name', 'Industry', 'Funnel stage'],
  },
  {
    id: 'intel-stats',
    selector: '.intel__stat-item',
    title: 'Stat ribbon',
    tools: ['Web browsing', 'LinkedIn', 'Sitemap'],
    sources: [
      'Investor reports',
      'Employee count',
      'Total content count',
      'Updates last 3 months',
    ],
  },
  {
    id: 'stakeholders',
    selector: '.intel__person-card',
    title: 'Key stakeholders',
    tools: ['LinkedIn', 'Salesforce', 'Gravatar'],
    sources: [
      'Main contacts + roles',
      'Account owner',
      'Key contacts on file',
      'Profile pictures',
    ],
  },
  {
    id: 'tech-stack',
    selector: '.intel__tech-stack',
    title: 'Current tech stack',
    tools: ['BuiltWith'],
    sources: ['Detected vendors on the live site'],
  },
  {
    id: 'investments',
    selector: '.intel__invest-list',
    title: 'Strategic investments',
    tools: ['Web browsing', 'Salesforce'],
    sources: [
      'Investor reports',
      'Recent acquisition news',
      'Account communication context',
    ],
  },
  {
    id: 'news',
    selector: '.intel__news',
    title: 'In the news',
    tools: ['Web browsing'],
    sources: [
      'Google News',
      'Newsroom feed',
      'Recent c-level changes',
      'Recent acquisition news',
    ],
  },
  {
    id: 'challenge-headline',
    selector: '.challenge__headline',
    title: 'Challenge headline',
    tools: ['Opal'],
    sources: [
      'Competitive positioning',
      'Messaging frameworks',
      'Website best practices',
    ],
  },
  {
    id: 'challenge-screenshot',
    selector: '.challenge__screenshot',
    title: 'Current website capture',
    tools: ['Opal', 'Web browsing'],
    sources: ['Live screenshot of brand site', 'Customer website URL'],
    notes: 'Real capture, not stock imagery.',
  },
  {
    id: 'pain-points',
    selector: '.challenge__pain',
    title: 'Pain points',
    tools: ['Opal', 'Web browsing'],
    sources: [
      'Site-derived pain narrative',
      'Competitive positioning',
      'Customer website context',
    ],
  },
  {
    id: 'comparison-row',
    selector: '.comparison__row',
    title: 'Comparison row',
    tools: ['CMS', 'Opal'],
    sources: [
      'Competitive pages',
      'Approved product language',
      'Competitive positioning',
    ],
  },
  {
    id: 'logo-wall',
    selector: '.proof__logo-item, .proof__logo-you',
    title: 'Reference customer',
    tools: ['CMS'],
    sources: ['Approved customer logos', 'Vertical-matched stories'],
  },
  {
    id: 'testimonials',
    selector: '.proof__testimonial',
    title: 'Testimonial',
    tools: ['CMS'],
    sources: ['Customer stories', 'Approved customer quotes'],
  },
  {
    id: 'analysts',
    selector: '.proof__analyst-card',
    title: 'Analyst recognition',
    tools: ['CMS'],
    sources: [
      'Forrester TEI report',
      'Gartner MQ',
      'Forrester Wave',
      'Analyst reports',
    ],
  },
  {
    id: 'roi-cards',
    selector: '.roi__card',
    title: 'ROI metric',
    tools: ['CMS', '6sense'],
    sources: [
      'Forrester TEI report',
      'Industry-segmented uplift bands',
      'Account funnel stage',
    ],
  },
  {
    id: 'roi-projection',
    selector: '.roi__projection',
    title: 'Revenue projection',
    tools: ['CMS', '6sense'],
    sources: [
      'TEI extrapolation',
      'Industry benchmarks',
      'Account activity signals',
    ],
  },
  {
    id: 'timeline-phases',
    selector: '.timeline__phase',
    title: 'Migration phase',
    tools: ['Opal'],
    sources: ['Phased rollout copy', 'Approved migration template'],
  },
  {
    id: 'team-members',
    selector: '.migration-team__member',
    title: 'Account team',
    tools: ['Salesforce', 'Gravatar'],
    sources: [
      'Account owner',
      'Key contacts on file',
      'Optimizely employees',
      'Profile pictures',
    ],
  },
  {
    id: 'cta-title',
    selector: '.cta__title',
    title: 'Closing CTA headline',
    tools: ['Opal', 'ODP'],
    sources: [
      'Approved CTA copy',
      'One-click form-less action',
      'Visitor engagement tracking',
    ],
  },
  {
    id: 'cta-description',
    selector: '.cta__description',
    title: 'CTA description',
    tools: ['Opal'],
    sources: ['Closing supporting line', 'Approved messaging'],
  },
];

/* Dynamic comparison page — non-ABM variant. Falls back to section IDs
 * since the dynamic layout is content-driven and less themed. */
export const DYNAMIC_XRAY_DEFAULTS: XraySectionInfo[] = [
  { id: 'hero',         selector: '#hero',         title: 'Hero',          tools: ['Opal'],         sources: ['Eyebrow, headline, subheadline', 'Primary CTA copy'] },
  { id: 'logos',        selector: '#logos',        title: 'Logo Bar',      tools: ['CMS'],          sources: ['Approved customer logos'] },
  { id: 'features',     selector: '#features',     title: 'Features',      tools: ['Opal', 'CMS'],  sources: ['Feature headlines + descriptions', 'Approved product language'] },
  { id: 'comparison',   selector: '#comparison',   title: 'Comparison',    tools: ['CMS', 'Opal'],  sources: ['Competitive pages', 'Approved product language'] },
  { id: 'analyst',      selector: '#analyst',      title: 'Analyst Quote', tools: ['CMS'],          sources: ['Analyst reports', 'Forrester / Gartner quotes'] },
  { id: 'testimonials', selector: '#testimonials', title: 'Testimonials',  tools: ['CMS'],          sources: ['Customer stories', 'Approved quotes'] },
  { id: 'faq',          selector: '#faq',          title: 'FAQ',           tools: ['Opal'],         sources: ['Curated questions + answers'] },
  { id: 'promo',        selector: '#promo',        title: 'Promo Card',    tools: ['Opal'],         sources: ['Promo headline + CTA'] },
  { id: 'final-cta',    selector: '#final-cta',    title: 'Closing CTA',   tools: ['Opal', 'ODP'],  sources: ['Closing headline + CTA', 'One-click form-less action'] },
];

/** Merge any CMS-supplied overrides into the defaults. */
/* ── 1:1 person page ──────────────────────────────────────────────────────
   The person page is generated by a different agent from a different mix of
   sources, so it needs its own registry rather than reusing the ABM one: the
   galaxy is drawn from the PARENT page's screenshot, the operation facts come
   from web research, and the engagement badge is the only thing on the page
   that Salesforce touches directly. Selectors track the section classes in
   PersonPageView. */
export const PERSON_XRAY_DEFAULTS: XraySectionInfo[] = [
  {
    id: 'person-galaxy',
    selector: '.person__sky',
    title: 'Hero galaxy',
    tools: ['Opal', 'Web browsing', 'CMS'],
    sources: ["The company page's site screenshot", 'Products drawn from this seat\u2019s scorecard'],
    notes: 'WebGL. The screenshot is inherited from the parent account page, not re-captured.',
  },
  {
    id: 'person-identity',
    selector: '.person__ident, .person__name',
    title: 'Who this is for',
    tools: ['Salesforce', 'LinkedIn'],
    sources: ['Contact record', 'Published profile as they wrote it'],
  },
  {
    id: 'person-tier',
    selector: '.person__tier',
    title: 'Engagement badge',
    tools: ['Salesforce'],
    sources: ['Logged activity in the last 6 months', 'Open opportunity membership'],
    notes: 'The only element on the page driven straight from CRM state.',
  },
  {
    id: 'person-opening',
    selector: '.person__opening',
    title: 'The opening',
    tools: ['Opal', 'Web browsing'],
    sources: ['One specific published detail', 'Named account executive'],
  },
  {
    id: 'person-measures',
    selector: '.person__measure',
    title: 'What the job is scored on',
    tools: ['Opal'],
    sources: ['Seat inference from title and department', "The parent page's pain points"],
    notes: 'A hypothesis about the role, not a record about the person.',
  },
  {
    id: 'person-operation',
    selector: '.person__fact',
    title: 'Your operation',
    tools: ['Web browsing', 'BuiltWith'],
    sources: ['Public site structure', 'Detected platform and stack', 'Filings and newsroom'],
  },
  {
    id: 'person-practice',
    selector: '.person__case',
    title: 'In practice',
    tools: ['Opal', 'CMS'],
    sources: ['Product claims from the parent page', 'Reframed to this seat\u2019s vocabulary'],
  },
  {
    id: 'person-how',
    selector: '.person__steps',
    title: 'How it works',
    tools: ['CMS'],
    sources: ['Fixed platform description'],
    notes: 'Identical on every person page \u2014 held in the frontend, not generated.',
  },
  {
    id: 'person-number',
    selector: '.roi__value-3d',
    title: 'The one number',
    tools: ['Opal', 'Web browsing'],
    sources: ['Published customer story or third-party research', 'Cited, never computed'],
  },
  {
    id: 'person-proof',
    selector: '.person__quote-card',
    title: 'Peer proof',
    tools: ['CMS', 'Opal'],
    sources: ['optimizely.com customer stories', 'Matched on role first, industry second'],
  },
  {
    id: 'person-team',
    selector: '.person__member',
    title: 'Your team',
    tools: ['Salesforce', 'Gravatar'],
    sources: ['Account team from the parent page', 'Placeholder contacts filtered out'],
  },
  {
    id: 'person-working',
    selector: '.person__working',
    title: 'Why you\u2019re seeing this',
    tools: ['Opal', 'Salesforce'],
    sources: ['Their own words', 'Our labelled assumption about the seat'],
    notes: 'The disclosure that earns the rest of the page.',
  },
];

export function resolveXraySections(
  defaults: XraySectionInfo[],
  overrides: Array<{
    SectionId: string;
    Title?: string | null;
    Tools?: string[] | null;
    Sources?: string[] | null;
    Notes?: string | null;
  }> | null | undefined,
): XraySectionInfo[] {
  if (!overrides || overrides.length === 0) return defaults;
  const byId = new Map(overrides.map((o) => [o.SectionId, o]));
  return defaults.map((d) => {
    const o = byId.get(d.id);
    if (!o) return d;
    return {
      id: d.id,
      selector: d.selector,
      title: o.Title || d.title,
      tools: o.Tools && o.Tools.length ? o.Tools : d.tools,
      sources: o.Sources && o.Sources.length ? o.Sources : d.sources,
      notes: o.Notes ?? d.notes,
    };
  });
}
