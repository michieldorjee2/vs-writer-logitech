import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Net-new component, so there is no upstream `display-settings.ts` to copy. The three
 * settings below reuse upstream's own vocabulary rather than inventing a private one:
 * `animationMode` takes the same `none | scroll | mouse` values as `stat-block`, and
 * `colorScheme` follows the `card-*` blocks' palette naming. `countUp` is the only key
 * specific to this card, and it toggles the existing `data-count` metric animation.
 *
 * The CMS cannot store a `defaultValue`, so these defaults are applied client-side at
 * compose time and this file is the source of truth for them.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmRoiCardElementDisplayTemplate',
    displayName: 'ABM ROI Card Display Template',
    contentType: 'AbmRoiCardElement',
    isDefault: true,
    settings: [
      {
        key: 'animationMode',
        displayName: 'Animation Mode',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'None' },
          { value: 'scroll', displayName: 'Scroll' },
          { value: 'mouse', displayName: 'Mouse' },
        ],
        defaultValue: 'scroll',
      },
      {
        key: 'countUp',
        displayName: 'Count Up Metric',
        type: 'select',
        required: false,
        options: [
          { value: 'true', displayName: 'Count up from zero' },
          { value: 'false', displayName: 'Show the final value' },
        ],
        defaultValue: 'true',
      },
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'neutral', displayName: 'Neutral' },
          { value: 'green', displayName: 'Green' },
          { value: 'darkGreen', displayName: 'Dark Green' },
        ],
        defaultValue: 'neutral',
      },
    ],
  },
]

export default displayTemplates
