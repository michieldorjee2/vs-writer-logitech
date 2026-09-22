/**
 * There is no upstream display-settings.ts to copy: optimizely.com has no analyst card.
 *
 * The one setting here is deliberately not invented from scratch — it is the same
 * `colorScheme` select, with the same two values and the same `dark` default, that
 * `blockquote-block` carries upstream. Analyst proof renders directly beside a blockquote in
 * the same column, and both need to flip together when the band behind them is dark.
 *
 * The CMS stores no `defaultValue`, so the default lives here and is applied client-side at
 * compose time.
 */
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmAnalystCardElementDisplayTemplate',
    displayName: 'ABM Analyst Card Display Template',
    contentType: 'AbmAnalystCardElement',
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
