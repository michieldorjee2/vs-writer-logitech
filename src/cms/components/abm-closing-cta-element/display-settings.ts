import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * No upstream component to port, so every setting is lifted out of upstream rather than
 * invented: `colorScheme` key-for-key from `components/block/blockquote-block`, and
 * `buttonVariant` / `buttonSize` key-for-key from `components/block/button-block`, which is
 * what the vendored upstream Button reads.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmClosingCtaElementDisplayTemplate',
    displayName: 'ABM Closing CTA Display Template',
    contentType: 'AbmClosingCtaElement',
    isDefault: true,
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'dark', displayName: 'Dark (dark text on light bg)' },
          { value: 'neutral', displayName: 'Neutral (light text on dark bg)' },
        ],
        defaultValue: 'dark',
      },
      {
        key: 'buttonVariant',
        displayName: 'Button Variant',
        type: 'select',
        required: false,
        options: [
          { value: 'primary', displayName: 'Primary (Green)' },
          { value: 'dark', displayName: 'Dark (Fir)' },
          { value: 'white', displayName: 'White' },
          { value: 'neutral', displayName: 'Neutral' },
          { value: 'whiteStroke', displayName: 'White Stroke' },
          { value: 'opalStroke', displayName: 'Opal Stroke' },
          { value: 'darkStroke', displayName: 'Dark Fir Stroke' },
        ],
        defaultValue: 'primary',
      },
      {
        key: 'buttonSize',
        displayName: 'Button Size',
        type: 'select',
        required: false,
        options: [
          { value: 'sm', displayName: 'Small' },
          { value: 'default', displayName: 'Default' },
        ],
        defaultValue: 'default',
      },
    ],
  },
]

export default displayTemplates
