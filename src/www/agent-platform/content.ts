/**
 * The agent platform template's content contract, and the interim adapter that fills it from an
 * existing CompetitorComparisonPage.
 *
 * The renderer (../AgentPlatformPage.tsx) only ever reads `AgentPlatformContent`. Two producers:
 *
 *   fromLegacyPage(page)   now: the 2,000+ pages Mark already wrote, re-read into the new
 *                          structure. Account facts come from the page's stored fields only; the
 *                          rest is the template's fixed copy or measured from stored data.
 *   (agent output)         later: the page agent writes this shape directly (see the drafts in
 *                          docs/agent-platform-template/), with sourced facts, the account's own
 *                          question, observed lines and a scored theme ranking.
 *
 * Every field carries its provenance so the review layer can show what is account-specific
 * today and what waits for the agents. Nothing is ever invented: a value the page does not
 * hold is either template copy (the same on every page) or left out.
 */
import type { CompetitorComparisonPage } from '../../lib/graph-types'
import { deriveCustomerName } from '../../lib/page-identity'
import { formatStatValue, realContacts } from '../account-helpers'
import {
  DEFAULT_TEAMS,
  IDENTITY_SENTENCE,
  STATES,
  THEMES,
  THEME_ORDER,
  type LifecycleState,
  type ThemeId,
} from './library'
import { readStack, stackTiles, themeEvidence, THEME_CATEGORIES, THEME_KEYWORDS, type StackTool, type ThemeEvidence } from './stack'

/** Where a value came from. `agent` = waits for the agent drafts; the adapter cannot fill it. */
export type Provenance = 'page' | 'derived' | 'template' | 'agent'

export interface Sourced<T> {
  value: T
  from: Provenance
  /** Rule or reason, shown in the review layer. */
  note?: string
}

export interface AgentPlatformContent {
  account: string
  logo: string | null
  domain: string | null
  state: Sourced<LifecycleState>
  /** Hero fact pills: public scale facts. Source lines are an agent field (rule N6). */
  pills: Sourced<string[]>
  stats: Sourced<Array<{ value: string; label: string }>>
  statsSource: Sourced<{ label: string; href: string } | null>
  teams: Sourced<string[]>
  stack: Sourced<StackTool[]>
  priorities: Sourced<string[]>
  quote: Sourced<{ text: string; who: string; href?: string } | null>
  /** The industry question in the account's terms (agent); else the lead theme's generic question. */
  question: Sourced<string>
  themes: Sourced<ThemeId[]>
  themeEvidence: ThemeEvidence[]
  /** Observed lines per lead theme (agent only: a public fact plus source, else the line is deleted). */
  observed: Sourced<Partial<Record<ThemeId, { text: string; href: string }>>>
  /**
   * Per theme, what the page's own data shows (the tools they run in the theme's categories and
   * the investments that name it): the homework line on a use-case card until the agent writes an
   * observed line. Built from the N2-safe stack tiles and priorities, so no competitor is named.
   */
  why: Sourced<Partial<Record<ThemeId, ThemeWhy>>>
  /** Account-specific job lines per theme (agent); else the theme's generic job. */
  jobs: Sourced<Partial<Record<ThemeId, string>>>
  rep: Sourced<{ named: Array<{ name: string; role: string; email: string | null; initials: string }>; pod: string }>
  scheduleUrl: string | null
  stickyText: string
  smallPrint: { tagline: string | null; legal: string | null }
  /** Fields of the legacy page this template does not show, and the rule that keeps them off. */
  notShown: Array<{ field: string; rule: string }>
}

/* --------------------------------------------------------------------- helpers */

/** Rule N8: monthly visitors and similar traffic figures never show unless publicly sourced. */
const UNSOURCED_TRAFFIC = /visitor|traffic|sessions|page ?views|\bmuv\b/i
/** A stat about Optimizely usage is not an account fact for the hero or homework tiles. */
const ABOUT_US = /optimizely/i

