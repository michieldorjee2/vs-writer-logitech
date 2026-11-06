/* ============================================================
   X-ray mode — per-component annotations.

   Each entry describes ONE visible UI component on an Aldus 1:1
   landing page and lists which Optimizely-stack tools / data
   sources actually populated it. Tool names are drawn from a
   curated set that maps 1:1 to icons in `xray-tool-icons.tsx`:

     Salesforce, BuiltWith, Mark, ODP, CMS, Web browsing,
     Sitemap, LinkedIn, 6sense, Gravatar, Brandfetch, ZoomInfo,
     Clay, CaliberMind, Outreach

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
  /**
   * How the part is made, in one line: the decision behind it, as against the data it is made from
   * (`sources`). Shown when its X-ray card opens (Michiel, 6 Nov).
   */
  logic?: string;
  /** A short note kept from the CMS overrides; shown when a part has no `logic`. */
  notes?: string;
};

/* The takeout account page's parts (src/www/AccountPage.tsx), one per stored component, each found
   by its `data-xray` hook. The agent platform page carries ten of the same ids for the parts it
   shares, so a page's stored X-ray overrides apply to both. */
const ACCOUNT_XRAY_SHARED: XraySectionInfo[] = [
  {
    id: 'hero-3d',
    selector: '[data-xray="hero-3d"]',
    title: 'Hero brand mark',
    logic: "Brandfetch finds their logo and colours; the page extrudes the logo and takes its accent from the brand.",
    tools: ['Brandfetch'],
    sources: ['Brand logo', 'Brand colours', 'Brand description'],
    notes: 'Logo extruded in real-time from the brand SVG.',
  },
  {
    id: 'hero-title',
    selector: '[data-xray="hero-title"]',
    title: 'Hero headline',
    logic: "Mark writes the pitch for this account's buyer and stage, in approved terms only.",
    tools: ['Mark'],
    sources: ['Custom pitch copy', 'Persona-targeted messaging', 'Approved terms'],
  },
  {
    id: 'hero-subtitle',
    selector: '[data-xray="hero-subtitle"]',
    title: 'Hero subtitle',
    logic: "Mark says what the pitch means for them, inside our approved messaging.",
    tools: ['Mark'],
    sources: ['Personalised supporting line', 'Approved messaging frameworks'],
  },
  {
    id: 'intel-headline',
    selector: '[data-xray="intel-headline"]',
    title: 'Account intel headline',
    logic: "Mark frames the research around their industry and where 6sense and CaliberMind put them in the funnel.",
    tools: ['Mark', '6sense', 'CaliberMind'],
    sources: ['Account name', 'Industry', 'Funnel stage'],
  },
  {
    id: 'intel-stats',
    selector: '[data-xray="intel-stats"]',
    title: 'Stat ribbon',
    logic: "Their scale in a few numbers: firmographics from ZoomInfo and LinkedIn, content and recent updates from their sitemap.",
    tools: ['ZoomInfo', 'Web browsing', 'LinkedIn', 'Sitemap'],
    sources: [
      'Investor reports',
      'Employee count',
      'Total content count',
      'Updates last 3 months',
    ],
  },
  {
    id: 'stakeholders',
    selector: '[data-xray="stakeholders"]',
    title: 'Key stakeholders',
    logic: "The roles we most want to meet, found in ZoomInfo and Clay, matched to Salesforce and LinkedIn; photos from Gravatar.",
    tools: ['ZoomInfo', 'Clay', 'LinkedIn', 'Salesforce', 'Gravatar'],
    sources: [
      'Main contacts + roles',
      'Account owner',
      'Key contacts on file',
      'Profile pictures',
    ],
  },
  {
    id: 'tech-stack',
    selector: '[data-xray="tech-stack"]',
    title: 'Current tech stack',
    logic: "What their live site runs today; the platform we would replace is marked.",
    tools: ['BuiltWith'],
    sources: ['Detected vendors on the live site'],
  },
  {
    id: 'investments',
    selector: '[data-xray="investments"]',
    title: 'Strategic investments',
    logic: "Where they are putting money, from public reports; the one closest to our pitch leads.",
    tools: ['Web browsing', 'Salesforce'],
    sources: [
      'Investor reports',
      'Recent acquisition news',
      'Account communication context',
    ],
  },
  {
    id: 'news',
    selector: '[data-xray="news"]',
    title: 'In the news',
    logic: "Recent public news about them, newest first.",
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
    selector: '[data-xray="challenge-headline"]',
    title: 'Challenge headline',
    logic: "Mark names the platform they are on and the problem it causes, from our positioning.",
    tools: ['Mark'],
    sources: [
      'Competitive positioning',
      'Messaging frameworks',
      'Website best practices',
    ],
  },
  {
    id: 'challenge-screenshot',
    selector: '[data-xray="challenge-screenshot"]',
    title: 'Current website capture',
    logic: "A live capture of their own site, so the problem is shown on their page, not stock imagery.",
    tools: ['Mark', 'Web browsing'],
    sources: ['Live screenshot of brand site', 'Customer website URL'],
    notes: 'Real capture, not stock imagery.',
  },
  {
    id: 'pain-points',
    selector: '[data-xray="pain-points"]',
    title: 'Pain points',
    logic: "Mark reads their site and keeps the problems our positioning answers.",
    tools: ['Mark', 'Web browsing'],
    sources: [
      'Site-derived pain narrative',
      'Competitive positioning',
      'Customer website context',
    ],
  },
  {
    id: 'comparison-row',
    selector: '[data-xray="comparison-row"]',
    title: 'Comparison row',
    logic: "Their platform against ours, capability by capability, in approved product language.",
    tools: ['CMS', 'Mark'],
    sources: [
      'Competitive pages',
      'Approved product language',
      'Competitive positioning',
    ],
  },
  {
    id: 'logo-wall',
    selector: '[data-xray="logo-wall"]',
    title: 'Reference customer',
    logic: "Customer logos chosen to match their industry.",
    tools: ['CMS'],
    sources: ['Approved customer logos', 'Vertical-matched stories'],
  },
  {
    id: 'testimonials',
    selector: '[data-xray="testimonials"]',
    title: 'Testimonial',
    logic: "Approved customer quotes from our story library.",
    tools: ['CMS'],
    sources: ['Customer stories', 'Approved customer quotes'],
  },
  {
    id: 'analysts',
    selector: '[data-xray="analysts"]',
    title: 'Analyst recognition',
    logic: "The analyst reports behind the pitch, quoted as published.",
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
    selector: '[data-xray="roi-cards"]',
    title: 'ROI metric',
    logic: "Forrester TEI results, scaled to their industry and funnel stage.",
    tools: ['CMS', '6sense'],
    sources: [
      'Forrester TEI report',
      'Industry-segmented uplift bands',
      'Account funnel stage',
    ],
  },
  {
    id: 'roi-projection',
    selector: '[data-xray="roi-projection"]',
    title: 'Revenue projection',
    logic: "TEI results carried over to their size with industry benchmarks: a projection, labelled so.",
    tools: ['CMS', '6sense'],
    sources: [
      'TEI extrapolation',
      'Industry benchmarks',
      'Account activity signals',
    ],
  },
  {
    id: 'timeline-phases',
    selector: '[data-xray="timeline-phases"]',
    title: 'Migration phase',
    logic: "Mark fits our approved migration plan to their move, phase by phase.",
    tools: ['Mark'],
    sources: ['Phased rollout copy', 'Approved migration template'],
  },
  {
    id: 'team-members',
    selector: '[data-xray="team-members"]',
    title: 'Account team',
    logic: "The Optimizely people working the account, from Salesforce and Outreach, with Gravatar photos.",
    tools: ['Salesforce', 'Outreach', 'Gravatar'],
    sources: [
      'Account owner',
      'Key contacts on file',
      'Optimizely employees',
      'Profile pictures',
    ],
  },
  {
    id: 'cta-title',
    selector: '[data-xray="cta-title"]',
    title: 'Closing CTA headline',
    logic: "One approved ask: pressing it tells the account team, no form to fill in.",
    tools: ['Mark', 'ODP'],
    sources: [
      'Approved CTA copy',
      'One-click form-less action',
      'Visitor engagement tracking',
    ],
  },
  {
    id: 'cta-description',
    selector: '[data-xray="cta-description"]',
    title: 'CTA description',
    logic: "Mark's closing line, inside our approved messaging.",
    tools: ['Mark'],
    sources: ['Closing supporting line', 'Approved messaging'],
  },
];

