# Renderer spec — writing `src/cms/components/<folder>/index.tsx`

Read this before writing a renderer. `COMPONENT-SPEC.md` (one directory up) defines the
*model* — `content-type.ts`, `display-settings.ts`, `types.ts`. This defines the *renderer*,
the `index.tsx` that file layout deliberately left out of Phase 0.

The chain that calls you already exists and is verified: `npx tsc --noEmit -p
tsconfig.app.json` and `npm run build` both pass with zero renderers present, and every one
of the 27 content types dispatches to the lane it should. You are filling in leaves, not
wiring a tree.

## The one rule that makes the rest work

**Default-export a single React component.** `registry.ts` keys the registry on the folder
name — `stat-block` becomes `StatBlock` via `kebabToPascalCase` — and lazily imports the
default export. A named export is invisible to it. Two default exports is a syntax error. A
folder with no `index.tsx` is simply not registered, which is the Phase 0 state and is fine.

The folder name must stay the kebab-case of the content type key. `src/cms/registry.ts`
already fails a folder where that is not true, so the model and the renderer cannot drift
apart, and the round-trip through `kebabToPascalCase` is safe.

## The props contract

```tsx
import type { StatBlockProps } from './types'

export default function StatBlock({ StatValue, StatDescription, displaySettings }: StatBlockProps) {
  …
}
```

You receive, in one flat object:

**The scalars of your content type**, PascalCase, exactly as `content-type.ts` declares them
and exactly as Graph returns them. They arrive spread from the Graph node, so every one is
optional at runtime regardless of `required: true` in the model — a `required` property is
enforced when a node is *written*, not when it is read, and an older version of a page may
predate the property. Render defensively: an absent scalar should drop its element, not
throw and not print `undefined`.

**`displaySettings?: DisplaySettings`** — an **ARRAY of `{key, value}`**, not an object.
This is the single most common way to get a renderer wrong. Graph returns
`displaySettings { key value }`; the nested `{displayTemplate, settings:{…}}` shape is the
*write* shape and you will never see it. Read it with the vendored helper:

```tsx
import { getDisplayValue } from '@/lib/utils'

const animation = getDisplayValue(displaySettings, 'animationMode') // 'none' | 'scroll' | …
```

or, when you want the whole set as an object:

```tsx
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettingValues } from './types'

const { animationMode, extrusionCount } = parseDisplaySettings<DisplaySettingValues>(displaySettings)
```

Do not hand-roll either one. Both are vendored from optimizely.com and both handle the
undefined/not-an-array cases.

**You do not need to apply your own defaults.** `display-defaults.ts` has already merged
every `defaultValue` from your `display-settings.ts` underneath whatever the CMS stored,
because the CMS cannot store defaults at all. By the time you read a key it has a value if
your template declares one. A key the editor cleared stays cleared — an empty string is a
stored value and wins over the default, deliberately.

**`preview?: boolean`** — true in draft/edit mode. Pass it down to any vendored layout
component you nest, and use `draftClass(preview, 'vb:…')` if you add edit-mode affordances.
Do not gate content on it; it changes chrome, not copy.

**`isFirst?: boolean`** — true for the first element in its column. Upstream uses it for
above-the-fold treatment, e.g. skipping a lazy-load or lifting a heading level.

**`locale?: string`** and **`profile?: DataPlatformProfile | null`** also arrive. Ignore
both unless your component genuinely needs them.

Declare all of this in your folder's `types.ts`, which `COMPONENT-SPEC.md` already requires
to carry `displaySettings` and `preview`.

## What to build with

Everything under `src/vendor/opticom/` is optimizely.com's own code, reachable through the
`@/` alias. **Prefer a vendored primitive over writing one.** That is the whole point of the
vendoring: a Showcase card and an optimizely.com card should be the same card, not two cards
that resemble each other. Read `src/vendor/opticom/UPSTREAM.md` before you touch anything in
there — those files are overwritten by `scripts/sync-opticom.mjs` and must never be
hand-edited.

| need | use |
| --- | --- |
| class merging | `import { cn } from '@/lib/utils'` — a `tailwind-merge` extended for the opticom font-size and colour scales, not plain `clsx` |
| variants | `cva` from `class-variance-authority`, in the shape `components/layout/row/index.tsx` uses: one `cva` with a `satisfies Record<NonNullable<DisplaySettingValues['x']>, string>` per variant, so a display-setting option with no class is a compile error |
| a Radix primitive | `@/components/_ui/<name>` — 37 of them: accordion, alert-dialog, aspect-ratio, avatar, button, card, checkbox, collapsible, context-menu, dialog, direction-provider, dropdown-menu, form, hover-card, icons, label, menubar, navigation-menu, pagination, popover, portal, progress, radio, scroll-area, select, separator, slider, slot, switch, tabs, taxonomy-tag, toast, toggle, toggle-group, toolbar, tooltip, visually-hidden |
| an icon | `import { MaterialIcon } from '@/components/element/icon-element'` for Material Symbols; `lucide-react` for the icons Radix primitives already use; `Icons` from `@/components/_ui/icons` for the brand social marks |
| a grid | `@/components/layout/row` and `@/components/layout/column`. The chain already wraps you in both — reach for them only for an *internal* grid |
| an inline editable field | `EditableField` / `EditableHtml` from `@/lib/optimizely/features/draft` |

