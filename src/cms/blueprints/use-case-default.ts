/**
 * `use-case-default` — Laura's Use Case Template v2.
 *
 * THIS BLUEPRINT IS DEFINED BY WHAT IT WITHHOLDS. It is `abm-takeout` with six sections taken
 * away, and the three that matter are deliberate: NO comparison table, NO ROI projection, NO
 * migration timeline. It also names no competitor anywhere — `competitorName` stays empty on
 * a page built from it.
 *
 * That is a sales judgement, not a content gap. A comparison table asserts a competitor, and
 * a competitor may only be asserted when a TECH signal confirmed one; an ROI projection
 * asserts a number nobody has agreed to; a migration timeline answers an objection that only
 * exists once you have claimed a displacement. On an account where none of those three are
 * confirmed, showing them is how a page loses its credibility in the first ten seconds — and
 * it is the thing the pilot got wrong.
 *
 * Withholding is only auditable if it is recorded, which is why a page carries
 * `componentPlan`: the plan says `include: false` and `why`, so a reviewer can see the
 * decision rather than inferring it from a null field. On the flat type a withheld comparison
 * table and a missing one were the same thing.
 *
 * Two of its seven sections need content the 67 registered fields on the flat type cannot
 * hold, and those are the two that forced this whole migration:
 *
 *   use-case-matrix   `useCaseLanes` — four strings per lane (Lane / Need / Solution /
 *                     Outcome). `painPoints` is the closest existing shape and carries two.
 *   why-now-thesis    `thesis*` — the argument, as prose plus an attributed line.
 *                     `roiTitle`/`roiDescription` is the nearest empty pair, and putting an
 *                     argument about content velocity into fields every reader treats as an
 *                     ROI claim is how a page starts lying by accident.
 *
 * Neither flat key is registered on `CompetitorComparisonPage` and neither is in `PAGE_QUERY`
 * — a selection on one unregistered field fails the ENTIRE GraphQL query and 404s all 2,695
 * pages, which is exactly what happened once. On `ABMExperience` the question does not arise:
 * the lanes are element nodes, not a page property.
 */

import { defineBlueprint } from './internal/compose'

export default defineBlueprint({
  blueprintId: 'use-case-default',
  contentType: 'ABMExperience',
  displayName: 'Use case (default)',
  description:
    "Laura's Use Case Template v2: nav rail, hero, pills, the in-market use-case matrix, the " +
    'why-now thesis, where it breaks, who to talk to. Names no competitor and shows no ' +
    'comparison table, ROI projection or migration timeline.',
  slots: [
    {
      slotId: 'nav-rail',
      displayName: 'Navigation rail',
      why: 'Chrome. A fixed rail with the section anchors and three lines of page meta.',
      section: {
        backgroundColor: 'transparent',
        paddingY: 'none',
        paddingX: 'none',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmNavRailElement',
          flatKey: 'railMeta',
          cardinality: 'one',
          note: 'railMeta -> RailLines, a string array. Derived when absent (intelEyebrow, then "Prepared for <company>", then the publish year), so the rail is never empty on a page written before the field existed. The nav destinations themselves come from the plan, not from content.',
        },
      ],
    },
    {
      slotId: 'hero',
      displayName: 'Hero',
      why: 'Same hero as the takeout, different argument: what we would do, not who we would replace.',
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
          note: 'headline -> Text at HeadingLevel h1; splitEmphasis() bolds the emphasised run.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'eyebrow', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'subheadline', cardinality: 'one', note: 'subheadline -> MainBody' },
        { contentType: 'ButtonBlock', flatKey: 'cta', cardinality: 'one', note: 'cta -> ButtonText, link -> ButtonUrl' },
      ],
    },
    {
      slotId: 'signal-pills',
      displayName: 'Signal pills',
      why: 'The evidence, as phrases. On this template they are the only numbers on the page.',
      section: {
        backgroundColor: 'dark_forest',
        paddingY: 'compact',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'StatBlock',
          flatKey: 'intelStats',
          cardinality: 'many',
          note: 'Value -> StatValue, Label -> Description, one node per stat, joined with a space at render time.',
        },
      ],
    },
    {
      slotId: 'use-case-matrix',
      displayName: 'In-market use cases',
      why: 'The centre of the template: the account\'s need on top, what we would use underneath.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmUseCaseLaneElement',
          flatKey: 'useCaseLanes',
          cardinality: 'many',
          note: 'Lane / Need / Solution / Outcome, one node per lane. NOT a registered field on the flat type — this is one of the two shapes that could not be expressed there.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'useCaseHeading', cardinality: 'one', note: 'Defaults to "What we\'d put to work at <company>" when absent.' },
        { contentType: 'TextContentElement', flatKey: 'useCaseNote', cardinality: 'one', note: 'The line under the heading.' },
        { contentType: 'TextContentElement', flatKey: 'useCaseFooter', cardinality: 'one', note: 'The footer line on the card — "all three are in active evaluation".' },
      ],
    },
    {
      slotId: 'why-now-thesis',
      displayName: 'Why now',
      why: 'The argument the page makes, in prose. The second shape the flat type had nowhere to put.',
      section: { backgroundColor: 'light_green', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmThesisElement',
          flatKey: 'thesisHeadline',
          cardinality: 'one',
          note: 'thesisHeadline -> the heading, thesisBody -> paragraphs (split on blank lines), thesisQuote + thesisAttribution -> the pulled line. The attribution is "the argument this page makes" rather than an invented speaker — never fabricate a named quote.',
        },
      ],
    },
    {
      slotId: 'friction-points',
      displayName: 'Where it breaks',
      why: 'Early here, late on the takeout: without a comparison table this IS the argument.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'AbmFrictionPointElement', flatKey: 'painPoints', cardinality: 'many', note: 'Title / Description, one node per point.' },
      ],
    },
    {
      slotId: 'contact-close',
      displayName: 'Who to talk to',
      why: 'The ask. The only conversion point on the template — there is no sticky CTA here.',
      section: { backgroundColor: 'dark_forest', paddingY: 'extra_loose', roundedCorners: 'top' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmClosingCtaElement',
          flatKey: 'ctaTitle',
          cardinality: 'one',
          note: 'ctaTitle -> Title, ctaDescription -> Description, ctaButtonText -> ButtonText, modalScheduleUrl -> ScheduleUrl.',
        },
        { contentType: 'AbmTeamMemberElement', flatKey: 'teamMembers', cardinality: 'many', note: 'Initials / Name / Role / Email — our side. teamMembers[0].Email is also the mailto target.', row: { displayMode: 'grid', gridColumns: 'cols_1', gridColumnsMd: 'cols_3', gap: 'md' }, column: { colSpan: 'auto' } },
        {
          contentType: 'AbmStakeholderElement',
          flatKey: 'stakeholders',
          cardinality: 'many',
          note: 'Their side. PersonSlug links the card to that person\'s own page beneath this one.',
        },
      ],
    },
  ],
})
