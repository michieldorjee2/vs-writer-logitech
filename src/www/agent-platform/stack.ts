/**
 * Reading an account's stored tech stack for the agent platform template: what category each
 * tool is in, which ones the page may name, and what evidence the stack holds for each of the
 * five use-case themes.
 *
 * This is MEASUREMENT over data the page already stores (techStack, investments, intelStats).
 * Laura's design gives the real scoring to Agent 1 (6sense family, stage, intent, open opps,
 * seller override) and stores it; until it does, this evidence ranks the themes so the 2,000+
 * existing pages get the new structure without a rebuild. When an agent-written ranking exists,
 * ./content.ts uses it instead.
 */
import type { ThemeId } from './library'

export type Category =
  | 'CMS'
  | 'Digital experience platform'
  | 'Commerce'
  | 'Marketing automation'
  | 'Customer data'
  | 'Analytics'
  | 'Testing'
  | 'Personalization'
  | 'Site search'
  | 'Tag management'
  | 'Digital assets'
  | 'Work management'
  | 'CRM'
  | 'ABM'
  | 'Consent'
  | 'Accessibility'
  | 'Data warehouse'
  | 'Local listings'
  | 'AI content'
  | 'Tool'

/** Lower-cased name fragments → category. First match wins, so specific names come first. */
const CATEGORIES: Array<[RegExp, Category]> = [
  [/adobe experience manager|\baem\b|sitecore|acquia|drupal|wordpress|contentful|contentstack|storyblok|sanity|kentico|umbraco|episerver|dnn|evoq|bloomreach content|magnolia|hubspot cms|squarespace|wix|webflow|sharepoint/, 'CMS'],
  [/adobe experience cloud|experience cloud|liferay|\bdxp\b/, 'Digital experience platform'],
  [/sap commerce|hybris|shopify|salesforce commerce|bigcommerce|magento|adobe commerce|commercetools|vtex/, 'Commerce'],
  [/marketo|eloqua|pardot|account engagement|hubspot|braze|iterable|klaviyo|salesforce marketing cloud|mailchimp|acoustic/, 'Marketing automation'],
  [/tealium|segment|treasure data|mparticle|salesforce data cloud|interaction studio|actioniq|amperity|bloomreach engagement|\bcdp\b/, 'Customer data'],
  [/google analytics|\bga4\b|adobe analytics|heap|mixpanel|amplitude|contentsquare|hotjar|fullstory|quantum metric|matomo|piwik|clarity/, 'Analytics'],
  [/optimizely|\bvwo\b|ab tasty|adobe target|kameleoon|convert\.com|google optimize|launchdarkly|statsig|split\.io/, 'Testing'],
  [/dynamic yield|monetate|evergage|insider|qubit|mutiny/, 'Personalization'],
  [/algolia|coveo|elastic|lucidworks|searchspring|klevu|constructor/, 'Site search'],
  [/google tag manager|tag manager|adobe launch|ensighten/, 'Tag management'],
  [/bynder|aprimo|widen|cloudinary|brandfolder|canto|adobe assets|\bdam\b/, 'Digital assets'],
  [/atlassian|jira|confluence|asana|monday|wrike|workfront|smartsheet/, 'Work management'],
  [/salesforce(?! commerce| marketing| data| interaction)|dynamics 365|zoho crm/, 'CRM'],
  [/6sense|demandbase|terminus|rollworks/, 'ABM'],
  [/onetrust|cookiebot|trustarc|usercentrics|osano/, 'Consent'],
  [/accessibe|userway|audioeye|siteimprove/, 'Accessibility'],
  [/snowflake|bigquery|databricks|redshift/, 'Data warehouse'],
  [/yext|uberall|rio seo/, 'Local listings'],
  [/ai generated copy|llms text|llms\.txt|jasper|writer\.com/, 'AI content'],
]

export function categoryOf(name: string): Category {
  const n = name.toLowerCase()
  for (const [re, c] of CATEGORIES) if (re.test(n)) return c
  return 'Tool'
}

/** How a competitor tile reads on this template (rule N2: category only, never the name). */
export function competitorLabel(c: Category): string {
  const word: Partial<Record<Category, string>> = {
    CMS: 'CMS',
    'Digital experience platform': 'experience platform',
    'Marketing automation': 'marketing automation',
    Testing: 'testing tool',
    Personalization: 'personalization tool',
    'Site search': 'site search',
    Commerce: 'commerce platform',
    'Customer data': 'customer data platform',
    Analytics: 'analytics',
  }
  return `Your ${word[c] ?? 'current platform'}`
}

export interface StackTool {
  name: string
  category: Category
  /** Shown by category only (the replaced platform, or any tool in the same category as it). */
  competitor: boolean
  /** An Optimizely product the account already runs. */
  ours: boolean
  /** The label the page shows. */
  label: string
}