/**
 * Rule N2 for free text the page stores (investments, stat labels, small print): a line that names
 * the replaced platform or a tool shown by category is left off. Names are matched whole, and so
 * are their initials for multi-word names ("Adobe Experience Manager" → "AEM").
 */
export function competitorMatcher(tools: StackTool[], competitorName: string | null | undefined): (text: string | null | undefined) => boolean {
  const names = new Set<string>()
  for (const n of [...tools.filter((t) => t.competitor).map((t) => t.name), (competitorName || '').trim()]) {
    if (!n || /your current platform/i.test(n)) continue
    names.add(n)
    const words = n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w))
    if (words.length >= 2) names.add(words.map((w) => w[0]).join('').toUpperCase())
  }
  if (!names.size) return () => false
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^A-Za-z0-9])(${[...names].map(esc).join('|')})(?![A-Za-z0-9])`, 'i')
  return (text) => !!text && re.test(text)
}

/** A personal name: two or more capitalized words ("Tim Plant", "Nguyen Thanh Son"), not a role ("Marketing leadership"). */
const PERSON_NAME = /^\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+)+$/u

/**
 * Rule N3 for stored free text: a line that names one of the page's stakeholders is left off.
 * Only person-shaped names count (some pages store a role group as a stakeholder's name), and
 * not the account's own name (Sam Edelman, Tangerine Bank) or an Optimizely team member listed
 * among the stakeholders. Found by the live-page sweep, 2 Nov 2026: investments such as
 * "Executive team led by CEO Tim Plant" and small print such as "Personalized for <name> at …".
 */
export function personMatcher(
  people: Array<{ Name?: string | null }> | null | undefined,
  opts: { account?: string; team?: Array<{ Name?: string | null }> | null } = {},
): (text: string | null | undefined) => boolean {
  const account = (opts.account || '').toLowerCase()
  const team = new Set((opts.team ?? []).map((m) => (m.Name || '').trim().toLowerCase()))
  const names = new Set<string>()
  for (const p of people ?? []) {
    const n = (p.Name || '').trim().replace(/\s+/g, ' ')
    if (!PERSON_NAME.test(n) || team.has(n.toLowerCase())) continue
    if (account && (account.includes(n.toLowerCase()) || n.toLowerCase().includes(account))) continue
    names.add(n)
  }
  if (!names.size) return () => false
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^\\p{L}])(${[...names].map(esc).join('|')})(?![\\p{L}])`, 'iu')
  return (text) => !!text && re.test(text)
}

/** The roles that count as the account executive for rule N4. */
const AE_ROLE = /account executive|\bAE\b|account director|client director/i

/** A founding year is a date, not a count: never "2K". */
function isYear(s: { Value: string; Label: string }) {
  return /^\s*(1[89]|20)\d{2}\s*$/.test(s.Value) && /found|establish|since|year|incorporat/i.test(s.Label)
}

function roleGroup(role: string): string | null {
  const r = role.toLowerCase()
  if (/\bai\b|artificial|automation|machine learning/.test(r)) return 'AI and automation'
  if (/martech|marketing tech|marketing op|ops|operations|data|analytics|crm/.test(r)) return 'Marketing operations and data'
  if (/content|brand|editor|creative|communications/.test(r)) return 'Content and brand'
  if (/digital|web|ecommerce|e-commerce|experience|cx|product/.test(r)) return 'Digital experience'
  if (/\bcto\b|cio|it\b|technolog|architect|engineering|developer|platform/.test(r)) return 'Technology and architecture'
  if (/cmo|marketing|demand|growth|chief/.test(r)) return 'Marketing leadership'
  return null
}

/**
 * Lifecycle state from what the page stores. The page holds no Customer_Stage__c or opportunity,
 * so the one signal it has is whether the account already runs Optimizely (a tool in its stack, or
 * a stat about its Optimizely use): that reads as a customer. Everything else reads as a prospect.
 * Agent 1 resolves the real state (incl. open opp, previously evaluated, ex-customer).
 */
