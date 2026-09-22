/**
 * Ports optimizely.com `components/element/text-content-element` — the prose element.
 *
 * The property is called `MainBody`, exactly as upstream, so the vendored upstream renderer
 * (Phase 1) destructures the same name. Upstream declares it `richText`; that format cannot be
 * created through the CMS API, so it is a bare long `string` here. See DIVERGENCE.md.
 */
import { longString, sequence, type ContentTypeDefinition } from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'TextContentElement',
  displayName: 'Text Content',
  description:
    'A block of body copy. Paragraphs are separated by a blank line. The whole reason this ' +
    'element exists is prose, so it carries no other fields.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    MainBody: longString('Main body', {
      description:
        'Body copy as plain text. Separate paragraphs with a blank line. No HTML — this is a ' +
        'bare string property, not rich text, and markup is rendered as characters.',
      required: true,
    }),
  }),
}

export default contentType
