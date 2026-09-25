import type { RepoDisplayTemplate } from '../../display-template-transform'

/** `color` is upstream AccordionBlock's own setting, same values and default. */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'FaqItemElementDisplayTemplate',
    displayName: 'FAQ Item Display Template',
    contentType: 'FaqItemElement',
    isDefault: true,
    settings: [
      {
        key: 'color',
        displayName: 'Color',
        type: 'select',
        required: false,
        options: [
          { value: 'neutral2', displayName: 'Neutral 2' },
          { value: 'white', displayName: 'White' },
        ],
        defaultValue: 'neutral2',
      },
    ],
  },
]

export default displayTemplates
