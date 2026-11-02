# Agent 1: signal resolver (draft)

**Status: draft, not deployed.**

Agent 1 is the Gather step that keeps each account's wiki dossier current (`get_learning` with `salesforce-account:<id>`). The page builder reads the dossier's **Account state** section and is told never to re-derive it. Every decision Laura made by hand for the Tyler build is a decision about Account state, so this is where the template's logic belongs.

All of it is measurement, not writing. It runs in a code step: deterministic, cheap, and the same answer every time. Mark writes copy from the result; it does not score.

## New Account state fields

These sit beside the fields Account state already carries (competitor, lead product, named-rep permission, CTA).

```yaml
template_route: agent-platform        # agent-platform | takeout | none (do not build)
route_reason: "No 'Takeout -' play in TargetedPlays__c"
lifecycle_state: open-opp             # prospect | open-opp | evaluated | customer | ex-customer
state_reason: "Open opp 2026-09-24 (New Customer); Ex-Customer stage is Ektron-era, 14 years old"
themes:                               # all five, ranked
  - { id: content-ops,     score: 116.2, why: "open opp +30, 6QA +40, Consideration +15, intent 56 → +11.2, reach High +10, news +10" }
  - { id: optimization,    score: 77.6,  why: "..." }
  - { id: geo,             score: 37.4,  why: "..." }
  - { id: personalization, score: 11.8,  why: "..." }
  - { id: analytics,       score: 0,     why: "..." }
theme_band: dual                      # single | dual | broad
proof_track: B                        # A (educational, no logos) | B (verified stories)
named_rep: { name: "...", role: "Senior Enterprise AE", source: "opp owner" }   # null when the state forbids it
role_groups: [Marketing leadership, Marketing operations and data, AI and automation]
stack:                                # at most 6, already reduced
  - { label: "Treasure Data", category: "Customer data", competitor: false, first_seen: 2026-09-30 }
  - { label: "Your marketing automation", category: "Marketing automation", competitor: true }
public_facts:                         # every one with a source and a date (N6, N7)
  - { text: "50,000+ installations", source: "Investor Day release", url: "https://...", date: 2026-06-09 }
guardrails: [...]                     # unchanged: never page copy
```

The five theme ids are the renderer's (`content-ops`, `personalization`, `geo`, `optimization`, `analytics`, in `src/www/agent-platform/library.ts`). Agent 1 names the theme; it never writes the theme's copy.

## Code-step logic

Each rule below is one of Laura's, from the Tyler debrief. They are written as plain functions so the step can be unit-tested on the three preview accounts before it runs anywhere else.

### Build gate and template route

```js
function route(acc) {
  if ((acc.Numberof6QASolutions__c ?? 0) < 1) return { route: 'none', reason: 'no 6QA solution' }
  const plays = (acc.TargetedPlays__c || '').split(';').map((p) => p.trim())
  const takeout = plays.some((p) => /^Takeout -/i.test(p))
  const liveCompetitor = acc.stack.some((t) => t.competitor && t.lastSeenDays <= 365)
  if (takeout && liveCompetitor) return { route: 'takeout', reason: 'Takeout play with a live competitor' }
  return { route: 'agent-platform', reason: takeout ? 'Takeout play but no live competitor' : "No 'Takeout -' play" }
}
```

A halt (no customer stage, no industry, no resolvable AE) stops the build and is reported, as today.

### Lifecycle state

```js
function lifecycle(acc) {
  if (acc.Customer_Stage__c === 'Active Customer') return 'customer'
  if (acc.openOpps.some((o) => !o.IsClosed)) return 'open-opp'
  // Ex-customer override: history older than ten years, or under another company name, reads as prospect.
  if (acc.Customer_Stage__c === 'Ex-Customer') return acc.lastWonYearsAgo <= 10 && !acc.renamedSince ? 'ex-customer' : 'prospect'
  if (acc.closedLost.some((o) => o.yearsAgo <= 3)) return 'evaluated'
  return 'prospect'
}
```

The state sets the hero look, the headline, whether a rep is named, the proof track and the two CTAs. All of that is renderer logic (`STATES` in `library.ts`); Agent 1 only supplies the state and the reason.

### Five-theme scoring

Per solution family, mapped to a theme, then the same rubric Laura applied by hand:

```js
const STAGE = { Decision: 25, Consideration: 15, Awareness: 5 }
function score(sol, acc) {
  let s = 0
  if (sol.is6QA) s += 40
  s += STAGE[sol.stage] ?? 0
  s += Math.round((sol.intent ?? 0) * 0.2 * 10) / 10
  if (sol.reach === 'High') s += 10
  if (acc.openOpps.some((o) => o.productFamily === sol.family)) s += 30
  if (acc.newsCorroborates(sol.family)) s += 10
  s += Math.min(20, acc.stackEvidence(sol.family) * 10)   // the renderer's interim rubric, kept as one term
  if (acc.sellerOverride === sol.theme) s += 50
  return s
}
// Band: lead/second ≥ 1.6 → single, ≥ 1.2 → dual, else broad. A tie goes to content-ops.
```

The weights for stage, override and the band thresholds are not in Laura's debrief and need her confirmation before this runs. The rest are hers.

### Stack reduction

The current pull fails on large accounts, so it changes in three ways. Competitors become their own query instead of being filtered out of one large pull. Only tools seen in the last 12 months on the primary domain count, and noise tags (mail, tracking pixels) are dropped. The result is reduced to six tiles: Optimizely products first, then named complementary tools, then one tile per competitor category. The renderer's `stackTiles()` already does the last step and the same function can run here.

### AE resolution (N4)

Opp owner when the page is tied to an open opp, then `Opal_AE__c`, then `Primary_Account_Executive__c`, then the account owner. `named_rep` is null unless the state is open-opp or customer.

### Role groups (N3)

Contacts are mapped to six role groups (marketing leadership, content and brand, digital experience, marketing operations and data, technology and architecture, AI and automation). Only the group names reach the page. When fewer than three groups resolve, the page uses the industry default. This is the same mapping as `roleGroup()` in `content.ts`.

### Public facts step

A new step, separate from the dossier's research, collects facts a stranger could check: a figure, a source name, a URL and a date. News older than 12 months is dropped (N7). Traffic figures such as MUV never appear without a public source (N8). Employee counts that disagree between sources are left out, as Laura did for Tyler.
