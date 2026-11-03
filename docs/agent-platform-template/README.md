# Agent platform template: what the agents need to change

**Status: draft, not deployed.** Nothing in this folder has been applied to Mark, the wiki or the CMS. It is the proposal that goes with the agent platform template in `src/www/AgentPlatformPage.tsx` (preview: any account page with `?design=www`).

The template is Laura Perez Riau's, built from Dan Tranter's pitch and debriefed on 27 October 2026 (Mark artifact "limitless-agent-platform-template-debrief-for-michiel.md", with the Tyler Technologies reference build). It presents Optimizely as the layer on top of the stack an account already runs, in eight sections: hero, who we are, where it fits, speaks your language, use cases, proof, first 90 days, close.

## What works today without any agent change

The renderer reads one shape, `AgentPlatformContent` (`src/www/agent-platform/content.ts`). For now `fromLegacyPage()` fills it from the 2,000+ pages Mark has already written, so every existing page gets the new structure without a rebuild. It uses only what the stored page holds:

| Part of the page | Today (from the stored page) | Waits for the agents |
|---|---|---|
| Lifecycle state | Customer if Optimizely is in the stored stack or stats, else prospect | Open opp, previously evaluated, ex-customer (Agent 1) |
| Hero fact pills, homework facts (one per scene) | `intelStats`, minus traffic figures (N8) and stats about Optimizely | A visible source per fact (N6) |
| "Our homework" on each use case | The stored stack tools and investments behind that theme, in their stored wording | Observed lines with a public source |
| Teams layer, "Built for" | Role groups from `stakeholders` (names never shown, N3), else an industry default | Persona groups from Salesforce contacts |
| Stack layer | `techStack`; the replaced platform and its category shown by category only (N2) | The 12-month, primary-domain stack pull |
| Use-case ranking | Stack and stated investments only | The full five-theme score: 6QA, stage, intent, opps, seller override |
| Industry question, job lines, observed lines | The lead theme's generic copy; observed lines left out | Written in the account's own terms, with sourced public facts |
| Named rep | `teamMembers`, only for open opp or customer | AE resolution rule N4 (opp owner first) |
| Proof | Track A for prospects, B otherwise, from the fixed library | Peer-proof level per account |

`?review=1` on a page shows this provenance for every part, and lets a reviewer switch the state (`?state=prospect|open-opp|evaluated|customer|ex-customer`). That layer never renders without the parameter (rule N12).

Ten of the 67 stored fields feed the template (`USED_FIELDS` in `content.ts`); the other 57 are deliberately not shown, each with the rule that keeps it off (`NOT_SHOWN`). Two of those, `eyebrow` and `intelHeadline`, are still read for the account's name. A unit test fails if any field is in neither list. Nothing is deleted: the fields stay in the CMS untouched and `?template=takeout` still renders every one of them.

## Changes after Michiel's review (2 November 2026)

- **One closing CTA.** Laura's state table had two ("Explore the agent platform" as the second). The close now has only the one-click ask; scheduling and the contact are in the panel it opens.
- **Homework through the page.** The facts after the hero's three are no longer a block in one section: one sits in each of where it fits, use cases, proof and the first 90 days. The stack, the investments and each use case carry the same "Our homework" tag. Agent 2's `stats` field feeds these, so the output contract is unchanged.
- **Hero.** Full screen at 75% of the window, the account logo above the headline, "Personalized for" said once.

## Edit mode on this template (live since 2 November 2026)

Most of this page is template copy, the same on every page, which no page field can change. Edit mode (the booth's `?search=1` sidebar) therefore offers only the parts a stored field drives, and says in each comment popup what the part is made of (`AGENT_PLATFORM_EDIT` in `src/lib/xray-defaults.ts`):

| Part | Fields |
|---|---|
| Account logo | `customerLogo` |
| Account facts (hero pills, and one per section further down) | `intelStats` |
| Agents at work, What they run today | `techStack` |
| Their teams | `stakeholders` (roles only) |
| Where they're investing | `investments` |
| Use cases | `techStack`, `investments` (the ranking and the "Our homework" lines) |
| Account team | `teamMembers` |
| Small print | `footerTagline`, `footerLegal` |

The request to Mark opens with "Page template: agent platform" and lists each commented part's fields (`src/lib/edit-payload.ts`). Mark's live-edit agent (`account_page_live_edit`, v1.4.3) knows this template, skips template copy with a reason, and sends each edit's `field` with its full new `value`. The page re-renders from that value while Mark works (`src/www/live-edit.ts`), so every place the field shows changes together; the rest of the page dims around the part in focus, and each changed element glows once. Mark's single `update_page` is still the save. Once Graph has it (Edit mode watches `lastModified`: Graph keeps `published` at the first publish date), Edit mode reads the saved page and replays, part by part, any change Mark saved without narrating it, then reloads. Mark often narrates only after saving, and once (v1.4.2, an instruction to narrate first) not at all, so the replay is what guarantees the spotlight and the live change.

## The three drafts

- [Agent 1: signal resolver](agent-1-signal-resolver.md). What the Gather step adds to the dossier's Account state, and the deterministic code-step logic for routing, state, scoring and the stack.
- [Agent 2: page builder](agent-2-page-builder.md). How the `limitless_account_page` prompt (`7b231bbf-d7eb-46b3-994c-46bca43dc0fd`) changes for this template, and its output contract.
- [Storage](storage.md). Where the new page's content lives, given that `CompetitorComparisonPage` is frozen.

## Order of work

The order keeps every step reversible and keeps the 2,000+ live pages untouched until the last step.

1. Agent 1 writes the new Account state fields into the dossier. Pages do not change; the review layer can start reading the real state.
2. The storage blueprint is registered. Nothing writes to it yet.
3. Agent 2 gets the agent platform path, run by hand on the three preview accounts (Carhartt, Tyler Technologies, CDW) and compared against Laura's gates.
4. The renderer reads the stored agent output when it exists and falls back to `fromLegacyPage()` when it does not. Only then does the route stop being opt-in.

Re-running Mark over every account is not part of this. Pages move to agent-written content one at a time, as they come up for refresh.
