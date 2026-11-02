# Storage for agent-written content (proposal)

**Status: proposal, needs sign-off.** Nothing has been registered in the CMS.

`CompetitorComparisonPage` is frozen: 67 properties, about 2,800 pages, and the takeout template still reads every one of them. Adding agent platform fields to it would change a content type that thousands of live pages depend on, so the new content goes somewhere else.

## Proposal: an `agent-platform` ABMExperience blueprint

The offer pages already store agent-written content as `ABMExperience` items built from a blueprint (`src/cms/blueprints/offer.ts`), read back by `readOffer()`. The same pattern fits here: a blueprint whose slots are the fields in the agent's output contract, one experience per account, keyed by `crm_account_id`.

The account's existing `CompetitorComparisonPage` stays where it is, at the same route. The renderer looks up the account's agent platform record by Salesforce id; when one exists it renders that, and when none exists it falls back to `fromLegacyPage()`. Either way the URL the account was sent does not change.

| Slot | Type | From |
|---|---|---|
| `crm_account_id` | string | Account state |
| `state`, `themes`, `theme_band`, `proof_track` | string, string list | Account state (Agent 1) |
| `question`, `jobs`, `observed` | text, keyed by theme | Agent 2 |
| `pills`, `stats`, `stats_source`, `priorities`, `quote` | text and links | Agent 2, from `public_facts` |
| `teams`, `stack`, `rep` | lists | Account state (Agent 1) |
| `review` | JSON | Both agents: the reasons behind each choice, shown only with `?review=1` |

## Alternatives considered

**One JSON field on the existing page.** Smallest change, but it is still a change to the frozen type, and a JSON blob cannot be edited in the CMS UI.

**A new page type at a new route.** Clean, but every link already sent to an account would point at the old page.

## Open questions for the decision

- Does the experience carry its own route, or is it only looked up by account id from the existing route?
- Who may edit it in the CMS, given that Agent 2 rewrites it on refresh?
- Does Edit mode's feedback go to Agent 2 on this template? Today Edit mode sends feedback to Mark against the takeout fields, which this template mostly does not show.
