import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Upstream's nearest component, `CalloutBlock`, ships `settings: []` — it has no presentation
 * choices at all because its variant is a content property (`CalloutType`). This card does
 * have two, and both use vocabulary already on the site: `numbering` takes the
 * `large_numbers` / `none` pair from `HtmlListBlock.listStyle`, and `colorScheme` the
 * neutral / white pair from `AccordionBlock`.
 *
 * `large_numbers` is the default because the current renderer already prints an ordinal
 * ("01", "02") above each title, and the CMS cannot store a default — this file is where that
 * fact lives.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmFrictionPointElementDisplayTemplate',
    displayName: 'ABM Friction Point Display Template',
    contentType: 'AbmFrictionPointElement',
    isDefault: true,
    settings: [
      {
        key: 'numbering',
        displayName: 'Numbering',
        type: 'select',
        required: false,
        options: [
          { value: 'large_numbers', displayName: 'Large numbers' },
          { value: 'none', displayName: 'None' },
        ],
        defaultValue: 'large_numbers',
      },
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'neutral', displayName: 'Neutral' },
          { value: 'white', displayName: 'White' },
        ],
        defaultValue: 'neutral',
      },
    ],
  },
]

export default displayTemplates
