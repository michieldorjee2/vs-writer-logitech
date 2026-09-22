# src/vendor/opticom — vendored from optimizely.com

This directory is a slice of the production optimizely.com app ("opticom"), copied in so the
Showcase renders Visual Builder compositions with the same code the main site uses. The point
is not to look like optimizely.com; it is to **run near-same code**, and to be able to prove
that later instead of asserting it.

That proof is `scripts/sync-opticom.mjs`:

```bash
node scripts/sync-opticom.mjs --upstream <path-to-unpacked-zip> --check
```

`--check` writes nothing and exits non-zero the moment this tree — or the vendored token
pipeline at the repo root, see "The vendored token pipeline" below — stops being *(upstream +
the patches recorded below)*. Without `--check` it re-copies and re-patches both. `<path>` is
the root of an unpacked OptimizelyHeadless zip — the directory holding `components/`, `lib/`
and `next.config.ts`. `OPTICOM_UPSTREAM` works instead of the flag.

## Source

| | |
| --- | --- |
| zip | `OptimizelyHeadless (4).zip` |
| vendored on | 2026-09-22 |
| upstream stack | Next 16 (canary), React 19, Tailwind v4, style-dictionary tokens, Storybook |
| unpacked at | `/private/tmp/…/scratchpad/headless` (a scratch path — pass your own with `--upstream`) |

## Never hand-edit a vendored file

Three kinds of file live here and the difference is load-bearing:

**Vendored** files are listed in `MANIFEST` in the sync script and are byte-identical to
upstream apart from the patches below. Editing one works until the next sync silently
overwrites it. Change the patch instead.

**Patched** files are vendored files with an entry in `PATCHES`. Every patch asserts its
`find` string appears in the upstream source exactly once, so if upstream rewrites that line
the sync **fails loudly** rather than quietly dropping the adaptation.

**Shims** are ours. They are listed in `SHIMS`, never copied, and never reported as orphans.
Anything else found under this directory is reported as an **orphan** and deleted on the next
sync — either upstream removed it, or somebody put a file in a directory that is not theirs.

## Next-to-Vite adaptations

Upstream is React-Server-Components-flavoured Next code. Six files carry patches for this
reason, and one rule applies to all of them. (A seventh file carries a patch too, but for a
different reason — see "Feature patches" below, right after this section.)

**`'use client'` is stripped from every file** (33 of them). It is meaningless in a Vite SPA
and Rollup warns on every module-level directive it cannot hoist.

| file | change |
| --- | --- |
| `lib/utils.ts` | dropped `import { ReadonlyURLSearchParams } from 'next/navigation'`; `createUrl`'s param is now the structural type it actually uses, `URLSearchParams \| { toString(): string }` |
| `lib/optimizely/rendering/content-area/block.tsx` | `require.context` → `import.meta.glob(…, { eager: true })`. Eager matches `require.context`'s synchronous semantics exactly |
| `lib/optimizely/rendering/content-area/section.tsx` | same |
| `lib/optimizely/rendering/content-area/element.tsx` | `next/dynamic` → `React.lazy`, `require.context` → lazy `import.meta.glob`, **plus a `<Suspense>` boundary** — `next/dynamic` carries its own fallback and `React.lazy` does not, so a straight swap would throw on first render |
| `components/section/blank-section/index.tsx` | `next/dynamic` → `React.lazy` + `<Suspense>`, same reason |
| `components/_ui/accordion/index.tsx` | `motion/react` → `framer-motion`. The `motion` package is not installed here; framer-motion v12 is, and `motion/react` is a re-export of it. Aliasing avoids shipping the animation engine twice |

Upstream's `@/` alias is kept rather than rewritten, so the vendored files stay
byte-comparable and the sync script keeps working. `@/` resolves to **this directory** — in
`vite.config.ts` (as the key `@/`, with a trailing slash so it cannot shadow the existing
`@components` and `@assets` aliases) and in `tsconfig.app.json` (`"@/*": ["./src/vendor/opticom/*"]`).

