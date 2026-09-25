import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Copied verbatim from optimizely.com `components/block/stat-block/display-settings.ts`.
 * Do not edit these three settings or their defaults here — upstream's renderer reads
 * `animationMode`, `extrusionCount` and `invertExtrusion` by exactly these keys and value
 * vocabularies (`extrusionCount` is parsed with `parseInt(value.replace('layers_', ''))`,
 * and `invertExtrusion` is compared against the string `'true'`).
 *
 * The CMS cannot store a `defaultValue`, so the defaults below are applied client-side at
 * compose time. This file is the source of truth for them.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'StatBlockDisplayTemplate',
    displayName: 'Stat Block Display Template',
    contentType: 'StatBlock',
    isDefault: true,
    settings: [
      {
        // Showcase extension. Upstream ALWAYS extrudes the value; the brand says to extrude one
        // heroic moment per page, so here it is opt-in and `plain` is the default.
        key: 'presentation',
        displayName: 'Presentation',
        type: 'select',
        required: false,
        options: [
          { value: 'plain', displayName: 'Plain' },
          { value: 'extruded', displayName: 'Extruded' },
        ],
        defaultValue: 'plain',
      },
      {
        key: 'animationMode',
        displayName: 'Animation Mode',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'None' },
          { value: 'scroll', displayName: 'Scroll' },
          { value: 'mouse', displayName: 'Mouse' },
        ],
        defaultValue: 'none',
      },
      {
        key: 'extrusionCount',
        displayName: 'Extrusion Layers',
        type: 'select',
        required: false,
        options: [
          { value: 'layers_5', displayName: '5 Layers' },
          { value: 'layers_6', displayName: '6 Layers' },
          { value: 'layers_7', displayName: '7 Layers' },
          { value: 'layers_8', displayName: '8 Layers' },
          { value: 'layers_9', displayName: '9 Layers' },
        ],
        defaultValue: 'layers_5',
      },
      {
        key: 'invertExtrusion',
        displayName: 'Invert Extrusion',
        type: 'select',
        required: false,
        options: [
          { value: 'false', displayName: 'Normal' },
          { value: 'true', displayName: 'Inverted' },
        ],
        defaultValue: 'false',
      },
    ],
  },
]

export default displayTemplates
