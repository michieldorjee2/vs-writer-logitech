/**
 * No upstream template exists for this component, so nothing could be copied wholesale. The
 * two settings below reuse optimizely.com's own vocabulary rather than inventing a new one:
 * `backgroundColor` with the `none` / `gray_800` choices and `bordersRounded` are exactly the
 * keys and values `components/block/quote-block/display-settings.ts` declares, which is the
 * nearest upstream neighbour — a quote sitting inside prose.
 *
 * `backgroundColor` defaults to `none` (an account page stacks several of these; a dark panel
 * is the exception, not the rule) and `bordersRounded` to `false`, which is the effective
 * upstream default where the setting carries no `defaultValue` at all. The CMS cannot store a
 * default, so both are applied client-side at compose time.
 */
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmThesisElementDisplayTemplate',
    displayName: 'ABM Why-now Thesis Display Template',
    contentType: 'AbmThesisElement',
    isDefault: true,
    settings: [
      {
        key: 'backgroundColor',
        displayName: 'Background Color',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'No Background' },
          { value: 'gray_800', displayName: 'Dark Gray' },
        ],
        defaultValue: 'none',
      },
      {
        key: 'bordersRounded',
        displayName: 'Rounded Borders',
        type: 'checkbox',
        required: false,
        defaultValue: false,
      },
    ],
  },
]

export default displayTemplates
