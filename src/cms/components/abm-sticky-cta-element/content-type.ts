import { sequence, shortString, url, type ContentTypeDefinition } from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmStickyCtaElement',
  displayName: 'ABM · Sticky CTA',
  description:
    'The persistent call to action that follows the reader down an ABM account page. One ' +
    'label, one destination, nothing else — it has no upstream optimizely.com counterpart.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Text: shortString('Text', {
      description: 'The label on the sticky bar, e.g. "Talk to us about this".',
      required: true,
    }),
    Url: url('URL', {
      description: 'Where the sticky CTA points, usually the scheduling link.',
      required: true,
    }),
  }),
}

export default contentType
