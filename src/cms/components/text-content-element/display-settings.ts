/**
 * Copied from optimizely.com `components/element/text-content-element/display-settings.ts`,
 * which declares the template with NO settings — the prose element has nothing to configure
 * and takes its width and rhythm from the column it sits in. `isDefault: true` is set so the
 * template is the one the CMS applies without an editor choosing it; upstream omits the flag
 * because it is that repo's only template for the type either way.
 */
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'TextContentElementDisplayTemplate',
    displayName: 'Text content Display Template',
    contentType: 'TextContentElement',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
