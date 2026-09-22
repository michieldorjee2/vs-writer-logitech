import {
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * No upstream port. This is an ABM-specific element: a screenshot of the prospect's own page
 * presented inside fake browser chrome, captioned by a headline that names the problem the
 * screenshot shows.
 *
 * `BrowserUrl` is deliberately a `shortString`, not a `url`. It is the address label drawn in
 * the fake chrome, a display string that should read exactly as authored
 * ("logitech.com/en-eu/products" with no scheme, say), and a `url` property would both
 * validate it and invite a renderer to make it navigable.
 */
const contentType: ContentTypeDefinition = {
  key: 'AbmChallengeShotElement',
  displayName: 'ABM · Challenge Screenshot',
  description:
    'A screenshot of the prospect’s own site shown in fake browser chrome, with a ' +
    'headline naming the challenge it illustrates.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Headline: shortString('Headline', {
      description: 'One line naming the challenge the screenshot shows.',
      maxLength: 160,
    }),
    ScreenshotUrl: url('Screenshot URL', {
      description: 'Absolute URL of the captured screenshot image.',
    }),
    ScreenshotAlt: shortString('Screenshot alt text', {
      description: 'Alternative text describing what the screenshot shows.',
      maxLength: 250,
    }),
    BrowserUrl: shortString('Browser address label', {
      description:
        'The address drawn in the fake browser chrome. A display string, not a link — ' +
        'it renders exactly as authored.',
      maxLength: 200,
    }),
  }),
}

export default contentType