/* Sections only the agent platform template has (src/www/AgentPlatformPage.tsx, the default
   www account page). Hook-only selectors: on the other renderers they match nothing, and X-ray and
   Edit mode skip a section with no match. Tools name where the content comes from TODAY; the
   notes say what the agent drafts (docs/agent-platform-template/) would add. */
export const AGENT_PLATFORM_XRAY: XraySectionInfo[] = [
  {
    id: 'agents-at-work',
    selector: '[data-xray="agents-at-work"]',
    title: 'Agents at work',
    logic: "The use cases the page leads with, ranked from their stack and investments; illustrative, and labelled so.",
    tools: ['BuiltWith', 'CMS'],
    sources: ['Lead use cases, ranked from the stored stack and investments', 'Stack chips from the stored stack'],
    notes: 'Illustrative, and labelled so. Agent 1 ranks the use cases from 6sense, stage and opportunities.',
  },
  {
    id: 'who-we-are',
    selector: '[data-xray="who-we-are"]',
    title: 'Who we are',
    logic: "The same on every page: our positioning and the analyst recognition behind it.",
    tools: ['CMS'],
    sources: ['Approved positioning', 'Analyst recognitions', 'Platform usage figure (May 2026 release)'],
    notes: 'The same on every page.',
  },
  {
    id: 'speaks-language',
    selector: '[data-xray="speaks-language"]',
    title: 'Speaks your language',
    logic: "The lead use case asked in their terms, naming the tools they run.",
    tools: ['CMS', 'BuiltWith'],
    sources: ['Lead use case question', 'Tools named from the stored stack'],
    notes: "Generic question until the page agent writes one in the account's own terms.",
  },
  {
    id: 'use-cases',
    selector: '[data-xray="use-cases"]',
    title: 'Use cases',
    logic: "Five themes ranked by what their stack and investments show; an observed line only with a public source.",
    tools: ['CMS', 'BuiltWith'],
    sources: ['Five-theme library', 'Ranking from the stored stack and investments'],
    notes: 'Observed lines appear once the agent supplies a sourced public fact.',
  },
  {
    id: 'proof-stories',
    selector: '[data-xray="proof-stories"]',
    title: 'Proof',
    logic: "Verified results from agent platform customers, never invented.",
    tools: ['CMS'],
    sources: ['Verified agent platform customer stories', 'Educational assets for prospects'],
  },
  {
    id: 'first-90-days',
    selector: '[data-xray="first-90-days"]',
    title: 'First 90 days',
    logic: "Our adoption plan, grouped by the kinds of tools they already run.",
    tools: ['CMS', 'BuiltWith'],
    sources: ['Adoption plan', 'Stack categories from the stored stack', 'Trust Center'],
  },
];