### Excluded on purpose

- **`__stories/`** everywhere. The Storybook files import `@/.storybook/display-settings-helper`
  and `@storybook/react`, neither of which exists here, and none of them is part of the
  render chain.
- **`lib/optimizely/features/draft/on-page-edit.tsx` and `draft-actions.tsx`.** Both import
  `next/navigation` and drive the CMS on-page-edit toolbar, which the Showcase has no route
  for. `features/draft/index.ts` is therefore a trimmed shim of upstream's barrel.
- **`lib/optimizely/rendering/template-area/`.** Not in scope; it renders `_Page`/`_Experience`
  templates, not compositions.

## Feature patches (ours, not a Next-to-Vite necessity)

One patch exists for a reason that has nothing to do with Next vs. Vite: upstream's `column`
is capable ONLY of being a grid CELL (`colSpan`, `colStart`/`colEnd`, self-alignment, `order`
— all sizing this column within its parent row's grid). It has no vocabulary for arranging
ITS OWN children, and its component is unconditionally `flex flex-1 flex-col`. That is fine
when a column holds one item, and silent breakage when it holds several: a `many`-cardinality
feed's N items (a strip of stat pills, a 3-up card grid) had nowhere to declare "arrange
yourselves," so they always stacked one per line regardless of how many there were — the
Showcase's own many-cardinality layout bug, isolated to this file and `compose.ts`.

| file | change |
| --- | --- |
| `components/layout/column/display-settings.ts` | six settings appended to `ColumnDisplayTemplate.settings`: `displayMode`, `gridColumns`, `gridColumnsMd`, `gridColumnsLg`, `gridColumnsXl`, `gap`. Not upstream's vocabulary reinvented — copied value-for-value from `RowDisplayTemplate`'s own settings of the same names (`components/layout/row/display-settings.ts`, itself unpatched), so a column and a row offer identical choices. Column's defaults diverge from Row's on purpose: `displayMode` defaults to `'flex'` and `gap` to `'none'`, reproducing the exact old always-stacked, no-gap rendering for every column that does not opt in |
| `components/layout/column/index.tsx` | reads and renders the six settings above: `columnVariants`' base class moves from the fixed string `'flex flex-1 flex-col flex-nowrap justify-start'` into a new `displayMode` variant (`'flex'` → that same string, unchanged; `'grid'` → `'grid'`), four `gridColumns*` variants and a `gap` class map are added, mirroring `components/layout/row/index.tsx`'s own `displayMode` / `gridColumns*` / gap-class-map handling. One find/replace covering everything from `export const columnVariants = cva(` to the end of the file, because the base-class change touches the shape of every variant declared after it |

The patch is large enough that it is easier to read on disk than in the `find`/`replace`
strings: open the vendored file itself, or diff it against upstream's
`components/layout/column/index.tsx`.

The **same six settings are mirrored** onto `src/cms/layout/column-display.ts` — the
CMS-facing copy `src/cms/blueprints/internal/compose.ts` validates blueprint `column`
overrides against (that file is outside this directory and outside the sync script's reach;
see its own header comment). The two must be kept in sync by hand.

## Bug-fix patches (upstream's own bugs, not ours)

One patch fixes something broken in upstream's own source, confirmed against the zip rather
than assumed:

| file | change | why |
| --- | --- | --- |
| `components/_ui/navigation-menu/index.tsx` | `origin-top-center` → `origin-top` | not a Tailwind class — the `transform-origin` keyword vocabulary has no compound `top-center` — and it compiled to no rule in either app. `origin-top` is the value it was reaching for: `transform-origin: top` already means "top center" |

Found during the D4 class-resolution audit (`node scripts/…` extraction of every class
string under `src/cms/` and `src/vendor/`, checked against the compiled CSS). This component
is not currently imported by any Showcase renderer.

## The CSS entry point — `app/globals.css`

Upstream's own Tailwind entry point was, for a while, not part of this slice at all — an
omission that then had to be worked around by hand, three separate times, with the same
magic number (`max-w-[622px]`, upstream's own `--max-width-card` value, hard-coded into
`card-customer-block`, `card-press-block` and `card-customer-quote-block` because the token
that names it did not exist here). It is vendored now, and it is the one file in this
directory that is a **patch, not a copy**, because importing it whole would either duplicate
or actively fight this app's own CSS pipeline:

| upstream line | fate | why |
| --- | --- | --- |
| `@import 'tailwindcss'` | dropped | `src/index.css` already splits Tailwind into its three real entry points (`theme.css` / `preflight.css` / `utilities.css`), unlayered, on purpose — see that file's own header. A second, actually-layered `@import 'tailwindcss'` next to it would reintroduce the exact real-cascade-layer bug that split exists to avoid |
| `@import '../tokens/compiled/default.css'` | dropped | the same compiled token file `src/index.css` already imports once |
| `@import './fonts.css'` | dropped | a path this repo does not vendor; the same VC Nudge / Die Grotesk B faces are already self-hosted from `src/styles/greenfield.css` |
| `@import 'material-symbols/rounded.css'` | dropped **here**, added in `src/main.tsx` | the actual fix — before this, `MaterialIcon` had no font and every icon rendered as its literal ligature name (`arrow_outward`, `article`, …) — but not from this file. Routing it through Tailwind's own `@import` resolution (`@tailwindcss/postcss`, which processes the whole graph starting from `index.css`) breaks Vite's asset handling for the package's relative `url(./material-symbols-rounded.woff2)`: measured with `npm run build`, the font file is never copied into `dist/assets` and the url is left unrewritten, so the icon would silently 404 in production while looking fine in dev. A plain JS-level import in `src/main.tsx` gives Vite's normal CSS-asset pipeline the file instead, which resolves and fingerprints it correctly — the same reason Google Fonts is loaded via a `<link>` in `index.html` rather than a CSS `@import` (see `src/index.css`'s own first line) |
| `@plugin '@tailwindcss/typography'` | dropped | already declared once in `src/index.css`; a second registration is redundant |
| `@theme { --max-width-card: 622px }` | **kept** | the real token behind the three `max-w-[622px]` workarounds, now restored — see those files' own headers, which the workaround is being removed from in the same change |
| `.prose { --tw-prose-*: currentColor }` | dropped | LIVE and unscoped. Two retail components (`ClosingReflection.tsx`, `WornThisYear.tsx`) already render `.prose` against `@tailwindcss/typography`'s real defaults; silently repainting it was not this change's job |
| `body { font-family: var(--font-body)… }` | dropped | LIVE and unscoped. Would out-cascade this app's own `body {}` rule in `src/index.css` that the ABM/retail/finserv templates render against |
| the commented-out `@layer base { … }` block | kept, still inert | never executes either way — no reason to touch it |
| `@keyframes checkbox-pulse` / `checkmark-pop` | kept | referenced today by the vendored `_ui/checkbox` and `_ui/radio` (`animate-[checkbox-pulse_0.4s_ease-out]` etc.) with no keyframe definition anywhere else in this repo — silently inert until this file supplied them |

`src/index.css` imports the result (`./vendor/opticom/app/globals.css`) alongside its other
imports, in the same cluster, so all `@import` statements in that file stay grouped at the
top as CSS requires.

## Shims (ours, not upstream's)

| file | why |
| --- | --- |
| `lib/optimizely/types/generated.ts` | **Upstream does not ship this file.** It is GraphQL-codegen output built from the live Graph schema by `codegen.yaml`, and it is gitignored, so it is absent from the zip. Four vendored modules import from it. This hand-writes only the members they reference. One known degradation is recorded in the file's header: upstream's `_IContent` is a discriminated union, so `ExtractContent<T>` narrows; here it is one open interface, so it widens |
| `lib/optimizely/features/draft/index.ts` | trimmed barrel — see "Excluded on purpose" |
| `components/block/.gitkeep` | Vite needs the directory to exist for the eager glob in `content-area/block.tsx`. We ship none of upstream's ~60 block renderers, so the glob resolves to `{}` and every Block-lane type falls through to the repo registry |

## What is vendored

75 files from upstream, plus 3 shims and this document.

**`components/_ui/` — 42 files across 37 primitive directories.** 32 of them wrap a
`@radix-ui/react-*` package; `icons` (inline brand SVGs) and `taxonomy-tag` do not, and
`button`, `card` and `pagination` are multi-file.

All 36 runtime packages the slice needs are in `package.json`: 32 Radix, plus
`class-variance-authority`, `clsx`, `tailwind-merge` and `lucide-react`. They were requested
at upstream's ranges but **npm resolved them to current latest**, so the caret ranges
recorded here are ahead of optimizely.com's — e.g. `@radix-ui/react-accordion` is `^1.2.20`
against upstream's `^1.2.12`. Every one is semver-compatible with upstream's range, and one
place the skew already bit is recorded in the patch table: `@radix-ui/react-menubar` 1.1.24
dropped `displayName` from `Menu`'s type. `@radix-ui/react-direction` and
`@radix-ui/react-portal` are direct imports here but only transitive deps upstream, so they
have no upstream range to match. If a rendering difference ever traces to Radix, pinning
this block to upstream's exact resolved versions is the first thing to try.

```
components/_ui/accordion/index.tsx
components/_ui/alert-dialog/index.tsx
components/_ui/aspect-ratio/index.tsx
components/_ui/avatar/index.tsx
components/_ui/button/index.tsx
components/_ui/button/opal-wrapper.tsx
components/_ui/button/stroke-wrapper.tsx
components/_ui/card/card-bottom-bar.tsx
components/_ui/card/card-resource-details.tsx
components/_ui/card/index.tsx
components/_ui/checkbox/index.tsx
components/_ui/collapsible/index.tsx
components/_ui/context-menu/index.tsx
components/_ui/dialog/index.tsx
components/_ui/direction-provider/index.tsx
components/_ui/dropdown-menu/index.tsx
components/_ui/form/index.tsx
components/_ui/hover-card/index.tsx
components/_ui/icons/index.tsx
components/_ui/label/index.tsx
components/_ui/menubar/index.tsx
components/_ui/navigation-menu/index.tsx
components/_ui/pagination/index.tsx
components/_ui/pagination/types.ts
components/_ui/popover/index.tsx
components/_ui/portal/index.tsx
components/_ui/progress/index.tsx
components/_ui/radio/index.tsx
components/_ui/scroll-area/index.tsx
components/_ui/select/index.tsx
components/_ui/separator/index.tsx
components/_ui/slider/index.tsx
components/_ui/slot/index.tsx
components/_ui/switch/index.tsx
components/_ui/tabs/index.tsx
components/_ui/taxonomy-tag/index.tsx
components/_ui/toast/index.tsx
components/_ui/toggle-group/index.tsx
components/_ui/toggle/index.tsx
components/_ui/toolbar/index.tsx
components/_ui/tooltip/index.tsx
components/_ui/visually-hidden/index.tsx
components/element/icon-element/display-settings.ts
components/element/icon-element/index.tsx
components/element/icon-element/types.ts
components/layout/column/display-settings.ts
components/layout/column/index.tsx
components/layout/column/types.ts
components/layout/row/display-settings.ts
components/layout/row/index.tsx
components/layout/row/types.ts
components/section/blank-section/display-settings.ts
components/section/blank-section/index.tsx
components/section/blank-section/types.ts
lib/hooks/parseDisplaySettings.ts
lib/optimizely/features/draft/draft-mode-context.tsx
lib/optimizely/features/draft/editable-block.tsx
lib/optimizely/features/draft/editable-field.tsx
lib/optimizely/features/draft/editable-html.tsx
lib/optimizely/rendering/content-area/block.tsx
lib/optimizely/rendering/content-area/component.tsx
lib/optimizely/rendering/content-area/element.tsx
lib/optimizely/rendering/content-area/mapper.tsx
lib/optimizely/rendering/content-area/section.tsx
lib/optimizely/rendering/content-area/utils.ts
lib/optimizely/rendering/visual-builder/wrapper.tsx
lib/optimizely/types/block.ts
lib/optimizely/types/display-settings.ts
lib/optimizely/types/experience.ts
lib/optimizely/types/typeUtils.ts
lib/products/odp/types.ts
lib/utils.ts
lib/utils/block-factory.tsx
lib/utils/draft-helpers.ts
app/globals.css
```

### Transitive pulls — files the task list did not name

Three entries above are here because something in the named set imports them, not because
they were asked for. Leaving them out would have meant editing a vendored file.

`components/element/icon-element/` is imported by four `_ui` files (`accordion`, `switch`,
`card/card-bottom-bar`, `card/card-resource-details`) for its `MaterialIcon` export.
`lib/optimizely/features/draft/*` supplies the `EditableBlock` that wraps every node in
`content-area/mapper` and `visual-builder/wrapper`. `lib/products/odp/types.ts` supplies the
`DataPlatformProfile` the mapper threads through to every renderer; it is 353 lines of flat
interface with no imports of its own, so vendoring it beat writing a fourth shim.

## The vendored token pipeline (repo root, not this directory)

One more vendored-from-upstream set is tracked by `scripts/sync-opticom.mjs`, and it does not
live under `src/vendor/opticom` at all — it lives at the **repo root**, in the same place
upstream keeps it, because the token build (`npm run tokens:build`, wired into `dev` and
`build`) has to read it from there:

```
scripts/build-tokens.js      (patched — see below)
tokens/$metadata.json
tokens/$themes.json
tokens/themes.json
tokens/Semantic/
tokens/TailwindCSS/
tokens/overrides/
```

These were copied from upstream by hand when Tailwind v4 landed, but the sync script had no
manifest entry for any of them — the "run near-same code, and prove it" contract this whole
directory exists for said nothing about the one thing that generates the app's entire colour
and type-scale vocabulary. `sync-opticom.mjs`'s `TOKENS_MANIFEST` now covers all seven, with
its own orphan scan restricted to `tokens/` (never the whole repo — `tokens/compiled/`, the
gitignored build OUTPUT, is the one thing under `tokens/` this never touches or reports).

`scripts/build-tokens.js` carries one patch, the same one its own header comment has
described since it was first hand-copied: upstream resolves every token path
(`tokens/TailwindCSS`, `tokens/Semantic`, `tokens/overrides`, `tokens/compiled`) against
`process.cwd()`, which upstream can assume is always the repo root because its only caller is
an npm script. This repo also runs the same file from `scripts/` and from the
`visual-baseline.mjs` capture harness, so every one of those paths is resolved against the
repo root explicitly instead (`repoPath(...)`, a `path.resolve` of `import.meta.url`'s own
directory). The patch is recorded in `sync-opticom.mjs`'s `PATCHES['scripts/build-tokens.js']`
exactly as it is applied.

Run the audit together with the rest of the vendored slice — one invocation now checks both:

```bash
node scripts/sync-opticom.mjs --upstream <path-to-unpacked-zip> --check
```

## Where the repo's own code lives

Nothing under `src/cms/` is vendored. The render chain that binds this slice to the Showcase
content model is `src/cms/rendering/`, and the props contract for a component renderer is
`src/cms/rendering/RENDERER-SPEC.md`.
