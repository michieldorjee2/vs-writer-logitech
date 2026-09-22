/**
 * `person` — the page written to one named individual, on `PersonExperience`.
 *
 * Five sections, and the shortest of the four blueprints on purpose: a page addressed to a
 * person is read in one sitting by one reader who did not ask for it. Every section it keeps
 * has to survive the question "would they forward this?".
 *
 * IT REUSES THE ABM SLOT IDS, AND THE BINDINGS DIFFER. `friction-points` is fed by
 * `painPoints` on an account page and by `scorecard` on a person page; `signal-pills` is
 * `intelStats` there and the single `keyNumber*` cluster here; `proof-wall` is a logo wall
 * there and peer proof here. That is exactly why `SLOT_MAP` is keyed by blueprint AND slot:
 * a slot id names the JOB of a band, and the flat key that fills it depends on which page
 * type the copy is coming from.
 *
 * The sections it withholds are the ones that would give the game away: no comparison table
 * (a person page never names a competitor), no ROI projection (one honest number, in the
 * pills, with its citation), no migration timeline, no offer card, no sticky CTA following
 * them down the page.
 *
 * ROUTING: `/{companySlug}/{personSlug}/`, a child of that account's page. The hierarchy is
 * load-bearing — a stakeholder card on the account page links here by appending `PersonSlug`,
 * and the hero screenshot is pulled across from the parent at resolve time.
 */

import { defineBlueprint } from './internal/compose'

export default defineBlueprint({
  blueprintId: 'person',
  contentType: 'PersonExperience',
  displayName: 'Person',
  description:
    'A page written to one named individual at an account: hero, one key number, what a seat ' +
    'like theirs is measured on, peer proof, the ask. A child of the account page at ' +
    '/{companySlug}/{personSlug}/.',
  slots: [
    {
      slotId: 'hero',
      displayName: 'Hero',
      why: 'Names them and the seat, not the company. The screenshot behind it comes from the parent page.',
      section: {
        containerWidth: 'full',
        backgroundColor: 'dark_forest',
        backgroundTreatment: 'gradient_galaxy',
        paddingY: 'extra_loose',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'heroHeadline', cardinality: 'one', note: 'heroHeadline -> Text at HeadingLevel h1.' },
        { contentType: 'StackedHeadingElement', flatKey: 'heroEyebrow', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'heroSubheadline', cardinality: 'one', note: 'heroSubheadline -> MainBody' },
        { contentType: 'ButtonBlock', flatKey: 'heroCtaText', cardinality: 'one', note: 'heroCtaText -> ButtonText, heroCtaUrl -> ButtonUrl' },
      ],
    },
    {
      slotId: 'signal-pills',
      displayName: 'The key number',
      why: 'One number with a citation, not a row of pills. A person page that quotes five statistics reads as a brochure.',
      section: {
        backgroundColor: 'dark_forest',
        paddingY: 'compact',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'StatBlock',
          flatKey: 'keyNumberValue',
          cardinality: 'one',
          note: 'keyNumberValue with keyNumberPrefix / keyNumberSuffix -> StatValue; keyNumberLabel and keyNumberDetail -> Description; keyNumberCitationUrl is the source link. Cardinality is deliberately `one` where the ABM blueprints use `many`.',
        },
      ],
    },
    {
      slotId: 'friction-points',
      displayName: 'Where this gets hard',
      why: 'What a seat like theirs is scored on. The section that proves we understand the job.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmFrictionPointElement',
          flatKey: 'scorecard',
          cardinality: 'many',
          note: 'Measure -> Title, WhyHard -> Description (WhatChanges and Metric ride along). `scorecard` is the current shape; `remitPoints` (Title / Description / Metric) is the previous generation and is still the only shape some live pages carry, so a migration must read both.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'scorecardHeadline', cardinality: 'one', note: 'Falls back to remitHeadline, then to "Where this gets hard".' },
        { contentType: 'TextContentElement', flatKey: 'scorecardIntro', cardinality: 'one' },
      ],
    },
    {
      slotId: 'proof-wall',
      displayName: 'Others who hold a seat like yours',
      why: 'Peer proof rather than a logo wall: at this altitude the relevant question is who like me has done this.',
      section: { backgroundColor: 'light_gray', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'CardCustomerQuoteBlock',
          flatKey: 'peerProof',
          cardinality: 'many',
          note: 'Quote / PersonName / PersonTitle / Company / SourceUrl, one node per quote. Real, sourced quotes only — the SourceUrl is what makes that checkable.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'peerProofHeadline', cardinality: 'one' },
      ],
    },
    {
      slotId: 'contact-close',
      displayName: 'The ask',
      why: 'One ask, and the people on our side who would be in the room.',
      section: { backgroundColor: 'dark_forest', paddingY: 'extra_loose', roundedCorners: 'top' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmClosingCtaElement',
          flatKey: 'ctaTitle',
          cardinality: 'one',
          note: 'ctaTitle -> Title, ctaBody -> Description (NOT ctaDescription, which is the account page\'s name for it), ctaButtonText -> ButtonText, meetingUrl -> ScheduleUrl.',
        },
        {
          contentType: 'AbmTeamMemberElement',
          flatKey: 'team',
          cardinality: 'many',
          note: 'Initials / Name / Role / Email / AvatarColor, plus AlreadyMet — the flat key is `team`, not `teamMembers`, on this page type.',
        },
      ],
    },
  ],
})
