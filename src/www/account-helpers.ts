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

/* The page's real contacts (placeholders dropped): one rule for the page and the CTA ping. */
export { realContacts } from '../lib/account-rep'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The comparison rows as the HTML table optimizely.com's TableBlock renders. Yes / No / Limited
 * become TableBlock's own `{true}` / `{false}` / `{warning}` icon tokens AND keep their word,
 * so nothing a writer typed is replaced by an icon alone. Free text stays as text.
 */
export function comparisonTableHtml(
  rows: NonNullable<CompetitorComparisonPage['comparisonTableRows']>,
  competitor: string,
  /** In the CMS editor: the competitor's column heading is the competitorName field (data-epi-edit). */
  editing = false,
): string {
  const cell = (v: string | null) => {
    const raw = (v ?? '').trim()
    const k = raw.toLowerCase()
    const icon = k === 'yes' ? '{true}' : k === 'no' ? '{false}' : k === 'limited' ? '{warning}' : ''
    return icon ? `${icon}<span class="www-cell-label">${esc(raw)}</span>` : esc(raw)
  }
  const body = rows
    .map((r) => `<tr data-xray="comparison-row"><td>${esc(r.Category)}</td><td>${cell(r.CompetitorValue)}</td><td>${cell(r.OurValue)}</td></tr>`)
    .join('')
  const head = editing ? `<th data-epi-edit="competitorName">${esc(competitor)}</th>` : `<th>${esc(competitor)}</th>`
  return `<table><thead><tr><th>Capability</th>${head}<th>Optimizely</th></tr></thead><tbody>${body}</tbody></table>`
}

/**
 * The same six customer logos the legacy proof wall used (optimizely.com's CMP DAM). The legacy
 * list labelled them Salesforce / Nike / Zoom / Visa / Santander / Cox Automotive, which only ever
 * reached alt text; these names are what the images actually show (checked by rendering each).
 */
export const PROOF_LOGOS = [
  { url: 'https://images1.cmp.optimizely.com/Zz1hYmM3ZWVlZTQ0NGExMWYxOGViZDUyNzY1OGQ1ZDg4OA==', alt: 'Alaska Airlines' },
  { url: 'https://images3.cmp.optimizely.com/Zz1iNGQ3OTg4YTQ0NWExMWYxYWY0YzhhNGEyZTdjMzU1YQ==', alt: 'Zoom' },
  { url: 'https://images1.cmp.optimizely.com/Zz0wMDRlM2U2MjQ0NTcxMWYxYWVjYTUyNzY1OGQ1ZDg4OA==', alt: 'Salesforce' },
  { url: 'https://images4.cmp.optimizely.com/Zz03ODJlY2YwODQ0NGExMWYxYWIzYTg2ZjEzODRhZmFlZg==', alt: 'Admiral' },
  { url: 'https://images3.cmp.optimizely.com/Zz1mY2I0MzVmYzQ0NTgxMWYxOTAxYThhNGEyZTdjMzU1YQ==', alt: 'The Royal Mint' },
  { url: 'https://images3.cmp.optimizely.com/Zz01YTg1N2VkODVhM2YxMWYxODQ4MTcyMjMyNWM5YzQ3YQ==', alt: 'Diligent' },
]

/** Hero backdrop: the Showcase's own mountain scene (public/home/scenes/v1), the mood of the site's product heroes. */
export const SCENE = '/home/scenes/v1/mountain-wide'
