import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Upstream ships no `display-settings.ts` for spacer-block — the block takes its whole
 * appearance from its four space props. This template therefore registers the key and the
 * default flag and invents no settings, matching upstream's settings-free templates
 * (`image-display-block`, `text-content-element`).
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'SpacerBlockDisplayTemplate',
    displayName: 'Spacer Block Display Template',
    contentType: 'SpacerBlock',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
