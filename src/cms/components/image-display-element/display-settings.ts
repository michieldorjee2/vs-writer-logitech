import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Settings copied from upstream `components/block/image-display-block/display-settings.ts`,
 * which declares an empty settings array; nothing is invented here. Two keys differ from
 * upstream and both follow from the rename: the template key tracks the content type key
 * (`ImageDisplayElementDisplayTemplate`), and `isDefault` is set. Upstream omits `isDefault`,
 * which reads back from the CMS as `false` and would leave the type with no default template
 * at all.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'ImageDisplayElementDisplayTemplate',
    displayName: 'Image Display Display Template',
    contentType: 'ImageDisplayElement',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