const OPTIMIZELY = /^optimizely\b/i

/**
 * The stored stack as the page may show it. A tool is a competitor when the legacy page marked it
 * (ColorTag var(--orange)), when it IS the page's competitorName, or when it shares that
 * competitor's category (a second CMS next to the replaced one is still a CMS we compete with).
 */
export function readStack(
  stack: Array<{ Name: string; ColorTag: string | null }> | null | undefined,
  competitorName: string | null | undefined,
): StackTool[] {
  const comp = (competitorName || '').trim().toLowerCase()
  const compCategory = comp && !/your current platform/.test(comp) ? categoryOf(comp) : null
  const seen = new Set<string>()
  const out: StackTool[] = []
  for (const t of stack ?? []) {
    const name = (t.Name || '').trim()
    if (!name || seen.has(name.toLowerCase())) continue // rule: dedupe by name
    seen.add(name.toLowerCase())
    const category = categoryOf(name)
    const ours = OPTIMIZELY.test(name)
    const competitor =
      !ours &&
      (/orange/.test(t.ColorTag || '') ||
        (!!comp && name.toLowerCase() === comp) ||
        (!!compCategory && compCategory !== 'Tool' && category === compCategory))
    out.push({ name, category, competitor, ours, label: competitor ? competitorLabel(category) : name })
  }
  return out
}

/**
 * Up to `max` tiles for the fit diagram: Optimizely first (customers see what they own), then
 * named tools, then competitors by category, one tile per competitor category.
 */
export function stackTiles(tools: StackTool[], max = 6): StackTool[] {
  const ours = tools.filter((t) => t.ours)
  const named = tools.filter((t) => !t.ours && !t.competitor && t.category !== 'Consent' && t.category !== 'Accessibility')
  const compByCat = new Map<string, StackTool>()
  for (const t of tools.filter((x) => x.competitor)) if (!compByCat.has(t.label)) compByCat.set(t.label, t)
  const comps = [...compByCat.values()]
  // Leave room for every competitor category: they are where the platform sits on top.
  const room = Math.max(0, max - ours.length - comps.length)
  return [...ours, ...named.slice(0, room), ...comps].slice(0, max)
}

/* ------------------------------------------------------------- theme evidence */

export interface ThemeEvidence {
  theme: ThemeId
  score: number
  why: string[]
}

const KEYWORDS: Record<ThemeId, RegExp> = {
  'content-ops': /content|brand|campaign|market|region|global|multi|launch|publish|localiz|translat|product line|catalog/i,
  personalization: /personaliz|segment|audience|customer data|loyalty|member|journey|1:1|one-to-one|buyer/i,
  geo: /\bai\b|search|seo|geo|answer|discover|chatgpt|llm/i,
  optimization: /test|experiment|conversion|optimi[sz]|cro|a\/b/i,
  analytics: /analytic|insight|data|measure|report|dashboard|attribution|warehouse/i,
}

/**
 * Evidence per theme from the stored stack and stated investments, Laura's rubric minus the
 * Salesforce/6sense terms the page does not store (6QA, stage, intent, open opp, override):
 * stack evidence +10 each (max 20), a stated investment that names the theme +10 each (max 20).
 */
export function themeEvidence(
  tools: StackTool[],
  investments: Array<{ Name: string; IsPrimary: boolean | null }> | null | undefined,
): ThemeEvidence[] {
  const has = (...cats: Category[]) => tools.filter((t) => cats.includes(t.category))
  const analyticsTools = tools.filter((t) => t.category === 'Analytics' || t.category === 'Customer data' || t.category === 'Data warehouse')
  const stackEvidence: Record<ThemeId, StackTool[]> = {
    'content-ops': has('CMS', 'Digital experience platform', 'Digital assets', 'Commerce'),
    personalization: has('Customer data', 'Personalization'),
    geo: has('Site search', 'AI content'),
    optimization: has('Testing'),
    analytics: analyticsTools.length >= 3 ? analyticsTools : [],
  }
  const out: ThemeEvidence[] = []
  for (const theme of Object.keys(KEYWORDS) as ThemeId[]) {
    const why: string[] = []
    const st = stackEvidence[theme]
    const stackPts = Math.min(20, st.length * 10)
    if (st.length) why.push(`stack: ${st.map((t) => t.label).join(', ')}`)
    const inv = (investments ?? []).filter((i) => KEYWORDS[theme].test(i.Name))
    const invPts = Math.min(20, inv.reduce((n, i) => n + (i.IsPrimary ? 15 : 10), 0))
    if (inv.length) why.push(`investing in: ${inv.map((i) => i.Name).join(', ')}`)
    out.push({ theme, score: stackPts + invPts, why })
  }
  return out
}
