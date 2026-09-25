/**
 * Copied from `components/block/card-customer-quote-block/display-settings.ts` in the
 * optimizely.com repo. Upstream ships this template with NO settings — the card's colour
 * scheme is hard-coded in its renderer (`colorScheme="light"` on both card sub-components) —
 * so there is nothing to copy and nothing may be invented here.
 *
 * The template itself still has to exist: it is what makes the block placeable with a default
 * presentation in Visual Builder.
 */
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'CardCustomerQuoteBlockDisplayTemplate',
    displayName: 'Customer Quote Card Display Template',
    contentType: 'CardCustomerQuoteBlock',
    isDefault: true,
    settings: [
      {
        // Showcase extension: `light` is a white card for a soft panel (the reports layout);
        // `dark` is upstream's green card and stays the default.
        key: 'cardStyle',
        displayName: 'Card style',
        type: 'select',
        required: false,
        options: [
          { value: 'dark', displayName: 'Dark' },
          { value: 'light', displayName: 'Light' },
        ],
        defaultValue: 'dark',
      },
    ],
  },
]

export default displayTemplates
