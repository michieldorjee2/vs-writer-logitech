import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmFrictionPointElement',
  displayName: 'ABM · Friction Point',
  description:
    'One "where it breaks" card: a named friction point and the paragraph that explains it. The section is one of these element nodes per point.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Title: shortString('Title', {
      description: 'The friction point, named in one phrase, e.g. "Partner portals remain disconnected silos".',
    }),
    Description: longString('Description', {
      description:
        'Why it costs this account something. Two to three sentences of body copy.',
    }),
  }),
}

export default contentType
