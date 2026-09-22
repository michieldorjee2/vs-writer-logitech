# Visual Builder component spec

Read this before writing a single file. Everything below was measured against the live
Showcase CMS instance; the full evidence is in
`../../../mcp-optimizely-cms/docs/cms-visual-builder-api.md`. Do not re-probe the API and do
not contradict the contract.

A component in this model is a content type with
`baseType: '_component'` and `compositionBehaviors: ['elementEnabled']`, which makes it
placeable as an **element inside a column** of a Visual Builder composition.

## Hard rules

### 1. An `elementEnabled` content type may hold ONLY scalars and arrays of scalars

Measured by creating one content type per property shape against each composition behaviour:

| property shape | `elementEnabled` | `sectionEnabled` |
| --- | --- | --- |
| `string` (bare, long text) | **OK** | OK |
| `string` + `format: 'shortString'` | **OK** | OK |
| `string` + `format: 'selectOne'` (with an `enum` array of `{value, displayName}`) | **OK** | OK |
| `array` of `{type: 'string'}` (optionally `maxItems`) | **OK** | OK |
| `boolean` | **OK** | OK |
| `integer` | **OK** | OK |
| `url` | **OK** | OK |
| `dateTime` | **OK** | OK |
| `array` of `component` | **400** | OK |
| `array` of `content` | **400** | OK |
| single `component` | **400** | OK |
| `content` reference | **400** | OK |

The rejection is `The property 'X' is not allowed when content type has ElementEnabled.`

Those eight legal shapes are the complete list. There is no ninth.

The consequence is the whole reason this model looks the way it does: **every list-shaped field
becomes its own element node in a column, one node per item.** A list of stats is not a
`StatItem[]` property on one element; it is N `StatElement` nodes. That is the Visual
Builder-native shape, and it is also the one Phase 2 wants — a pruned item is visible in the
composition tree, whereas a suppressed array entry inside a property would be invisible.

### 2. `format: 'richText'` cannot be created through the API. Ever.

It is rejected identically on every surface (`/preview3/contenttypes`, `/v1/contenttypes`),
on every baseType and under both composition behaviours:
`The property format 'richText' does not match an existing format.` (`code: InvalidPropertyFormat`).

So are `richtext`, `RichText`, `html`, `Html`, `HTML`, `xhtml`, `XhtmlString` and
`longString`. Live types that read back with `format: 'richText'` were created by an older API
version or in the UI; new ones cannot be declared in code.

**Body copy uses a bare long `string` with no `format` key.** Use `longString()`. That is the
better fit anyway: our copy is agent-generated prose, and a `richText` property validates its
payload as HTML — a bare `<6` or `<headline one>` in generated text fails the whole write.

`richText()` exists in `property-builders.ts` and throws on purpose. Never emit `richText`
or `html`.

### 3. A property name must be at least 2 characters

`The properties object contains a field whose name 'P' does not meet the minimum length
requirement of 2 characters.`

### 3a. A content type `description` is capped at 255 characters

`The content type description must be a string with a maximum length of '255'.`
(`field: Description`, `code: InvalidModel`). Measured while applying this model — it is not
in the contract doc.

A **property** description is not capped (a 300-character one was measured accepted), so when
the type-level blurb runs long, move the detail onto the properties it describes.
`validateContentType()` in `property-builders.ts` catches this locally, before the request.

### 3b. A property `group` must name a group that already exists

`The property group 'Quote' does not match an existing group.` (`code: InvalidPropertyGroup`).
One unknown group fails the **entire** content type, not just the property.

`apply.ts` handles this: it collects every group the authored definitions reference and
provisions the missing ones through `POST /preview3/propertygroups` before it writes a single
content type. So a new group name is allowed — it just becomes a real, permanent group on the
instance, shared with every other content type there. Reuse an existing one when it fits, and
invent a name only when the grouping is genuinely new. The four the CMS ships are
`Information`, `Scheduling`, `Shortcut` and `Categories`.

### 4. Write only the files in your own component folders