/**
 * Edit mode on the www agent platform page (src/www/AgentPlatformPage.tsx): the parts a page field
 * drives, and the headlines and body text, which are the page's own copy (src/lib/page-copy.ts:
 * "copy.<key>" fields, kept beside the page). Labels (eyebrows, captions, buttons) and the proof
 * stories (verified customer results) are not offered. `fields` are CompetitorComparisonPage
 * property keys or copy fields; a field ending ".*" is every copy key under it that the page
 * shows (Edit mode expands it). `hint` is what the comment popup says the area is made of.
 */
export type EditSectionInfo = XraySectionInfo & { fields: string[]; hint: string };

export const AGENT_PLATFORM_EDIT: EditSectionInfo[] = [
  {
    id: 'hero-title',
    selector: '#hero [data-xray="hero-title"]',
    title: 'Headline',
    tools: ['Mark'],
    sources: ['copy.hero.h1'],
    fields: ['copy.hero.h1'],
    hint: 'The headline. The words between ## marks are the extruded ones; keep one run.',
  },
  {
    id: 'hero-subtitle',
    selector: '#hero [data-xray="hero-subtitle"]',
    title: 'Subtitle',
    tools: ['Mark'],
    sources: ['copy.hero.sub'],
    fields: ['copy.hero.sub'],
    hint: 'The line under the headline.',
  },
  {
    id: 'account-logo',
    selector: '#hero [data-xray="account-logo"]',
    title: 'Account logo',
    tools: ['Brandfetch', 'CMS'],
    sources: ['customerLogo'],
    fields: ['customerLogo'],
    hint: 'Their logo above the headline.',
  },
  {
    id: 'account-facts',
    selector: '#hero [data-xray="intel-stats"]',
    title: 'Account facts',
    tools: ['Mark', 'CMS'],
    sources: ['intelStats'],
    fields: ['intelStats'],
    hint: 'The first three facts show here; the next four appear one per section further down. No traffic figures.',
  },
  {
    id: 'who-we-are',
    selector: '#who [data-field^="copy.who"]',
    title: 'Who we are',
    tools: ['Mark'],
    sources: ['copy.who.*'],
    fields: ['copy.who.*'],
    hint: 'The heading and the three tiles. The analyst badges and the usage line stay as they are.',
  },
  {
    id: 'where-it-fits',
    selector: '#intel [data-field^="copy.fit"]',
    title: 'Where it fits',
    tools: ['Mark'],
    sources: ['copy.fit.*'],
    fields: ['copy.fit.*'],
    hint: 'The heading and the line under it.',
  },
  {
    id: 'speaks-language',
    selector: '#language [data-field^="copy.language"]',
    title: 'Speaks your language',
    tools: ['Mark'],
    sources: ['copy.language.*'],
    fields: ['copy.language.*'],
    hint: 'The heading, the leadership question, the generic AI answer and the checklist.',
  },
  {
    id: 'agents-at-work',
    selector: '[data-xray="agents-at-work"]',
    title: 'Agents at work',
    tools: ['BuiltWith', 'CMS'],
    sources: ['techStack'],
    fields: ['techStack'],
    hint: 'The tasks follow the two lead use cases; the chips are tools from their stack.',
  },
  {
    id: 'tech-stack',
    selector: '[data-xray="tech-stack"]',
    title: 'What they run today',
    tools: ['BuiltWith', 'CMS'],
    sources: ['techStack'],
    fields: ['techStack'],
    hint: 'Their stack. A competitor shows by its category only ("Your CMS").',
  },
  {
    id: 'teams',
    selector: '[data-xray="teams"]',
    title: 'Their teams',
    tools: ['Salesforce', 'LinkedIn', 'CMS'],
    sources: ['stakeholders (roles only)'],
    fields: ['stakeholders'],
    hint: 'Role groups from the people on the page. Names are never shown.',
  },
  {
    id: 'investments',
    selector: '[data-xray="investments"]',
    title: "Where they're investing",
    tools: ['Mark', 'CMS'],
    sources: ['investments'],
    fields: ['investments'],
    hint: 'Up to four, primary first. Lines naming a person or a competitor are left off.',
  },
  {
    id: 'use-cases',
    selector: '[data-xray="use-cases"]',
    title: 'Use cases',
    tools: ['BuiltWith', 'Mark', 'CMS'],
    sources: ['techStack', 'investments', 'copy.usecases.*'],
    fields: ['techStack', 'investments', 'copy.usecases.*'],
    hint: 'Ranked from their stack and investments; "Our homework" on each card shows which. The heading, each card\'s title and text, and the closing line can be reworded for this page.',
  },
  {
    id: 'proof-heading',
    selector: '#proof [data-field="copy.proof.heading"]',
    title: 'Proof headline',
    tools: ['Mark'],
    sources: ['copy.proof.heading'],
    fields: ['copy.proof.heading'],
    hint: 'The heading. The stories under it are verified customer results and stay as they are.',
  },
  {
    id: 'first-90-days',
    selector: '[data-xray="first-90-days"]',
    title: 'First 90 days',
    tools: ['Mark'],
    sources: ['copy.ninety.*'],
    fields: ['copy.ninety.*'],
    hint: 'The heading, the four steps and the governance line. Connect names their stack by category.',
  },
  {
    id: 'close',
    selector: '#cta [data-field^="copy.close"]',
    title: 'Close',
    tools: ['Mark'],
    sources: ['copy.close.*'],
    fields: ['copy.close.*'],
    hint: 'The closing headline, the three reasons and the line above the button.',
  },
  {
    id: 'team-members',
    selector: '[data-xray="team-members"]',
    title: 'Account team',
    tools: ['Salesforce', 'CMS'],
    sources: ['teamMembers'],
    fields: ['teamMembers'],
    hint: 'Only an account executive is named, and only for an open opportunity or a customer.',
  },
  {
    id: 'small-print',
    selector: '[data-xray="small-print"]',
    title: 'Small print',
    tools: ['CMS'],
    sources: ['footerTagline', 'footerLegal'],
    fields: ['footerTagline', 'footerLegal'],
    hint: 'The tagline and legal line at the very end.',
  },
];

