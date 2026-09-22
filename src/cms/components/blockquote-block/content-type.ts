/**
 * BlockquoteBlock — a pull quote with an attribution line.
 *
 * Ports `components/block/blockquote-block` from the optimizely.com repo unchanged: the
 * upstream Graph fragment selects exactly `Quote`, `AuthorName`, `AuthorTitle`
 * (`lib/optimizely/queries/fragments/Block.graphql`), and all three are scalars, so nothing
 * had to be flattened for `elementEnabled`.
 *
 * It backs two slots in the account page: the analyst-proof pair
 * (`analystQuote` / `analystSource`) and the thesis pull quote.
 */
import { longString, shortString, sequence, type ContentTypeDefinition } from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'BlockquoteBlock',
  displayName: 'Blockquote',
  description:
    'A pull quote with an attribution line. Used for the thesis quote and for analyst proof.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Quote: longString('Quote', {
      description: 'The quote itself, without surrounding quotation marks — the renderer adds them.',
      required: true,
    }),
    AuthorName: shortString('Author name', {
      description: 'Who said it, e.g. "Gartner" or "Jane Doe". Rendered before the divider.',
    }),
    AuthorTitle: shortString('Author title', {
      description: 'Their role or the source, e.g. "Magic Quadrant, 2026". Rendered after the divider.',
    }),
  }),
}

export default contentType
