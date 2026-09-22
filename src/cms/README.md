# `src/cms` — the Visual Builder content model

This directory is the source of truth for the Showcase CMS content model: the content types,
the display templates, the experiences and the blueprints, all authored as TypeScript and
pushed by one idempotent script.

The API contract every file here obeys was measured against the live Showcase instance and is
recorded in [`../../../mcp-optimizely-cms/docs/cms-visual-builder-api.md`](../../../mcp-optimizely-cms/docs/cms-visual-builder-api.md).
Nothing here is inferred from documentation.

Applying the model for real turned up five constraints that document does not carry. Four are
additions and one is a correction; all five were measured the same way, by pushing at the live
instance and reading the result back:

| finding | where it is written down |
| --- | --- |
| a property `group` must already exist, or the whole content type 400s | `reconcilePropertyGroups` in `apply.ts` |
| a content type `description` is capped at 255 characters (a property's is not) | `validateContentType` in `property-builders.ts` |
| a node's `displaySettings` is `{displayTemplate, settings}`, **not** a flat map | `NodeDisplaySettings` in `client.ts` |
| a setting's `description`/`required` are accepted and then discarded | `storedDisplayTemplateProjection` in `display-template-transform.ts` |
| a blueprint `POST` is not immediately readable — the composition PATCH can 404 | `patchCompositionWithRetry` in `apply.ts` |

The third one is the correction, and it is the one to be careful with: settings put in the
wrong place are dropped with a `200`, not a `400`. See
[A node's `displaySettings` is not a flat map](#a-nodes-displaysettings-is-not-a-flat-map).

Component authors read [`COMPONENT-SPEC.md`](./COMPONENT-SPEC.md), not this file.

## Layout

```
src/cms/
  client.ts                        CMA client — auth, req(), typed endpoint helpers
  property-builders.ts             the only legal way to author an element property
  display-template-transform.ts    repo shape <-> CMS shape, plus the defaults registry
  display-template-transform.test.ts
  registry.ts                      auto-discovery (Vite eager globs + plain-Node readdir)
  apply.ts                         idempotent create-or-patch, with the frozen-type denylist
  COMPONENT-SPEC.md                what the component agents follow
  components/<kebab-case-of-key>/  one folder per content type
      content-type.ts              default-exports the content type definition
      display-settings.ts          default-exports an ARRAY of repo-shape display templates
      types.ts                     the props interface
      DIVERGENCE.md                only when the component diverges from upstream
      index.tsx                    Phase 1 renderer — absent for all of Phase 0
  experiences/<name>.ts            default-exports a content type definition (_experience)
  sections/<name>.ts               default-exports a content type definition/patch (_section)
  sections/<name>-display.ts       default-exports an ARRAY of repo-shape display templates
  layout/<name>-display.ts         the row / column display templates, same array shape
  blueprints/<name>.ts             default-exports a BlueprintDefinition
```

Every directory is optional: discovery returns an empty list for one that does not exist yet,
and `apply.ts` then has nothing to do.

### The five discovery paths

`registry.ts` globs five things, and the split matters because a file in the wrong place is
simply never applied:

| path | what it must default-export | becomes |
|---|---|---|
| `components/*/content-type.ts` | a `ContentTypeDefinition` | a content type |
| `components/*/display-settings.ts` | `RepoDisplayTemplate[]` | display templates |
| `experiences/*.ts` | a `ContentTypeDefinition` | a content type |
| `sections/*.ts` (not `*-display.ts`) | a `ContentTypeDefinition` | a content type |
| `sections/*-display.ts`, `layout/*.ts` | `RepoDisplayTemplate[]` | display templates |
| `blueprints/*.ts` | a `BlueprintDefinition` | a blueprint |

Two rules keep this honest:

- **`index.ts` is skipped everywhere.** A barrel that re-exports a sibling as its default
  would otherwise be discovered twice under the same id and inflate every count.
- **The globs are single-level and do not descend.** Helper modules live in `internal/`,
  which is why `blueprints/internal/` is invisible to discovery.

A section type is normally a **patch**, not a creation: `BlankSection` already exists on the
instance, so `sections/blank-section.ts` deliberately omits `displayName` and `description`
and asks only for `compositionBehaviors: ['sectionEnabled']`. That is why `readSection` does
not require a `displayName` the way `readExperience` does — supplying one would re-title a
type the CMS ships.

## Running apply

```bash
npm run cms:apply:dry     # read-only plan: what would be created or patched
npm run cms:apply         # reconcile
```

or directly, which is what the npm scripts do:

```bash
npx tsx src/cms/apply.ts --dry-run
npx tsx src/cms/apply.ts
```

It prints a table of `created` / `patched` / `unchanged` / `planned` / `refused` / `failed`
and exits non-zero if anything failed or was refused. It is safe to run repeatedly: a second
run on an unchanged model reports everything as `unchanged` and issues no writes.

Run the transform's unit test with:

```bash
npx tsx src/cms/display-template-transform.test.ts
```

## How apply.ts decides

For every discovered item it **reads before it writes**. Re-POSTing an existing key is a `409`
(`A content type with the key '…' already exists.`), so there is no blind POST anywhere:

| state | action |
| --- | --- |
| `GET` returns 404 | `POST` to create |
| `GET` returns 200 and the desired state is a deep subset of the remote state | `unchanged`, no request |
| `GET` returns 200 and something differs | `PATCH` with `application/merge-patch+json` |

`PUT` is a `405` on both the content-type and the blueprint surfaces, so PATCH is the only
update verb.

Blueprint keys are deterministic: `blueprintKeyFor(blueprintId)` is `md5(blueprintId)` in
GUID form. A supplied key is honoured by the API, so the same `blueprintId` always resolves to
the same blueprint and creation is idempotent with no lookup.

### Phase order is load-bearing

```
property groups -> content types (+ sections, experiences) -> display templates -> blueprints
```

Each arrow is a hard dependency measured as a `400`, not a preference:

- A property whose `group` names a group that does not exist fails the **whole** content type
  with `InvalidPropertyGroup`, so the groups go first. `apply.ts` collects every group the
  authored definitions reference and creates the missing ones through
  `POST /preview3/propertygroups`. Groups are created, never renamed and never deleted —
  other content types on the instance already point at them.
- A display template naming a `contentType` that does not exist is `InvalidContentType`.
- A blueprint naming an experience type that does not exist is `InvalidContentType` too.
- A composition's `displaySettings` values are validated against the named display template's
  choices, so the templates must exist before any composition is written.

One more measured wrinkle: a blueprint's `POST` is not immediately followed by a readable
resource. In a run of four creates, three composition PATCHes landed and one came back `404`
on the key the `POST` had just returned `201` for. `patchCompositionWithRetry` retries a
`404` with a short backoff and nothing else — a `400` is a shape problem and will never
resolve itself.

### Four things it will never do

1. **Touch a frozen content type.** `FROZEN_CONTENT_TYPES` is hard-coded and asserted intact
   at startup: `CompetitorComparisonPage`, `PersonPage`, `RetailCustomerPage`, `FinServPage`.
   They are never created, never patched, and never used as a blueprint's `contentType`. A
   property change on an existing type takes roughly 40 minutes to reach Graph, and in that
   window a selection on a field Graph does not yet know fails the *entire* query — `data:
   null`, no partial result. One such drift 404'd 2,676 published account pages.
2. **Delete anything.** A property that exists remotely but no longer appears in a local
   definition is reported in the `DETAIL` column and left alone. Removing it would need an
   explicit `null` in the merge-patch, and that is a human decision.
3. **Write a property shape an element cannot hold.** Every `elementEnabled` definition is run
   through `validateElementProperties()` before the first request, so an illegal shape is a
   local failure with a readable message instead of a `400`.
4. **Call the API when there is nothing to do.** With an empty model it does not even
   authenticate.

## Credentials

`client.ts` reads `OPTIMIZELY_CMS_CLIENT_ID` and `OPTIMIZELY_CMS_CLIENT_SECRET` from
`/Users/michiel.dorjee/Claude/mcp-optimizely-cms/.env.local`. The ambient environment wins if
both variables are already set, and `OPTIMIZELY_CMS_ENV_FILE` overrides the path.

The values are held in-process only. They are never logged, never copied into another file,
and never included in an error message — a failed token request reports the status and the
path of the credential file, nothing else.

## Two runtime-specific details that look like mistakes and are not

**A browser User-Agent on every call.** Cloudflare error `1010` blocks the default
fetch/undici User-Agent on `api.cms.optimizely.com`. `BROWSER_USER_AGENT` is required, on the
token call too.

**`import.meta.glob` wrapped in try/catch.** `import.meta.glob` is a Vite *build-time*
transform, not a runtime function. Vite rewrites the call into a static import map; under tsx
the property does not exist and the call throws. So Vite never reaches the catch and Node
always does. Do not replace the try/catch with `typeof import.meta.glob === 'function'`: after
Vite's transform that test is false in the browser too, and the registry would come back empty
in the app.

This is why `registry.ts` has two discovery paths — eager globs for Vite, `readdir` plus
dynamic import for the plain-Node run under tsx — and why it imports `node:fs` dynamically
inside the function that needs it, so a Phase 1 browser bundle pulling in a renderer never
drags the filesystem into the client graph.

## Display templates: the CMS cannot store a default

The repo and the CMS disagree on the shape of a display template, so
`display-template-transform.ts` converts in both directions:

| repo (`display-settings.ts`) | CMS (`/preview3/displaytemplates`) |
| --- | --- |
| `settings: [ { key, … } ]` (array) | `settings: { <key>: { … } }` (keyed map) |
| `type: 'select'` | `editor: 'select'` |
| `options: [ { value, displayName } ]` | `choices: { <value>: { displayName, sortOrder } }` |
| `type: 'checkbox'` with no options | `editor: 'checkbox'`, `choices: {}` |
| **`defaultValue`** | **no equivalent** |

That last row is load-bearing. Because the CMS stores no defaults, defaults are applied
**client-side at compose time** from the repo's own `display-settings.ts` files, which is why
the repo — not the CMS — stays the source of truth for display defaults.
`extractDefaults()` pulls them, mirroring upstream's `display-settings-registry.ts`: an
explicit `defaultValue` wins, otherwise the first option's value is used.

The round trip is lossless except for `defaultValue`, and
`display-template-transform.test.ts` proves it — including a test that re-attaching the
extracted defaults restores the original field for field, which is what makes "`defaultValue`
is the *only* thing lost" a measured claim rather than an assertion.

`defaultValue` is not the only thing the CMS discards. Pushing all 30 templates showed that a
setting's `description` and `required`, and a template-level `description`, are **accepted and
then dropped**: `201`/`200` back, and the read-back carries none of them. There is no error to
react to, only a diff that would never converge — which is why `apply.ts` writes with
`{ measuredKeysOnly: true }` and compares against `storedDisplayTemplateProjection()`, the
keys the CMS demonstrably stores. Keep authoring the descriptions; they document the setting
in the repo, they just never reach the CMS.

## A node's `displaySettings` is not a flat map

This is the one place the contract doc is wrong, and it fails loudly in one direction and
silently in the other. The shape is:

```json
"displaySettings": {
  "displayTemplate": "RowDisplayTemplate",
  "settings": { "displayMode": "grid" }
}
```

Three measured facts:

1. **`displayTemplate` is required whenever `displaySettings` is present.** Omitting it is
   `The DisplayTemplate field is required.` at
   `Content.Composition.Nodes[n].DisplaySettings.DisplayTemplate`, on every node at once. A
   node-level sibling — `displayTemplateKey` or `displayTemplate` next to `nodeType` — does
   **not** satisfy it; both were probed and both 400. Omitting `displaySettings` entirely is
   fine, so a node with nothing to say can leave it out.
2. **Settings written as siblings of `displayTemplate` are silently dropped.** The PATCH
   returns `200` and the composition reads back `"settings": {}`. This is the dangerous one:
   nothing fails, the layout is just blank, and only reading the composition back catches it.
3. **Values are validated against the named template's choices.** `Display setting value
   'default' does not exist for setting 'displayMode' on display template with key
   'RowDisplayTemplate'.` `validateOverrides()` in `blueprints/internal/compose.ts` checks the
   same thing against the repo template first, so the failure stays local.

An array form (`[{displayTemplate, settings}]`) is rejected outright:
`nodes[0].displaySettings: The value did not match the expected type.`

`compose.ts` writes `displaySettings` on every section, row and column, even when there are no
overrides, so each node is explicitly bound to its template rather than depending on the CMS
and the repo agreeing about which one applies.

One related constraint, for whoever places element nodes in Phase 2: a `component` node whose
content type has a **required** property cannot be placed with empty properties —
`Property 'Stat value' is required.` at
`Composition.Nodes[…].Component.Properties.StatValue`. A blueprint skeleton therefore places
sections, rows and columns only, and element nodes are minted at instantiation time with their
copy already in hand.

## Node ids are ours to mint, and they must be deterministic

The API strips every node `id` on read-back, so a blueprint stores its skeleton *without*
ids. Ids are assigned when a blueprint is instantiated onto a page.

The upstream reference implementation uses `randomUUID()` per node. **Do not copy that.** Run
it twice and every node id changes, which destroys `update_page`'s merge contract, Visual
Builder's editing continuity for a human editor, and any node-level reference held elsewhere.
Mint ids as `uuidv5(pageKey + slotId + index)`, so the same page and slot always resolve to the
same node id and a re-render is a merge rather than a replacement.

One more read-side quirk: an empty column round-trips as `{"nodeType": "column"}` — an
*absent* `nodes` key, not `nodes: []`. Readers must tolerate both.
