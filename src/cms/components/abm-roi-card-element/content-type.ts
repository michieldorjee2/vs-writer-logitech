import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * One card in the ROI grid. Net-new — optimizely.com has no equivalent block, so the property
 * names come from the existing `ABMROICard` list-item component on `CompetitorComparisonPage`
 * (`Metric`, `Unit`, `Label`, `CitationText`), which keeps the migration of live content a
 * rename-free copy.
 *
 * Today `roiCards` is an array property on the page; as an element it becomes one node per
 * card in the ROI column, which is what makes a pruned card visible in the composition tree.
 */
const contentType: ContentTypeDefinition = {
  key: 'AbmRoiCardElement',
  displayName: 'ABM · ROI Card',
  description:
    'One number in the ROI grid: the metric, its unit, what it measures, and the source it ' +
    'came from. Place one per card — the grid is a column of these elements, not a list ' +
    'property.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Metric: shortString('Metric', {
      description:
        'The bare number, e.g. "38" or "2.4". The renderer strips everything but digits and ' +
        'the decimal point to drive the count-up animation, so keep the unit out of this field.',
      required: true,
      maxLength: 16,
    }),
    Unit: shortString('Unit', {
      description: 'The unit shown under the metric — "%", "x", "hrs/week", "$M".',
      maxLength: 24,
    }),
    Label: shortString('Label', {
      description:
        'What the number measures, e.g. "faster time to first experiment". One short line.',
      maxLength: 120,
    }),
    CitationText: longString('Citation', {
      description:
        'Where the number came from, shown in small type under the label. A bare long string, ' +
        'so a citation containing "<" or a stray angle bracket still writes cleanly.',
    }),
  }),
}

export default contentType
