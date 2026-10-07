#!/usr/bin/env node
/**
 * Offer pages: the code half of "Mark writes the slots, code does the rest".
 *
 * The offer page writer (Mark agent `limitless_offer_page_writer`) returns ONLY the personalized
 * slot values. This script merges them into the campaign template and checks them, so Mark never
 * re-types fixed copy and never has to grade its own work: on Airwallex (2026-10-07) the agent's
 * self-check passed "a signal appears in at most two blocks" while "SaaS" sat in three.
 *
 *   node scripts/offer-pages/slots.mjs merge <campaign.json> <agent-response.md|json> <out.json>
 *   node scripts/offer-pages/slots.mjs check <campaign.json> <page.json> [--deny "Name One,Name Two"]
 *
 * `merge` writes {account, page, content} — the shape `create-sample-page.mjs --content-json` takes.
 * `check` prints one line per violation, each naming the slot and the fix, and exits 1 if any.
 * The violations are written to be pasted back to the agent as revision notes.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [cmd, campaignFile, inputFile, ...rest] = process.argv.slice(2)
if (!cmd || !campaignFile || !inputFile) {
  console.error('usage: slots.mjs merge <campaign.json> <response> <out.json> | check <campaign.json> <page.json> [--deny "A,B"]')
  process.exit(2)
}
const campaign = JSON.parse(readFileSync(campaignFile, 'utf8'))

/** `aboutPillars[2].Description` -> ['aboutPillars', 2, 'Description']. */
function parsePath(path) {
  const m = /^(\w+)(?:\[(\d+)\])?\.(\w+)$/.exec(path)
  if (!m) throw new Error(`not a slot path: ${path}`)
  return [m[1], m[2] === undefined ? null : Number(m[2]), m[3]]
}
function node(content, key, index) {
  return index === null ? content[key] : content[key]?.[index]
}

/** The agent answers in markdown around one fenced JSON block; take the block. */
function readSlots(file) {
  const raw = readFileSync(file, 'utf8')
  const fenced = /```json\s*(\{[\s\S]*?\})\s*```/.exec(raw)
  return JSON.parse(fenced ? fenced[1] : raw)
}

function merge() {
  const out = rest[0]
  const answer = readSlots(inputFile)
  const { account, slots } = answer
  const fill = (v) =>
    typeof v === 'string' ? v.replaceAll('{account}', account)
      : Array.isArray(v) ? v.map(fill)
        : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]))
          : v
  const content = fill(structuredClone(campaign.template))
  const problems = []
  for (const [path, value] of Object.entries(slots)) {
    if (path === 'MetaDescription') continue
    if (!campaign.slots.includes(path)) { problems.push(`${path}: not a slot of this template; ignored`); continue }
    const [key, index, prop] = parsePath(path)
    node(content, key, index)[prop] = value
  }
  const unfilled = [...JSON.stringify(content).matchAll(/<<WRITE ([^>]+)>>/g)].map((m) => m[1])
  for (const path of unfilled) problems.push(`${path}: not written`)
  if (!slots.MetaDescription) problems.push('MetaDescription: not written')
  const page = { PageTitle: campaign.pageTitle.replaceAll('{account}', account), MetaDescription: slots.MetaDescription }
  writeFileSync(out, JSON.stringify({ account, salesforceAccountId: answer.salesforce_account_id ?? null, page, content }, null, 1))
  console.log(`merged ${Object.keys(slots).length} slot(s) for ${account} -> ${out}`)
  for (const p of problems) console.log(`  ! ${p}`)
  process.exit(problems.length ? 1 : 0)
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

const BLOCK_OF = [
  ['offerClose', 'sign-up'], ['offer', 'hero'], ['about', 'who-is-optimizely'], ['problem', 'opportunity'],
  ['proof', 'proof'], ['outcomes', 'outcomes'], ['fit', 'what-this-means'], ['faq', 'questions'],
]
const blockOf = (key) => BLOCK_OF.find(([prefix]) => key.startsWith(prefix))?.[1] ?? key

/** Capitalised words the template and the brief use everywhere; never an account signal. */
const COMMON = new Set(`Optimizely Limitless Diligent John Habib CRM ABM SDR AI Use Always Book Lunch Who Which Where What How Can Does
Do Yes No Every Each Now So Pages Their Your You It The A An Forty Same Name Straight Written Built Agents Pick Some Nothing
Senior Director Content Strategy Customer Bring We Thousands Four Multiple One Several Hand Without And Make See If Only
Hundreds In Our That Then Start More Labs Not Both For Fortune`.split(/\s+/))

