/**
 * ABM · Timeline Phase — one phase of a migration / engagement timeline.
 *
 * A timeline is NOT an array property: an `elementEnabled` type may hold only scalars and
 * arrays of scalars, so each phase is its own element node in the column and the node order
 * is the timeline order. See COMPONENT-SPEC.md hard rule 1.
 *
 * There is no optimizely.com component to port — upstream has no timeline block — so the
 * property names follow upstream's scalar naming idiom (`Title`, `Description`).
 */

import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmTimelinePhaseElement',
  displayName: 'ABM · Timeline Phase',
  description:
    'One phase of a migration or engagement timeline. One element node per phase; the order of the nodes in the column is the order of the timeline.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Title: shortString('Title', {
      description: 'The phase name, e.g. "Discovery" or "Phase 1 — Pilot".',
      required: true,
    }),
    Description: longString('Description', {
      description:
        'What happens in this phase, in plain prose. A bare long string, not richText — richText cannot be created through the CMS API, and generated copy containing a "<" would fail an HTML-validated property.',
    }),
    MarkerColor: shortString('Marker color', {
      description:
        'Colour for the phase marker — an Optimizely brand token or a hex value, e.g. "lime" or "#B3F73A". Leave empty to inherit the colour variant from the display template.',
    }),
  }),
}

export default contentType