Nine agents are writing sibling folders in this repo at the same time. Touching a file outside
your own folders destroys their work. Never run `git add -A`, `git commit`, `git checkout` or
`git stash`. Never edit `apply.ts`, `client.ts`, `property-builders.ts`,
`display-template-transform.ts`, `registry.ts` or this file.

### 5. Do not call the Optimizely API

A later stage runs `apply.ts`. You only author code.

## File layout

For EACH component in your group create the folder `src/cms/components/<kebab-case-of-key>/`
containing exactly these files:

1. `content-type.ts` — default-exports the CMS content type definition object:
   { key, displayName, description, baseType: '_component',
     compositionBehaviors: ['elementEnabled'],
     properties: { <PropName>: { type, format?, displayName, description, required?,
                                 maxLength?, enum?, items?, maxItems?, group, sortOrder } } }
   sortOrder in steps of 10. group: 'Information' unless a better group name is obvious.
   Import the shared property builders from '../../property-builders' and use them —
   do not hand-write raw property objects.

2. `display-settings.ts` — default-exports an ARRAY of display templates in the
   optimizely.com repo shape (key, displayName, contentType, isDefault, settings: [ {key,
   displayName, type, required, options: [{value, displayName}], defaultValue} ]).
   Name the template `<ContentTypeKey>DisplayTemplate`. Where the component ports an
   upstream one, COPY the upstream display-settings.ts settings rather than inventing any.
   Every setting needs a defaultValue (the CMS cannot store defaults — the repo is the
   source of truth, applied client-side at compose time).

3. `types.ts` — the TypeScript props interface. Scalars from content-type.ts plus
   `displaySettings?: Record<string,string>` and `preview?: boolean`, matching the
   upstream component convention.

4. `DIVERGENCE.md` — ONLY when the component's note says it diverges from upstream.
   State what upstream does, what we do, and why (one short paragraph, no bullets).

Do NOT write index.tsx. React renderers are Phase 1, after the upstream UI is vendored.

## Naming

| thing | convention | example |
| --- | --- | --- |
| content type key | PascalCase, as it will appear in Graph | `StatBlock` |
| folder name | kebab-case of the key | `stat-block` |
| display template key | `<ContentTypeKey>DisplayTemplate` | `StatBlockDisplayTemplate` |
| property name | PascalCase, >= 2 characters | `StatValue` |
| display setting key | camelCase, copied from upstream | `animationMode` |

`registry.ts` fails a folder whose name is not the kebab-case of its key, so the two cannot
drift apart.

## Worked example

`src/cms/components/stat-block/content-type.ts`:

```ts
import {
  longString,
  sequence,
  shortString,
  type ContentTypeDefinition,
} from '../../property-builders'

const contentType: ContentTypeDefinition = {
  key: 'StatBlock',
  displayName: 'Stat',
  description: 'A single headline number with a caption.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: sequence({
    StatValue: shortString('Stat value', {
      description: 'The number itself, e.g. "38%".',
      required: true,
      maxLength: 24,
    }),
    StatDescription: longString('Stat description', {
      description: 'One line of supporting copy.',
    }),
  }),
}

export default contentType
```

`src/cms/components/stat-block/display-settings.ts` — the upstream settings, copied:

```ts
import type { RepoDisplayTemplate } from '../../display-template-transform'

const displayTemplates: RepoDisplayTemplate[] = [
  {
    key: 'StatBlockDisplayTemplate',
    displayName: 'Stat Block Display Template',
    contentType: 'StatBlock',
    isDefault: true,
    settings: [
      {
        key: 'animationMode',
        displayName: 'Animation Mode',
        type: 'select',
        required: false,
        options: [
          { value: 'none', displayName: 'None' },
          { value: 'scroll', displayName: 'Scroll' },
          { value: 'mouse', displayName: 'Mouse' },
        ],
        defaultValue: 'none',
      },
      {
        key: 'extrusionCount',
        displayName: 'Extrusion Layers',
        type: 'select',
        required: false,
        options: [
          { value: 'layers_5', displayName: '5 Layers' },
          { value: 'layers_6', displayName: '6 Layers' },
          { value: 'layers_7', displayName: '7 Layers' },
          { value: 'layers_8', displayName: '8 Layers' },
          { value: 'layers_9', displayName: '9 Layers' },
        ],
        defaultValue: 'layers_5',
      },
    ],
  },
]

export default displayTemplates
```

