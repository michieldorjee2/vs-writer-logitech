import { sequence, shortString, url, type ContentTypeDefinition } from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'LinkItemElement',
  displayName: 'Link Item',
  description:
    'One link in a list of links. Replaces the optimizely.com LinkListBlock, whose Links ' +
    'property is an array of content references and therefore illegal on an element: a list of ' +
    'N links is N of these nodes in a column — see DIVERGENCE.md.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Label: shortString('Label', {
      description:
        'The visible link text. Upstream reads link.text and substitutes a placeholder when it ' +
        'is empty, so this is not required.',
    }),
    Url: url('URL', {
      description:
        'Where the link points. Without a destination there is no link to render, so this is ' +
        'required.',
      required: true,
    }),
  }),
}

export default contentType
