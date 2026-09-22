import {
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * Renamed from upstream's `ImageDisplayBlock` because the shape is no longer upstream's: its
 * `ImageReference` is a content reference, which is a 400 on an `elementEnabled` type. The
 * two scalars upstream also has, `AltText` and `Caption`, keep their names. See
 * DIVERGENCE.md.
 */
const contentType: ContentTypeDefinition = {
  key: 'ImageDisplayElement',
  displayName: 'Image Display',
  description:
    'A full-width image with optional alt text and caption, addressed by URL rather than by ' +
    'a CMS or DAM reference.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    ImageUrl: url('Image URL', {
      description:
        'Absolute URL of the image. A DAM CDN URL, or any external URL such as a captured ' +
        'screenshot. Replaces upstream’s ImageReference — see DIVERGENCE.md.',
    }),
    AltText: shortString('Alt text', {
      description:
        'Alternative text for assistive technology. With no CMS asset behind the image there ' +
        'is nothing to inherit it from, so set it here.',
      maxLength: 250,
    }),
    Caption: shortString('Caption', {
      description: 'Optional line shown beneath the image.',
      maxLength: 250,
    }),
  }),
}

export default contentType
