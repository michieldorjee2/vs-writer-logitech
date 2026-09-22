import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Copied verbatim from the optimizely.com repo's
 * `components/block/button-block/display-settings.ts` — same keys, same option values, same
 * defaults — so the vendored upstream React reads exactly what it reads today.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'ButtonBlockDisplayTemplate',
    displayName: 'Button / Link Display Template',
    contentType: 'ButtonBlock',
    isDefault: true,
    settings: [
      {
        key: 'displayType',
        displayName: 'Display Type',
        type: 'select',
        required: false,
        options: [
          { value: 'button', displayName: 'Button' },
          { value: 'link', displayName: 'Link' },
        ],
        defaultValue: 'button',
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
      {
        key: 'iconType',
        displayName: 'Icon',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'None' },
          { value: 'icon', displayName: 'Icon (Large)' },
          { value: 'iconSmall', displayName: 'Icon (Small)' },
        ],
        defaultValue: 'none',
      },
    ],
  },
]

export default displayTemplates