/**
 * Edit mode on the takeout template (src/www/AccountPage.tsx): every part the page shows, the
 * stored fields it is drawn from, and a hint for Mark. With the fields named, Mark changes exactly
 * those and sends each one's full new value, and the page re-renders from it as it streams
 * (src/www/live-edit.ts), as on the agent platform page. The titles are the section names Mark's
 * prompt maps to fields. Between them, the parts cover every stored field the page shows.
 */
const TAKEOUT_PARTS: Array<{ id: string; title?: string; fields: string[]; hint: string; tools?: string[]; sources?: string[] }> = [
  { id: 'hero-3d', fields: ['eyebrow', 'customerLogo', 'brandAccentColor'], hint: 'The account\'s logo, the line beside it and the accent stripe under it.' },
  { id: 'hero-title', fields: ['headline'], hint: 'The headline: the page\'s pitch in a few words.' },
  { id: 'hero-subtitle', fields: ['subheadline'], hint: 'The line under the headline: what the pitch means for them.' },
  { id: 'hero-cta', title: 'Hero button', fields: ['cta', 'link'], hint: 'The second button in the hero and where it goes.', tools: ['Mark'], sources: ['cta', 'link'] },
  { id: 'intel-headline', fields: ['intelEyebrow', 'intelHeadline'], hint: 'The research section\'s eyebrow and headline.' },
  { id: 'intel-stats', fields: ['intelStats'], hint: 'The account facts: each a value and a label.' },
  { id: 'stakeholders', fields: ['stakeholders'], hint: 'The people we\'d love to meet: name, role, LinkedIn.' },
  { id: 'tech-stack', fields: ['techStack', 'brandDomain'], hint: 'The tools they run today; the one being replaced is marked.' },
  { id: 'investments', fields: ['investments'], hint: 'What they invest in; the primary one is highlighted.' },
  { id: 'news', fields: ['newsItems'], hint: 'Recent news: date, headline, link.' },
  { id: 'challenge-headline', fields: ['challengeHeadline'], hint: 'The challenge headline ("You\'re on Sitecore. We hear you.").' },
  { id: 'challenge-screenshot', fields: ['challengeScreenshotUrl', 'challengeScreenshotAlt', 'challengeBrowserUrl'], hint: 'Their site today: the capture, its alt text and the address shown above it.' },
  { id: 'pain-points', fields: ['painPoints'], hint: 'The pain points: each a title and a line.' },
  { id: 'comparison-heading', title: 'Comparison headline', fields: ['comparisonHeadline', 'comparisonDescription', 'competitorName'], hint: 'The comparison\'s headline, its intro and the platform it compares against.', tools: ['Mark'], sources: ['comparisonHeadline', 'comparisonDescription', 'competitorName'] },
  { id: 'comparison-row', title: 'Comparison table', fields: ['comparisonTableRows'], hint: 'The rows: a capability, then theirs and ours (Yes, No, Limited or a short phrase).' },
  { id: 'logo-wall', fields: ['logoWallCustomerSlot'], hint: 'The name on their tile in the customer logo strip.' },
  { id: 'testimonials', title: 'Testimonials', fields: ['testimonial1', 'testimonial1JobTitle', 'testimonial1Company', 'testimonial2', 'testimonial2JobTitle', 'testimonial2Company'], hint: 'Two customer quotes, each with a job title and company.' },
  { id: 'analysts', fields: ['analystHeadline', 'analystQuote', 'analystSource', 'analystCTA', 'analystCTALink', 'analystCards'], hint: 'The analyst headline, quote and source, its button, and the report cards.' },
  { id: 'promo', title: 'Promo statement', fields: ['promoEyebrow', 'promoHeading', 'promoDescription', 'promoCTA', 'promoCTALink'], hint: 'The big statement mid-page: eyebrow, heading, line and its button.', tools: ['Mark'], sources: ['promoHeading', 'promoDescription'] },
  { id: 'roi-heading', title: 'ROI headline', fields: ['roiTitle', 'roiDescription'], hint: 'The impact section\'s headline and intro.', tools: ['Mark'], sources: ['roiTitle', 'roiDescription'] },
  { id: 'roi-projection', fields: ['roiProjectionValue', 'roiProjectionLabel', 'roiProjectionDetail'], hint: 'The big projected number, its label and the line under it.' },
  { id: 'roi-cards', title: 'ROI cards', fields: ['roiCards'], hint: 'The impact numbers: metric, unit, label and a citation.' },
  { id: 'end-cta', title: 'Next step card', fields: ['endHeadline', 'endSubheadline', 'endCTA', 'endCTALink'], hint: 'The card under the impact numbers: a headline, a line and a button.', tools: ['Mark'], sources: ['endHeadline', 'endSubheadline', 'endCTA'] },
  { id: 'path-heading', title: 'Migration headline', fields: ['migrationTitle', 'migrationDescription'], hint: 'The path section\'s headline and intro.', tools: ['Mark'], sources: ['migrationTitle', 'migrationDescription'] },
  { id: 'timeline-phases', title: 'Timeline', fields: ['timelinePhases'], hint: 'The phases: each a title and a line.' },
  { id: 'cta-title', fields: ['ctaTitle'], hint: 'The closing headline.' },
  { id: 'cta-description', fields: ['ctaDescription', 'ctaButtonText', 'stickyCTAText'], hint: 'The closing line, its button, and the line in the sticky bar.' },
  { id: 'team-members', fields: ['teamMembers', 'modalScheduleUrl'], hint: 'The Optimizely team on the account, and the schedule link in the panel.' },
  { id: 'small-print', title: 'Small print', fields: ['footerTagline', 'footerLegal', 'footerLinks'], hint: 'The tagline, legal line and links at the very end.', tools: ['Mark'], sources: ['footerTagline', 'footerLegal', 'footerLinks'] },
]

