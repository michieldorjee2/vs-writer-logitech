/* ============================================================
   X-ray mode — default per-component annotations.
   These describe which tools + data sources populated each
   visible component of an Aldus 1:1 landing page when the CMS
   hasn't supplied page-specific overrides via `xraySections`.

   Each entry is keyed by a unique `id` (used for CMS overrides)
   and points at a DOM node via a CSS `selector` (the first match
   becomes the outlined component).
   ============================================================ */

export type XraySectionInfo = {
  /** Stable identifier — used to match CMS overrides. */
  id: string;
  /** CSS selector pointing at the component to outline. First match wins. */
  selector: string;
  /** Display title shown on the annotation card. */
  title: string;
  /** Tools / services that produced the component. */
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
    title: 'Hero 3D logo',
    tools: ['Three.js / WebGL', 'Brandfetch logo CDN'],
    sources: ['Customer logo SVG', 'Brand accent colour'],
    notes: 'Custom shader extrudes the brand mark in real time.',
  },
  {
    id: 'hero-title',
    selector: '.hero__title',
    title: 'Hero headline',
    tools: ['Claude Opus 4'],
    sources: ['Generated headline (split into two accent lines)'],
  },
  {
    id: 'hero-subtitle',
    selector: '.hero__subtitle',
    title: 'Hero subtitle',
    tools: ['Claude Opus 4'],
    sources: ['Generated supporting line'],
  },
  {
    id: 'intel-headline',
    selector: '.intel__hero',
    title: 'Account intel headline',
    tools: ['Perplexity Deep Research'],
    sources: ['Account name + market context'],
  },
  {
    id: 'intel-stats',
    selector: '.intel__stats',
    title: 'Stat ribbon',
    tools: ['Perplexity', 'Crunchbase', 'Public filings'],
    sources: ['Revenue, headcount, market cap, customer count'],
  },
  {
    id: 'stakeholders',
    selector: '.intel__people-row',
    title: 'Key stakeholders',
    tools: ['LinkedIn lookup', 'SFDC contact match'],
    sources: ['Decision makers + roles + LinkedIn URLs'],
  },
  {
    id: 'tech-stack',
    selector: '.intel__dossier > *:nth-child(1)',
    title: 'Current tech stack',
    tools: ['BuiltWith', 'Wappalyzer'],
    sources: ['Detected vendors on the live site'],
  },
  {
    id: 'investments',
    selector: '.intel__dossier > *:nth-child(2)',
    title: 'Strategic investments',
    tools: ['Job posting analysis', 'Press release scan'],
    sources: ['Hiring signals + public initiatives'],
  },
  {
    id: 'news',
    selector: '.intel__dossier > *:nth-child(3)',
    title: 'In the news',
    tools: ['News API', 'Claude summarisation'],
    sources: ['Recent press coverage with URLs'],
  },
  {
    id: 'challenge',
    selector: '.challenge__left',
    title: 'Current-state capture',
    tools: ['Playwright headless screenshot'],
    sources: ['Live render of the brand site', 'Browser URL'],
    notes: 'Screenshot is a real capture, not stock imagery.',
  },
  {
    id: 'pain-points',
    selector: '.challenge__pain-points',
    title: 'Pain points',
    tools: ['Claude page analysis'],
    sources: ['Site-derived pain narrative'],
  },
  {
    id: 'comparison',
    selector: '.comparison__table',
    title: 'Side-by-side comparison',
    tools: ['Optimizely battlecard KB', 'Product docs RAG'],
    sources: ['Competitor + Optimizely feature parity matrix'],
  },
  {
    id: 'logo-wall',
    selector: '.proof__logos',
    title: 'Logo wall',
    tools: ['DAM curated set'],
    sources: ['Reference customers (vertical-matched)'],
  },
  {
    id: 'testimonials',
    selector: '.proof__testimonials',
    title: 'Testimonials',
    tools: ['Customer quote DB'],
    sources: ['Verified customer quotes + roles'],
  },
  {
    id: 'analysts',
    selector: '.proof__analysts',
    title: 'Analyst recognition',
    tools: ['Analyst report index'],
    sources: ['Gartner / Forrester badges + URLs'],
  },
  {
    id: 'roi-grid',
    selector: '.roi__grid',
    title: 'ROI cards',
    tools: ['Forrester TEI model'],
    sources: ['Industry-segmented uplift bands'],
  },
  {
    id: 'roi-projection',
    selector: '.roi__projection',
    title: 'Revenue projection',
    tools: ['Account-size heuristics', 'TEI extrapolation'],
    sources: ['Estimated traffic + AOV'],
  },
  {
    id: 'timeline',
    selector: '.timeline',
    title: 'Migration timeline',
    tools: ['Project planner template'],
    sources: ['Phased rollout assumptions'],
  },
  {
    id: 'team',
    selector: '.migration-team',
    title: 'Dedicated team',
    tools: ['SFDC AE directory', 'Gravatar'],
    sources: ['Account team + emails'],
  },
  {
    id: 'cta',
    selector: '.cta__content',
    title: 'Closing CTA',
    tools: ['Claude copy generation', 'Calendar scheduling link'],
    sources: ['Closing headline + booking URL'],
  },
];

/* Dynamic comparison — non-ABM variant. Uses the existing section ids. */
export const DYNAMIC_XRAY_DEFAULTS: XraySectionInfo[] = [
  { id: 'hero',        selector: '#hero',        title: 'Hero',           tools: ['Claude Opus 4'], sources: ['Eyebrow, headline, subheadline', 'Primary CTA'] },
  { id: 'logos',       selector: '#logos',       title: 'Logo Bar',       tools: ['Optimizely DAM'], sources: ['Curated customer logos'] },
  { id: 'features',    selector: '#features',    title: 'Features',       tools: ['Claude feature extraction', 'Product docs'], sources: ['Feature headlines + descriptions'] },
  { id: 'comparison',  selector: '#comparison',  title: 'Comparison',     tools: ['Battlecard KB'], sources: ['Competitor + Optimizely feature parity'] },
  { id: 'analyst',     selector: '#analyst',     title: 'Analyst Quote',  tools: ['Analyst report index'], sources: ['Analyst quote + source'] },
  { id: 'testimonials',selector: '#testimonials',title: 'Testimonials',   tools: ['Customer quote DB'], sources: ['Customer quotes'] },
  { id: 'faq',         selector: '#faq',         title: 'FAQ',            tools: ['Support KB', 'Claude summarisation'], sources: ['Common questions + curated answers'] },
  { id: 'promo',       selector: '#promo',       title: 'Promo Card',     tools: ['Claude copy generation'], sources: ['Promo headline + CTA'] },
  { id: 'final-cta',   selector: '#final-cta',   title: 'Closing CTA',    tools: ['Claude copy generation'], sources: ['Closing headline + CTA'] },
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
      selector: d.selector,
      title: o.Title || d.title,
      tools: o.Tools && o.Tools.length ? o.Tools : d.tools,
      sources: o.Sources && o.Sources.length ? o.Sources : d.sources,
      notes: o.Notes ?? d.notes,
    };
  });
}
