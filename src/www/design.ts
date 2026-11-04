/**
 * The www design is the only design for account pages (`/<company>/`, in the template the page's
 * own pitch calls for: ./account-template.ts) and offer pages (`/vb/<slug>`). Live since 2 November
 * 2026 (Michiel: "switch all pages to it"); the previous renderers and every switch in the address
 * were removed on 4 November. Person, retail and fin-serv pages have their own renderers.
 */

/** An ABMExperience written by the offer blueprint. */
export function isOfferExperience(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const item = value as { template?: unknown; componentPlan?: unknown }
  if (item.template === 'offer') return true
  const plan = item.componentPlan
  if (typeof plan === 'string') return /"blueprint"\s*:\s*"offer"|"kind"\s*:\s*"offer-page"/.test(plan)
  return false
}
