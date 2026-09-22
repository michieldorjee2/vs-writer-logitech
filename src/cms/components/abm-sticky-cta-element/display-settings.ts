import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * No upstream component to port, so the settings are kept to upstream's own button vocabulary:
 * `buttonVariant` and `buttonSize` are lifted key-for-key and value-for-value out of
 * `components/block/button-block/display-settings.ts`, which is what the vendored upstream
 * Button reads. Nothing new was invented.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmStickyCtaElementDisplayTemplate',
    displayName: 'ABM Sticky CTA Display Template',
    contentType: 'AbmStickyCtaElement',
    isDefault: true,
    settings: [
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