export const TAKEOUT_EDIT: EditSectionInfo[] = TAKEOUT_PARTS.map((p) => {
  const x = ACCOUNT_XRAY_SHARED.find((s) => s.id === p.id)
  return {
    id: p.id,
    selector: `[data-xray="${p.id}"]`,
    title: p.title ?? x?.title ?? p.id,
    tools: p.tools ?? x?.tools ?? ['Mark'],
    sources: p.sources ?? x?.sources ?? p.fields,
    fields: p.fields,
    hint: p.hint,
  }
})

/** Every part X-ray and Edit mode can find on an account page, either template: each finds what is on screen. */
export const ABM_XRAY_DEFAULTS: XraySectionInfo[] = [...ACCOUNT_XRAY_SHARED, ...AGENT_PLATFORM_XRAY];

/** The takeout page's part ids. */
export const ABM_XRAY_LEGACY_IDS = ACCOUNT_XRAY_SHARED.map((s) => s.id);

/* ── 1:1 person page ──────────────────────────────────────────────────────
   The person page (src/www/PersonPage.tsx) is written by a different agent from a different
   mix of sources, so it has its own registry: the operation facts come from web research, and
   nothing on the page comes from Salesforce or from our conversations with them. Each part is
   found by its `data-xray` hook; Edit mode names the stored fields each part shows
   (PERSON_EDIT), so Mark changes exactly those. */
