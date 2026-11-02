# Agent 2: page builder (draft)

**Status: draft, not deployed.** The live agent is `limitless_account_page` (`7b231bbf-d7eb-46b3-994c-46bca43dc0fd`, "Limitless ABM account page (wiki)"). Its prompt today writes every section of a `CompetitorComparisonPage` against one named competitor. This draft adds a second path for the agent platform template. The takeout path stays as it is.

## What changes in the prompt

**Goal and Reading Account state.** The agent reads `template_route` from Account state. `takeout` keeps today's flow. `agent-platform` takes the new path below. `none` stops with the existing "no dossier" style of report. The rule "Do not re-derive it" now also covers the lifecycle state, the theme ranking, the stack tiles, the named rep and the role groups.

**A smaller writing job.** On this template most of the page is fixed copy that the renderer owns (who we are, the platform layer, the proof library, the 90-day plan, the five themes' generic lines, the state headlines and CTAs). The agent writes only what has to be about the account, which is also where personalization actually shows:

| Field | What to write | Limit |
|---|---|---|
| `question` | The leadership question for the lead theme, in the account's own business terms (Tyler: justice and public safety) | 120 chars |
| `jobs[theme]` | For the two lead themes: the job line in the account's language ("One content engine for every county you serve") | 70 chars |
| `observed[theme]` | For the two lead themes: one public fact that shows the need, with its source from `public_facts`. No fact, no line | 160 chars |
| `pills` | Up to three public scale facts from `public_facts` | 32 chars each |
| `stats` | Up to four homework facts not used in the pills, with one source line. The page shows one per scene (where it fits, use cases, proof, first 90 days), so each should stand on its own | 24 chars each |
| `priorities` | Up to four priority chips from news under 12 months | 40 chars each |
| `quote` | Optional: one executive quote, verbatim, with source URL | 220 chars |

Everything else on the page comes from Account state (state, themes, stack, rep, role groups) or the template.

**Section ids for `withheld_sections`.** The new path's ids are the renderer's scene ids: `hero`, `who`, `intel`, `language`, `usecases`, `proof`, `migration`, `cta`. A withheld section is left out of the output; the renderer drops a scene with nothing in it.

**Rules.** Laura's rules become hard constraints on this path, and the agent checks them before writing:

- N1: no incumbent framing. Nothing is "replaced"; the stack is what the platform sits on.
- N2: competitors appear by category only ("your CMS"), in copy and in the page title and description.
- N3: roles only. No stakeholder names, anywhere.
- N6: every account fact carries a visible source. N7: news under 12 months. N8: no traffic figure without a public source.
- N9: proof is agent platform proof only. The renderer owns the proof library; the agent does not pick testimonials.
- N12: the review layer is never part of the output.
- N14: the agent's own copy stays under 250 words, so the page stays under 750.
- One closing CTA: the close has only the one-click ask (Michiel, 2 November 2026). The agent writes no second CTA.
- The swap test from gate 4: if another company's name could replace the account's and every line still held, rewrite the question, the job lines and the observed lines.

**Write step.** Instead of `create_page` for `CompetitorComparisonPage`, the path writes the agent platform blueprint (see [storage](storage.md)), one record per account, keyed by `crm_account_id`. The existing takeout page at the account's route is not touched. The final output block stays the same.

## Output contract

The agent's output is the account-specific part of `AgentPlatformContent` (`src/www/agent-platform/content.ts`). The renderer already reads that shape, so the day this is stored, `fromLegacyPage()` becomes the fallback and nothing else in the renderer changes.

```json
{
  "crm_account_id": "001...",
  "account": "Tyler Technologies",
  "state": "open-opp",
  "themes": ["content-ops", "optimization", "geo", "personalization", "analytics"],
  "question": "Which justice and public safety programs need content first, and where are we behind?",
  "jobs": {
    "content-ops": "One content engine for every county and city you serve",
    "optimization": "Test every product page your clients start from"
  },
  "observed": {
    "content-ops": { "text": "Clients range from a county of 71 residents to one of 9.7 million.", "href": "https://www.tylertech.com/Portals/0/Tyler-Fast-Facts-2025.pdf" }
  },
  "pills": ["50,000+ installations", "16,000 client locations", "All 50 states"],
  "stats": [{ "value": "98%", "label": "client retention" }],
  "statsSource": { "label": "Tyler Fast Facts 2025", "href": "https://www.tylertech.com/Portals/0/Tyler-Fast-Facts-2025.pdf" },
  "priorities": ["Cloud transition", "AI strategy", "Payments platform"],
  "quote": { "text": "...", "who": "CEO, Q3 2025 earnings release", "href": "https://www.sec.gov/..." },
  "teams": ["Marketing leadership", "Marketing operations and data", "AI and automation"],
  "stack": [{ "label": "Treasure Data", "category": "Customer data" }, { "label": "Your marketing automation", "category": "Marketing automation" }],
  "rep": { "named": [{ "name": "...", "role": "Senior Enterprise AE", "email": "..." }] }
}
```

The example values for Tyler come from Laura's build and her public-facts table. `quote.text` is left as a placeholder here on purpose: it must be copied verbatim from the source, never retyped.

## Not in this draft

The update path (Task 1-lite) works the same way on the new path: re-read the dossier, rewrite only the fields whose inputs changed. It is not written out yet because it depends on how storage versions the record.
