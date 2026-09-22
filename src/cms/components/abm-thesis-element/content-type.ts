/**
 * New — no optimizely.com upstream. Backs the why-now-thesis component on an ABM account page:
 * the short argument for why this account should act now, optionally anchored by a quote.
 *
 * `Body` and `Quote` are bare long `string`s (the only body-copy shape the API can create);
 * `Quote` and `Attribution` sit in their own editor group because the quote is a distinct,
 * optional cluster an editor fills — or leaves empty — as a unit.
 */
import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

const QUOTE_GROUP = 'Quote'

const contentType: ContentTypeDefinition = {
  key: 'AbmThesisElement',
  displayName: 'ABM · Why-now thesis',
  description:
    'The why-now argument for one account: a headline claim, a few paragraphs of reasoning, ' +
    'and an optional supporting quote with its attribution.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Headline: shortString('Headline', {
      description: 'The claim, in one line. Written for this account, not for the segment.',
      required: true,
    }),
    Body: longString('Body', {
      description:
        'The reasoning, as plain text. Separate paragraphs with a blank line — no HTML.',
      required: true,
    }),
    Quote: longString('Quote', {
      description:
        'Optional supporting quote, as plain text and without surrounding quotation marks; ' +
        'the renderer adds them. Leave empty to render the thesis without a quote.',
      group: QUOTE_GROUP,
    }),
    Attribution: shortString('Attribution', {
      description:
        'Who said it — name, then role and company, e.g. "Jane Roe, CFO, Acme". Ignored ' +
        'when Quote is empty.',
      group: QUOTE_GROUP,
    }),
  }),
}

export default contentType
