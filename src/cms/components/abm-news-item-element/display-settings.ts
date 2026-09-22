import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * No upstream template to copy — this element has no optimizely.com counterpart. It follows the
 * idiom of the cards it sits beside (`CardCustomerBlock`, `CardPressBlock`): a default template
 * with no settings, because a news row has one appearance and takes its colour scheme from the
 * section around it. Settings are not invented ahead of a real need.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmNewsItemElementDisplayTemplate',
    displayName: 'ABM News Item Display Template',
    contentType: 'AbmNewsItemElement',
    isDefault: true,
    settings: [],
  },
]

export default displayTemplates
