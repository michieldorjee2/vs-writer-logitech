import {
  selectOne,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'ButtonBlock',
  displayName: 'Button',
  description:
    'A single call-to-action button or text link. Diverges from the optimizely.com ButtonBlock, ' +
    'whose Link property is a content reference and therefore rejected on an elementEnabled ' +
    'type — see DIVERGENCE.md.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    ButtonText: shortString('Button text', {
      description:
        'The visible label, e.g. "Book a walkthrough". Upstream substitutes "Update Link Text" ' +
        'when this is empty, so it is not required.',
      maxLength: 40,
    }),
    ButtonUrl: url('Button URL', {
      description:
        'Where the button points. Upstream renders nothing at all without a destination, so ' +
        'this is the one required field.',
      required: true,
    }),
    Variant: selectOne(
      'Variant',
      [
        { value: 'primary', displayName: 'Primary' },
        { value: 'secondary', displayName: 'Secondary' },
        { value: 'ghost', displayName: 'Ghost' },
      ],
      {
        description:
          'Content-level visual weight, set by the generating agent. The vendored upstream ' +
          'React reads its variant from the buttonVariant display setting; this property is ' +
          'what an agent writes when it has no display settings to write into.',
      }
    ),
  }),
}

export default contentType
