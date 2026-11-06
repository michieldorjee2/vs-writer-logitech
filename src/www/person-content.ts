/**
 * The person page (PersonPage, `/<company>/<person>/`) in the www design: what each stored field
 * becomes, and the rules the page keeps. Pure, no React, so `check:www` and the server can use it.
 *
 * The rules come from the page it replaces (rebuilt 2026-08-25) and still hold:
 *
 *   SALESFORCE IS AN INPUT TO REASONING, NEVER AN OUTPUT TO THE PAGE. The open opportunity, the
 *   touchpoint log and the engagement summary are stored and never fetched.
 *
 *   NO CONVERSATION OF OURS ON THE PAGE (Michiel, 6 Nov 2026: "I don't like that we put
 *   conversations on the page. The main account page also doesn't do that."). Nothing says we
 *   have talked: no engagement badge, no "You have met", and their words only when they
 *   published them (a quote must link a public source; one from an email, call or meeting is
 *   dropped on the server, before the page is drawn). The agent writing these pages has the
 *   same rule (person_page v3.1.0).
 *
 *   THE WORKING STAYS VISIBLE, JUST QUIETLY. The page names a real person, so what we assumed
 *   about the role, and their own words, stay on the page with an invitation to correct us.
 *
 * And from the www design (Michiel, 2 Nov): personalization said once (the account logo and the
 * stored eyebrow above the headline), one closing call to action, the one-click ask (it tells the
 * account executive, src/lib/cta-ping.ts), no navigation, no footer.
 */
import type { PersonPage } from '../lib/graph-types.js'
import { resolveUrl } from '../lib/graph-types.js'
import { realContacts } from '../lib/account-rep.js'

/** Full product names, never acronyms: these are read outside the building. */
export const PRODUCT_LABEL: Record<string, string> = {
  cms: 'Content Management',
  opal: 'Mark',
  experimentation: 'Experimentation',
  cmp: 'Content Marketing',
  commerce: 'Commerce',
}

export const PRODUCT_HREF: Record<string, string> = {
  cms: 'https://www.optimizely.com/products/content-management',
  opal: 'https://www.optimizely.com/products/ai',
  experimentation: 'https://www.optimizely.com/products/experimentation',
  cmp: 'https://www.optimizely.com/products/content-marketing',
  commerce: 'https://www.optimizely.com/products/commerce',
}

/**
 * How the platform works. Identical on every person page: the one part about the product rather
 * than the reader, so a set of these reads as one product. Mechanism, not promised outcomes.
 */
export const HOW_IT_WORKS = [
  {
    title: 'Connect what you already run',
    body: 'Content, data and audiences come from the systems you have in place today. Nothing has to be migrated to get started.',
  },
  {
    title: 'Build without a release',
    body: 'Marketers work in a visual editor against approved components, so engineering stays on product work instead of page requests.',
  },
  {
    title: 'Keep the guardrails',
    body: 'Brand, legal and approval checkpoints stay inside the flow, so moving faster does not cost you control of what ships.',
  },
  {
    title: 'Measure, then keep the wins',
    body: 'Every change is tested against real behaviour, and what works feeds the next decision rather than an end-of-quarter report.',
  },
]
export const HOW_IT_WORKS_TITLE = 'Four steps, and none of them start with a migration'

/* ISO codes the writer occasionally puts where the symbol belongs, in front of a very large numeral. */
const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF ', SEK: 'kr', NOK: 'kr', DKK: 'kr',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-03-14" -> "14 Mar 2026", read off the string so the server and the browser always agree. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  const month = m && MONTHS[Number(m[2]) - 1]
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : iso
}

/** The one number, as shown: "€4M+", never "EUR4M+"; "68" stays "68". */
export function keyNumberText(page: Pick<PersonPage, 'keyNumberPrefix' | 'keyNumberValue' | 'keyNumberSuffix'>): string {
  const raw = (page.keyNumberPrefix ?? '').trim()
  const prefix = CURRENCY_SYMBOL[raw.toUpperCase()] ?? page.keyNumberPrefix ?? ''
  const n = Number(page.keyNumberValue ?? '')
  const value = Number.isFinite(n) && page.keyNumberValue?.trim() ? n.toLocaleString('en-US') : (page.keyNumberValue ?? '')
  return `${prefix}${value}${page.keyNumberSuffix ?? ''}`
}

/** What the seat is scored on: `scorecard`, or `remitPoints` on the two oldest pages that only carry those. */
export function measuresOf(page: Pick<PersonPage, 'scorecard' | 'remitPoints'>) {
  const scorecard = page.scorecard ?? []
  return scorecard.length
    ? scorecard.map((s) => ({ title: s.Measure ?? '', note: s.WhyHard, metric: s.Metric }))
    : (page.remitPoints ?? []).map((r) => ({ title: r.Title ?? '', note: r.Description, metric: r.Metric }))
}

/** A source anyone can open: an http(s) link. An email, a call or a meeting has none. */
export function isPublicSource(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    return /^https?:$/.test(new URL(url).protocol)
  } catch {
    return false
  }
}

