/**
 * Copied verbatim from `components/block/blockquote-block/display-settings.ts` in the
 * optimizely.com repo — one `colorScheme` select, defaulting to `dark`. Upstream's renderer
 * keys its text colours off it (`dark` = dark text on a light background).
 *
 * The CMS cannot store `defaultValue` (see the display-template transform), so the default
 * lives here and is applied client-side at compose time.
 */
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'BlockquoteBlockDisplayTemplate',
    displayName: 'Blockquote Block Display Template',
    contentType: 'BlockquoteBlock',
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
    ],
  },
]

export default displayTemplates
