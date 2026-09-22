import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Net-new component, so there is no upstream `display-settings.ts` to copy. Both settings
 * reuse upstream's own key vocabulary rather than inventing a private one: `colorScheme`
 * follows the `card-*` blocks' naming, and `dividers` is upstream's key for rules between
 * repeated lines.
 *
 * The CMS cannot store a `defaultValue`, so these defaults are applied client-side at
 * compose time and this file is the source of truth for them.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmNavRailElementDisplayTemplate',
    displayName: 'ABM Nav Rail Display Template',
    contentType: 'AbmNavRailElement',
    isDefault: true,
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'neutral', displayName: 'Neutral (light text on dark bg)' },
          { value: 'light', displayName: 'Light (dark text on light bg)' },
        ],
        defaultValue: 'neutral',
      },
      {
        key: 'dividers',
        displayName: 'Dividers',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'None' },
          { value: 'between', displayName: 'Between lines' },
        ],
        defaultValue: 'none',
      },
    ],
  },
]

export default displayTemplates
