import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * `displayType` is copied from the optimizely.com repo's
 * `components/block/link-list-block/display-settings.ts` — same key, same option values, same
 * default. Upstream set it once for a whole list; here it rides on each link node, so every
 * node in one list must carry the same value. Nothing else was added.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'LinkItemElementDisplayTemplate',
    displayName: 'Link Item Display Template',
    contentType: 'LinkItemElement',
    isDefault: true,
    settings: [
      {
        key: 'displayType',
        displayName: 'Display type',
        description:
          'Layout of the list this link belongs to. Set the same value on every link node in ' +
          'the list.',
        type: 'select',
        required: false,
        options: [
          { value: 'vertical', displayName: 'Vertical' },
          { value: 'horizontal', displayName: 'Horizontal' },
        ],
        defaultValue: 'vertical',
      },
    ],
  },
]

export default displayTemplates