export function deriveState(page: CompetitorComparisonPage): Sourced<LifecycleState> {
  const runsUs =
    (page.techStack ?? []).some((t) => /^optimizely\b/i.test(t.Name || '')) ||
    (page.intelStats ?? []).some((s) => ABOUT_US.test(s.Label || ''))
  return runsUs
    ? { value: 'customer', from: 'derived', note: 'Optimizely is in their stored stack or stats' }
    : { value: 'prospect', from: 'derived', note: 'no Optimizely product in the stored stack; open opp unknown to the page' }
}

export const STATE_IDS = Object.keys(STATES) as LifecycleState[]

/** The page's real contacts (placeholders like "Your Account Executive" dropped) in the contract's shape. */
export function toPeople(members: CompetitorComparisonPage['teamMembers']) {
  return realContacts(members)
    .filter((m) => m.Name)
    .map((m) => ({
      name: m.Name as string,
      role: m.Role || 'Optimizely',
      email: m.Email || null,
      initials: m.Initials || (m.Name as string).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(),
    }))
}

/** What the page's own data shows for one theme: tools in its categories, investments that name it. */
export interface ThemeWhy {
  /** Stack tile labels (N2-safe: no competitor tile). */
  stack: string[]
  /** Stored investment names, verbatim (free text from the research; never re-cased or re-phrased). */
  plans: string[]
}

function whyOf(theme: ThemeId, tiles: StackTool[], priorities: string[]): ThemeWhy | null {
  const stack = tiles.filter((t) => !t.competitor && THEME_CATEGORIES[theme].includes(t.category)).map((t) => t.label).slice(0, 3)
  const plans = priorities.filter((p) => THEME_KEYWORDS[theme].test(p)).slice(0, 2)
  return stack.length || plans.length ? { stack, plans } : null
}

/* ---------------------------------------------------------------------- adapter */

