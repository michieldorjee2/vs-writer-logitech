import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * No upstream template to port. `colorScheme` is copied verbatim from upstream
 * `card-author-block`, the nearest analogue in the catalogue, so a team member card, a
 * stakeholder card and an author card all offer an editor the same choice with the same
 * labels.
 *
 * The `defaultValue` carries the whole weight here: the CMS stores no defaults, so this file
 * is the source of truth and the value is applied client-side at compose time.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmTeamMemberElementDisplayTemplate',
    displayName: 'ABM Team Member Display Template',
    contentType: 'AbmTeamMemberElement',
    isDefault: true,
    settings: [
      {
        key: 'colorScheme',
        displayName: 'Color Scheme',
        type: 'select',
        required: false,
        options: [
          { value: 'dark', displayName: 'Dark (light text on dark bg)' },
          { value: 'light', displayName: 'Light (dark text on light bg)' },
        ],
        defaultValue: 'dark',
      },
    ],
  },
]

export default displayTemplates
