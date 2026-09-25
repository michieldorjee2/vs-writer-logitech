/**
 * The OFFER page: one account, one offer, one call to action.
 *
 * Modelled on optimizely.com's AI Marketing Certificate page (prod content 7879), which is a
 * campaign page, not an account dossier: hero -> proof -> who runs it -> what you walk away with
 * -> how it runs -> is this for you -> sign up. Michiel's ruling (2026-09-25): the takeout shape
 * mirrors the account-intelligence page too closely; a page like this should promote an offer.
 *
 * So there is no comparison table, no tech-stack intel, no ROI model and no analyst wall here.
 * Account context appears only where it sharpens the offer: the hero's highlight cards and the
 * "is this for you" lists. Everything else is about what the prospect gets.
 *
 * Flat keys are the offer's own (`offerHeadline`, `agendaSteps`, …). There is no legacy page type
 * behind this blueprint, so nothing constrains them to CompetitorComparisonPage's field names.
 */
import { defineBlueprint } from './internal/compose'
import { CLOSE_CARD, COL_BODY, COL_HERO, DARK_CARD, HERO_FULL, PANEL_CARD, ROW_GRID, cards, sheet } from './internal/layouts'

export default defineBlueprint({
  blueprintId: 'offer',
  contentType: 'ABMExperience',
  displayName: 'Offer',
  description:
    'A campaign page promoting one offer to one account: hero, proof, hosts, outcomes, agenda, ' +
    'fit, sign-up. Modelled on the AI Marketing Certificate page.',
  slots: [
    {
      slotId: 'hero',
      displayName: 'Hero',
      why: 'The offer, stated once, with the three or four facts that make it worth taking.',
      section: HERO_FULL,
      row: ROW_GRID,
      column: COL_HERO,
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'offerEyebrow', cardinality: 'one', note: 'Rendered as a pill above the headline.' },
        { contentType: 'StackedHeadingElement', flatKey: 'offerHeadline', cardinality: 'one', primary: true, note: 'h1. A ##run## is the tonal emphasis.' },
        {
          contentType: 'StatBlock',
          flatKey: 'offerHighlights',
          cardinality: 'many',
          note: 'The floating cards: what the offer IS (time, cost, deliverable), not account intel.',
          ...cards('cols_4', 'cols_2'),
          row: { ...cards('cols_4', 'cols_2').row, gridColumns: 'cols_2', gridColumnsMd: 'cols_4' },
        },
        { contentType: 'TextContentElement', flatKey: 'offerIntro', cardinality: 'one' },
        { contentType: 'ButtonBlock', flatKey: 'offerCta', cardinality: 'one' },
      ],
    },
    {
      slotId: 'customer-stories',
      displayName: 'Proof',
      why: 'Peers who took the same session, before anything is asked of the reader.',
      section: PANEL_CARD,
      sharedRow: true,
      row: { ...ROW_GRID, gridColumns: 'cols_1', gridColumnsMd: 'cols_12', columnGap: 'md', rowGap: 'md' },
      column: { colSpan: 'full', colSpanMd: 'span_6' },
      feeds: [
        {
          contentType: 'StackedHeadingElement',
          flatKey: 'proofHeadline',
          cardinality: 'one',
          column: { colSpanMd: 'full', colSpanLg: 'span_10', colStartLg: 'start_2' },
        },
        {
          contentType: 'CardCustomerQuoteBlock',
          flatKey: 'proofQuote1',
          cardinality: 'one',
          column: { colSpanLg: 'span_5', colStartLg: 'start_2' },
          element: { cardStyle: 'light' },
        },
        {
          contentType: 'CardCustomerQuoteBlock',
          flatKey: 'proofQuote2',
          cardinality: 'one',
          column: { colSpanLg: 'span_5', colStartLg: 'start_7' },
          element: { cardStyle: 'light' },
        },
      ],
    },
    {
      slotId: 'offer-hosts',
      displayName: 'Who runs it',
      why: 'Names and faces: the offer is a conversation with specific people, not a form.',
      section: sheet(),
      row: ROW_GRID,
      column: COL_BODY,
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'hostsHeadline', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'hostsIntro', cardinality: 'one' },
        { contentType: 'AbmTeamMemberElement', flatKey: 'hosts', cardinality: 'many', element: { colorScheme: 'light' }, ...cards('cols_3', 'cols_2') },
      ],
    },
    {
      slotId: 'offer-outcomes',
      displayName: 'What you walk away with',
      why: 'The deliverables, concretely — the reference page’s "What you’ll build".',
      section: sheet(),
      row: ROW_GRID,
      column: COL_BODY,
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'outcomesHeadline', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'outcomesIntro', cardinality: 'one' },
        { contentType: 'AbmFrictionPointElement', flatKey: 'outcomes', cardinality: 'many', note: 'Title / Description, one card per deliverable.', ...cards('cols_3', 'cols_2') },
      ],
    },
    {
      slotId: 'offer-agenda',
      displayName: 'How it runs',
      why: 'The session, minute by minute — the reference page’s "Your 5-day journey".',
      section: DARK_CARD,
      row: ROW_GRID,
      column: { ...COL_BODY, colSpanLg: 'span_8', colStartLg: 'start_3' },
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'agendaHeadline', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'agendaIntro', cardinality: 'one' },
        { contentType: 'AbmTimelinePhaseElement', flatKey: 'agendaSteps', cardinality: 'many', note: 'Title / Description / MarkerColor, one per step.' },
      ],
    },
    {
      slotId: 'offer-fit',
      displayName: 'Is this for you?',
      why: 'Who should say yes and who should not — it qualifies without a form.',
      section: sheet(),
      sharedRow: true,
      row: { ...ROW_GRID, gridColumns: 'cols_1', gridColumnsMd: 'cols_12', columnGap: 'md', rowGap: 'md' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'fitHeadline', cardinality: 'one', column: { colSpanMd: 'full', colSpanLg: 'span_4' } },
        { contentType: 'CalloutBlock', flatKey: 'fitYes', cardinality: 'one', column: { colSpanMd: 'span_6', colSpanLg: 'span_4', colStartLg: 'start_5' } },
        { contentType: 'CalloutBlock', flatKey: 'fitNo', cardinality: 'one', column: { colSpanMd: 'span_6', colSpanLg: 'span_4' } },
      ],
    },
    {
      slotId: 'contact-close',
      displayName: 'Sign up',
      why: 'The one ask, restated at the end.',
      section: CLOSE_CARD,
      row: ROW_GRID,
      column: { ...COL_BODY, colSpanLg: 'span_8', colStartLg: 'start_3' },
      feeds: [{ contentType: 'AbmClosingCtaElement', flatKey: 'offerClose', cardinality: 'one', primary: true }],
    },
  ],
})