export function fromLegacyPage(page: CompetitorComparisonPage, opts: { state?: LifecycleState | null } = {}): AgentPlatformContent {
  const account = deriveCustomerName(page)
  const state: Sourced<LifecycleState> =
    opts.state && STATES[opts.state] ? { value: opts.state, from: 'derived', note: 'set by ?state= (review)' } : deriveState(page)

  const tools = readStack(page.techStack, page.competitorName)
  const namesCompetitor = competitorMatcher(tools, page.competitorName)
  const namesPerson = personMatcher(page.stakeholders, { account, team: page.teamMembers })

  // Facts: the page's own stats, minus unsourced traffic (N8), stats about Optimizely, and any
  // that name the replaced platform (N2).
  const facts = (page.intelStats ?? [])
    .filter(
      (s) =>
        s.Value &&
        s.Label &&
        !UNSOURCED_TRAFFIC.test(s.Label) &&
        !ABOUT_US.test(s.Label) &&
        // N2 and N3 on the value as well as the label: "Sitecore CMS" / "in place today".
        !namesCompetitor(`${s.Value} ${s.Label}`) &&
        !namesPerson(`${s.Value} ${s.Label}`),
    )
    .map((s) => (isYear(s) ? { value: s.Value.trim(), label: s.Label, year: true } : { value: formatStatValue(s.Value), label: s.Label, year: false }))
  // "Founded 1998", not "2K founded".
  const pills = facts.slice(0, 3).map((f) => (f.year ? `${f.label.charAt(0).toUpperCase()}${f.label.slice(1)} ${f.value}` : `${f.value} ${f.label}`))

  const evidence = themeEvidence(tools, page.investments)
  const ranked = [...evidence].sort((a, b) => b.score - a.score || THEME_ORDER.indexOf(a.theme) - THEME_ORDER.indexOf(b.theme))

  // Teams: role groups from the people on the page (roles only, rule N3), else the industry default.
  const groups = [...new Set((page.stakeholders ?? []).map((p) => roleGroup(p.Role || '')).filter(Boolean) as string[])]
  const teams = groups.length >= 3 ? groups : [...new Set([...groups, ...DEFAULT_TEAMS])].slice(0, 5)

  // N4: one named rep, the account executive. The stored team often holds an SDR or a growth rep
  // instead; then the page shows the team pod until Agent 1 resolves the AE (opp owner first).
  const ae = toPeople(page.teamMembers).find((p) => AE_ROLE.test(p.role))
  const named = STATES[state.value].namedRep && ae ? [ae] : []

  const tiles = stackTiles(tools)
  // Primary investments first, at most four: a row of chips, not a list to read.
  const priorities = [...(page.investments ?? [])]
    .sort((a, b) => Number(!!b.IsPrimary) - Number(!!a.IsPrimary))
    .map((i) => i.Name)
    // N2 and N3: no investment line that names the replaced platform or one of their people.
    .filter((n) => n && !namesCompetitor(n) && !namesPerson(n))
    .slice(0, 4)
  // Each stored tool or investment backs one use case only, the highest-ranked it fits: two cards
  // side by side never show the same homework (Carhartt: Tealium counts for personalization and
  // for analytics, and its one investment names both).
  const why: Partial<Record<ThemeId, ThemeWhy>> = {}
  const used = new Set<string>()
  for (const e of ranked) {
    const w = whyOf(e.theme, tiles, priorities)
    if (!w) continue
    const fresh = { stack: w.stack.filter((x) => !used.has(x)), plans: w.plans.filter((x) => !used.has(x)) }
    if (!fresh.stack.length && !fresh.plans.length) continue
    for (const x of [...fresh.stack, ...fresh.plans]) used.add(x)
    why[e.theme] = fresh
  }

  return {
    account,
    logo: page.customerLogo || null,
    domain: page.brandDomain || null,
    state,
    pills: { value: pills, from: 'page', note: 'intelStats, without traffic figures (N8); source lines need the public-facts step (N6)' },
    // The homework tiles carry the facts the hero pills did not, so no fact is said twice.
    stats: { value: facts.slice(3, 7).map(({ value, label }) => ({ value, label })), from: 'page', note: 'intelStats after the three in the hero; source line needs the public-facts step (N6)' },
    statsSource: { value: null, from: 'agent', note: 'N6: every account fact carries a visible source' },
    teams: {
      value: teams,
      from: groups.length >= 3 ? 'derived' : 'template',
      note: groups.length >= 3 ? 'role groups from the page’s stakeholders (names never shown, N3)' : 'industry default: fewer than 3 role groups on the page',
    },
    stack: { value: tiles, from: 'derived', note: 'techStack; competitors by category only (N2)' },
    priorities: {
      value: priorities,
      from: 'page',
      note: 'investments (primary first, up to four), minus any that name the replaced platform (N2)',
    },
    quote: { value: null, from: 'agent', note: 'optional exec quote with source' },
    question: {
      value: THEMES[ranked[0].theme].question.replace('{account}', account),
      from: 'template',
      note: 'the lead theme’s generic question; the agent writes one in the account’s own terms',
    },
    themes: {
      value: ranked.map((e) => e.theme),
      from: 'derived',
      note: 'interim: stack and investment evidence only; Agent 1 adds 6QA, stage, intent, opps and seller override',
    },
    themeEvidence: evidence,
    observed: { value: {}, from: 'agent', note: 'a public fact with a source, or the line is deleted' },
    why: { value: why, from: 'derived', note: 'the stored tools and investments behind each theme; the agent’s observed line replaces it' },
    jobs: { value: {}, from: 'template', note: 'generic job lines; the agent writes them in the account’s language' },
    rep: {
      value: { named, pod: 'Your Optimizely account team' },
      from: named.length ? 'page' : 'template',
      note: STATES[state.value].namedRep
        ? named.length
          ? 'the stored team member with an account executive role (N4); Agent 1 resolves the opp owner'
          : 'no stored team member is an account executive, so the team pod (N4)'
        : 'no named rep in this state',
    },
    scheduleUrl: page.modalScheduleUrl?.default || null,
    // The stored sticky line was written for the takeout pitch ("Your <competitor> exit plan is
    // ready"): N1 and N2 keep it off. The bar repeats the state's closing line instead.
    stickyText: STATES[state.value].closeLine,
    // Stored small print that names the replaced platform (N2) or one of the account's people (N3:
    // "Personalized for <name> at <company>", found by the live-page sweep) is left off.
    smallPrint: {
      tagline: namesCompetitor(page.footerTagline) || namesPerson(page.footerTagline) ? null : page.footerTagline || null,
      legal: namesCompetitor(page.footerLegal) || namesPerson(page.footerLegal) ? null : page.footerLegal || null,
    },
    notShown: NOT_SHOWN,
  }
}

