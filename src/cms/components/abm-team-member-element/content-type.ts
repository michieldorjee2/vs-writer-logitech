import { sequence, shortString, type ContentTypeDefinition } from '../../property-builders'

/**
 * One person on OUR side of an account — the Optimizely account team. Maps the `teamMembers`
 * list, one element node per member, because an `array` of `component` is a 400 on an
 * elementEnabled type.
 *
 * Deliberately four scalars and nothing else: this is the "who to call" strip at the foot of
 * an account page, not a profile. The customer-side counterpart is `AbmStakeholderElement`.
 */
const contentType: ContentTypeDefinition = {
  key: 'AbmTeamMemberElement',
  displayName: 'ABM · Team Member',
  description:
    'A member of the Optimizely account team, as shown in the contact strip of an account page.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    Initials: shortString('Initials', {
      description: 'Avatar initials, 1–4 characters. Falls back to the initials of Name.',
      maxLength: 4,
    }),
    Name: shortString('Name', {
      description: 'Full name as it should appear on the card.',
      required: true,
      maxLength: 120,
    }),
    Role: shortString('Role', {
      description: 'Role on the account, e.g. "Account Executive" or "Solution Consultant".',
      maxLength: 160,
    }),
    Email: shortString('Email', {
      description:
        'Work email address. A plain short string — the CMS has no email format, and the ' +
        'card renders it as a mailto link.',
      maxLength: 254,
    }),
  }),
}

export default contentType
