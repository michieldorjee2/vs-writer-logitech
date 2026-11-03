/**
 * Every live account page, rendered in the www design (the default since 2 Nov 2026), checked
 * from its server HTML. Lists the pages from Graph (read-only) and fetches each one.
 *
 *   npx tsx scripts/smoke-live-pages.ts [base] [--sample N] [--concurrency N]
 *   base defaults to http://127.0.0.1:5199 (scripts/serve-prod.ts); pass the live domain to check production.
 *
 * Per page: HTTP 200, the agent platform template with its eight sections, its own tab title, one
 * closing call to action, no broken values ("undefined", "NaN", "[object Object]"), and none of the
 * stored competitor or stakeholder names in what a reader sees (N2, N3; the hydration data in
 * the page source is a known gap and is not part of this check).
 *
 * Reads GRAPH_AUTH_KEY from the environment or .env.local and never prints it. Sends nothing
 * anywhere except GET requests to the pages and the Graph read. No page JS runs, so no tracking.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { showsWhoWeAre } from '../src/www/agent-platform/library'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of fs.existsSync(path.join(ROOT, '.env.local')) ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/i)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}
const KEY = process.env.GRAPH_AUTH_KEY
if (!KEY) throw new Error('GRAPH_AUTH_KEY is not set')

const args = process.argv.slice(2)
const flag = (name: string, def: number) => {
  const i = args.indexOf(name)
  return i > -1 ? Number(args[i + 1]) : def
}
const BASE = (args.find((a) => /^https?:\/\//.test(a)) || 'http://127.0.0.1:5199').replace(/\/$/, '')
const SAMPLE = flag('--sample', 0)
const CONCURRENCY = flag('--concurrency', 8)
const BYPASS = process.env.E2E_BYPASS

const QUERY = `
query Pages($limit: Int!, $skip: Int!) {
  CompetitorComparisonPage(locale: en, limit: $limit, skip: $skip, orderBy: { _metadata: { published: DESC } }) {
    total
    items {
      _metadata { key url { default hierarchical } }
      competitorName
      stakeholders { Name }
      teamMembers { Name }
    }
  }
}`

interface Item {
  _metadata?: { key?: string | null; url?: { default?: string | null; hierarchical?: string | null } | null } | null
  competitorName?: string | null
  stakeholders?: Array<{ Name?: string | null }> | null
  teamMembers?: Array<{ Name?: string | null }> | null
}

async function listPages(): Promise<Array<{ path: string; key: string | null; competitor: string | null; people: string[] }>> {
  const out: Item[] = []
  for (let skip = 0; skip < 6000; skip += 100) {
    const r = await fetch(`https://cg.optimizely.com/content/v2?auth=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { limit: 100, skip } }),
    })
    const j = (await r.json()) as { data?: { CompetitorComparisonPage?: { items?: Item[] } } ; errors?: unknown }
    const items = j.data?.CompetitorComparisonPage?.items ?? []
    out.push(...items)
    if (items.length < 100) break
  }
  const seen = new Set<string>()
  const pages = []
  for (const it of out) {
    const raw = it._metadata?.url?.hierarchical || it._metadata?.url?.default || ''
    const p = '/' + raw.replace(/^\/(en)\//, '/').replace(/^\/+|\/+$/g, '') + '/'
    // Account pages only: /<company>/ (person pages are /<company>/<person>/ and keep their own design).
    if (p === '//' || p.split('/').filter(Boolean).length !== 1 || seen.has(p)) continue
    seen.add(p)
    pages.push({
      path: p,
      key: it._metadata?.key ?? null,
      competitor: it.competitorName && !/your current platform/i.test(it.competitorName) ? it.competitorName.trim() : null,
      // Person-shaped names only (some pages store a role group as a name), never an Optimizely
      // team member listed among the stakeholders (the AE may be named, N4).
      people: (it.stakeholders ?? [])
        .map((s) => (s.Name || '').trim())
        .filter((n) => /^\p{Lu}[\p{L}'’.-]+(?:\s+\p{Lu}[\p{L}'’.-]+)+$/u.test(n))
        .filter((n) => !(it.teamMembers ?? []).some((m) => (m.Name || '').trim() === n)),
    })
  }
  return pages
}

/** What a reader sees: no scripts (the hydration data), no styles, no tags. */
function visible(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<head>[\s\S]*?<\/head>/, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SECTIONS = ['hero', 'who', 'intel', 'language', 'usecases', 'proof', 'migration', 'cta']

async function check(p: { path: string; key: string | null; competitor: string | null; people: string[] }): Promise<string[]> {
  const problems: string[] = []
  let res: Response
  try {
    res = await fetch(`${BASE}${p.path}`, { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {}, redirect: 'manual' })
  } catch (e) {
    return [`fetch failed: ${(e as Error).message}`]
  }
  if (res.status !== 200) return [`HTTP ${res.status}`]
  const html = await res.text()
  if (!/class="www-page[^"]*\bwww-ap\b/.test(html)) return ['not the agent platform page']
  // Pages in WITHOUT_WHO_WE_ARE (Google) leave "Who we are" out, and must not show it.
  const expected = showsWhoWeAre(p.key) ? SECTIONS : SECTIONS.filter((id) => id !== 'who')
  const missing = expected.filter((id) => !new RegExp(`<section id="${id}"`).test(html))
  if (!expected.includes('who') && /<section id="who"/.test(html)) problems.push('shows Who we are, which this page leaves out')
  if (missing.length) problems.push(`missing sections: ${missing.join(', ')}`)
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
  if (!title.startsWith('Optimizely agent platform · Personalized for ')) problems.push(`title: ${title}`)
  const band = html.match(/<div[^>]*class="www-close-band"[\s\S]*?<\/button><\/div>/)?.[0] ?? ''
  if ((band.match(/<(a|button)\b/g) ?? []).length !== 1) problems.push('the close does not have exactly one CTA')
  const text = visible(html)
  // The account's own name is not a competitor or a stakeholder mention (pages built for Sitecore,
  // WordPress; accounts named after a person, such as Sam Edelman).
  const account = (html.match(/class="www-account__label">Personalized for ([^<]+)</)?.[1] ?? '').replace(/&amp;/g, '&').toLowerCase()
  const isAccount = (n: string) => !!account && (account.includes(n.toLowerCase()) || n.toLowerCase().includes(account))
  for (const bad of ['undefined', 'NaN', '[object Object]', 'null null'])
    if (new RegExp(`(^|[^A-Za-z])${esc(bad)}([^A-Za-z]|$)`).test(text)) problems.push(`shows "${bad}"`)
  if (p.competitor && p.competitor.length >= 3 && !isAccount(p.competitor) && new RegExp(`(^|[^A-Za-z0-9])${esc(p.competitor)}([^A-Za-z0-9]|$)`, 'i').test(text))
    problems.push(`names the competitor "${p.competitor}"`)
  for (const name of p.people.filter((n) => !isAccount(n)))
    if (new RegExp(`(^|[^A-Za-z])${esc(name)}([^A-Za-z]|$)`).test(text)) problems.push(`names a stakeholder (${name.split(/\s+/)[0]} …)`)
  return problems
}

