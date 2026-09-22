/**
 * Copied verbatim from optimizely.com
 * `components/element/stacked-heading-element/display-settings.ts` — keys, options, order and
 * `defaultValue`s unchanged, so the vendored upstream renderer (Phase 1) reads exactly the
 * settings it already expects.
 *
 * It is a superset of the three settings `stat-block/display-settings.ts` declares:
 * `animationMode`, `extrusionCount` and `invertExtrusion` are identical in both files;
 * `curvedText` and `arcAmount` are the stacked-heading extras that upstream's index.tsx reads
 * (`curvedText === 'true'`, `parseInt(arcAmount.replace('arc_', ''), 10) / 100`). Dropping them
 * would silently disable the curved variant, so they are kept.
 *
 * `animationMode` defaults to 'mouse' here (upstream stacked-heading), not 'none'
 * (upstream stat-block) — it matches the React default `animationMode = 'mouse'`.
 *
 * The CMS has nowhere to store `defaultValue`; it is applied client-side at compose time.
 */
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'StackedHeadingElementDisplayTemplate',
    displayName: 'Stacked Heading Display Template',
    contentType: 'StackedHeadingElement',
    isDefault: true,
    settings: [
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
        defaultValue: 'mouse',
      },
      {
        key: 'curvedText',
        displayName: 'Curved Text',
        type: 'select',
        required: false,
        options: [
          { value: 'false', displayName: 'Off' },
          { value: 'true', displayName: 'On' },
        ],
        defaultValue: 'false',
      },
      {
        key: 'arcAmount',
        displayName: 'Arc Amount',
        type: 'select',
        required: false,
        options: [
          { value: 'arc_10', displayName: '10% (Subtle)' },
          { value: 'arc_20', displayName: '20%' },
          { value: 'arc_30', displayName: '30%' },
          { value: 'arc_40', displayName: '40%' },
          { value: 'arc_50', displayName: '50% (Half Circle)' },
          { value: 'arc_60', displayName: '60%' },
          { value: 'arc_70', displayName: '70%' },
          { value: 'arc_80', displayName: '80%' },
        ],
        defaultValue: 'arc_30',
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
