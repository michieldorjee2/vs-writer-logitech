import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * There is no upstream component to copy settings from, and the instruction is to copy rather
 * than invent, so this template registers the key and the default flag with no settings of
 * its own. Upstream does exactly this for `image-display-block` and `text-content-element`.
 * Phase 1 can add settings once the renderer exists and the real variation points are known.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmChallengeShotElementDisplayTemplate',
    displayName: 'ABM Challenge Screenshot Display Template',
    contentType: 'AbmChallengeShotElement',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
