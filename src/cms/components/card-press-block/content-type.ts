import {
  dateTime,
  longString,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * Ports optimizely.com's `components/block/card-press-block`. Property names match
 * `CardPressBlockFragment` in `lib/optimizely/queries/fragments/Block.graphql` exactly.
 *
 * Two shape changes, both recorded in DIVERGENCE.md: `ResourceUrl` is flattened from
 * upstream's link object to a `url` (a reference is a 400 on an element), and `PublishDate`
 * is a real `dateTime` rather than the pre-formatted display string upstream stores.
 */
const contentType: ContentTypeDefinition = {
  key: 'CardPressBlock',
  displayName: 'Press Card',
  description:
    'A press-mention card: headline, teaser, publish date, and the publication on the bottom ' +
    'bar with a forward arrow. Links out to the coverage in a new tab.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Headline: shortString('Headline', {
      description: 'The press headline, as the publication ran it.',
    }),
    Body: longString('Body', {
      description: 'A sentence or two from the article. Optional — the card renders without it.',
    }),
    PublishDate: dateTime('Publish date', {
      description:
        'When the coverage ran. Stored as an instant and formatted for display at render time.',
    }),
    CompanyName: shortString('Publication name', {
      description: 'The outlet that published it, shown on the bottom bar, e.g. "Calendly".',
    }),
    CompanyLogoUrl: url('Publication logo URL', {
      description: 'Absolute URL of the publication logo shown on the bottom bar.',
    }),
    ResourceUrl: url('Resource URL', {
      description:
        'Where the card links, opened in a new tab. Without it the card still renders, unlinked.',
    }),
  }),
}

export default contentType