/**
 * The page as the <head> builders see it on this template (server: buildHeadHtml, client:
 * useHeadMeta). The stored title and description were written for the takeout pitch and name the
 * competitor ("Why Optimizely over …"), which a forwarded link would show in its preview (N2);
 * testimonials and legacy analyst cards are not this template's proof (N9), so they leave the
 * structured data too.
 */
export function agentPlatformHead<T extends CompetitorComparisonPage>(page: T): T {
  const c = fromLegacyPage(page)
  return {
    ...page,
    PageTitle: `Optimizely agent platform · Personalized for ${c.account}`,
    MetaDescription: `${IDENTITY_SENTENCE} How agents work on the stack ${c.account} already runs, starting with ${THEMES[c.themes.value[0]].lead}.`,
    testimonial1: null,
    testimonial2: null,
    analystCards: null,
  }
}

/** The stored fields this template does use, and where. With NOT_SHOWN, every field is accounted for. */
export const USED_FIELDS: Array<{ field: string; where: string }> = [
  { field: 'salesforceAccountID', where: 'identity only; no renderer displays it' },
  { field: 'customerLogo', where: 'top strip' },
  { field: 'intelStats', where: 'hero fact pills and the homework stat tiles, without traffic figures (N8)' },
  { field: 'techStack', where: 'stack layer of the fit diagram, hero chips, use-case ranking, the 90-day Connect step' },
  { field: 'investments', where: 'priority chips and use-case ranking' },
  { field: 'stakeholders', where: 'the teams layer and "Built for", as role groups only (N3)' },
  { field: 'teamMembers', where: 'the account executive on the rep card and connect panel when the state allows (N4); the ping' },
  { field: 'modalScheduleUrl', where: 'connect panel: "Schedule a call"' },
  { field: 'footerTagline', where: 'small print (left off if it names the replaced platform, N2)' },
  { field: 'footerLegal', where: 'small print (left off if it names the replaced platform, N2)' },
]

/**
 * Legacy fields the agent platform template deliberately leaves off, with Laura's rule. They stay
 * in the CMS untouched.
 */
