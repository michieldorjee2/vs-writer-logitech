import {
  longString,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * Ports optimizely.com's `components/block/card-customer-block`. Property names match
 * `CardCustomerBlockFragment` in `lib/optimizely/queries/fragments/Block.graphql` exactly, so
 * Phase 1 can vendor upstream's renderer against them unchanged.
 *
 * One shape change, forced by the element rules and recorded in DIVERGENCE.md: upstream's
 * `ResourceUrl` is a link object and a reference is a 400 on an `elementEnabled` type, so it
 * is a flat `url` here.
 */
const contentType: ContentTypeDefinition = {
  key: 'CardCustomerBlock',
  displayName: 'Customer Card',
  description:
    'A customer-story card: image, headline, teaser, resource type and duration, with the ' +
    'customer company on the bottom bar. The whole card links to the story. Backs the proof-wall.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Headline: shortString('Headline', {
      description: 'The card title, e.g. "Build end to end campaigns across channels".',
    }),
    Body: longString('Body', {
      description:
        'One or two sentences of teaser copy. Clamped to three lines in the card, so keep it short.',
    }),
    ImageUrl: url('Image URL', {
      description: 'Absolute URL of the card image. Rendered at 395x158; omit for a text-only card.',
    }),
    ImageAlt: shortString('Image alt text', {
      description: 'Alternative text for the card image. Leave empty only when the image is decorative.',
    }),
    ResourceType: shortString('Resource type', {
      description: 'The kind of resource behind the card, e.g. "video", "article", "customer-story".',
    }),
    Duration: shortString('Duration', {
      description: 'How long the resource takes to consume, e.g. "2 minutes".',
    }),
    CompanyName: shortString('Company name', {
      description: 'The customer company shown on the card bottom bar, e.g. "Acme Corp".',
    }),
    CompanyLogoUrl: url('Company logo URL', {
      description: 'Absolute URL of the customer logo shown on the bottom bar.',
    }),
    ResourceUrl: url('Resource URL', {
      description:
        'Where the card links. Required: upstream renders nothing at all without a resolvable href.',
      required: true,
    }),
  }),
}

export default contentType
