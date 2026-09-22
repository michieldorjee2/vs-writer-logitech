import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmUseCaseLaneElement',
  displayName: 'ABM · Use-Case Lane',
  description:
    'One need-to-solution lane card: the buyer\'s goal, the need in their language, what we would use, and why it applies here. A use-case matrix is one of these element nodes per lane.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Lane: shortString('Lane', {
      description:
        'The goal in the buyer\'s own framing, e.g. "Drive revenue". Rendered as the eyebrow above the need.',
    }),
    Need: longString('Need', {
      description:
        'The need in the account\'s language, not ours. One sentence; it is the card heading.',
    }),
    Solution: longString('Solution', {
      description:
        'What we would put to work, e.g. "Agentic Experimentation". Rendered as a pill under the "We\'d use" label.',
    }),
    Outcome: longString('Outcome', {
      description: 'Why it applies to this account. Two to three sentences.',
    }),
  }),
}

export default contentType