export const NOT_SHOWN: Array<{ field: string; rule: string }> = [
  { field: 'eyebrow', rule: 'fixed eyebrow "Personalized for {account}" (4.1); still read for the account name' },
  { field: 'headline', rule: 'H1 follows the lifecycle state, no account name (4.1)' },
  { field: 'subheadline', rule: 'identity sentence first, then the lead use case (4.1)' },
  { field: 'cta', rule: 'exactly two CTAs, set by state (4.8)' },
  { field: 'link', rule: 'exactly two CTAs, set by state (4.8)' },
  { field: 'brandAccentColor', rule: 'gate 2: no account colours' },
  { field: 'intelEyebrow', rule: 'section is "We did our homework" (4.3)' },
  { field: 'intelHeadline', rule: 'section is "We did our homework" (4.3); still read for the account name' },
  { field: 'brandDomain', rule: "the account's own site is not pictured; the hero panel is Agents at work (4.1)" },
  { field: 'newsItems', rule: 'N7: news only under 12 months and relevant, as priority chips or a quote' },
  { field: 'challengeHeadline', rule: 'N1: no incumbent framing' },
  { field: 'challengeScreenshotUrl', rule: 'hero panel is "Agents at work" (4.1)' },
  { field: 'challengeScreenshotAlt', rule: 'hero panel is "Agents at work" (4.1)' },
  { field: 'challengeBrowserUrl', rule: 'hero panel is "Agents at work" (4.1)' },
  { field: 'painPoints', rule: 'N1: no incumbent framing; replaced by use cases (4.5)' },
  { field: 'competitorName', rule: 'N2: competitors by category only' },
  { field: 'comparisonHeadline', rule: 'N1: no comparison table on this template' },
  { field: 'comparisonDescription', rule: 'N1: no comparison table on this template' },
  { field: 'comparisonTableRows', rule: 'N1: no comparison table on this template' },
  { field: 'logoWallCustomerSlot', rule: 'proof is three verified results (4.6)' },
  { field: 'testimonial1', rule: 'N9: agent platform proof only' },
  { field: 'testimonial1JobTitle', rule: 'N9: agent platform proof only' },
  { field: 'testimonial1Company', rule: 'N9: agent platform proof only' },
  { field: 'testimonial2', rule: 'N9: agent platform proof only' },
  { field: 'testimonial2JobTitle', rule: 'N9: agent platform proof only' },
  { field: 'testimonial2Company', rule: 'N9: agent platform proof only' },
  { field: 'analystHeadline', rule: 'analyst badges live in "Who we are" (4.2)' },
  { field: 'analystQuote', rule: 'analyst badges live in "Who we are" (4.2)' },
  { field: 'analystSource', rule: 'analyst badges live in "Who we are" (4.2)' },
  { field: 'analystCTA', rule: 'analyst badges live in "Who we are" (4.2)' },
  { field: 'analystCTALink', rule: 'analyst badges live in "Who we are" (4.2)' },
  { field: 'analystCards', rule: 'analyst badges live in "Who we are" (4.2)' },
  { field: 'promoEyebrow', rule: 'not in the template (section 3)' },
  { field: 'promoHeading', rule: 'not in the template (section 3)' },
  { field: 'promoDescription', rule: 'not in the template (section 3)' },
  { field: 'promoCTA', rule: 'not in the template (section 3)' },
  { field: 'promoCTALink', rule: 'not in the template (section 3)' },
  { field: 'roiTitle', rule: 'N9: experimentation stats are not agent platform proof' },
  { field: 'roiDescription', rule: 'N9: experimentation stats are not agent platform proof' },
  { field: 'roiProjectionValue', rule: 'N9: experimentation stats are not agent platform proof' },
  { field: 'roiProjectionLabel', rule: 'N9: experimentation stats are not agent platform proof' },
  { field: 'roiProjectionDetail', rule: 'N9: experimentation stats are not agent platform proof' },
  { field: 'roiCards', rule: 'N9: experimentation stats are not agent platform proof' },
  { field: 'endHeadline', rule: 'close headline follows the state (4.8)' },
  { field: 'endSubheadline', rule: 'close headline follows the state (4.8)' },
  { field: 'endCTA', rule: 'exactly two CTAs (4.8)' },
  { field: 'endCTALink', rule: 'exactly two CTAs (4.8)' },
  { field: 'migrationTitle', rule: 'first 90 days is adoption, nothing replaced (4.7)' },
  { field: 'migrationDescription', rule: 'first 90 days is adoption, nothing replaced (4.7)' },
  { field: 'timelinePhases', rule: 'first 90 days is adoption, nothing replaced (4.7)' },
  { field: 'ctaTitle', rule: 'close headline follows the state (4.8)' },
  { field: 'ctaDescription', rule: 'close copy follows the state (4.8)' },
  { field: 'ctaButtonText', rule: 'primary CTA follows the state (4.8)' },
  { field: 'footerLinks', rule: 'no footer; the small print keeps tagline and legal' },
  { field: 'PageTitle', rule: 'N2: written for the takeout pitch, names the competitor in the tab and link previews; agentPlatformHead() sets the title' },
  { field: 'MetaDescription', rule: 'N2: written for the takeout pitch; agentPlatformHead() sets the description' },
  { field: 'stickyCTAText', rule: 'N1 and N2: written for the takeout pitch, often names the competitor; the bar uses the state line' },
]
