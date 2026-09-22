import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Copied from upstream `components/block/callout-block/display-settings.ts`, which declares
 * this template with an empty settings array — the block varies by its `CalloutType`
 * property, not by a display setting. Nothing invented here.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'CalloutBlockDisplayTemplate',
    displayName: 'Callout Display Template',
    contentType: 'CalloutBlock',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
