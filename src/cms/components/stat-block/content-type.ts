import {
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * A direct port of optimizely.com's `StatBlock`.
 *
 * The upstream property names are `StatValue` and `Description` — the GraphQL fragment
 * aliases the second one (`components/block/stat-block` reads `StatDescription`, and
 * `lib/optimizely/queries/fragments/Block.graphql` does `StatDescription: Description`).
 * The CMS side of that pair is `Description`, so that is what this type declares. Phase 1
 * vendors upstream's renderer against the aliased fragment, not against the raw field name.
 *
 * This is the workhorse of the stats group: it backs the hero signal pills (today's
 * `intelStats`, one node per pill) and the caption-bearing numbers inside the ROI section.
 */
const contentType: ContentTypeDefinition = {
  key: 'StatBlock',
  displayName: 'Stat',
  description:
    'A single headline number with one line of supporting copy. Rendered with the stacked ' +
    'extrusion treatment, so the value carries the emphasis and the description stays quiet.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    StatValue: shortString('Stat value', {
      description:
        'The number itself, with its own unit and punctuation — "38%", "4.8M", "3x". ' +
        'Kept short because the extrusion treatment sets it very large.',
      required: true,
      maxLength: 24,
    }),
    Description: shortString('Description', {
      description:
        'One line of supporting copy under the value, e.g. "monthly digital visitors". ' +
        'Read by the renderer as StatDescription via the GraphQL alias.',
      maxLength: 160,
    }),
  }),
}

export default contentType
