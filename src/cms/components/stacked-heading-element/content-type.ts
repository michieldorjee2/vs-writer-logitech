/**
 * Ports optimizely.com `components/element/stacked-heading-element`.
 *
 * Upstream's `Text` is a `richText` property (the GraphQL fragment selects `Text { html }`).
 * `format: 'richText'` cannot be created through the CMS API, so `Text` here is a bare long
 * `string`. See DIVERGENCE.md in this folder.
 *
 * The extruded / stacked treatment is NOT a property: it is a display setting
 * (`animationMode`, `extrusionCount`, `invertExtrusion`, plus upstream's `curvedText` and
 * `arcAmount`) — see display-settings.ts.
 */
import {
  longString,
  selectOne,
  sequence,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'StackedHeadingElement',
  displayName: 'Stacked Heading',
  description:
    'A display heading rendered with the brand extrusion treatment. Wrap a phrase in ' +
    '##double hashes## to extrude just that phrase; a new line starts a new heading line.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Text: longString('Text', {
      description:
        'The heading copy. One heading line per newline. Wrap a phrase in ##like this## to ' +
        'give that phrase the stacked/extruded treatment; text outside the hashes renders flat.',
      required: true,
    }),
    HeadingLevel: selectOne(
      'Heading level',
      [
        { value: 'h1', displayName: 'Heading 1' },
        { value: 'h2', displayName: 'Heading 2' },
        { value: 'h3', displayName: 'Heading 3' },
        { value: 'h4', displayName: 'Heading 4' },
      ],
      {
        description:
          'Which HTML heading tag wraps the text. Visual size comes from the display ' +
          'template, not from this — pick the level the page outline needs. Defaults to h1.',
      }
    ),
  }),
}

export default contentType
