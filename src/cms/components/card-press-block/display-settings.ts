import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Copied from upstream `components/block/card-press-block/display-settings.ts`, which declares
 * the default template with no settings — the press card has a single fixed appearance.
 * Nothing invented here on purpose.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'CardPressBlockDisplayTemplate',
    displayName: 'Press Card Display Template',
    contentType: 'CardPressBlock',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
