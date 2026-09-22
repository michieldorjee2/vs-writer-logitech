import {
  longString,
  selectOne,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../../property-builders'

/**
 * One person on the CUSTOMER side of an account — a buying-committee member the account team
 * is tracking. Placed as one element node per person inside a column; the list of
 * stakeholders is never an array property, because an `array` of `component` is a 400 on an
 * elementEnabled type.
 *
 * Upstream `ContactBlock` cannot serve this role — see DIVERGENCE.md in this folder.
 */
const contentType: ContentTypeDefinition = {
  key: 'AbmStakeholderElement',
  displayName: 'ABM · Stakeholder',
  description:
    'A customer-side person on the buying committee, with their engagement state and the ' +
    'links back to their person page and CRM record.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Name: shortString('Name', {
      description: 'Full name as it should appear on the card, e.g. "Anja Lindqvist".',
      required: true,
      maxLength: 120,
    }),
    Role: shortString('Role', {
      description: 'Job title or function at the account, e.g. "VP Digital Experience".',
      maxLength: 160,
    }),
    Initials: shortString('Initials', {
      description: 'Avatar initials, 1–4 characters. Falls back to the initials of Name.',
      maxLength: 4,
    }),
    AvatarColor: shortString('Avatar colour', {
      description:
        'Avatar background, as a brand palette token or a CSS colour, e.g. "lime" or "#B3F73A".',
      maxLength: 32,
    }),
    EngagementTier: selectOne(
      'Engagement tier',
      [
        { value: 'cold', displayName: 'Cold — no contact yet' },
        { value: 'warm', displayName: 'Warm — some contact' },
        { value: 'engaged', displayName: 'Engaged — in conversation' },
        { value: 'champion', displayName: 'Champion — actively advocating' },
      ],
      {
        description: 'How far along this person is. Drives the badge on the card.',
        group: 'Engagement',
      }
    ),
    EngagementNote: longString('Engagement note', {
      description:
        'One or two sentences of context for the tier — the last touch, the open thread, the ' +
        'ask. Long text; shown as the badge tooltip.',
      group: 'Engagement',
    }),
    PersonSlug: shortString('Person slug', {
      description:
        'Slug of this person’s own person page. When set, the card links to ' +
        '/{companySlug}/{PersonSlug}. Leave empty when no person page exists.',
      maxLength: 120,
      group: 'Engagement',
    }),
    CrmContactId: shortString('CRM contact id', {
      description: 'Salesforce contact id, so the card can be traced back to its source record.',
      maxLength: 32,
      group: 'Engagement',
    }),
    LinkedInUrl: url('LinkedIn URL', {
      description: 'Absolute URL to the person’s LinkedIn profile.',
    }),
  }),
}

export default contentType
