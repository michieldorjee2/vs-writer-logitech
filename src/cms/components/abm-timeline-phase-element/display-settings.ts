/**
 * There is no upstream timeline component, so these settings are authored rather than copied.
 * `colorVariant` is taken verbatim from upstream's `name-tag-element` (the closest small
 * repeated element), and `markerStyle` covers the only other rendering choice a phase node
 * has once its copy is set.
 *
 * Every setting carries a `defaultValue` because the CMS has no `defaultValue` field: the
 * repo stays the source of truth and the default is applied client-side at compose time.
 */

import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmTimelinePhaseElementDisplayTemplate',
    displayName: 'ABM Timeline Phase Display Template',
    contentType: 'AbmTimelinePhaseElement',
    isDefault: true,
    settings: [
      {
        key: 'markerStyle',
        displayName: 'Marker Style',
        type: 'select',
        required: false,
        options: [
          { value: 'dot', displayName: 'Dot' },
          { value: 'ring', displayName: 'Ring' },
          { value: 'number', displayName: 'Number' },
        ],
        defaultValue: 'dot',
      },
      {
        key: 'colorVariant',
        displayName: 'Color Variant',
        type: 'select',
        required: false,
        options: [
          { value: 'default', displayName: 'Default (Light)' },
          { value: 'muted', displayName: 'Muted' },
          { value: 'strong', displayName: 'Strong' },
        ],
        defaultValue: 'default',
      },
    ],
  },
]

export default displayTemplates
