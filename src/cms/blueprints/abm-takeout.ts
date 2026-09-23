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
 * Layout settings come from ./internal/layouts (prod's vocabulary, modelled on optimizely.com's
 * AI Marketing Certificate page). The zip-era `backgroundTreatment` setting is gone: no renderer
 * ever read it, and prod has no such setting.
 */

import { defineBlueprint } from './internal/compose'
import { CHROME, CLOSE_CARD, COL_BODY, COL_FULL, COL_HERO, HERO_CARD, ROW_GRID, cards, sheet } from './internal/layouts'

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
      section: HERO_CARD,
      row: ROW_GRID,
      column: COL_HERO,
      // Render order (eyebrow above headline) and PRIMARY (still the headline — the write
      // Phase 3 mirrors onto this slot's binding) are separate now: see SlotFeed.primary.
      // This was one of the five slots where feeds[0]-as-both disagreed with itself.
      feeds: [
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'eyebrow',
          cardinality: 'one',
          note: 'The kicker above the headline — a second heading node, not a property of the first.',
        },
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'headline',
          cardinality: 'one',
          primary: true,
          note: 'headline -> Text at HeadingLevel h1. splitEmphasis() bolds the emphasised run at render time, so the copy carries its own emphasis markers rather than needing a second field.',
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
      section: sheet('white'),
      row: ROW_GRID,
      column: COL_BODY,
      feeds: [
        {
          contentType: 'StatBlock',
          flatKey: 'intelStats',
          cardinality: 'many',
          note: 'Value -> StatValue, Label -> Description (one node per stat). readPills() joins the pair with a single space, which leaves the punctuation with the author and is why a metric ("4.8M" + "monthly visitors") and a statement ("Strategic focus:" + "…") both read correctly.',
          // A pill strip, not a stack of full-width cards: 4-up (all of them, on this page)
          // from md up. Measured defect: every `many` feed rendered one item per line
          // regardless of how many there were. On `row`, not `column` — see compose.ts's
          // header for the measured reason a column-level equivalent is silently dropped by
          // the CMS.
          //
          // 1-up on a phone, NOT 2-up: MEASURED. StatBlock's value is huge extruded display
          // type (`text-11xl`, no shrink-to-fit), and at cols_2 on a 390px viewport
          // "Mar 2027" overflowed its own ~180px column and forced the page 162px wider than
          // the viewport — a phone-width horizontal scrollbar, worse than the stacking bug
          // this slot exists to fix. techStack below is small tag text and stays 2-up.
          // Base (phone) is still 1-up — see above; 2-up on tablets, 4-up on desktop.
          ...cards('cols_4', 'cols_2'),
        },
      ],
    },
    {
      slotId: 'account-intel',
      displayName: 'Account intelligence',
      why: 'What we found: the stack, the news, the people. Five element types, five columns, one row.',
      section: sheet('neutral'),
      row: ROW_GRID,
      column: COL_BODY,
      feeds: [
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'intelEyebrow',
          cardinality: 'one',
          note: 'Also the fallback first line of the nav rail when railMeta is absent.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'intelHeadline', cardinality: 'one', primary: true },
        {
          contentType: 'AbmTechStackItemElement',
          flatKey: 'techStack',
          cardinality: 'many',
          note: 'Name / ColorTag',
          // A dense tag strip, same treatment as signal-pills.
          ...cards('cols_4', 'cols_2'),
        },
        { contentType: 'AbmNewsItemElement', flatKey: 'newsItems', cardinality: 'many', note: 'Date / Headline / Url' },
        {
          contentType: 'AbmStakeholderElement',
          flatKey: 'stakeholders',
          cardinality: 'many',
          note: 'Initials / Name / Role / LinkedInUrl / AvatarColor, plus the Salesforce engagement fields (EngagementTier, EngagementNote, PersonSlug, CrmContactId).',
          // 3-up from md; full width on a phone, where a 3rd of the width is too narrow for
          // a name, a role and an engagement note.
          ...cards('cols_3', 'cols_2'),
        },
      ],
    },
    {
      slotId: 'challenge-shot',
      displayName: 'The challenge',
      why: "A framed screenshot of the customer's own site, and what is wrong with it.",
      section: sheet('white'),
      row: ROW_GRID,
      column: COL_BODY,
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
      section: sheet('neutral'),
      row: ROW_GRID,
      column: COL_BODY,
      // Another of the five slots where the primary feed (the rows — the whole point of
      // this slot) does not render first; its heading does.
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'comparisonHeadline', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'comparisonDescription', cardinality: 'one' },
        {
          contentType: 'AbmComparisonRowElement',
          flatKey: 'comparisonTableRows',
          cardinality: 'many',
          primary: true,
          note: 'One node per row. Category / OurValue / CompetitorValue carry across unchanged; the legacy OurHighlight and CompetitorHighlight booleans do NOT — a highlight is a presentation choice and now lives in that element\'s display template. See its DIVERGENCE.md.',
          // These are rows of a table, not cards — no `row` override, so this feed's own
          // row stays at its default one-column grid: MUST stay one per line.
        },
      ],
    },
    {
      slotId: 'proof-wall',
      displayName: 'Proof wall',
      why: 'The logo wall. Shown unconditionally today — it has no content gate of its own.',
      section: sheet('white'),
      row: ROW_GRID,
      column: COL_BODY,
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
      section: sheet('neutral'),
      row: ROW_GRID,
      column: COL_BODY,
      // Another of the five: the cards are primary, but the headline number renders above
      // them.
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'roiTitle', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'roiDescription', cardinality: 'one' },
        {
          contentType: 'StatBlock',
          flatKey: 'roiProjectionValue',
          cardinality: 'one',
          note: 'roiProjectionValue -> StatValue; roiProjectionLabel and roiProjectionDetail -> Description. The headline number above the cards.',
        },
        {
          contentType: 'AbmRoiCardElement',
          flatKey: 'roiCards',
          cardinality: 'many',
          primary: true,
          note: 'Metric / Unit / Label / CitationText',
          // 3-up from md; a citation needs the full width of a phone screen to stay legible.
          ...cards('cols_3', 'cols_2'),
        },
      ],
    },
    {
      slotId: 'migration-timeline',
      displayName: 'Migration timeline',
      why: 'How the move happens. Answers the objection the comparison table creates.',
      section: sheet('dark_forest'),
      row: ROW_GRID,
      column: COL_BODY,
      // Another of the five: the phases are primary, but the title renders above them.
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'migrationTitle', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'migrationDescription', cardinality: 'one' },
        {
          contentType: 'AbmTimelinePhaseElement',
          flatKey: 'timelinePhases',
          cardinality: 'many',
          primary: true,
          note: 'Weeks / Title / Description / MarkerColor',
          // A vertical spine, not a grid — no `row` override, so this feed's own row stays
          // at its default one-column grid: MUST stay one per line.
        },
      ],
    },
    {
      slotId: 'analyst-proof',
      displayName: 'Analyst recognition',
      why: 'Third-party proof, which is the only kind that answers "says who?".',
      section: sheet('white'),
      row: ROW_GRID,
      column: COL_BODY,
      // Another of the five: the badge cards are primary, but the headline and quote render
      // above them.
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'analystHeadline', cardinality: 'one' },
        {
          contentType: 'BlockquoteBlock',
          flatKey: 'analystQuote',
          cardinality: 'one',
          note: 'analystSource -> the attribution. A real quote from a named report, never a synthesised one.',
        },
        {
          contentType: 'AbmAnalystCardElement',
          flatKey: 'analystCards',
          cardinality: 'many',
          primary: true,
          note: 'Badge / Source / Category / Url',
          ...cards('cols_3', 'cols_2'),
        },
        { contentType: 'ButtonBlock', flatKey: 'analystCTA', cardinality: 'one', note: 'analystCTA -> ButtonText, analystCTALink -> ButtonUrl' },
      ],
    },
    {
      slotId: 'customer-stories',
      displayName: 'Customer stories',
      section: sheet('neutral'),
      // TWO DIFFERENT feeds side by side, not one feed's own items — the one case that needs
      // `sharedRow`. No slot-level colSpan override: `colSpan: 'full'` on both columns would
      // make the second always wrap to its own line; `auto` (the column default) lets each
      // take one of the row's two grid cells instead.
      sharedRow: true,
      row: cards('cols_2', 'cols_1').row,
      column: cards('cols_2', 'cols_1').column,
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
      section: sheet('white'),
      row: ROW_GRID,
      column: COL_BODY,
      feeds: [
        {
          contentType: 'AbmFrictionPointElement',
          flatKey: 'painPoints',
          cardinality: 'many',
          note: 'Title / Description, one node per point.',
          ...cards('cols_3', 'cols_2'),
        },
      ],
    },
    {
      slotId: 'contact-close',
      displayName: 'Who to talk to',
      why: 'The ask, and the named humans on both sides of it.',
      section: CLOSE_CARD,
      row: ROW_GRID,
      column: COL_BODY,
      // ctaTitle is both the first feed and the primary one — no disagreement to record here,
      // unlike its five siblings above. Only the two `many` feeds' relative order changes:
      // stakeholders (who to talk to) reads before teamMembers (who is asking).
      feeds: [
        {
          contentType: 'AbmClosingCtaElement',
          flatKey: 'ctaTitle',
          cardinality: 'one',
          note: 'ctaTitle -> Title, ctaDescription -> Description, ctaButtonText -> ButtonText, modalScheduleUrl -> ScheduleUrl.',
        },
        {
          contentType: 'AbmStakeholderElement',
          flatKey: 'stakeholders',
          cardinality: 'many',
          note: 'The same people as account-intel, shown here as who to talk to. PersonSlug is what makes the card link to that person\'s own page.',
          ...cards('cols_3', 'cols_2'),
        },
        { contentType: 'AbmTeamMemberElement', flatKey: 'teamMembers', cardinality: 'many', note: 'Initials / Name / Role / Email — our side.', ...cards('cols_3', 'cols_2'), },
      ],
    },
    {
      slotId: 'sticky-cta',
      displayName: 'Sticky CTA',
      why: 'Chrome, not content: it floats over the page rather than occupying a band.',
      section: CHROME,
      row: ROW_GRID,
      column: COL_FULL,
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
