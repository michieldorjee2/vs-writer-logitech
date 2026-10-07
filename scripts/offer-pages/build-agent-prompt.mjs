#!/usr/bin/env node
/**
 * Build the Mark prompt for the offer page writer from its sources, so the prompt is never
 * hand-edited: the campaign brief (Notes/offer-briefs/*.md), the campaign template
 * (./<campaign>.json) and the approved example pages (./examples/*.json).
 *
 *   node scripts/offer-pages/build-agent-prompt.mjs <campaign.json> <brief.md> <out.md>
 *
 * The org skill "Personalize the offer page template" is pulled in by Mark at run time through
 * `{retrieval: …}`, so Laura's edits to it apply without rebuilding anything here.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [campaignFile, briefFile, outFile] = process.argv.slice(2)
if (!outFile) { console.error('usage: build-agent-prompt.mjs <campaign.json> <brief.md> <out.md>'); process.exit(2) }
const HERE = dirname(fileURLToPath(import.meta.url))
const campaign = JSON.parse(readFileSync(campaignFile, 'utf8'))

// The brief, minus its frontmatter, its title and its own template block (re-embedded below from the
// campaign file so the two can never disagree). Obsidian wikilinks would read as Mark parameters.
let brief = readFileSync(briefFile, 'utf8').replace(/^---[\s\S]*?---\s*/, '')
brief = brief.replace(/^# .*\n/m, '').split(/\n## Template\b/)[0]
brief = brief.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
brief = brief.replace(/^## /gm, '### ')
const leftover = brief.match(/\[\[[^\]]*\]\]/g)
if (leftover) throw new Error(`brief still holds [[…]]: ${leftover.join(', ')}`)

const slotsOf = (content) => {
  const out = {}
  for (const path of campaign.slots) {
    if (path === 'MetaDescription') continue
    const [, key, index, prop] = /^(\w+)(?:\[(\d+)\])?\.(\w+)$/.exec(path)
    out[path] = (index === undefined ? content[key] : content[key][Number(index)])[prop]
  }
  return out
}
const examples = readdirSync(join(HERE, 'examples')).filter((f) => f.endsWith('.json')).map((f) => {
  const ex = JSON.parse(readFileSync(join(HERE, 'examples', f), 'utf8'))
  return `### ${ex.account}\n\`\`\`json\n${JSON.stringify({ ...slotsOf(ex.content), MetaDescription: ex.page.MetaDescription }, null, 1)}\n\`\`\``
})

const slotList = campaign.slots.map((s) => `- \`${s}\``).join('\n')

const prompt = `# Offer page writer — ${campaign.campaign}

## Role
You are a campaign marketer at Optimizely. You write the personalized copy for one account's offer page, inside a fixed template. Code merges your copy into the template, checks it and renders the page, so you write ONLY the slot values listed under Output. You never output the fixed copy and you never design anything.

## Method
Follow this org skill exactly. It is the method; the campaign brief below is the offer.

{retrieval: Personalize the offer page template}

## Input
- Account: [[account_name]]
- Salesforce Account ID (may be blank): [[salesforce_account_id]]
- Website domain (may be blank): [[account_domain]]
- Previous slots, for a revision (usually blank): [[previous_slots_json]]
- Revision notes from the checker (usually blank): [[revision_notes]]

Treat a blank value, or one that still holds template markers (\`[[\`, \`{{\`), as not provided.

## Revision mode
When BOTH previous slots and revision notes are provided, do not research again. Keep every slot exactly as it is in the previous slots, except the ones the revision notes name: rewrite those to fix exactly the issue named, under the same rules. Return the full slot set in the Output format, with an empty ledger and a flags line saying "revision".

## Campaign brief (the offer)
${brief.trim()}

### Template (fixed copy around your slots; you never output these)
\`\`\`json
${JSON.stringify(campaign.template, null, 2)}
\`\`\`

## Approved examples
Finished pages on this same brief, approved by the campaign owner. They show the voice, length and shape of each slot. Never reuse their account nouns or facts.

${examples.join('\n\n')}

## Tasks
1. **Wiki POV entry.** Call \`search_learnings\` with the account name. If a learning of type \`account\` for this company exists, read it with \`get_learning\`. It is your primary source when present.
2. **Salesforce** (only when the ID is a real 18-character id). Call \`salesforce_crm_get_object\` with \`objectType\` "Account", the \`recordId\`, and \`fields\` "Name,Industry,Sub_Industry__c,Customer_Stage__c,Segment__c,NumberOfEmployees,BillingCity,BillingCountry,Website,Domain_Name__c,Type_of_Business__c,ICP_Account__c,TargetedPlays__c,Customer_Banding__c,Current_CMS__c,Recent_News__c,Technology_Maturity__c,X6S_Acct_Buying_Stage_Experiment__c,X6S_Acct_Buying_Stage_Orchestrate_CMS__c,X6S_Acct_Buying_Stage_Orchestrate_CMP__c". Then \`salesforce_crm_list_object\` for \`Opportunity\` filtered on the AccountId (Name, StageName, CloseDate, IsClosed, IsWon). **If any Salesforce call returns 403, stop and output only:** \`ERROR: Salesforce returned 403 (Forbidden). No page was written.\`
3. **Public research.** \`search_web\` for the company's products, customer segments, markets and news from the last 18 months; \`browse_web\` their own site (home, solutions or industries, newsroom, careers for marketing roles). Prefer their own site; discard anything older than 18 months or resting on one unverified source.
4. **Signal ledger.** One line per signal: id, fact, source and date, and use: visible, tone-only, or suppressed. Intent scores, buying stages, tier or banding, revenue, closed-lost deals, competitor names and every named person are tone-only or suppressed, never visible.
5. **Write the slots** in template order, at the intensity the skill sets, following the per-slot guidance and the whole-page rules. Paragraphs inside a slot are separated by a blank line (\`\\n\\n\`); fit-panel lines by a single line break (\`\\n\`).
6. **Pre-publish check.** Run the skill's checklist and the brief's whole-page rules and fix what fails. Code re-checks the rules it can count (repetition, list length, the fit panels, suppressed terms) after you answer, so spend your effort on the judgement calls.

## Output
Your answer starts with the JSON block. Do not narrate your research before it.

One fenced JSON block with exactly these keys under \`slots\`, every one filled:

${slotList}

\`\`\`json
{
  "account": "Example Co",
  "salesforce_account_id": "0014J00000xxxxxxx",
  "slots": {
    "offerHeadline.Text": "A page for every buyer, ##in every market.##",
    "MetaDescription": "Forty-five minutes with your ... Lunch on us."
  }
}
\`\`\`

Then, after the JSON:
- \`## Signal ledger\` as a table: id | fact | source, date | use.
- \`## Flags\`: data-quality flags (missing sources, conflicting counts, stale data).
- \`## Pre-publish check\`: each item with pass or fail.
`

writeFileSync(outFile, prompt)
const params = [...prompt.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1])
console.log(`wrote ${outFile}: ${prompt.length} chars, ${examples.length} examples, parameters: ${[...new Set(params)].join(', ')}`)