const PERSON_PARTS: Array<XraySectionInfo & { fields: string[]; hint: string }> = [
  {
    id: 'person-hero',
    selector: '',
    title: 'Who this is for',
    logic: "Who the page is for, under their company's logo; the personalization is said once, here.",
    tools: ['Salesforce', 'CMS'],
    sources: ['Account logo from the parent account page', 'Contact record'],
    fields: ['heroEyebrow', 'companyLogo'],
    hint: 'The line beside their account logo ("Written for Ben"). Personalization is said once, here.',
  },
  {
    id: 'person-identity',
    selector: '',
    title: 'Headline',
    logic: "Their name and role as they publish them; a headline, when there is one, makes the claim.",
    tools: ['Salesforce', 'LinkedIn'],
    sources: ['Contact record', 'Published profile as they wrote it'],
    fields: ['heroHeadline', 'heroSubheadline', 'personName', 'personTitle', 'roleFrame'],
    hint: 'With a headline the h1 is the claim; without one it is their name and title.',
  },
  {
    id: 'person-opening',
    selector: '',
    title: 'The note',
    logic: "Mark opens on one specific thing they published; their account executive signs it.",
    tools: ['Mark', 'Web browsing'],
    sources: ['One specific published detail', 'Named account executive'],
    fields: ['noteBody', 'noteSignedBy', 'noteSignedByRole', 'noteSignedByInitials', 'noteDate'],
    hint: 'One paragraph from their account executive, signed.',
  },
  {
    id: 'person-measures',
    selector: '',
    title: 'What the job is scored on',
    logic: "What a seat like theirs is measured on, inferred from title and department: a hypothesis, not a record.",
    tools: ['Mark'],
    sources: ['Seat inference from title and department', "The parent page's pain points"],
    notes: 'A hypothesis about the role, not a record about the person.',
    fields: ['scorecardHeadline', 'scorecard'],
    hint: 'Three or four measures, each with why it is hard and a metric.',
  },
  {
    id: 'person-operation',
    selector: '',
    title: 'Your operation',
    logic: "Public facts about their operation, each with its source.",
    tools: ['Web browsing', 'BuiltWith'],
    sources: ['Public site structure', 'Detected platform and stack', 'Filings and newsroom'],
    fields: ['provenance'],
    hint: 'The provenance rows with Register "read": public facts, each with its source.',
  },
  {
    id: 'person-practice',
    selector: '',
    title: 'In practice',
    logic: "The parent page's product claims, put in this seat's own vocabulary.",
    tools: ['Mark', 'CMS'],
    sources: ['Product claims from the parent page', 'Reframed to this seat’s vocabulary'],
    fields: ['solutionsHeadline', 'solutionsIntro', 'solutions'],
    hint: 'One card per product, in the order of the measures.',
  },
  {
    id: 'person-how',
    selector: '',
    title: 'How it works',
    logic: "The same on every person page: held in the page, not generated.",
    tools: ['CMS'],
    sources: ['Fixed platform description'],
    notes: 'Identical on every person page — held in the frontend, not generated.',
    fields: [],
    hint: 'Template copy, the same on every person page: nothing here is stored on the page.',
  },
  {
    id: 'person-number',
    selector: '',
    title: 'The one number',
    logic: "One figure from a published customer story or third-party research: cited, never computed.",
    tools: ['Mark', 'Web browsing'],
    sources: ['Published customer story or third-party research', 'Cited, never computed'],
    fields: ['keyNumberPrefix', 'keyNumberValue', 'keyNumberSuffix', 'keyNumberLabel', 'keyNumberDetail', 'keyNumberCitationUrl'],
    hint: 'A third party’s figure with its source, never our own arithmetic.',
  },
  {
    id: 'person-proof',
    selector: '',
    title: 'Peer proof',
    logic: "Quotes from people in a seat like theirs, matched on role first, industry second.",
    tools: ['CMS', 'Mark'],
    sources: ['optimizely.com customer stories', 'Matched on role first, industry second'],
    fields: ['peerProofHeadline', 'peerProof'],
    hint: 'Quotes from people in a seat like theirs, one per person.',
  },
  {
    id: 'person-working',
    selector: '',
    title: 'Why you’re seeing this',
    logic: "Why they are seeing this: their own public words and our labelled assumptions.",
    tools: ['Mark', 'Salesforce'],
    sources: ['Their own words', 'Our labelled assumption about the seat'],
    notes: 'The disclosure that earns the rest of the page.',
    fields: ['provenance'],
    hint: 'The provenance rows with Register "told" (their words) or "assumed" (ours, labelled).',
  },
  {
    id: 'person-cta',
    selector: '',
    title: 'The ask',
    logic: "One click tells their account executive; no form.",
    tools: ['Mark'],
    sources: ['The one-click ask: it tells the account executive'],
    fields: ['ctaTitle', 'ctaBody', 'ctaButtonText', 'meetingUrl'],
    hint: 'The button keeps its words only with a booking link in meetingUrl; otherwise it reads "Talk to your team".',
  },
  {
    id: 'person-team',
    selector: '',
    title: 'Your team',
    logic: "Their account team from the parent page (Salesforce and Outreach), with placeholder contacts left out.",
    tools: ['Salesforce', 'Outreach', 'Gravatar'],
    sources: ['Account team from the parent page', 'Placeholder contacts filtered out'],
    fields: ['teamHeadline', 'team'],
    hint: 'The account executive (by role) is who the ask messages.',
  },
  {
    id: 'person-small-print',
    selector: '',
    title: 'Small print',
    logic: "One stored line at the foot of the ask.",
    tools: ['CMS'],
    sources: ['Stored footer line'],
    fields: ['footerLine'],
    hint: 'One line at the foot of the ask.',
  },
]

export const PERSON_XRAY_DEFAULTS: XraySectionInfo[] = PERSON_PARTS.map(({ fields: _f, hint: _h, ...p }) => ({
  ...p,
  selector: `[data-xray="${p.id}"]`,
}))

/** Edit mode on a person page: each part with the fields it shows. */
export const PERSON_EDIT: EditSectionInfo[] = PERSON_PARTS.map((p) => ({ ...p, selector: `[data-xray="${p.id}"]` }))

/** Tools renamed since CMS pages stored their own `Tools` overrides. */
const RENAMED_TOOLS: Record<string, string> = { 'Opal': 'Mark' };

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
      tools: o.Tools && o.Tools.length ? o.Tools.map((t) => RENAMED_TOOLS[t] ?? t) : d.tools,
      sources: o.Sources && o.Sources.length ? o.Sources : d.sources,
      // A page's own stored note is about that page: it says how the part was made there.
      logic: o.Notes?.trim() ? o.Notes : d.logic,
      notes: o.Notes ?? d.notes,
    };
  });
}
