/**
 * `comparison` — the plain comparison page.
 *
 * Five sections: the hero, the table, the analyst proof, the customer stories, the offer. No
 * account intelligence, no stakeholders, no timeline, no ROI. It is the page you can publish
 * without knowing anything about a specific account, which is precisely what distinguishes it
 * from `abm-takeout`: the takeout argues about ONE company, this one argues about a category.
 *
 * So it is the only blueprint of the four that has a shot at being indexable, and the one
 * where the offer card earns a section of its own rather than riding along at the bottom of
 * a closing CTA. `DynamicComparisonPage` is the renderer that exists for it today.
 *
 * It is still on `ABMExperience`. A page that names no account still wants the same identity,
 * branding, meta and provenance fields, and a fourth content type to hold nothing new would
 * cost a Graph migration for no gain.
 */

import { defineBlueprint } from './internal/compose'

export default defineBlueprint({
  blueprintId: 'comparison',
  contentType: 'ABMExperience',
  displayName: 'Comparison',
  description:
    'The plain "Optimizely vs X" page: hero, comparison table, analyst proof, customer ' +
    'stories, offer card. Category-level, not account-specific.',
  slots: [
    {
      slotId: 'hero',
      displayName: 'Hero',
      why: 'States the comparison. Shorter than the takeout hero — there is no account to introduce.',
      section: {
        containerWidth: 'full',
        backgroundColor: 'dark_forest',
        backgroundTreatment: 'gradient_galaxy',
        paddingY: 'loose',
        roundedCorners: 'none',
      },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'StackedHeadingElement', flatKey: 'headline', cardinality: 'one', note: 'headline -> Text at HeadingLevel h1.' },
        { contentType: 'StackedHeadingElement', flatKey: 'eyebrow', cardinality: 'one' },
        { contentType: 'TextContentElement', flatKey: 'subheadline', cardinality: 'one', note: 'subheadline -> MainBody' },
        { contentType: 'ButtonBlock', flatKey: 'cta', cardinality: 'one', note: 'cta -> ButtonText, link -> ButtonUrl' },
      ],
    },
    {
      slotId: 'comparison-table',
      displayName: 'Comparison table',
      why: 'The page. Unlike the takeout, this blueprint is nothing without it.',
      section: { backgroundColor: 'white', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'AbmComparisonRowElement',
          flatKey: 'comparisonTableRows',
          cardinality: 'many',
          note: 'One node per row: Category / OurValue / CompetitorValue, plus the OurDetail and CompetitorDetail qualifying lines the array shape had nowhere to put. Rows are category-level claims, never a fabricated statistic about the named product.',
        },
        { contentType: 'StackedHeadingElement', flatKey: 'comparisonHeadline', cardinality: 'one', note: 'e.g. "Optimizely vs. Sitecore".' },
        { contentType: 'TextContentElement', flatKey: 'comparisonDescription', cardinality: 'one' },
      ],
    },
    {
      slotId: 'analyst-proof',
      displayName: 'Analyst recognition',
      why: 'On a category page this is the only third-party voice, so it sits directly under the table.',
      section: { backgroundColor: 'light_teal', paddingY: 'loose' },
      column: { colSpan: 'full' },
      feeds: [
        { contentType: 'AbmAnalystCardElement', flatKey: 'analystCards', cardinality: 'many', note: 'Badge / Source / Category / Url', row: { displayMode: 'grid', gridColumns: 'cols_1', gridColumnsMd: 'cols_3', gap: 'md' }, column: { colSpan: 'auto' } },
        { contentType: 'BlockquoteBlock', flatKey: 'analystQuote', cardinality: 'one', note: 'analystSource -> the attribution.' },
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
        { contentType: 'CardCustomerQuoteBlock', flatKey: 'testimonial1', cardinality: 'one', note: 'testimonial1JobTitle / testimonial1Company -> the attribution.' },
        { contentType: 'CardCustomerQuoteBlock', flatKey: 'testimonial2', cardinality: 'one', note: 'One node per quote, so a third quote is a node rather than four more properties.' },
      ],
    },
    {
      slotId: 'offer-card',
      displayName: 'Offer card',
      why: 'The named next step. A section of its own here because it is the page\'s only conversion point.',
      section: {
        containerWidth: 'contained_bg',
        backgroundColor: 'light_green',
        paddingY: 'loose',
        marginBottom: 'm_2xl',
      },
      column: { colSpan: 'full' },
      feeds: [
        {
          contentType: 'CalloutBlock',
          flatKey: 'promoHeading',
          cardinality: 'one',
          note: 'promoEyebrow -> the kicker, promoHeading -> the heading, promoDescription -> the body. The offer copy itself is looked up by offer id (OFFER_COPY in plan-to-page.ts), so the page stores what was offered, not a re-typed version of it.',
        },
        { contentType: 'ButtonBlock', flatKey: 'promoCTA', cardinality: 'one', note: 'promoCTA -> ButtonText, promoCTALink -> ButtonUrl' },
      ],
    },
  ],
})
