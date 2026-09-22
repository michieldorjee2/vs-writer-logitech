import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * Copied from upstream `components/block/card-customer-block/display-settings.ts`, which
 * declares the default template with no settings — the card has exactly one appearance and
 * takes its colour scheme from the section around it. Nothing invented here on purpose.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'CardCustomerBlockDisplayTemplate',
    displayName: 'Customer Card Display Template',
    contentType: 'CardCustomerBlock',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