**Token classes, not hex.** Tailwind v4 is configured with opticom's token vocabulary, so
use the same class names the main site does: `bg-primary-1`, `bg-tertiary-2`,
`bg-primary-lfgreen`, `bg-secondary-ltblue`, `bg-secondary-darkfir`, and the
`text-body-*` / `text-headline-*` / `text-overline-*` scales that `cn`'s `tailwind-merge`
extension knows how to collapse. `blank-section/index.tsx` is the worked example. A literal
hex in a renderer is a bug — it will not follow a brand change and it will not respond to a
section's background.

## What NOT to do

**Do not add a Suspense boundary.** `registry.ts` already wraps every renderer in one, so
your component may suspend freely.

**Do not import from another component folder.** Nine agents write these in parallel; a
cross-folder import is a merge conflict and a circular-import risk. Shared markup belongs in
a vendored primitive, or nowhere yet.

**Do not touch** `registry.ts`, `component-factory.tsx`, `visual-builder.tsx`,
`display-defaults.ts`, this file, anything under `src/vendor/`, or another agent's folder.
Never run `git add -A`, `git commit -a`, `git checkout .`, `git stash` or `git reset --hard`.

**Do not fetch.** A renderer is a pure function of its props. The composition is already
loaded by the time you are called.

**Do not use `dangerouslySetInnerHTML` on a scalar.** Body copy is a bare long `string`, not
`richText` — see `COMPONENT-SPEC.md` hard rule 2 — so it is plain text and must be escaped
by React the normal way. `EditableHtml` exists for the fields that really are HTML.

## Previewing one in isolation

There is no Storybook here; upstream's `__stories` were deliberately not vendored. Preview a
renderer by rendering it directly with literal props — a renderer takes no context and no
provider, so this works with nothing else mounted:

```tsx
import StatBlock from '@/../cms/components/stat-block' // or a relative path from your route
;<StatBlock
  StatValue="38%"
  StatDescription="faster time to first experiment"
  displaySettings={[
    { key: 'animationMode', value: 'scroll' },
    { key: 'extrusionCount', value: 'layers_7' },
  ]}
/>
```

Note the array shape of `displaySettings` — pass it the way Graph does, or you are testing
something the chain will never hand you. Omit a key to check that the default from your
`display-settings.ts` lands; `display-defaults.ts` fills it only when the component is
reached through the chain, so to test defaults in isolation call
`withContentTypeDefaults('StatBlock', [])` from `../rendering/display-defaults` and pass the
result.

To see it in the real chain, render a composition through
`src/cms/rendering/visual-builder.tsx`:

```tsx
import VisualBuilderExperience from '@/../cms/rendering/visual-builder'

<VisualBuilderExperience experience={experienceFromGraph} preview />
```

## How your component gets reached

```
VisualBuilderExperience   composition.nodes
  └─ SectionNode          node.section.__typename  -> BlankSection (vendored)
       └─ Row             node.rows[]              -> vendored, display-settings driven
            └─ Column     row.columns[]            -> vendored
                 └─ Element  column.elements[]
                      └─ component-factory  element.component.__typename
                           └─ YOUR DEFAULT EXPORT
```

`component-factory.tsx` routes on the type NAME, as upstream does: a name containing
`Element` goes to the Element lane, one containing `Section` or `ContainerData` to the
Section lane, everything else to Block. All 27 current types land correctly — 19 Element, 8
Block — and the repo registry is consulted before the lane, so your folder wins for its own
type. If you ever add a type, check it with `laneReport()` from `component-factory.tsx`
rather than by eye.

## Before you finish

- [ ] `index.tsx` default-exports exactly one component.
- [ ] Props come from `./types`, and every scalar is handled when absent.
- [ ] `displaySettings` is read as an ARRAY, through `getDisplayValue` or
      `parseDisplaySettings`.
- [ ] No hand-applied defaults, no hand-rolled settings parser.
- [ ] Vendored primitives and token classes, no literal hex, no new dependency.
- [ ] No import from a sibling component folder, nothing written outside your own folders.
- [ ] `npx tsc --noEmit -p tsconfig.app.json` is clean.
- [ ] `npm run build` passes.
