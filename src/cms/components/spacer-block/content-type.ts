import { integer, sequence, type ContentTypeDefinition } from '../../property-builders'

/**
 * Value vocabulary, and why it is numeric rather than a t-shirt-size enum.
 *
 * The assignment guessed `selectOne` over `[none, sm, md, lg, xl]` for all four props, but
 * instructed us to read upstream and prefer it where the vocabulary differs. It differs.
 * Upstream `components/block/spacer-block/index.tsx` interpolates each value straight into a
 * CSS custom property:
 *
 *   '--space-default': `${SpaceDefault ?? 0}px`
 *   '--space-md':      `${SpaceMd ?? SpaceDefault ?? 0}px`
 *
 * so the value is a NUMBER OF PIXELS. A token would render as `smpx`, an invalid length, and
 * the spacer would silently collapse to zero height. `?? 0` defaulting to the number zero
 * says the same thing. Phase 1 vendors that exact component against these exact names, so the
 * props are `integer`, which is element-legal.
 *
 * The cascade is upstream's, not the CMS's: an omitted breakpoint inherits the next smaller
 * one at render time, which is why none of the four is required.
 */
const contentType: ContentTypeDefinition = {
  key: 'SpacerBlock',
  displayName: 'Spacer',
  description:
    'Vertical whitespace with a responsive height in pixels. Leave a breakpoint empty to ' +
    'inherit the next smaller one.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    SpaceDefault: integer('Space (default)', {
      description: 'Height in pixels at the smallest breakpoint. The base for the cascade.',
    }),
    SpaceMd: integer('Space (md)', {
      description: 'Height in pixels from the md breakpoint up. Falls back to Space (default).',
    }),
    SpaceLg: integer('Space (lg)', {
      description: 'Height in pixels from the lg breakpoint up. Falls back to Space (md).',
    }),
    SpaceXl: integer('Space (xl)', {
      description: 'Height in pixels from the xl breakpoint up. Falls back to Space (lg).',
    }),
  }),
}

export default contentType
