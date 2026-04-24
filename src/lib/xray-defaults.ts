/* ============================================================
   X-ray mode — default per-section annotations.
   These describe which tools + data sources populated each
   section of an Aldus 1:1 landing page when the CMS hasn't
   supplied page-specific overrides via `xraySections`.
   ============================================================ */

export type XraySectionInfo = {
  /** DOM id of the <section> this annotation anchors to. */
  id: string;
  /** Display title shown on the annotation card. */
  title: string;
  /** Tools / services that produced the section. */
  tools: string[];
  /** Raw data inputs the section was built from. */
  sources: string[];
  /** Optional short note shown in italics. */
  notes?: string;
};

/* ABM / Aldus 1:1 landing page — the full sales pitch. */
export const ABM_XRAY_DEFAULTS: XraySectionInfo[] = [
  {
    id: 'hero',
    title: 'Hero',
    tools: ['Claude Opus 4', 'Brandfetch', 'Three.js / WebGL'],
    sources: ['Brand domain', 'Customer logo', 'Brand accent color', 'Generated headline + subhead'],
    notes: 'Hero 3D canvas renders at 60fps from the brand palette.',
  },
  {
    id: 'intel',
    title: 'Account Intel',
    tools: ['Perplexity Deep Research', 'LinkedIn lookup', 'Clearbit', 'Crunchbase'],
    sources: ['Tech stack', 'Strategic investments', 'Recent news', 'Key stakeholders'],
    notes: 'Refreshed nightly; stakeholders matched against SFDC contacts.',
  },
  {
    id: 'challenge',
    title: 'Current-state Challenge',
    tools: ['Playwright headless screenshot', 'Claude page analysis'],
    sources: ['Live website capture', 'Pain points', 'Browser URL'],
    notes: 'Screenshot is a live render of their current site, not a stock image.',
  },
  {
    id: 'comparison',
    title: 'Side-by-side Comparison',
    tools: ['Optimizely battlecard KB', 'Product docs RAG'],
    sources: ['Competitor feature matrix', 'Optimizely feature parity'],
  },
  {
    id: 'proof',
    title: 'Proof',
    tools: ['Customer quote DB', 'Analyst report index'],
    sources: ['Testimonials', 'Analyst badges (Gartner / Forrester)', 'Logo wall'],
  },
  {
    id: 'roi',
    title: 'ROI Projection',
    tools: ['Forrester TEI model', 'Company-size heuristics'],
    sources: ['Traffic estimates', 'Conversion uplift bands', 'Projected revenue lift'],
  },
  {
    id: 'migration',
    title: 'Path Forward',
    tools: ['Project planner template', 'SFDC AE directory', 'Gravatar'],
    sources: ['Phased timeline', 'Dedicated team members'],
  },
  {
    id: 'cta',
    title: 'Close',
    tools: ['Calendar scheduling link', 'Claude copy generation'],
    sources: ['CTA headline', 'Booking URL', 'Team emails'],
  },
];

/* Dynamic comparison — the lighter, non-ABM variant. */
export const DYNAMIC_XRAY_DEFAULTS: XraySectionInfo[] = [
  {
    id: 'hero',
    title: 'Hero',
    tools: ['Claude Opus 4'],
    sources: ['Eyebrow, headline, subheadline', 'Primary CTA'],
  },
  {
    id: 'logos',
    title: 'Logo Bar',
    tools: ['Optimizely DAM'],
    sources: ['Curated customer logos'],
  },
  {
    id: 'features',
    title: 'Features',
    tools: ['Claude feature-extraction', 'Product docs'],
    sources: ['Feature headlines', 'Feature descriptions'],
  },
  {
    id: 'comparison',
    title: 'Comparison Table',
    tools: ['Battlecard KB'],
    sources: ['Competitor feature matrix', 'Our feature parity'],
  },
  {
    id: 'analyst',
    title: 'Analyst Quote',
    tools: ['Analyst report index'],
    sources: ['Analyst quote + source'],
  },
  {
    id: 'testimonials',
    title: 'Testimonials',
    tools: ['Customer quote DB'],
    sources: ['Customer quotes'],
  },
  {
    id: 'faq',
    title: 'FAQ',
    tools: ['Support KB', 'Claude summarisation'],
    sources: ['Common questions', 'Curated answers'],
  },
  {
    id: 'promo',
    title: 'Promo Card',
    tools: ['Claude copy generation'],
    sources: ['Promo headline + CTA'],
  },
  {
    id: 'final-cta',
    title: 'Closing CTA',
    tools: ['Claude copy generation'],
    sources: ['Closing headline + CTA'],
  },
];

/** Merge any CMS-supplied overrides into the defaults. */
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
      title: o.Title || d.title,
      tools: o.Tools && o.Tools.length ? o.Tools : d.tools,
      sources: o.Sources && o.Sources.length ? o.Sources : d.sources,
      notes: o.Notes ?? d.notes,
    };
  });
}