const all = await listPages()
let pages = all
if (SAMPLE && SAMPLE < all.length) {
  // A spread across the list (newest to oldest), not just the newest.
  const step = all.length / SAMPLE
  pages = Array.from({ length: SAMPLE }, (_, i) => all[Math.floor(i * step)])
}
console.log(`${pages.length} of ${all.length} live account pages against ${BASE}`)

const failures: Array<{ path: string; problems: string[] }> = []
let done = 0
const queue = [...pages]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const problems = await check(p)
      if (problems.length) failures.push({ path: p.path, problems })
      if (++done % 100 === 0) console.log(`  ${done}/${pages.length} checked, ${failures.length} with problems`)
    }
  }),
)

const byProblem = new Map<string, string[]>()
for (const f of failures)
  for (const pr of f.problems) {
    const k = pr.replace(/"[^"]*"|\([^)]*\)/g, '…')
    byProblem.set(k, [...(byProblem.get(k) ?? []), f.path])
  }
console.log(`\n${pages.length - failures.length} of ${pages.length} pages pass`)
for (const [k, paths] of byProblem) console.log(`  ${paths.length} × ${k}: ${paths.slice(0, 8).join(' ')}${paths.length > 8 ? ' …' : ''}`)
fs.writeFileSync(path.join(process.env.SMOKE_OUT || '/tmp', 'smoke-live-pages.json'), JSON.stringify(failures, null, 2))
process.exit(failures.length ? 1 : 0)
