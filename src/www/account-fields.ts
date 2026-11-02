/**
 * Where every CompetitorComparisonPage property lands on the www-design account page.
 *
 * All 67 properties of the content type (read from the CMS, GET /v1/contenttypes/
 * CompetitorComparisonPage, 2026-11-01). The content type is frozen and nothing is migrated:
 * the new page reads the same fields the legacy renderer reads. `check:www` renders a page with
 * every field filled and fails if a `text` or `attr` field's value is not in the output, or if
 * this list and the content type ever disagree.
 *
 *   text  the value is on screen as text
 *   attr  the value is used as a link, image source or colour (asserted in the markup)
 *   head  rendered into <head> by the server (buildHeadHtml), unchanged by the new design
 *   none  identity metadata no renderer displays (also not fetched by PAGE_QUERY)
 *
 * `legacy` marks the 16 fields the old ABMHyperPage stored but never showed.
 */
export type FieldUse = 'text' | 'attr' | 'head' | 'none'

export interface FieldPlacement {
  field: string
  use: FieldUse
  section: string
  legacy?: boolean
}

export const ACCOUNT_FIELDS: FieldPlacement[] = [
  // SEO + identity
  { field: 'PageTitle', use: 'head', section: '<title>' },
  { field: 'MetaDescription', use: 'head', section: '<meta name="description">' },
  { field: 'salesforceAccountID', use: 'none', section: 'identity (Settings group)' },
  // Hero
  { field: 'eyebrow', use: 'text', section: 'Hero: the line beside the account logo, above the headline' },
  { field: 'headline', use: 'text', section: 'Hero: h1' },
  { field: 'subheadline', use: 'text', section: 'Hero: lead' },
  { field: 'cta', use: 'text', section: 'Hero: second button', legacy: true },
  { field: 'link', use: 'attr', section: 'Hero: second button href (#form maps to the ask)', legacy: true },
  { field: 'customerLogo', use: 'attr', section: 'Hero: the account logo above the headline; the account tile in the proof logo strip' },
  { field: 'brandDomain', use: 'text', section: 'Hero browser bar (fallback), signals: tool count' },
  { field: 'brandAccentColor', use: 'attr', section: '--www-accent: the stripe under the account logo above the hero headline' },
  { field: 'challengeScreenshotUrl', use: 'attr', section: 'Challenge: browser frame image (shown at its own size)' },
  { field: 'challengeScreenshotAlt', use: 'attr', section: 'Challenge: browser frame alt text' },
  { field: 'challengeBrowserUrl', use: 'text', section: 'Challenge: browser frame address bar' },
  // Logo strip
  { field: 'logoWallCustomerSlot', use: 'text', section: 'Proof: the account tile in the logo strip' },
  // Intel
  { field: 'intelEyebrow', use: 'text', section: 'Intel: overline' },
  { field: 'intelHeadline', use: 'text', section: 'Intel: heading (<em> becomes the accent run)' },
  { field: 'intelStats', use: 'text', section: 'Intel: counting numbers' },
  { field: 'stakeholders', use: 'text', section: 'Intel: people cards' },
  // Signals
  { field: 'techStack', use: 'text', section: 'Signals: tool chips (the replaced platform and Optimizely marked)' },
  { field: 'investments', use: 'text', section: 'Signals: "Investing in" badges' },
  { field: 'newsItems', use: 'text', section: 'Signals: "In the news" list' },
  // Challenge
  { field: 'challengeHeadline', use: 'text', section: 'Challenge: heading (highlight in the accent colour)' },
  { field: 'painPoints', use: 'text', section: 'Challenge: numbered points' },
  { field: 'competitorName', use: 'text', section: 'Comparison: table column header' },
  // Comparison
  { field: 'comparisonHeadline', use: 'text', section: 'Comparison: heading' },
  { field: 'comparisonDescription', use: 'text', section: 'Comparison: lead' },
  { field: 'comparisonTableRows', use: 'text', section: 'Comparison: TableBlock rows (icon + word); cards on a phone' },
  // Proof
  { field: 'testimonial1', use: 'text', section: 'Proof: PortraitTextQuoteCard 1' },
  { field: 'testimonial1JobTitle', use: 'text', section: 'Proof: quote card 1 author' },
  { field: 'testimonial1Company', use: 'text', section: 'Proof: quote card 1 company' },
  { field: 'testimonial2', use: 'text', section: 'Proof: PortraitTextQuoteCard 2' },
  { field: 'testimonial2JobTitle', use: 'text', section: 'Proof: quote card 2 author' },
  { field: 'testimonial2Company', use: 'text', section: 'Proof: quote card 2 company' },
  { field: 'analystHeadline', use: 'text', section: 'Analysts: heading', legacy: true },
  { field: 'analystQuote', use: 'text', section: 'Analysts: quote', legacy: true },
  { field: 'analystSource', use: 'text', section: 'Analysts: quote source', legacy: true },
  { field: 'analystCTA', use: 'text', section: 'Analysts: button', legacy: true },
  { field: 'analystCTALink', use: 'attr', section: 'Analysts: button href', legacy: true },
  { field: 'analystCards', use: 'text', section: 'Analysts: CardArrowCard row' },
  // Promo
  { field: 'promoEyebrow', use: 'text', section: 'Statement scene: eyebrow', legacy: true },
  { field: 'promoHeading', use: 'text', section: 'Statement scene: display heading', legacy: true },
  { field: 'promoDescription', use: 'text', section: 'Statement scene: lead', legacy: true },
  { field: 'promoCTA', use: 'text', section: 'Statement scene: button', legacy: true },
  { field: 'promoCTALink', use: 'attr', section: 'Statement scene: button href', legacy: true },
  // ROI
  { field: 'roiTitle', use: 'text', section: 'ROI: heading' },
  { field: 'roiDescription', use: 'text', section: 'ROI: lead' },
  { field: 'roiProjectionValue', use: 'text', section: 'ROI: StatBlock value, the page\'s one extruded moment' },
  { field: 'roiProjectionLabel', use: 'text', section: 'ROI: horizontal StatBlock label' },
  { field: 'roiProjectionDetail', use: 'text', section: 'ROI: detail line' },
  { field: 'roiCards', use: 'text', section: 'ROI: counting numbers + linked citation' },
  // Closing callout
  { field: 'endHeadline', use: 'text', section: 'ROI: closing strip heading', legacy: true },
  { field: 'endSubheadline', use: 'text', section: 'ROI: closing strip line', legacy: true },
  { field: 'endCTA', use: 'text', section: 'ROI: closing strip button', legacy: true },
  { field: 'endCTALink', use: 'attr', section: 'ROI: closing strip href', legacy: true },
  // Migration
  { field: 'migrationTitle', use: 'text', section: 'Path: heading' },
  { field: 'migrationDescription', use: 'text', section: 'Path: lead' },
  { field: 'timelinePhases', use: 'text', section: 'Path: steps on a rule' },
  // Contact
  { field: 'teamMembers', use: 'text', section: 'The ask: team list (Gravatar, mailto)' },
  { field: 'ctaTitle', use: 'text', section: 'The ask: display heading' },
  { field: 'ctaDescription', use: 'text', section: 'The ask: lead' },
  { field: 'ctaButtonText', use: 'text', section: 'The ask: one-click button (fires the team webhook)' },
  { field: 'modalScheduleUrl', use: 'attr', section: 'The connect panel the ask opens: "Schedule a call" href' },
  { field: 'stickyCTAText', use: 'text', section: 'Sticky bar' },
  // Footer
  { field: 'footerTagline', use: 'text', section: 'The ask: small print' },
  { field: 'footerLinks', use: 'text', section: 'The ask: small print links' },
  { field: 'footerLegal', use: 'text', section: 'The ask: small print' },
]
