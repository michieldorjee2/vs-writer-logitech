/**
 * Who on OUR side of an account a page names: the stored team (`teamMembers`) without its
 * placeholders, and the account executive among them.
 *
 * The page (the rep card, the connect panel's "We've let … know") and the server's CTA ping
 * (api/cta-ping.ts) read the same answer, so the person a visitor is told about is the person who
 * gets the message. No React, no browser: the server imports it as it is.
 */
import type { CompetitorComparisonPage } from './graph-types'

type Members = CompetitorComparisonPage['teamMembers']
export type TeamMember = NonNullable<Members>[number]

/* The legacy renderer's rule: a team member whose Name is a generic role title is a placeholder. */
const GENERIC_CONTACT_NAMES = new Set([
  'solutions architect',
  'solution architect',
  'migration engineer',
  'customer success manager',
])

export function realContacts(members: Members): TeamMember[] {
  return (members || []).filter((m) => !!m && !GENERIC_CONTACT_NAMES.has((m.Name || '').trim().toLowerCase()))
}

/** The roles that count as the account executive (rule N4, and who the CTA ping messages). */
export const AE_ROLE = /account executive|\bAE\b|account director|client director/i

/**
 * A named account executive: the role is one of AE_ROLE, and the name is a person's, not a role
 * title standing in for one ("Account Executive", "Your Account Executive").
 */
export const isAccountExecutive = (name: string | null | undefined, role: string | null | undefined): boolean =>
  !!name?.trim() && AE_ROLE.test(role || '') && !AE_ROLE.test(name)

/** The page's account executive: the first real contact who is one. */
export function accountExecutiveOf(members: Members): TeamMember | null {
  return realContacts(members).find((m) => isAccountExecutive(m.Name, m.Role)) ?? null
}

/** Who the connect panel says the ping told: the account executive's first name, never whoever is listed first. */
export function toldFirstName(people: Array<{ name: string; role: string }>): string | undefined {
  return people.find((p) => isAccountExecutive(p.name, p.role))?.name.split(/\s+/)[0]
}
