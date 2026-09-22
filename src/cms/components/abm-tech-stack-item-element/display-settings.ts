/**
 * Upstream has no tech-stack component, so there is nothing to copy. These two settings are
 * the rendering choices the `_ui/taxonomy-tag` primitive actually exposes, and each default
 * reproduces that primitive's current hard-coded look: a bordered (outline) tag with
 * uppercase label text.
 *
 * Every setting carries a `defaultValue` because the CMS cannot store one — the repo is the
 * source of truth and the default is applied client-side at compose time.
 */

import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmTechStackItemElementDisplayTemplate',
    displayName: 'ABM Tech Stack Item Display Template',
    contentType: 'AbmTechStackItemElement',
    isDefault: true,
    settings: [
      {
        key: 'tagStyle',
        displayName: 'Tag Style',
        type: 'select',
        required: false,
        options: [
          { value: 'outline', displayName: 'Outline' },
          { value: 'solid', displayName: 'Solid' },
          { value: 'subtle', displayName: 'Subtle' },
        ],
        defaultValue: 'outline',
      },
      {
        key: 'textCase',
        displayName: 'Text Case',
        type: 'select',
        required: false,
        options: [
          { value: 'uppercase', displayName: 'Uppercase' },
          { value: 'normal', displayName: 'As Typed' },
        ],
        defaultValue: 'uppercase',
      },
    ],
  },
]

export default displayTemplates
