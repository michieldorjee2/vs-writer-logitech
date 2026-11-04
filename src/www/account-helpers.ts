/** Pure helpers for the www-design account page. No React, so the coverage check can use them too. */
import type { CompetitorComparisonPage } from '../lib/graph-types'

/**
 * Stat values as the earlier account page showed them:
 *   104000 → "104K", 1500000 → "1.5M", "5B+" / "$380M" / "30+" unchanged.
 */
export function formatStatValue(val: string): string {
  if (!val) return val
  if (/[KMBTkmbt]\+?$/.test(val.replace(/[,$\s]/g, ''))) return val
  if (val.includes('$')) return val
  const match = val.match(/^([^0-9]*?)([\d,]+(?:\.\d+)?)\s*([^0-9,.]*)$/)
  if (!match) return val
  const [, prefix, numStr, suffix] = match
  const n = parseFloat(numStr.replace(/,/g, ''))
  if (isNaN(n)) return val
  const fmt = (d: number, s: string) => (n / d).toFixed(n % d === 0 ? 0 : 1).replace(/\.0$/, '') + s
  const out = n >= 1e9 ? fmt(1e9, 'B') : n >= 1e6 ? fmt(1e6, 'M') : n >= 1e3 ? fmt(1e3, 'K') : String(n)
  return prefix + out + suffix
}

/* The legacy renderer's rule: a team member whose Name is a generic role title is a placeholder. */
const GENERIC_CONTACT_NAMES = new Set([
  'solutions architect',
  'solution architect',
  'migration engineer',
  'customer success manager',
])
export function realContacts(members: CompetitorComparisonPage['teamMembers']) {
  return (members || []).filter((m) => !GENERIC_CONTACT_NAMES.has((m.Name || '').trim().toLowerCase()))
}

/** Hero backdrop: the Showcase's own mountain scene (public/home/scenes/v1), the mood of the site's product heroes. */
export const SCENE = '/home/scenes/v1/mountain-wide'
