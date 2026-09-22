import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * The lane card is new, so the settings borrow optimizely.com's existing vocabulary rather
 * than inventing one: `colorScheme` takes the five-value palette from
 * `CardResourceInlineBlock` / `CardCustomerStoryBlock`, and `layout` takes the stacked /
 * horizontal pair from `CountdownTickerBlock`.
 *
 * `stacked` and `neutral` are the defaults because they are what the current renderer's
 * `.uc-lane` card already does; the CMS stores no defaults, so this file is the only place
 * that fact can live.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmUseCaseLaneElementDisplayTemplate',
    displayName: 'ABM Use-Case Lane Display Template',
    contentType: 'AbmUseCaseLaneElement',
    isDefault: true,
    settings: [
      {
        key: 'layout',
        displayName: 'Layout',
        type: 'select',
        required: false,
        options: [
          { value: 'stacked', displayName: 'Stacked' },
          { value: 'horizontal', displayName: 'Horizontal' },
        ],
        defaultValue: 'stacked',
      },
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'neutral', displayName: 'Neutral' },
          { value: 'darkGreen', displayName: 'Dark Green' },
          { value: 'green', displayName: 'Green' },
          { value: 'blue', displayName: 'Blue' },
          { value: 'pink', displayName: 'Pink' },
        ],
        defaultValue: 'neutral',
      },
    ],
  },
]

export default displayTemplates
