/**
 * CardCustomerQuoteBlock — a customer testimonial card that links to the underlying resource.
 *
 * Ports `components/block/card-customer-quote-block` from the optimizely.com repo. Upstream's
 * Graph fragment selects `QuoteText`, `Attribution`, `ResourceType`, `Duration`,
 * `CompanyName`, `CompanyLogoUrl` and `ResourceUrl`
 * (`lib/optimizely/queries/fragments/Block.graphql`). Every one of those is authored inline on
 * the block — there is no content reference anywhere in it — which is why it ports onto an
 * `elementEnabled` element and why it maps cleanly onto the account page's
 * `testimonial1` / `testimonial2` slots plus `JobTitle` and `Company`.
 *
 * One property shape differs from upstream: see DIVERGENCE.md.
 */
import {
  longString,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'CardCustomerQuoteBlock',
  displayName: 'Customer Quote Card',
  description:
    'A customer testimonial card: the quote, who said it, and a link to the story behind it.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    QuoteText: longString('Quote text', {
      description:
        'The testimonial itself, without quotation marks — the renderer adds the curly quotes.',
      required: true,
    }),
    Attribution: shortString('Attribution', {
      description: 'Name, job title and company on one line, e.g. "Jane Doe, VP Marketing, Acme".',
    }),
    ResourceType: shortString('Resource type', {
      description: 'The kind of resource the card links to, e.g. "Case study" or "Video".',
    }),
    Duration: shortString('Duration', {
      description: 'How long the resource takes to consume, e.g. "4 min read".',
    }),
    CompanyName: shortString('Company name', {
      description: 'The customer company, shown in the card bottom bar.',
    }),
    CompanyLogoUrl: url('Company logo URL', {
      description: 'Absolute URL of the company logo shown in the card bottom bar.',
    }),
    ResourceUrl: url('Resource URL', {
      description:
        'Where the card links. Upstream renders nothing at all when this is empty, so treat it as required in practice.',
    }),
  }),
}

export default contentType