`src/cms/components/stat-block/types.ts`:

```ts
import displayTemplates from './display-settings'

export interface StatBlockProps {
  StatValue?: string
  StatDescription?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type StatBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
```

## Property builders

Import from `'../../property-builders'`. Each returns a complete property object with
`group: 'Information'` and `sortOrder: 0`; wrap the whole map in `sequence()` to number
`sortOrder` 10, 20, 30 in declaration order.

| builder | emits |
| --- | --- |
| `shortString(displayName, {description, required, maxLength, group, sortOrder})` | `string` + `shortString` |
| `longString(displayName, {…, maxLength})` | bare `string` — body copy, the richText replacement |
| `selectOne(displayName, values, {…})` | `string` + `selectOne` + `enum`; `values` is `string[]` or `{value, displayName}[]` |
| `stringArray(displayName, {maxItems, …})` | `array` of `{type: 'string'}` |
| `url(displayName, {…})` | `url` |
| `dateTime(displayName, {…})` | `dateTime` |
| `boolean(displayName, {…})` | `boolean` |
| `integer(displayName, {…})` | `integer` |
| `richText(...)` | **throws** — see hard rule 2 |
| `sequence(properties)` | renumbers `sortOrder` in steps of 10 |
| `validateElementProperties(properties, label)` | the problems `apply.ts` will refuse on |

Use a `group` other than `'Information'` only when a component genuinely has two clusters of
fields and an editor would benefit from the split — and see hard rule 3b: a group that does
not exist yet is created on the instance for real, so the name outlives this component.

## Divergence from upstream

Three optimizely.com blocks cannot be ported unchanged, because each holds a content
reference and a reference is a 400 on an element:

| upstream | property | what we do instead |
| --- | --- | --- |
| `ButtonBlock` | `Link` (content reference) | two scalars: `ButtonText` + `ButtonUrl` |
| `LinkListBlock` | `Links` (array of content) | one `LinkItemElement` node per link |
| `ImageDisplayBlock` | `ImageReference` (content reference) | `ImageUrl` as a `url` property |

If your component is one of these, or your assignment note says it diverges, write
`DIVERGENCE.md` in the folder: what upstream does, what we do, and why. One short paragraph,
no bullets.

## Checklist before you finish

- [ ] Folder name is the kebab-case of the content type key.
- [ ] `content-type.ts` default-exports the definition; every property came from a builder.
- [ ] Every property name is at least 2 characters.
- [ ] No `richText`, no `html`, no component array, no content reference, no single component.
- [ ] `sortOrder` runs 10, 20, 30 (use `sequence()`).
- [ ] `display-settings.ts` default-exports an ARRAY; the template key is
      `<ContentTypeKey>DisplayTemplate`; every setting has a `defaultValue`.
- [ ] Upstream settings were copied, not invented.
- [ ] `types.ts` carries `displaySettings?: Record<string, string>` and `preview?: boolean`.
- [ ] `DIVERGENCE.md` exists if and only if the component diverges.
- [ ] No `index.tsx`.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` is clean.
- [ ] `npx tsx src/cms/apply.ts --dry-run` lists your components with no `failed` rows.

## Never touched

`apply.ts` hard-codes a denylist and asserts it intact at startup. These four content types
are never created, patched, or used as a blueprint's `contentType`:

`CompetitorComparisonPage` (67 props, 2,695 live pages), `PersonPage` (62 props, 14 live),
`RetailCustomerPage` (38 props, 10 live), `FinServPage` (22 props, 4 live).

A property change on an existing type takes roughly 40 minutes to reach Graph, and during that
window a selection on a field Graph does not yet know fails the ENTIRE query — `data: null`,
no partial result. One such drift 404'd 2,676 published account pages. Create new types;
never mutate those four.
