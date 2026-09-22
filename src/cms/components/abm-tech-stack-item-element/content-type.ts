/**
 * ABM · Tech Stack Item — one detected technology in an account's stack.
 *
 * The stack is NOT an array property: an `elementEnabled` type may hold only scalars and
 * arrays of scalars, so each technology is its own element node in the column. That is also
 * what Phase 2 wants — a pruned technology is visible in the composition tree, where a
 * suppressed array entry inside a property would be invisible. See COMPONENT-SPEC.md rule 1.
 *
 * Phase 1 renders this on upstream's `components/_ui/taxonomy-tag` primitive, whose only
 * inputs are `label` and `className`: `Name` feeds `label`, and `ColorTag` plus the display
 * template decide the className.
 */

import { sequence, shortString, type ContentTypeDefinition } from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'AbmTechStackItemElement',
  displayName: 'ABM · Tech Stack Item',
  description:
    'One detected technology in the account tech stack, rendered as a taxonomy tag. One element node per technology.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Name: shortString('Name', {
      description:
        'The technology name exactly as it should read on the tag, e.g. "Adobe Experience Manager".',
      required: true,
    }),
    ColorTag: shortString('Color tag', {
      description:
        'Optional grouping or colour token for the tag — a category such as "cms" or "analytics", or a brand token / hex such as "#B3F73A". Leave empty to use the display template style unchanged.',
    }),
  }),
}

export default contentType
