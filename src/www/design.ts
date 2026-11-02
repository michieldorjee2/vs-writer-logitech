/**
 * The www design is opt-in per request while it is a concept: `?design=www` on any account page
 * (`/<company>/`) or offer page (`/vb/<slug>`). Both the server render and the client read the
 * same parameter, so the two always agree and hydration holds. Without it, nothing changes.
 */
export function wantsWwwDesign(search: string | URLSearchParams | null | undefined): boolean {
  if (!search) return false
  const p = typeof search === 'string' ? new URLSearchParams(search) : search
  return p.get('design') === 'www'
}

/** An ABMExperience written by the offer blueprint. */
export function isOfferExperience(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const item = value as { template?: unknown; componentPlan?: unknown }
  if (item.template === 'offer') return true
  const plan = item.componentPlan
  if (typeof plan === 'string') return /"blueprint"\s*:\s*"offer"|"kind"\s*:\s*"offer-page"/.test(plan)
  return false
}
