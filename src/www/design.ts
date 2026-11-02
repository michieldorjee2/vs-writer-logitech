/**
 * The www design is the default for every account page (`/<company>/`) and offer page
 * (`/vb/<slug>`), live since 2 November 2026 (Michiel: "switch all pages to it").
 * `?design=classic` renders the previous design for that one request: to compare, or to fall
 * back for one page without a redeploy. `?design=www` still works (old links keep working).
 * Both the server render and the client read the same parameter, so the two always agree and
 * hydration holds. Person, retail and fin-serv pages are not affected.
 */
export function wantsWwwDesign(search: string | URLSearchParams | null | undefined): boolean {
  if (!search) return true
  const p = typeof search === 'string' ? new URLSearchParams(search) : search
  return p.get('design') !== 'classic'
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

/** `?template=takeout`: the competitive takeout template instead of the agent platform one. */
export function wantsTakeout(search: string | URLSearchParams | null | undefined): boolean {
  if (!search) return false
  const p = typeof search === 'string' ? new URLSearchParams(search) : search
  return p.get('template') === 'takeout'
}
