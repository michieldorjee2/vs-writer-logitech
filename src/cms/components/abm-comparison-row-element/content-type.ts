import {
  selectOne,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * Yes / No / Limited — the same three values the live `ComparisonRow` component type already
 * carries on `OurValue`. Reused verbatim on both sides of the row so a migrated row keeps the
 * value an editor already picked.
 */
const VERDICTS = [
  { value: 'Yes', displayName: 'Yes' },
  { value: 'No', displayName: 'No' },
  { value: 'Limited', displayName: 'Limited' },
]

const contentType: ContentTypeDefinition = {
  key: 'AbmComparisonRowElement',
  displayName: 'ABM · Comparison Row',
  description:
    'One row of a comparison table: the capability, our verdict, the competitor verdict and a short detail line for each. A comparison table is N of these element nodes stacked in one column.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Category: shortString('Category', {
      description:
        'The capability being compared, e.g. "Server-side experimentation". One short phrase; it is the row label.',
      required: true,
      maxLength: 50,
    }),
    OurValue: selectOne('Our value', VERDICTS, {
      description: 'Our verdict for this row.',
    }),
    OurDetail: shortString('Our detail', {
      description: 'One line qualifying our verdict. Rendered under the value, not instead of it.',
      maxLength: 120,
    }),
    CompetitorValue: selectOne('Competitor value', VERDICTS, {
      description: "The competitor's verdict for this row.",
    }),
    CompetitorDetail: shortString('Competitor detail', {
      description: "One line qualifying the competitor's verdict.",
      maxLength: 120,
    }),
  }),
}

export default contentType
