import {
  longString,
  selectOne,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * `CalloutType`'s vocabulary is upstream's, not the assignment's guess of
 * [info, warning, success, promo]. Upstream `components/block/callout-block/index.tsx`
 * styles exactly four variants — error, warning, info, default — and funnels anything else
 * to `default`:
 *
 *   const variant = (['error','warning','info','default'].includes(CalloutType ?? '')
 *     ? CalloutType : 'default')
 *
 * So `success` and `promo` would be accepted by the CMS and then render as flat neutral once
 * Phase 1 vendors that component. See DIVERGENCE.md.
 */
const contentType: ContentTypeDefinition = {
  key: 'CalloutBlock',
  displayName: 'Callout',
  description:
    'A bordered callout with an icon, used to lift one short passage out of the surrounding ' +
    'copy.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    CalloutType: selectOne(
      'Callout type',
      [
        { value: 'info', displayName: 'Info' },
        { value: 'warning', displayName: 'Warning' },
        { value: 'error', displayName: 'Error' },
        { value: 'default', displayName: 'Default' },
      ],
      {
        description:
          'Chooses the border, text colour and icon. "Default" is the neutral treatment and ' +
          'shows no icon.',
      }
    ),
    CalloutHeading: shortString('Callout heading', {
      description:
        'Optional single line above the body copy. Not an upstream property — see ' +
        'DIVERGENCE.md.',
      maxLength: 120,
    }),
    CalloutText: longString('Callout text', {
      description:
        'The body copy. Plain long text, not rich text: the CMS API cannot create a richText ' +
        'property.',
    }),
  }),
}

export default contentType
