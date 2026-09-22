import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Settings vocabulary is taken from optimizely.com's own display templates so the migrated
 * table looks like the site: the icon/text choice mirrors `HtmlListBlock.listStyle`
 * (checkmarks / xmarks) and `colorScheme` mirrors the neutral / white pair used by
 * `AccordionBlock` and `CardResourceInlineBlock`.
 *
 * Every setting carries a `defaultValue` because the CMS stores none — the repo is the source
 * of truth and the default is applied client-side at compose time.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmComparisonRowElementDisplayTemplate',
    displayName: 'ABM Comparison Row Display Template',
    contentType: 'AbmComparisonRowElement',
    isDefault: true,
    settings: [
      {
        key: 'valueDisplay',
        displayName: 'Value Display',
        type: 'select',
        required: false,
        options: [
          { value: 'icon', displayName: 'Icon and detail' },
          { value: 'iconOnly', displayName: 'Icon only' },
          { value: 'text', displayName: 'Text and detail' },
        ],
        defaultValue: 'icon',
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
      {
        key: 'emphasis',
        displayName: 'Emphasis',
        type: 'select',
        required: false,
        options: [
          { value: 'default', displayName: 'Default' },
          { value: 'highlighted', displayName: 'Highlighted' },
        ],
        defaultValue: 'default',
      },
    ],
  },
]

export default displayTemplates