/** Terms the brief keeps off every page, whatever the account. */
const ALWAYS_SUPPRESSED = [/6sense/i, /\b6QA\b/i, /intent score/i, /buying stage/i, /closed[- ]lost/i, /\btier [0-9]\b/i, /\bbanding\b/i, /\bARR\b/, /\$\s?\d/]

function slotTexts(content, campaign) {
  const out = []
  for (const path of campaign.slots) {
    if (path === 'MetaDescription') continue
    const [key, index, prop] = parsePath(path)
    const v = node(content, key, index)?.[prop]
    if (typeof v === 'string') out.push({ path, block: blockOf(key), text: v })
  }
  return out
}

function check() {
  const page = JSON.parse(readFileSync(inputFile, 'utf8'))
  const { content, account } = page
  const denyIdx = rest.indexOf('--deny')
  const deny = denyIdx >= 0 ? rest[denyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean) : []
  const v = []
  const slots = slotTexts(content, campaign)

  // 1. The hero carries exactly one emphasis run.
  const runs = (content.offerHeadline?.Text.match(/##/g) ?? []).length / 2
  if (runs !== 1) v.push(`offerHeadline.Text: needs exactly one ##run## (found ${runs})`)

  // 2. Fit panel 1: four statements, the last one the capacity gap.
  const fit = (content.fitYes?.CalloutText ?? '').split('\n')
  if (fit.length !== 4 || fit.some((l) => !l.startsWith('✓ ')))
    v.push(`fitYes.CalloutText: needs exactly four lines, each starting "✓ " (found ${fit.length})`)
  if (!/worth personaliz\w* than|more .{0,60} than .{0,40}(write|bandwidth|people|hours)/i.test(fit.at(-1) ?? ''))
    v.push('fitYes.CalloutText: line 4 must be the capacity gap ("have more … worth personalizing than … to write for them")')

  // 3. Fit panel 2: the four personalization tiers, in order.
  const tiers = (content.fitNo?.CalloutText ?? '').split('\n')
  const want = [/^→ an? [^:]+:/, /^→ an account:/, /^→ an opportunity:/, /^→ a contact:/]
  if (tiers.length !== 4 || want.some((re, i) => !re.test(tiers[i] ?? '')))
    v.push('fitNo.CalloutText: needs four lines: "→ a {segment unit}: …", "→ an account: …", "→ an opportunity: …", "→ a contact: …"')

  // 4. No list you write names more than five items; Laura's approved pages top out at five.
  //    Items are comma-separated (house style is the Oxford comma), so "cell and gene therapy" is
  //    one item; a closing "and more" is not one. Template patterns are exempt.
  for (const { path, text } of slots) {
    if (campaign.templatePatterns?.includes(path)) continue
    for (const sentence of text.split(/(?<=[.:])\s+|\n/)) {
      const items = sentence.split(/,\s*/).filter((it) => !/^(and |or )?more\b/i.test(it.trim()))
      if (items.length > 5) v.push(`${path}: a list of ${items.length} items; name at most five, ideally four ("and more" is fine)`)
    }
  }

  // 5. A signal appears in at most two blocks.
  const seen = new Map()
  const own = new Set(account.split(/\s+/))
  for (const { block, text } of slots) {
    for (const m of text.matchAll(/\b([A-Z][A-Za-z0-9-]+)/g)) {
      const w = m[1]
      if (COMMON.has(w) || own.has(w) || w.length < 3) continue
      if (!seen.has(w)) seen.set(w, new Set())
      seen.get(w).add(block)
    }
  }
  for (const [w, blocks] of seen) {
    if (blocks.size > 2) v.push(`"${w}" appears in ${blocks.size} blocks (${[...blocks].join(', ')}); keep it to the two that matter most`)
  }

  // 6. Suppressed terms never appear: the brief's list plus the account's own deny-list (CRM names).
  for (const { path, text } of slots) {
    for (const re of ALWAYS_SUPPRESSED) if (re.test(text)) v.push(`${path}: contains a suppressed signal (${re})`)
    for (const name of deny) if (name && text.includes(name)) v.push(`${path}: names "${name}", who must stay off the page`)
  }

  // 7. Every slot is written.
  for (const { path, text } of slots) if (!text.trim() || text.includes('<<WRITE')) v.push(`${path}: not written`)
  if (!page.page?.MetaDescription) v.push('MetaDescription: not written')

  if (v.length === 0) { console.log(`ok — ${account}: ${slots.length} slots pass every check`); process.exit(0) }
  console.log(`${v.length} issue(s) for ${account}:`)
  for (const line of v) console.log(`- ${line}`)
  process.exit(1)
}

if (cmd === 'merge') merge()
else if (cmd === 'check') check()
else { console.error(`unknown command ${cmd}`); process.exit(2) }
