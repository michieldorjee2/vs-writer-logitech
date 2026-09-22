import type { RepoDisplayTemplate } from '../../display-template-transform'

/**
 * No upstream template to port: optimizely.com has no customer-side stakeholder card.
 * `colorScheme` is copied verbatim from upstream `card-author-block`, the nearest analogue
 * (the only other person card in the catalogue), so a stakeholder and an author card offer an
 * editor the same choice with the same labels. `showEngagementTier` is ours, because the
 * engagement badge is ours.
 *
 * Every setting carries a `defaultValue`: the CMS stores no defaults, so this file is the
 * source of truth and the values are applied client-side at compose time.
 */
const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'AbmStakeholderElementDisplayTemplate',
    displayName: 'ABM Stakeholder Display Template',
    contentType: 'AbmStakeholderElement',
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
      {
        key: 'showEngagementTier',
        displayName: 'Show Engagement Tier',
        description:
          'Render the engagement badge. Turn it off for an outward-facing page where the ' +
          'account team’s read on a person should not be visible.',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
  },
]

export default displayTemplates
