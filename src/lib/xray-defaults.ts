/* ============================================================
   X-ray mode — default per-component annotations.
   These describe which tools + data sources populated each
   visible component of an Aldus 1:1 landing page when the CMS
   hasn't supplied page-specific overrides via `xraySections`.

   Each entry is keyed by a unique `id` and points at one or
   more DOM nodes via a CSS `selector` (querySelectorAll). Every
   match becomes its own outlined component on the page; all
   matches under the same selector share a single annotation card.
   ============================================================ */

export type XraySectionInfo = {
  /** Stable identifier — used to match CMS overrides. */
  id: string;
  /**
   * CSS selector pointing at the component(s) to outline. May match
   * multiple elements (e.g. each .roi__card); every match gets its
   * own traced outline + corner brackets + number.
   */
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

/* ABM / Aldus 1:1 landing page — focus on actual content elements
 * (headlines, individual cards, list groups) rather than the full-width
 * <section> wrappers. */
export const ABM_XRAY_DEFAULTS: XraySectionInfo[] = [
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
    selector: '.intel__headline',
    title: 'Account intel headline',
    tools: ['Perplexity Deep Research'],
    sources: ['Account name + market context'],
  },
  {
    id: 'intel-stats',
    selector: '.intel__stat-item',
    title: 'Stat ribbon',
    tools: ['Perplexity', 'Crunchbase', 'Public filings'],
    sources: ['Revenue, headcount, market cap, customer count'],
  },
  {
    id: 'stakeholders',
    selector: '.intel__person-card',
    title: 'Key stakeholders',
    tools: ['LinkedIn lookup', 'SFDC contact match'],
    sources: ['Decision makers + roles + LinkedIn URLs'],
  },
  {
    id: 'tech-stack',
    selector: '.intel__tech-stack',
    title: 'Current tech stack',
    tools: ['BuiltWith', 'Wappalyzer'],
    sources: ['Detected vendors on the live site'],
  },
  {
    id: 'investments',
    selector: '.intel__invest-list',
    title: 'Strategic investments',
    tools: ['Job posting analysis', 'Press release scan'],
    sources: ['Hiring signals + public initiatives'],
  },
  {
    id: 'news',
    selector: '.intel__news',
    title: 'In the news',
    tools: ['News API', 'Claude summarisation'],
    sources: ['Recent press coverage with URLs'],
  },
  {
    id: 'challenge-headline',
    selector: '.challenge__headline',
    title: 'Challenge headline',
    tools: ['Claude page analysis'],
    sources: ['Site-derived problem statement'],
  },
  {
    id: 'challenge-screenshot',
    selector: '.challenge__screenshot',
    title: 'Current website capture',
    tools: ['Playwright headless browser'],
    sources: ['Live render of the brand site', 'Browser URL'],
    notes: 'Real screenshot of their site — not stock imagery.',
  },
  {
    id: 'pain-points',
    selector: '.challenge__pain',
    title: 'Pain points',
    tools: ['Claude page analysis'],
    sources: ['Site-derived pain narrative'],
  },
  {
    id: 'comparison-row',
    selector: '.comparison__row',
    title: 'Comparison row',
    tools: ['Optimizely battlecard KB', 'Product docs RAG'],
    sources: ['Per-feature competitor + Optimizely capability'],
  },
  {
    id: 'logo-wall',
    selector: '.proof__logo-item, .proof__logo-you',
    title: 'Reference customer',
    tools: ['DAM curated set'],
    sources: ['Vertical-matched customer logo'],
  },
  {
    id: 'testimonials',
    selector: '.proof__testimonial',
    title: 'Testimonial',
    tools: ['Customer quote DB'],
    sources: ['Verified customer quote + role'],
  },
  {
    id: 'analysts',
    selector: '.proof__analyst-card',
    title: 'Analyst recognition',
    tools: ['Analyst report index'],
    sources: ['Gartner / Forrester badge + URL'],
  },
  {
    id: 'roi-cards',
    selector: '.roi__card',
    title: 'ROI metric',
    tools: ['Forrester TEI model'],
    sources: ['Industry-segmented uplift band', 'Citation source'],
  },
  {
    id: 'roi-projection',
    selector: '.roi__projection',
    title: 'Revenue projection',
    tools: ['Account-size heuristics', 'TEI extrapolation'],
    sources: ['Estimated traffic + AOV'],
  },
  {
    id: 'timeline-phases',
    selector: '.timeline__phase',
    title: 'Migration phase',
    tools: ['Project planner template'],
    sources: ['Phased rollout assumption'],
  },
  {
    id: 'team-members',
    selector: '.migration-team__member',
    title: 'Account team member',
    tools: ['SFDC AE directory', 'Gravatar'],
    sources: ['Name + role + email'],
  },
  {
    id: 'cta-title',
    selector: '.cta__title',
    title: 'Closing CTA headline',
    tools: ['Claude copy generation'],
    sources: ['Closing headline'],
  },
  {
    id: 'cta-description',
    selector: '.cta__description',
    title: 'Closing CTA description',
    tools: ['Claude copy generation'],
    sources: ['Supporting line'],
  },
];

/* Dynamic comparison — non-ABM variant. Targets inner content where
 * possible; falls back to the section ids for less-themed parts. */
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