type Provenance = NonNullable<PersonPage['provenance']>[number]
const registerOf = (p: Provenance) => p.Register ?? 'assumed'

/**
 * Their words (`told`) only when they published them: the quote links a public source. Words from
 * an email, a call or a meeting have no link, and are dropped. `read` (public facts) and
 * `assumed` (our labelled inference about the seat) stay.
 */
export function publicProvenance(items: PersonPage['provenance']): Provenance[] {
  return (items ?? []).filter((p) => registerOf(p) !== 'told' || isPublicSource(resolveUrl(p.SourceUrl)))
}

/** `read` is public fact about their business; `told` (published) and `assumed` are the honesty register. */
export function provenanceOf(page: Pick<PersonPage, 'provenance'>) {
  const all = publicProvenance(page.provenance)
  return { operation: all.filter((p) => registerOf(p) === 'read'), working: all.filter((p) => registerOf(p) !== 'read') }
}

/**
 * The person page as it may leave the server (api/content.ts, server/ssr-handler.tsx, the CMS
 * preview): their unpublished words are not in the page's source either, not just off the screen.
 */
export function publicPersonPage<T extends Pick<PersonPage, 'provenance'>>(page: T): T {
  return { ...page, provenance: publicProvenance(page.provenance) }
}

/** One voice per card: two quotes from the same person read as a mistake, not as weight. */
export function peerProofOf(page: Pick<PersonPage, 'peerProof'>) {
  const all = page.peerProof ?? []
  return all.filter((p, i) => all.findIndex((q) => q.PersonName === p.PersonName) === i)
}

/** Our team on the page, without role titles standing in for people ("Account Executive"). */
export function teamOf(page: Pick<PersonPage, 'team'>) {
  // realContacts drops the generic names; a role title as a name ("Account Executive") is a placeholder too.
  return realContacts(page.team).filter((m) => !!m.Name?.trim() && !/^(your )?(account executive|technical lead)$/i.test(m.Name.trim()))
}

/**
 * The connect panel's "Schedule a call": a booking link only. 21 of the 33 pages store
 * optimizely.com/contact there, a form, which the one-click ask replaces; another stores a page
 * on this site. Those offer no fast track rather than a "Pick a 30-minute slot" that isn't one.
 */
export function bookingUrlOf(page: Pick<PersonPage, 'meetingUrl'>): string | null {
  const url = resolveUrl(page.meetingUrl)
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return null
    if (/(^|\.)optimizely\.com$/i.test(u.hostname)) return null
    return url
  } catch {
    return null
  }
}

/**
 * The closing button's words. The stored ones promise a booking ("Book 30 minutes", "Pick a
 * time"), which is honest only when the panel the click opens has a booking link in it.
 */
export function askLabelOf(page: Pick<PersonPage, 'ctaButtonText' | 'meetingUrl'>): string {
  return bookingUrlOf(page) && page.ctaButtonText?.trim() ? page.ctaButtonText.trim() : 'Talk to your team'
}

/** The hero's second button: the stored words ("See how it works"), to the page's own argument. */
export function heroSecondHref(page: Pick<PersonPage, 'solutions'>): string {
  return (page.solutions ?? []).length ? '#practice' : '#how'
}

/**
 * Where every PersonPage property lands. `check:www` renders a page with every field filled and
 * fails if a `text` field's value is missing or a `never` field's value is anywhere in the markup,
 * and checks the page's query fetches exactly the fields that are not `never`.
 *
 *   text   on screen as text          attr   a link, image or colour
 *   head   the server's <head>        meta   fetched to route and tag the page, not shown
 *   never  stored, deliberately not shown and NOT FETCHED: in neither the page's source nor
 *          /api/content (the reason says why)
 */
