/**
 * `abm-takeout` — the competitive-takeout account page, as a blueprint.
 *
 * This is the existing shape: the thirteen sections `ABMHyperPage` renders today, in the
 * order it renders them, on the new `ABMExperience` type. It is the reference blueprint —
 * the one that proves the composition can hold everything the 67-property flat type held —
 * so its slot list is deliberately the LONGEST of the four and nothing is withheld.
 *
 * The other three blueprints are this one with things taken away. That is the right way round:
 * `use-case-default` withholds the comparison table, the ROI projection and the migration
 * timeline ON PURPOSE, and a withholding is only legible against something that includes them.
 *
 * SECTION RHYTHM. The bands alternate deliberately: a dark hero and pill strip open the page
 * as one unit (both `dark_forest`, square corners, so the seam is invisible), then light and
 * white bands alternate down the argument, and the page closes on dark again. The two
 * `backgroundTreatment` values are used exactly twice — `gradient_galaxy` on the hero and
 * `extrusion` on the ROI band, the two places the brand's own motion language earns its keep.
 * Everything else stays `plain`, which is optimizely.com's flat band.
 */

import { defineBlueprint } from './internal/compose'

export default defineBlueprint({
  blueprintId: 'abm-takeout',
  contentType: 'ABMExperience',
  displayName: 'ABM takeout',
  description:
    'The full competitive-takeout account page: thirteen sections from hero to sticky CTA. ' +
    'The shape ABMHyperPage renders today.',
  slots: [
    {
      slotId: 'hero',
      displayName: 'Hero',
      why: 'Names the account and the argument. The one section no blueprint omits.',
      section: {
        containerWidth: 'full',
        backgroundColor: 'dark_forest',
        backgroundTreatment: 'gradient_galaxy',
        paddingY: 'extra_loose',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'headline',
          cardinality: 'one',
          note: 'headline -> Text at HeadingLevel h1. splitEmphasis() bolds the emphasised run at render time, so the copy carries its own emphasis markers rather than needing a second field.',
        },
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'eyebrow',
          cardinality: 'one',
          note: 'The kicker above the headline — a second heading node, not a property of the first.',
        },
        { contentType: 'TextContentElement', flatKey: 'subheadline', cardinality: 'one', note: 'subheadline -> MainBody' },
        {
          contentType: 'ButtonBlock',
          flatKey: 'cta',
          cardinality: 'one',
          note: 'cta -> ButtonText, link -> ButtonUrl. Flattened from upstream ButtonBlock.Link, which is a content reference and therefore a 400 on an element.',
        },
      ],
    },
    {
      slotId: 'signal-pills',
      displayName: 'Signal pills',
      why: 'The evidence the page was written from, as short phrases directly under the hero.',
      section: {
        backgroundColor: 'dark_forest',
        paddingY: 'compact',
        roundedCorners: 'none',
        marginTop: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'StatBlock',
          flatKey: 'intelStats',
          cardinality: 'many',
          note: 'Value -> StatValue, Label -> Description (one node per stat). readPills() joins the pair with a single space, which leaves the punctuation with the author and is why a metric ("4.8M" + "monthly visitors") and a statement ("Strategic focus:" + "…") both read correctly.',
        },
      ],
    },
    {
      slotId: 'account-intel',
      displayName: 'Account intelligence',
      why: 'What we found: the stack, the news, the people. Four element types in one column.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'intelHeadline', cardinality: 'one' },
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'intelEyebrow',
          cardinality: 'one',
          note: 'Also the fallback first line of the nav rail when railMeta is absent.',
        },
        { contentType: 'AbmTechStackItemElement', flatKey: 'techStack', cardinality: 'many', note: 'Name / ColorTag' },
        { contentType: 'AbmNewsItemElement', flatKey: 'newsItems', cardinality: 'many', note: 'Date / Headline / Url' },
        {
          contentType: 'AbmStakeholderElement',
          flatKey: 'stakeholders',
          cardinality: 'many',
          note: 'Initials / Name / Role / LinkedInUrl / AvatarColor, plus the Salesforce engagement fields (EngagementTier, EngagementNote, PersonSlug, CrmContactId).',
        },
      ],
    },
    {
      slotId: 'challenge-shot',
      displayName: 'The challenge',
      why: "A framed screenshot of the customer's own site, and what is wrong with it.",
      section: { backgroundColor: 'light_gray', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmChallengeShotElement',
          flatKey: 'challengeHeadline',
          cardinality: 'one',
          note: 'challengeHeadline -> the heading; challengeScreenshotUrl / challengeScreenshotAlt / challengeBrowserUrl -> the framed shot. One element rather than four, because the frame and its caption are one thing.',
        },
      ],
    },
    {
      slotId: 'comparison-table',
      displayName: 'Comparison table',
      why: 'Only present when a competitor is confirmed. The whole point of the takeout shape.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmComparisonRowElement',
          flatKey: 'comparisonTableRows',
          cardinality: 'many',
          note: 'One node per row. Category / OurValue / CompetitorValue carry across unchanged; the legacy OurHighlight and CompetitorHighlight booleans do NOT — a highlight is a presentation choice and now lives in that element\'s display template. See its DIVERGENCE.md.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'comparisonHeadline', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'comparisonDescription', cardinality: 'one' },
      ],
    },
    {
      slotId: 'proof-wall',
      displayName: 'Proof wall',
      why: 'The logo wall. Shown unconditionally today — it has no content gate of its own.',
      section: { backgroundColor: 'light_gray', paddingY: 'default' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'ImageDisplayElement',
          flatKey: 'logoWallCustomerSlot',
          cardinality: 'one',
          note: "The one customer logo slotted into an otherwise static wall -> ImageUrl. Flattened from upstream ImageDisplayBlock.ImageReference, which is a content reference.",
        },
      ],
    },
    {
      slotId: 'roi-projection',
      displayName: 'ROI projection',
      why: 'The number the page is arguing for, with its citations.',
      section: {
        backgroundColor: 'dark_forest',
        backgroundTreatment: 'extrusion',
        paddingY: 'loose',
      },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'AbmRoiCardElement', flatKey: 'roiCards', cardinality: 'many', note: 'Metric / Unit / Label / CitationText' },
        { contentType: 'StackedHeadingElement', flatKey: 'roiTitle', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'roiDescription', cardinality: 'one' },
        {
          contentType: 'StatBlock',
          flatKey: 'roiProjectionValue',
          cardinality: 'one',
          note: 'roiProjectionValue -> StatValue; roiProjectionLabel and roiProjectionDetail -> Description. The headline number above the cards.',
        },
      ],
    },
    {
      slotId: 'migration-timeline',
      displayName: 'Migration timeline',
      why: 'How the move happens. Answers the objection the comparison table creates.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'AbmTimelinePhaseElement', flatKey: 'timelinePhases', cardinality: 'many', note: 'Weeks / Title / Description / MarkerColor' },
        { contentType: 'StackedHeadingElement', flatKey: 'migrationTitle', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'migrationDescription', cardinality: 'one' },
      ],
    },
    {
      slotId: 'analyst-proof',
      displayName: 'Analyst recognition',
      why: 'Third-party proof, which is the only kind that answers "says who?".',
      section: { backgroundColor: 'light_teal', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'AbmAnalystCardElement', flatKey: 'analystCards', cardinality: 'many', note: 'Badge / Source / Category / Url' },
        {
          contentType: 'BlockquoteBlock',
          flatKey: 'analystQuote',
          cardinality: 'one',
          note: 'analystSource -> the attribution. A real quote from a named report, never a synthesised one.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'analystHeadline', cardinality: 'one' },
        { contentType: 'ButtonBlock', flatKey: 'analystCTA', cardinality: 'one', note: 'analystCTA -> ButtonText, analystCTALink -> ButtonUrl' },
      ],
    },
    {
      slotId: 'customer-stories',
      displayName: 'Customer stories',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'CardCustomerQuoteBlock',
          flatKey: 'testimonial1',
          cardinality: 'one',
          note: 'testimonial1JobTitle and testimonial1Company -> the attribution.',
        },
        {
          contentType: 'CardCustomerQuoteBlock',
          flatKey: 'testimonial2',
          cardinality: 'one',
          note: 'The legacy type NUMBERS its testimonials, which is why there are exactly two of them and never three. In the composition each quote is a node, so a third costs a node rather than four new properties.',
        },
      ],
    },
    {
      slotId: 'friction-points',
      displayName: 'Where it breaks',
      why: 'The gaps, in the account\'s own language. Late on a takeout page, early on a use-case page.',
      section: { backgroundColor: 'light_gray', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'AbmFrictionPointElement', flatKey: 'painPoints', cardinality: 'many', note: 'Title / Description, one node per point.' },
      ],
    },
    {
      slotId: 'contact-close',
      displayName: 'Who to talk to',
      why: 'The ask, and the named humans on both sides of it.',
      section: { backgroundColor: 'dark_forest', paddingY: 'extra_loose', roundedCorners: 'top' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmClosingCtaElement',
          flatKey: 'ctaTitle',
          cardinality: 'one',
          note: 'ctaTitle -> Title, ctaDescription -> Description, ctaButtonText -> ButtonText, modalScheduleUrl -> ScheduleUrl.',
        },
        { contentType: 'AbmTeamMemberElement', flatKey: 'teamMembers', cardinality: 'many', note: 'Initials / Name / Role / Email — our side.' },
        {
          contentType: 'AbmStakeholderElement',
          flatKey: 'stakeholders',
          cardinality: 'many',
          note: 'The same people as account-intel, shown here as who to talk to. PersonSlug is what makes the card link to that person\'s own page.',
        },
      ],
    },
    {
      slotId: 'sticky-cta',
      displayName: 'Sticky CTA',
      why: 'Chrome, not content: it floats over the page rather than occupying a band.',
      section: {
        backgroundColor: 'transparent',
        paddingY: 'none',
        paddingX: 'none',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmStickyCtaElement',
          flatKey: 'stickyCTAText',
          cardinality: 'one',
          note: 'stickyCTAText -> Text; Url comes from modalScheduleUrl, the same link the closing CTA opens.',
        },
      ],
    },
  ],
})
