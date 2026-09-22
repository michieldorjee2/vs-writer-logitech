import {
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * One item from an account page's news rail. No upstream optimizely.com component ports here —
 * this is the element form of the existing `ABMNewsItem` list-item component, which cannot be
 * placed in a composition as-is.
 *
 * `newsItems` is a list-shaped field, and an array of components is a 400 on an
 * `elementEnabled` type, so a rail of N headlines is N of these nodes in one column rather
 * than one element holding an array.
 *
 * `NewsDate` is deliberately a `shortString`, not a `dateTime` — see DIVERGENCE.md.
 */
const contentType: ContentTypeDefinition = {
  key: 'AbmNewsItemElement',
  displayName: 'ABM · News Item',
  description:
    'A single dated headline in an account news rail: the date as it should read, the headline, ' +
    'and a link to the source.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    NewsDate: shortString('Date', {
      description:
        'The date exactly as it should read, e.g. "Mar 2026". A display string, not an instant — ' +
        'source values are often month-precision.',
    }),
    Headline: shortString('Headline', {
      description: 'The news headline, in the source’s own words.',
      required: true,
    }),
    Url: url('Source URL', {
      description: 'Absolute URL of the article or announcement this item summarizes.',
    }),
  }),
}

export default contentType