export type PersonFieldUse = 'text' | 'attr' | 'head' | 'meta' | 'never'
export const PERSON_FIELDS: Array<{ field: keyof PersonPage; use: PersonFieldUse; where: string }> = [
  { field: 'PageTitle', use: 'head', where: '<title>' },
  { field: 'MetaDescription', use: 'head', where: '<meta name="description">' },
  { field: 'noIndex', use: 'head', where: 'robots noindex (person pages name a real person)' },
  { field: 'template', use: 'meta', where: 'the renderer tag' },
  { field: 'companySlug', use: 'attr', where: 'the "Back to <company>" link in the small print' },
  { field: 'companyName', use: 'text', where: 'hero: the account mark; operation heading; small print' },
  { field: 'personSlug', use: 'meta', where: 'the route' },
  { field: 'crmContactId', use: 'never', where: 'Salesforce id: never on the page' },
  { field: 'personName', use: 'text', where: 'hero: h1 (without a stored headline); sticky bar' },
  { field: 'personTitle', use: 'text', where: 'hero: the lead (without a stored subheadline)' },
  { field: 'personInitials', use: 'never', where: 'the reader is not shown an avatar of themselves' },
  { field: 'personLinkedIn', use: 'attr', where: 'hero: their LinkedIn link' },
  { field: 'personAvatarColor', use: 'never', where: 'as personInitials' },
  { field: 'companyLogo', use: 'attr', where: 'hero: the account logo above the headline' },
  { field: 'brandAccentColor', use: 'attr', where: '--www-accent: the stripe under the account logo' },
  { field: 'heroEyebrow', use: 'text', where: 'hero: the line beside the account logo ("Written for Ben")' },
  { field: 'heroHeadline', use: 'text', where: 'hero: h1 when stored (14 of 33)' },
  { field: 'heroSubheadline', use: 'text', where: 'hero: the lead when stored' },
  { field: 'heroCtaText', use: 'text', where: "hero: second button, to the page's own argument" },
  { field: 'heroCtaUrl', use: 'never', where: 'mostly optimizely.com/contact, a form: the second button scrolls to the argument instead' },
  { field: 'engagementTier', use: 'never', where: 'CRM state: the page never says whether we have talked' },
  { field: 'engagementHeadline', use: 'never', where: 'CRM output: never on the page' },
  { field: 'engagementSummary', use: 'never', where: 'CRM output: never on the page' },
  { field: 'touchpoints', use: 'never', where: 'our outreach log: never on the page' },
  { field: 'openOpportunityName', use: 'never', where: 'a pipeline record: never on the page' },
  { field: 'openOpportunityStage', use: 'never', where: 'a pipeline record: never on the page' },
  { field: 'openOpportunityDetail', use: 'never', where: 'a pipeline record: never on the page' },
  { field: 'remitHeadline', use: 'text', where: 'the problem: heading, on pages without a scorecard' },
  { field: 'remitIntro', use: 'never', where: 'the dossier voice the August rebuild removed' },
  { field: 'remitPoints', use: 'text', where: 'the problem: the measures, on pages without a scorecard' },
  { field: 'roleFrame', use: 'text', where: 'hero: the chip under the lead ("Brand leader, global gaming brand")' },
  { field: 'noteBody', use: 'text', where: 'the note' },
  { field: 'noteSignedBy', use: 'text', where: 'the note: signature; the working: who to correct' },
  { field: 'noteSignedByRole', use: 'text', where: 'the note: signature' },
  { field: 'noteSignedByInitials', use: 'text', where: 'the note: signature tile' },
  { field: 'noteDate', use: 'text', where: 'the note: date ("22 Oct 2026")' },
  { field: 'researchHeadline', use: 'never', where: '"What we looked at before writing this": the dossier voice' },
  { field: 'researchClaim', use: 'never', where: 'as researchHeadline' },
  { field: 'provenance', use: 'text', where: '`read`: the operation scene; `told` (only with a public source) and `assumed`: why you\'re seeing this' },
  { field: 'scorecardHeadline', use: 'text', where: 'the problem: heading' },
  { field: 'scorecardIntro', use: 'never', where: '"our hypothesis about your scorecard": the dossier voice' },
  { field: 'scorecard', use: 'text', where: 'the problem: each measure, why it is hard, its metric (WhatChanges is the practice scene\'s job)' },
  { field: 'solutionsHeadline', use: 'text', where: 'in practice: heading' },
  { field: 'solutionsIntro', use: 'text', where: 'in practice: lead' },
  { field: 'solutions', use: 'text', where: 'in practice: one card per product' },
  { field: 'keyNumberValue', use: 'text', where: 'proof: the one extruded number' },
  { field: 'keyNumberPrefix', use: 'text', where: 'proof: before the number (an ISO code becomes its symbol)' },
  { field: 'keyNumberSuffix', use: 'text', where: 'proof: after the number' },
  { field: 'keyNumberLabel', use: 'text', where: 'proof: what the number is' },
  { field: 'keyNumberDetail', use: 'text', where: 'proof: where it comes from' },
  { field: 'keyNumberCitationUrl', use: 'attr', where: 'proof: the "Source" link' },
  { field: 'peerProofHeadline', use: 'text', where: 'proof: the quotes\' heading' },
  { field: 'peerProof', use: 'text', where: 'proof: one quote card per person' },
  { field: 'teamHeadline', use: 'text', where: 'the ask: above the team' },
  { field: 'team', use: 'text', where: 'the ask: the team (names and roles, never who has met them); the account executive gets the ping' },
  { field: 'ctaTitle', use: 'text', where: 'the ask: heading; sticky bar' },
  { field: 'ctaBody', use: 'text', where: 'the ask: lead' },
  { field: 'ctaButtonText', use: 'text', where: 'the ask: the button, when the page has a booking link (askLabelOf)' },
  { field: 'meetingUrl', use: 'attr', where: 'the connect panel: "Schedule a call", when it is a booking link (bookingUrlOf)' },
  { field: 'footerLine', use: 'text', where: 'the ask: small print' },
  { field: 'generatedAt', use: 'never', where: 'build metadata' },
  { field: 'generatedBy', use: 'never', where: 'build metadata' },
]
