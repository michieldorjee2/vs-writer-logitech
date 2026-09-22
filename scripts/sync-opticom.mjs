#!/usr/bin/env node
/**
 * Re-copy the vendored slice of the optimizely.com app ("opticom") into
 * `src/vendor/opticom/`, re-apply the recorded Next-to-Vite patches, and report the diff.
 *
 * WHY THIS EXISTS. The requirement is that the Showcase "runs near-same code" as the main
 * site. A hand-copy makes that a claim; this script makes it a check. `--check` is a
 * read-only audit that exits non-zero the moment the vendored tree stops being
 * (upstream + the recorded patches), so drift is a failing command rather than a belief.
 *
 *   node scripts/sync-opticom.mjs --upstream <path> --check   # audit, write nothing
 *   node scripts/sync-opticom.mjs --upstream <path>           # re-copy + re-patch
 *   OPTICOM_UPSTREAM=<path> node scripts/sync-opticom.mjs
 *
 * `<path>` is the root of an unpacked OptimizelyHeadless zip — the directory holding
 * `components/`, `lib/` and `next.config.ts`. See `src/vendor/opticom/UPSTREAM.md` for the
 * zip this tree was cut from.
 *
 * THREE KINDS OF FILE live under src/vendor/opticom, and the difference matters:
 *
 *   vendored   listed in MANIFEST. Byte-identical to upstream except for PATCHES.
 *              Never hand-edit one — the next sync overwrites it. Edit the patch instead.
 *   patched    vendored, plus an entry in PATCHES. Every patch asserts its `find` string is
 *              present exactly once; if upstream rewrites that line the sync FAILS LOUDLY
 *              rather than silently dropping the adaptation.
 *   shim       listed in SHIMS. Ours, not upstream's — the handful of modules the vendored
 *              files import that live outside the slice (codegen output, an ODP type, a
 *              trimmed barrel). Never copied, never reported as an orphan.
 *
 * Anything else found under src/vendor/opticom is reported as an ORPHAN: either upstream
 * deleted it, or somebody added a file to a directory that is not theirs.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR_ROOT = join(REPO_ROOT, 'src', 'vendor', 'opticom')

// ---------------------------------------------------------------------------
// What we vendor
// ---------------------------------------------------------------------------

/**
 * `dir` entries copy a whole directory (single level unless `recurse`), `file` entries copy
 * one file. `__stories` is excluded everywhere: the Storybook files import
 * `@/.storybook/display-settings-helper` and `@storybook/react`, neither of which exists
 * here, and they are not part of the render chain.
 */
const MANIFEST = [
  // The 37 Radix primitives, plus the three multi-file ones (button, card, pagination).
  { dir: 'components/_ui', recurse: true },

  // Layout + section renderers: the bodies of the composition tree.
  { dir: 'components/layout/row' },
  { dir: 'components/layout/column' },
  { dir: 'components/section/blank-section' },

  // Transitive: four _ui files import `MaterialIcon` from here.
  { dir: 'components/element/icon-element' },

  // The render chain itself.
  { dir: 'lib/optimizely/rendering/content-area' },
  { dir: 'lib/optimizely/rendering/visual-builder' },

  // Types the chain is written against.
  { file: 'lib/optimizely/types/experience.ts' },
  { file: 'lib/optimizely/types/display-settings.ts' },
  { file: 'lib/optimizely/types/block.ts' },
  { file: 'lib/optimizely/types/typeUtils.ts' },

  // Transitive: EditableBlock/EditableField wrap every node in the chain.
  { file: 'lib/optimizely/features/draft/draft-mode-context.tsx' },
  { file: 'lib/optimizely/features/draft/editable-block.tsx' },
  { file: 'lib/optimizely/features/draft/editable-field.tsx' },
  { file: 'lib/optimizely/features/draft/editable-html.tsx' },

  // cn + getDisplayValue, the component-to-module map, and the draft class helper.
  { file: 'lib/utils.ts' },
  { file: 'lib/utils/block-factory.tsx' },
  { file: 'lib/utils/draft-helpers.ts' },

  // displaySettings in Graph is an ARRAY of {key,value}; this is the reader for it.
  { file: 'lib/hooks/parseDisplaySettings.ts' },

  // Transitive: content-area/mapper threads an ODP profile through to every renderer.
  // 353 lines of flat interface with no imports of its own, so vendoring beats shimming.
  { file: 'lib/products/odp/types.ts' },

  // The CSS entry point. Patched — see PATCHES['app/globals.css'] — because three of its
  // four imports and two of its unscoped rules duplicate or endanger things this app already
  // does its own way; only the `material-symbols` import and the `--max-width-card` token are
  // new. src/index.css imports the vendored result. See UPSTREAM.md.
  { file: 'app/globals.css' },
]

/** Ours, not upstream's. Never copied, never reported as an orphan. */
const SHIMS = [
  'UPSTREAM.md',
  'lib/optimizely/types/generated.ts',
  'lib/optimizely/features/draft/index.ts',
  'components/block/.gitkeep',
]

const EXCLUDED_DIR = '__stories'

// ---------------------------------------------------------------------------
// The vendored Figma token pipeline (D3)
// ---------------------------------------------------------------------------

/**
 * A second, smaller vendored set. Unlike everything in MANIFEST, these files are NOT under
 * src/vendor/opticom — they live at the REPO ROOT, because the build pipeline
 * (`npm run tokens:build`, wired into `dev` and `build`) reads them from there, exactly where
 * upstream keeps them too. They are still (upstream + recorded patches), so they get the same
 * MANIFEST/PATCHES/SHIMS treatment as everything above, just rooted at REPO_ROOT instead of
 * VENDOR_ROOT — see `syncManifest`'s `destRoot` argument.
 *
 * `tokens/compiled/` is this pipeline's OWN build output (gitignored, like upstream's), never
 * part of the vendored set — nothing here ever names it.
 */
const TOKENS_MANIFEST = [
  { file: 'scripts/build-tokens.js' },
  { file: 'tokens/$metadata.json' },
  { file: 'tokens/$themes.json' },
  { file: 'tokens/themes.json' },
  { dir: 'tokens/Semantic', recurse: true },
  { dir: 'tokens/TailwindCSS', recurse: true },
  { dir: 'tokens/overrides', recurse: true },
]

/** Where orphan-scanning looks for this group, relative to REPO_ROOT — never the whole repo. */
const TOKENS_ORPHAN_SCAN_DIRS = ['tokens']
/** Generated output, gitignored like upstream's own — never orphan-scanned. */
const TOKENS_ORPHAN_IGNORE = 'compiled'

// ---------------------------------------------------------------------------
// The Next-to-Vite patches
// ---------------------------------------------------------------------------

/**
 * Applied to EVERY vendored file. React Server Components' `'use client'` is meaningless in
 * a Vite SPA, and Rollup warns on every module-level directive it cannot hoist.
 */
function stripUseClient(source) {
  return source.replace(/^(﻿)?'use client'\r?\n(\r?\n)?/, (_m, bom) => bom ?? '')
}

/**
 * Per-file edits. Every `find` must appear EXACTLY ONCE in the upstream file or the sync
 * aborts — an upstream rewrite must not silently drop an adaptation.
 */
const PATCHES = {
  'lib/utils.ts': [
    {
      why: "next/navigation does not exist here; ReadonlyURLSearchParams is structurally just { toString(): string }",
      find: "import { ReadonlyURLSearchParams } from 'next/navigation'\n",
      replace: '',
    },
    {
      why: 'same — widen createUrl to the structural type it actually uses',
      find: '  params: URLSearchParams | ReadonlyURLSearchParams\n',
      replace: '  params: URLSearchParams | { toString(): string }\n',
    },
  ],

  'lib/optimizely/rendering/content-area/block.tsx': [
    {
      why: "webpack's require.context does not exist in Vite; import.meta.glob eager matches require.context's synchronous semantics exactly",
      find: `  const blockModules = require.context(
    '../../../../components/block',
    true,
    /^\\.\\/[^\\/]+\\/index\\.tsx$/
  )

  blockModules.keys().forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^\\.\\//, '')
      .replace(/\\/index\\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const mod = blockModules(modulePath) as { default?: BlockComponent }
    if (mod.default) {
      blocks[componentName] = mod.default
    }
  })`,
      replace: `  const blockModules = import.meta.glob<{ default?: BlockComponent }>(
    '../../../../components/block/*/index.tsx',
    { eager: true }
  )

  Object.keys(blockModules).forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^.*\\/components\\/block\\//, '')
      .replace(/\\/index\\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const mod = blockModules[modulePath]
    if (mod.default) {
      blocks[componentName] = mod.default
    }
  })`,
    },
  ],

  'lib/optimizely/rendering/content-area/section.tsx': [
    {
      why: 'same require.context replacement as block.tsx',
      find: `  const sectionModules = require.context(
    '../../../../components/section',
    true,
    /^\\.\\/[^\\/]+\\/index\\.tsx$/
  )

  sectionModules.keys().forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^\\.\\//, '')
      .replace(/\\/index\\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const mod = sectionModules(modulePath) as { default?: SectionComponent }
    if (mod.default) {
      sections[componentName] = mod.default
    }
  })`,
      replace: `  const sectionModules = import.meta.glob<{ default?: SectionComponent }>(
    '../../../../components/section/*/index.tsx',
    { eager: true }
  )

  Object.keys(sectionModules).forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^.*\\/components\\/section\\//, '')
      .replace(/\\/index\\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const mod = sectionModules[modulePath]
    if (mod.default) {
      sections[componentName] = mod.default
    }
  })`,
    },
  ],

  'lib/optimizely/rendering/content-area/element.tsx': [
    {
      why: 'next/dynamic -> React.lazy; elements stay code-split, which is why upstream made this one dynamic and the other two eager',
      find: `import { ComponentType } from 'react'
import dynamic from 'next/dynamic'`,
      replace: `import { ComponentType, Suspense, lazy } from 'react'`,
    },
    {
      why: "require.context -> import.meta.glob (lazy), and React.lazy needs its own Suspense boundary — next/dynamic carried one, React.lazy does not",
      find: `  const elementModules = require.context(
    '../../../../components/element',
    true,
    /^\\.\\/[^/]+\\/index\\.tsx$/
  )

  elementModules.keys().forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^\\.\\//, '')
      .replace(/\\/index\\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    elements[componentName] = dynamic(
      () => import(\`@/components/element/\${folderName}\`)
    )
  })`,
      replace: `  const elementModules = import.meta.glob(
    '../../../../components/element/*/index.tsx'
  )

  Object.keys(elementModules).forEach((modulePath: string) => {
    const folderName = modulePath
      .replace(/^.*\\/components\\/element\\//, '')
      .replace(/\\/index\\.tsx$/, '')

    const componentName = kebabToPascalCase(folderName)

    const Loaded = lazy(
      elementModules[modulePath] as () => Promise<{
        default: ComponentType<ElementProps>
      }>
    )

    function LazyElement(props: ElementProps) {
      return (
        <Suspense fallback={null}>
          <Loaded {...props} />
        </Suspense>
      )
    }
    LazyElement.displayName = \`Lazy(\${componentName})\`

    elements[componentName] = LazyElement
  })`,
    },
  ],

  'components/section/blank-section/index.tsx': [
    {
      why: 'next/dynamic -> React.lazy + an explicit Suspense boundary',
      find: `import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'`,
      replace: `import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react'`,
    },
    {
      why: 'same — React.lazy has no built-in fallback, so wrap it once here',
      find: `const ContentAreaMapper = dynamic(
  () => import('@/lib/optimizely/rendering/content-area/mapper')
)`,
      replace: `const LazyContentAreaMapper = lazy(
  () => import('@/lib/optimizely/rendering/content-area/mapper')
)

function ContentAreaMapper(props: ComponentProps<typeof LazyContentAreaMapper>) {
  return (
    <Suspense fallback={null}>
      <LazyContentAreaMapper {...props} />
    </Suspense>
  )
}`,
    },
  ],

  'components/_ui/accordion/index.tsx': [
    {
      why: "the `motion` package is not installed here; framer-motion v12 is, and motion/react re-exports it",
      find: "from 'motion/react'",
      replace: "from 'framer-motion'",
    },
  ],

  'components/_ui/menubar/index.tsx': [
    {
      why:
        '@radix-ui/react-menubar 1.1.24 types `Menu` as a bare arrow function, which has no ' +
        '`displayName`. Upstream pins ^1.1.16 and resolved an older build where it did. ' +
        'Widening the read keeps the runtime behaviour identical and only silences the type.',
      find: 'MenubarMenu.displayName = MenubarPrimitive.Menu.displayName',
      replace:
        'MenubarMenu.displayName = (\n' +
        '  MenubarPrimitive.Menu as { displayName?: string }\n' +
        ').displayName',
    },
    {
      why:
        'rem-scale mismatch (see UPSTREAM.md and tailwind.config.js\'s rem-scale-mismatch ' +
        'comment): this app rescales every NAMED Tailwind scale step by 16/10 to compensate ' +
        'for its 10px root, but a raw arbitrary value is invisible to that rescale. ' +
        'Upstream\'s `min-w-[12rem]` would render at 120px here instead of the 192px it means ' +
        'at a standard 16px root. `min-w-48` is Tailwind\'s own non-arbitrary step for 12rem ' +
        'and reads from the same rescaled theme every other themed utility in this file does.',
      find:
        "'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] overflow-hidden rounded-md border p-1 shadow-md',",
      replace:
        // No leading spaces on this first line: `find` starts at the `'`, so the 10 spaces of
        // original indentation before it are preserved untouched and this line continues them.
        '/*\n' +
        '           * PATCH (rem-scale-mismatch, see src/vendor/opticom/UPSTREAM.md): upstream spells\n' +
        '           * this utility as an arbitrary bracketed value of 12 rem, which is invisible to\n' +
        "           * this app's root-font-size rescale (tailwind.config.js's rem-scale-mismatch\n" +
        '           * comment) and would render at 120px here instead of the 192px that value means at\n' +
        "           * a standard 16px root. `min-w-48` is Tailwind's own non-arbitrary scale step for\n" +
        '           * 12rem and reads from the same rescaled theme every other themed utility in this\n' +
        '           * file does.\n' +
        '           */\n' +
        "          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-48 overflow-hidden rounded-md border p-1 shadow-md',",
    },
  ],

  'components/_ui/navigation-menu/index.tsx': [
    {
      why:
        "D4 fix: `origin-top-center` is not a Tailwind class (the transform-origin keyword " +
        "vocabulary is center/top/top-right/right/bottom-right/bottom/bottom-left/left/" +
        "top-left — no compound 'top-center'), and it compiles to no rule — confirmed in " +
        "upstream's own source too (unpatched byte-for-byte here otherwise), so this is " +
        "upstream's own typo, not something vendoring introduced. `origin-top` is the exact " +
        "keyword it was reaching for: `transform-origin: top` already means 'top center' — a " +
        "horizontally-centered dropdown anchored at its top edge, which is what this viewport " +
        "is.",
      find: "'origin-top-center bg-popover",
      replace: "'origin-top bg-popover",
    },
  ],

  'components/_ui/toolbar/index.tsx': [
    {
      why:
        'rem-scale mismatch (see UPSTREAM.md and tailwind.config.js\'s rem-scale-mismatch ' +
        'comment): this app rescales every NAMED Tailwind scale step by 16/10 to compensate ' +
        'for its 10px root, but a raw arbitrary value is invisible to that rescale. ' +
        'Upstream\'s `min-h-[2.5rem]` would render at 25px here instead of the 40px it means ' +
        'at a standard 16px root. `min-h-10` is Tailwind\'s own non-arbitrary step for 2.5rem ' +
        'and reads from the same rescaled theme every other themed utility in this file does.',
      // `find` starts at `const toolbarVariants`, not the class string, because the patched
      // file puts the comment ABOVE the declaration rather than inside the `cva(` call.
      find:
        "const toolbarVariants = cva(\n" +
        "  'flex min-h-[2.5rem] w-full items-center gap-1 rounded-md border bg-background p-1',",
      replace:
        '/*\n' +
        ' * PATCH (rem-scale-mismatch, see src/vendor/opticom/UPSTREAM.md): upstream spells this\n' +
        ' * utility as an arbitrary bracketed value of 2.5 rem, which is invisible to this app\'s\n' +
        " * root-font-size rescale (tailwind.config.js's rem-scale-mismatch comment) and would render\n" +
        ' * at 25px here instead of the 40px that value means at a standard 16px root. `min-h-10` is\n' +
        " * Tailwind's own non-arbitrary scale step for 2.5rem and reads from the same rescaled theme\n" +
        ' * every other themed utility in this file does.\n' +
        ' */\n' +
        "const toolbarVariants = cva(\n" +
        "  'flex min-h-10 w-full items-center gap-1 rounded-md border bg-background p-1',",
    },
  ],

  'lib/products/odp/types.ts': [
    {
      why:
        'this `declare global` collides with the repo\'s own Window.zaius in ' +
        'src/hooks/useOdpTracking.ts (TS2717 + TS2687, and it breaks that file too). ' +
        'The repo already owns the ODP globals; this module is vendored only for ' +
        'DataPlatformProfile, which the content-area mapper threads through to renderers.',
      find: `declare global {
  interface Window {
    zaius?: OptimizelyDataPlatformApi
    _iaq?: OptimizelyContentRecsApi
    optimizely?: OptimizelyWebExperimentationApi
  }
}

`,
      replace: `// [vendor patch] Upstream declares Window.zaius / _iaq / optimizely here. The repo already
// declares Window.zaius in src/hooks/useOdpTracking.ts with a different shape, and two
// conflicting augmentations fail BOTH files. See UPSTREAM.md.

`,
    },
  ],

  'app/globals.css': [
    {
      why:
        "none of these five lines survive vendoring, for three different reasons. " +
        "`@import 'tailwindcss'` would load a SECOND, really-layered copy of Tailwind next to " +
        "this app's deliberately-flattened `theme.css`/`preflight.css`/`utilities.css` split — " +
        "exactly the real-cascade-layer bug that split exists to avoid (see the header comment " +
        "in src/index.css). `../tokens/compiled/default.css` is the same token file " +
        "src/index.css already imports once, and `@plugin '@tailwindcss/typography'` is already " +
        "declared once there too — both a second time here is pure redundancy. `./fonts.css` is " +
        "a path this repo does not vendor; the same VC Nudge / Die Grotesk B faces are already " +
        "self-hosted from src/styles/greenfield.css. `material-symbols/rounded.css` IS the D1 " +
        "fix, but not from here: routing it through this file means through Tailwind's own " +
        "`@import` resolution (`@tailwindcss/postcss`, which processes the whole graph starting " +
        "from index.css), and that breaks Vite's asset handling for the package's relative " +
        "`url(./material-symbols-rounded.woff2)` — measured with `npm run build`: the font file " +
        "is never copied into dist/assets and the url is left unrewritten, so every icon would " +
        "silently 404 in production while looking fine in dev. It is imported instead as a " +
        "plain JS side effect in src/main.tsx, which Vite's normal CSS-asset pipeline handles " +
        "correctly — see that file's own comment.",
      find: "@import 'tailwindcss';\n@import '../tokens/compiled/default.css';\n@import './fonts.css';\n@import 'material-symbols/rounded.css';\n@plugin '@tailwindcss/typography';\n\n",
      replace: '',
    },
    {
      why:
        "both rules are LIVE and unscoped, so importing them verbatim would reach the four " +
        "legacy templates this phase must not move. `.prose`'s `--tw-prose-*: currentColor` " +
        "reset would repaint the two retail components that already use `.prose` today " +
        "(ClosingReflection.tsx, WornThisYear.tsx) against @tailwindcss/typography's own " +
        "defaults. The plain `body { font-family: var(--font-body)… }` would override this " +
        "app's own unlayered `body {}` rule (src/index.css) that the ABM/retail/finserv " +
        "templates render against. Neither rule is part of D1/D2 (the icon font and " +
        "`--max-width-card`), so both are dropped rather than risking the regression the audit " +
        "already measured as passing.",
      find: ".prose {\n  --tw-prose-body: currentColor;\n  --tw-prose-headings: currentColor;\n  --tw-prose-lead: currentColor;\n  --tw-prose-links: currentColor;\n  --tw-prose-bold: currentColor;\n  --tw-prose-counters: currentColor;\n  --tw-prose-bullets: currentColor;\n  --tw-prose-hr: currentColor;\n  --tw-prose-quotes: currentColor;\n  --tw-prose-quote-borders: currentColor;\n  --tw-prose-captions: currentColor;\n  --tw-prose-kbd: currentColor;\n  --tw-prose-code: currentColor;\n  --tw-prose-th-borders: currentColor;\n  --tw-prose-td-borders: currentColor;\n}\n\nbody {\n  font-family: var(--font-body), Arial, Helvetica, sans-serif;\n}\n\n",
      replace: '',
    },
  ],

  'scripts/build-tokens.js': [
    {
      why:
        'upstream resolves every token path against process.cwd(), fine for a script only ever ' +
        'run as an npm script from the repo root. This one also runs from scripts/ and from the ' +
        'visual-baseline capture harness, so paths are resolved against the repo root instead.',
      find: "import { readdirSync, existsSync, rmSync, readFileSync } from 'fs'\n\nregister(StyleDictionary)",
      replace:
        "import { readdirSync, existsSync, rmSync, readFileSync } from 'fs'\n" +
        "import path from 'path'\n" +
        "import { fileURLToPath } from 'url'\n\n" +
        '/*\n' +
        ' * Vendored from optimizely.com\'s "opticom" app. The only change from upstream is\n' +
        ' * this block: upstream resolves every token path against process.cwd(), which is\n' +
        ' * fine for a script that is only ever run as an npm script from the repo root.\n' +
        ' * Here it is also run from scripts/ and from a capture harness, so paths are\n' +
        ' * resolved against the repo root instead.\n' +
        ' */\n' +
        "const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')\n" +
        'const repoPath = (...segments) => path.join(REPO, ...segments)\n\n' +
        'register(StyleDictionary)',
    },
    {
      why: 'same — resolve against the repo root, not cwd',
      find: "  const themesFile = 'tokens/themes.json'",
      replace: "  const themesFile = repoPath('tokens/themes.json')",
    },
    {
      why: 'same',
      find: "  const themesDir = 'tokens/TailwindCSS'",
      replace: "  const themesDir = repoPath('tokens/TailwindCSS')",
    },
    {
      why: 'same',
      find:
        '  const tailwindPath = `tokens/TailwindCSS/${themeName}.json`\n' +
        '  const semanticPath = `tokens/Semantic/${themeName}.json`\n' +
        '  const overridePath = `tokens/overrides/${themeName}.json`',
      replace:
        "  const tailwindPath = repoPath('tokens/TailwindCSS', `${themeName}.json`)\n" +
        "  const semanticPath = repoPath('tokens/Semantic', `${themeName}.json`)\n" +
        "  const overridePath = repoPath('tokens/overrides', `${themeName}.json`)",
    },
    {
      why: 'same',
      find: "        buildPath: 'tokens/compiled/',",
      replace: "        buildPath: repoPath('tokens/compiled') + path.sep,",
    },
    {
      why: 'same',
      find:
        "if (existsSync('tokens/compiled')) {\n" +
        "  rmSync('tokens/compiled', { recursive: true, force: true })",
      replace:
        "if (existsSync(repoPath('tokens/compiled'))) {\n" +
        "  rmSync(repoPath('tokens/compiled'), { recursive: true, force: true })",
    },
  ],

  'components/layout/column/display-settings.ts': [
    {
      why:
        'the many-cardinality layout fix: a column can hold several sibling item nodes ' +
        '(one many-cardinality feed\'s worth) and upstream gives it no vocabulary to ' +
        'arrange them, only RowDisplayTemplate\'s gridColumns/displayMode/gap settings, ' +
        'copied here onto Column so an editor sees the same choices on either node. See ' +
        'UPSTREAM.md \'Feature patches\'.',
      find: `        ],
      },
    ],
  },
] as const
`,
      replace: `        ],
      },
      {
        key: 'displayMode',
        displayName: 'Display Mode',
        description: 'Layout mode for this column\\'s own children',
        type: 'select',
        required: false,
        options: [
          {
            value: 'flex',
            displayName: 'Flex',
          },
          {
            value: 'grid',
            displayName: 'Grid',
          },
        ],
        defaultValue: 'flex',
      },
      {
        key: 'gridColumns',
        displayName: 'Grid Columns',
        description: 'Number of columns in this column\\'s own grid (base/sm breakpoint), when Display Mode is Grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'cols_1',
      },
      {
        key: 'gridColumnsMd',
        displayName: 'Grid Columns (md)',
        description: 'Number of columns at md breakpoint and above, when Display Mode is Grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit from base',
          },
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'gridColumnsLg',
        displayName: 'Grid Columns (lg)',
        description: 'Number of columns at lg breakpoint and above, when Display Mode is Grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit from md',
          },
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'gridColumnsXl',
        displayName: 'Grid Columns (xl)',
        description: 'Number of columns at xl breakpoint and above, when Display Mode is Grid',
        type: 'select',
        required: false,
        options: [
          {
            value: 'inherit',
            displayName: 'Inherit from lg',
          },
          {
            value: 'auto',
            displayName: 'Auto',
          },
          {
            value: 'none',
            displayName: 'None',
          },
          {
            value: 'cols_1',
            displayName: '1 Column',
          },
          {
            value: 'cols_2',
            displayName: '2 Columns',
          },
          {
            value: 'cols_3',
            displayName: '3 Columns',
          },
          {
            value: 'cols_4',
            displayName: '4 Columns',
          },
          {
            value: 'cols_5',
            displayName: '5 Columns',
          },
          {
            value: 'cols_6',
            displayName: '6 Columns',
          },
          {
            value: 'cols_7',
            displayName: '7 Columns',
          },
          {
            value: 'cols_8',
            displayName: '8 Columns',
          },
          {
            value: 'cols_9',
            displayName: '9 Columns',
          },
          {
            value: 'cols_10',
            displayName: '10 Columns',
          },
          {
            value: 'cols_11',
            displayName: '11 Columns',
          },
          {
            value: 'cols_12',
            displayName: '12 Columns',
          },
        ],
        defaultValue: 'inherit',
      },
      {
        key: 'gap',
        displayName: 'Gap',
        description: 'Spacing between this column\\'s own child items',
        type: 'select',
        required: false,
        options: [
          {
            value: 'none',
            displayName: 'None (0)',
          },
          {
            value: 'xs',
            displayName: 'Extra Small (0.5rem)',
          },
          {
            value: 'sm',
            displayName: 'Small (1rem)',
          },
          {
            value: 'md',
            displayName: 'Medium (1.5rem)',
          },
          {
            value: 'lg',
            displayName: 'Large (2rem)',
          },
          {
            value: 'xl',
            displayName: 'Extra Large (3rem)',
          },
        ],
        defaultValue: 'none',
      },
    ],
  },
] as const
`,
    },
  ],

  'components/layout/column/index.tsx': [
    {
      why:
        'the component half of the same many-cardinality layout fix: reads the six new ' +
        'display-settings.ts settings and renders them, mirroring ' +
        'components/layout/row/index.tsx\'s own displayMode/gridColumns*/gap handling. ' +
        'One find/replace because the change touches nearly every line below the imports ' +
        '(the gap helper is new module-level code, and the cva base class moves from a ' +
        'fixed string into the displayMode variant itself). See UPSTREAM.md \'Feature ' +
        'patches\'.',
      find: `export const columnVariants = cva(
  'flex flex-1 flex-col flex-nowrap justify-start',
  {
    variants: {
      colSpan: {
        auto: '',
        full: 'col-span-full',
        span_1: 'col-span-1',
        span_2: 'col-span-2',
        span_3: 'col-span-3',
        span_4: 'col-span-4',
        span_5: 'col-span-5',
        span_6: 'col-span-6',
        span_7: 'col-span-7',
        span_8: 'col-span-8',
        span_9: 'col-span-9',
        span_10: 'col-span-10',
        span_11: 'col-span-11',
        span_12: 'col-span-12',
      } satisfies Record<NonNullable<DisplaySettingValues['colSpan']>, string>,
      colStart: {
        auto: '',
        start_1: 'col-start-1',
        start_2: 'col-start-2',
        start_3: 'col-start-3',
        start_4: 'col-start-4',
        start_5: 'col-start-5',
        start_6: 'col-start-6',
        start_7: 'col-start-7',
        start_8: 'col-start-8',
        start_9: 'col-start-9',
        start_10: 'col-start-10',
        start_11: 'col-start-11',
        start_12: 'col-start-12',
        start_13: 'col-start-13',
      } satisfies Record<NonNullable<DisplaySettingValues['colStart']>, string>,
      colEnd: {
        auto: '',
        end_1: 'col-end-1',
        end_2: 'col-end-2',
        end_3: 'col-end-3',
        end_4: 'col-end-4',
        end_5: 'col-end-5',
        end_6: 'col-end-6',
        end_7: 'col-end-7',
        end_8: 'col-end-8',
        end_9: 'col-end-9',
        end_10: 'col-end-10',
        end_11: 'col-end-11',
        end_12: 'col-end-12',
        end_13: 'col-end-13',
      } satisfies Record<NonNullable<DisplaySettingValues['colEnd']>, string>,
      rowSpan: {
        auto: '',
        full: 'row-span-full',
        row_span_1: 'row-span-1',
        row_span_2: 'row-span-2',
        row_span_3: 'row-span-3',
        row_span_4: 'row-span-4',
        row_span_5: 'row-span-5',
        row_span_6: 'row-span-6',
      } satisfies Record<NonNullable<DisplaySettingValues['rowSpan']>, string>,
      rowStart: {
        auto: '',
        row_start_1: 'row-start-1',
        row_start_2: 'row-start-2',
        row_start_3: 'row-start-3',
        row_start_4: 'row-start-4',
        row_start_5: 'row-start-5',
        row_start_6: 'row-start-6',
        row_start_7: 'row-start-7',
      } satisfies Record<NonNullable<DisplaySettingValues['rowStart']>, string>,
      rowEnd: {
        auto: '',
        row_end_1: 'row-end-1',
        row_end_2: 'row-end-2',
        row_end_3: 'row-end-3',
        row_end_4: 'row-end-4',
        row_end_5: 'row-end-5',
        row_end_6: 'row-end-6',
        row_end_7: 'row-end-7',
      } satisfies Record<NonNullable<DisplaySettingValues['rowEnd']>, string>,
      justifySelf: {
        auto: '',
        start: 'justify-self-start',
        center: 'justify-self-center',
        end: 'justify-self-end',
        stretch: 'justify-self-stretch',
      } satisfies Record<
        NonNullable<DisplaySettingValues['justifySelf']>,
        string
      >,
      alignSelf: {
        auto: '',
        start: 'self-start',
        center: 'self-center',
        end: 'self-end',
        stretch: 'self-stretch',
        baseline: 'self-baseline',
      } satisfies Record<
        NonNullable<DisplaySettingValues['alignSelf']>,
        string
      >,
      order: {
        none: '',
        first: 'order-first',
        last: 'order-last',
        order_1: 'order-1',
        order_2: 'order-2',
        order_3: 'order-3',
        order_4: 'order-4',
        order_5: 'order-5',
        order_6: 'order-6',
        order_7: 'order-7',
        order_8: 'order-8',
        order_9: 'order-9',
        order_10: 'order-10',
        order_11: 'order-11',
        order_12: 'order-12',
      } satisfies Record<NonNullable<DisplaySettingValues['order']>, string>,
    },
  }
)

export default function Column({
  displaySettings,
  className,
  children,
  preview,
  ...props
}: ColumnProps) {
  const customClassName = getDisplayValue(displaySettings, 'className')

  return (
    <div
      className={cn(
        columnVariants({
          colSpan: getDisplayValue(
            displaySettings,
            'colSpan'
          ) as ColumnVariants['colSpan'],
          colStart: getDisplayValue(
            displaySettings,
            'colStart'
          ) as ColumnVariants['colStart'],
          colEnd: getDisplayValue(
            displaySettings,
            'colEnd'
          ) as ColumnVariants['colEnd'],
          rowSpan: getDisplayValue(
            displaySettings,
            'rowSpan'
          ) as ColumnVariants['rowSpan'],
          rowStart: getDisplayValue(
            displaySettings,
            'rowStart'
          ) as ColumnVariants['rowStart'],
          rowEnd: getDisplayValue(
            displaySettings,
            'rowEnd'
          ) as ColumnVariants['rowEnd'],
          justifySelf: getDisplayValue(
            displaySettings,
            'justifySelf'
          ) as ColumnVariants['justifySelf'],
          alignSelf: getDisplayValue(
            displaySettings,
            'alignSelf'
          ) as ColumnVariants['alignSelf'],
          order: getDisplayValue(
            displaySettings,
            'order'
          ) as ColumnVariants['order'],
        }),
        draftClass(preview, 'vb:col'),
        customClassName,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
`,
      replace: `/**
 * \`gap\`'s six sizes, identical to Row's own \`gap\` ladder (\`layout/row/index.tsx\`'s
 * \`gapClassMap.gap\`) — same rem values, so a column and a row that both say "sm" read the
 * same. Not exported: Column has no \`columnGap\` / \`rowGap\` split, only one axis of children.
 */
const gapClassMap = {
  none: 'gap-0',
  xs: 'gap-2',
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
  xl: 'gap-12',
} as const

type GapSize = keyof typeof gapClassMap

export const columnVariants = cva('', {
  variants: {
    /**
     * This column's OWN layout mode for its children — added, not upstream's (see
     * \`display-settings.ts\` and \`UPSTREAM.md\`). \`flex\` reproduces the exact base class this
     * component always rendered before the patch, so an unconfigured column is unchanged.
     */
    displayMode: {
      flex: 'flex flex-1 flex-col flex-nowrap justify-start',
      grid: 'grid',
    } satisfies Record<NonNullable<DisplaySettingValues['displayMode']>, string>,
    /** Added. Same vocabulary as \`RowDisplayTemplate.gridColumns\` — see \`display-settings.ts\`. */
    gridColumns: {
      auto: 'grid-cols-auto',
      none: '',
      cols_1: 'grid-cols-1',
      cols_2: 'grid-cols-2',
      cols_3: 'grid-cols-3',
      cols_4: 'grid-cols-4',
      cols_5: 'grid-cols-5',
      cols_6: 'grid-cols-6',
      cols_7: 'grid-cols-7',
      cols_8: 'grid-cols-8',
      cols_9: 'grid-cols-9',
      cols_10: 'grid-cols-10',
      cols_11: 'grid-cols-11',
      cols_12: 'grid-cols-12',
    } satisfies Record<NonNullable<DisplaySettingValues['gridColumns']>, string>,
    gridColumnsMd: {
      inherit: '',
      auto: 'md:grid-cols-auto',
      none: 'md:grid-cols-none',
      cols_1: 'md:grid-cols-1',
      cols_2: 'md:grid-cols-2',
      cols_3: 'md:grid-cols-3',
      cols_4: 'md:grid-cols-4',
      cols_5: 'md:grid-cols-5',
      cols_6: 'md:grid-cols-6',
      cols_7: 'md:grid-cols-7',
      cols_8: 'md:grid-cols-8',
      cols_9: 'md:grid-cols-9',
      cols_10: 'md:grid-cols-10',
      cols_11: 'md:grid-cols-11',
      cols_12: 'md:grid-cols-12',
    } satisfies Record<NonNullable<DisplaySettingValues['gridColumnsMd']>, string>,
    gridColumnsLg: {
      inherit: '',
      auto: 'lg:grid-cols-auto',
      none: 'lg:grid-cols-none',
      cols_1: 'lg:grid-cols-1',
      cols_2: 'lg:grid-cols-2',
      cols_3: 'lg:grid-cols-3',
      cols_4: 'lg:grid-cols-4',
      cols_5: 'lg:grid-cols-5',
      cols_6: 'lg:grid-cols-6',
      cols_7: 'lg:grid-cols-7',
      cols_8: 'lg:grid-cols-8',
      cols_9: 'lg:grid-cols-9',
      cols_10: 'lg:grid-cols-10',
      cols_11: 'lg:grid-cols-11',
      cols_12: 'lg:grid-cols-12',
    } satisfies Record<NonNullable<DisplaySettingValues['gridColumnsLg']>, string>,
    gridColumnsXl: {
      inherit: '',
      auto: 'xl:grid-cols-auto',
      none: 'xl:grid-cols-none',
      cols_1: 'xl:grid-cols-1',
      cols_2: 'xl:grid-cols-2',
      cols_3: 'xl:grid-cols-3',
      cols_4: 'xl:grid-cols-4',
      cols_5: 'xl:grid-cols-5',
      cols_6: 'xl:grid-cols-6',
      cols_7: 'xl:grid-cols-7',
      cols_8: 'xl:grid-cols-8',
      cols_9: 'xl:grid-cols-9',
      cols_10: 'xl:grid-cols-10',
      cols_11: 'xl:grid-cols-11',
      cols_12: 'xl:grid-cols-12',
    } satisfies Record<NonNullable<DisplaySettingValues['gridColumnsXl']>, string>,
    colSpan: {
      auto: '',
      full: 'col-span-full',
      span_1: 'col-span-1',
      span_2: 'col-span-2',
      span_3: 'col-span-3',
      span_4: 'col-span-4',
      span_5: 'col-span-5',
      span_6: 'col-span-6',
      span_7: 'col-span-7',
      span_8: 'col-span-8',
      span_9: 'col-span-9',
      span_10: 'col-span-10',
      span_11: 'col-span-11',
      span_12: 'col-span-12',
    } satisfies Record<NonNullable<DisplaySettingValues['colSpan']>, string>,
    colStart: {
      auto: '',
      start_1: 'col-start-1',
      start_2: 'col-start-2',
      start_3: 'col-start-3',
      start_4: 'col-start-4',
      start_5: 'col-start-5',
      start_6: 'col-start-6',
      start_7: 'col-start-7',
      start_8: 'col-start-8',
      start_9: 'col-start-9',
      start_10: 'col-start-10',
      start_11: 'col-start-11',
      start_12: 'col-start-12',
      start_13: 'col-start-13',
    } satisfies Record<NonNullable<DisplaySettingValues['colStart']>, string>,
    colEnd: {
      auto: '',
      end_1: 'col-end-1',
      end_2: 'col-end-2',
      end_3: 'col-end-3',
      end_4: 'col-end-4',
      end_5: 'col-end-5',
      end_6: 'col-end-6',
      end_7: 'col-end-7',
      end_8: 'col-end-8',
      end_9: 'col-end-9',
      end_10: 'col-end-10',
      end_11: 'col-end-11',
      end_12: 'col-end-12',
      end_13: 'col-end-13',
    } satisfies Record<NonNullable<DisplaySettingValues['colEnd']>, string>,
    rowSpan: {
      auto: '',
      full: 'row-span-full',
      row_span_1: 'row-span-1',
      row_span_2: 'row-span-2',
      row_span_3: 'row-span-3',
      row_span_4: 'row-span-4',
      row_span_5: 'row-span-5',
      row_span_6: 'row-span-6',
    } satisfies Record<NonNullable<DisplaySettingValues['rowSpan']>, string>,
    rowStart: {
      auto: '',
      row_start_1: 'row-start-1',
      row_start_2: 'row-start-2',
      row_start_3: 'row-start-3',
      row_start_4: 'row-start-4',
      row_start_5: 'row-start-5',
      row_start_6: 'row-start-6',
      row_start_7: 'row-start-7',
    } satisfies Record<NonNullable<DisplaySettingValues['rowStart']>, string>,
    rowEnd: {
      auto: '',
      row_end_1: 'row-end-1',
      row_end_2: 'row-end-2',
      row_end_3: 'row-end-3',
      row_end_4: 'row-end-4',
      row_end_5: 'row-end-5',
      row_end_6: 'row-end-6',
      row_end_7: 'row-end-7',
    } satisfies Record<NonNullable<DisplaySettingValues['rowEnd']>, string>,
    justifySelf: {
      auto: '',
      start: 'justify-self-start',
      center: 'justify-self-center',
      end: 'justify-self-end',
      stretch: 'justify-self-stretch',
    } satisfies Record<
      NonNullable<DisplaySettingValues['justifySelf']>,
      string
    >,
    alignSelf: {
      auto: '',
      start: 'self-start',
      center: 'self-center',
      end: 'self-end',
      stretch: 'self-stretch',
      baseline: 'self-baseline',
    } satisfies Record<
      NonNullable<DisplaySettingValues['alignSelf']>,
      string
    >,
    order: {
      none: '',
      first: 'order-first',
      last: 'order-last',
      order_1: 'order-1',
      order_2: 'order-2',
      order_3: 'order-3',
      order_4: 'order-4',
      order_5: 'order-5',
      order_6: 'order-6',
      order_7: 'order-7',
      order_8: 'order-8',
      order_9: 'order-9',
      order_10: 'order-10',
      order_11: 'order-11',
      order_12: 'order-12',
    } satisfies Record<NonNullable<DisplaySettingValues['order']>, string>,
  },
  defaultVariants: {
    displayMode: 'flex',
  },
})

export default function Column({
  displaySettings,
  className,
  children,
  preview,
  ...props
}: ColumnProps) {
  const customClassName = getDisplayValue(displaySettings, 'className')

  const displayMode = (getDisplayValue(displaySettings, 'displayMode') ||
    'flex') as DisplaySettingValues['displayMode']
  const isGridMode = displayMode === 'grid'

  const gap = getDisplayValue(displaySettings, 'gap') as GapSize | undefined
  const gapClass = gap && gap !== 'none' ? gapClassMap[gap] : undefined

  return (
    <div
      className={cn(
        columnVariants({
          displayMode: displayMode as ColumnVariants['displayMode'],
          gridColumns: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumns'
              ) as ColumnVariants['gridColumns'])
            : undefined,
          gridColumnsMd: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumnsMd'
              ) as ColumnVariants['gridColumnsMd'])
            : undefined,
          gridColumnsLg: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumnsLg'
              ) as ColumnVariants['gridColumnsLg'])
            : undefined,
          gridColumnsXl: isGridMode
            ? (getDisplayValue(
                displaySettings,
                'gridColumnsXl'
              ) as ColumnVariants['gridColumnsXl'])
            : undefined,
          colSpan: getDisplayValue(
            displaySettings,
            'colSpan'
          ) as ColumnVariants['colSpan'],
          colStart: getDisplayValue(
            displaySettings,
            'colStart'
          ) as ColumnVariants['colStart'],
          colEnd: getDisplayValue(
            displaySettings,
            'colEnd'
          ) as ColumnVariants['colEnd'],
          rowSpan: getDisplayValue(
            displaySettings,
            'rowSpan'
          ) as ColumnVariants['rowSpan'],
          rowStart: getDisplayValue(
            displaySettings,
            'rowStart'
          ) as ColumnVariants['rowStart'],
          rowEnd: getDisplayValue(
            displaySettings,
            'rowEnd'
          ) as ColumnVariants['rowEnd'],
          justifySelf: getDisplayValue(
            displaySettings,
            'justifySelf'
          ) as ColumnVariants['justifySelf'],
          alignSelf: getDisplayValue(
            displaySettings,
            'alignSelf'
          ) as ColumnVariants['alignSelf'],
          order: getDisplayValue(
            displaySettings,
            'order'
          ) as ColumnVariants['order'],
        }),
        gapClass,
        draftClass(preview, 'vb:col'),
        customClassName,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
`,
    },
  ],
}

// ---------------------------------------------------------------------------
// Machinery
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { check: false, upstream: process.env.OPTICOM_UPSTREAM ?? '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--check') args.check = true
    else if (arg === '--upstream') args.upstream = argv[++i] ?? ''
    else if (arg.startsWith('--upstream=')) args.upstream = arg.slice('--upstream='.length)
    else {
      console.error(`unknown argument: ${arg}`)
      process.exit(2)
    }
  }
  return args
}

function walk(dir, recurse, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === EXCLUDED_DIR || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (recurse) walk(full, recurse, acc)
    } else if (entry.isFile()) {
      acc.push(full)
    }
  }
  return acc
}

/** Every relative path `manifest` resolves to, against a given upstream root. */
function manifestFiles(upstream, manifest) {
  const out = []
  for (const entry of manifest) {
    if (entry.file) {
      const full = join(upstream, entry.file)
      if (!existsSync(full)) {
        throw new Error(`manifest lists ${entry.file}, which is not in the upstream tree`)
      }
      out.push(entry.file)
      continue
    }
    const full = join(upstream, entry.dir)
    if (!existsSync(full) || !statSync(full).isDirectory()) {
      throw new Error(`manifest lists ${entry.dir}/, which is not a directory in the upstream tree`)
    }
    for (const file of walk(full, entry.recurse === true)) {
      out.push(relative(upstream, file).split(sep).join('/'))
    }
  }
  return [...new Set(out)].sort()
}

/** Upstream bytes with every recorded adaptation applied. Throws if a patch no longer fits. */
function transform(relPath, source) {
  let out = stripUseClient(source)
  for (const patch of PATCHES[relPath] ?? []) {
    const hits = out.split(patch.find).length - 1
    if (hits !== 1) {
      throw new Error(
        `patch for ${relPath} matched ${hits} times, expected exactly 1.\n` +
          `  why: ${patch.why}\n` +
          `  find: ${JSON.stringify(patch.find.slice(0, 120))}…\n` +
          `  Upstream changed. Re-derive the patch against the new source — do not hand-edit ` +
          `the vendored file, the next sync would overwrite it.`
      )
    }
    out = out.split(patch.find).join(patch.replace)
  }
  return out
}

/**
 * Everything currently on disk, relative and slash-joined.
 *
 * With no `subdirs`, walks the whole of `root` (the VENDOR_ROOT case: every file under
 * src/vendor/opticom belongs to the vendored set, so the whole tree is fair game for orphan
 * detection). With `subdirs`, only those directories under `root` are walked — the TOKENS
 * case, where `root` is the REPO ROOT and scanning the whole repo for orphans would be
 * nonsense. `ignoreName` skips one directory name at any depth (TOKENS' own `compiled/`
 * build output).
 */
function onDiskFiles(root, subdirs, ignoreName) {
  const starts = subdirs ? subdirs.map((d) => join(root, d)) : [root]
  const out = []
  for (const start of starts) {
    if (!existsSync(start)) continue
    const stack = [start]
    while (stack.length) {
      const dir = stack.pop()
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (ignoreName && entry.isDirectory() && entry.name === ignoreName) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else out.push(relative(root, full).split(sep).join('/'))
      }
    }
  }
  return out.sort()
}

/**
 * Syncs one manifest/shims/patches group against `upstream`, rooted at `destRoot`. Shared by
 * the src/vendor/opticom group and the repo-root token-pipeline group (D3) — the only
 * difference between them is `destRoot` and which files count for orphan-scanning.
 */
function syncManifest({ upstream, manifest, shims, destRoot, orphanSubdirs, orphanIgnore, check }) {
  const wanted = manifestFiles(upstream, manifest)
  const shimSet = new Set(shims)
  const added = []
  const changed = []
  const unchanged = []

  for (const relPath of wanted) {
    if (shimSet.has(relPath)) {
      throw new Error(`${relPath} is listed in both a MANIFEST and SHIMS — pick one`)
    }
    const next = transform(relPath, readFileSync(join(upstream, relPath), 'utf8'))
    const dest = join(destRoot, relPath)
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null

    if (current === null) added.push(relPath)
    else if (current !== next) changed.push(relPath)
    else {
      unchanged.push(relPath)
      continue
    }

    if (!check) {
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, next)
    }
  }

  const expected = new Set([...wanted, ...shimSet])
  const onDisk = onDiskFiles(destRoot, orphanSubdirs, orphanIgnore)
  const orphans = onDisk.filter((f) => !expected.has(f))
  if (!check) {
    for (const orphan of orphans) rmSync(join(destRoot, orphan))
  }

  const missingShims = shims.filter((s) => !existsSync(join(destRoot, s)))

  return { wanted, added, changed, unchanged, orphans, missingShims }
}

function report(label, patchCount, shimCount, result, check) {
  console.log(`\n${label}`)
  console.log(`  vendored   ${result.wanted.length} file(s)  (+${shimCount} local shim(s))`)
  console.log(`  patched    ${patchCount} file(s) carry recorded edits`)
  for (const f of result.added) console.log(`    added     ${f}`)
  for (const f of result.changed) console.log(`    ${check ? 'DRIFT    ' : 'updated  '} ${f}`)
  for (const f of result.orphans) console.log(`    ${check ? 'ORPHAN   ' : 'removed  '} ${f}`)
  for (const f of result.missingShims) console.log(`    MISSING SHIM ${f}`)
  console.log(`  unchanged  ${result.unchanged.length}`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.upstream) {
    console.error(
      'No upstream path. Pass --upstream <path> or set OPTICOM_UPSTREAM.\n' +
        'It is the root of an unpacked OptimizelyHeadless zip — the directory holding\n' +
        'components/, lib/ and next.config.ts. See src/vendor/opticom/UPSTREAM.md.'
    )
    process.exit(2)
  }
  const upstream = resolve(args.upstream)
  if (!existsSync(join(upstream, 'components')) || !existsSync(join(upstream, 'lib'))) {
    console.error(`${upstream} does not look like an opticom checkout (no components/ + lib/).`)
    process.exit(2)
  }

  const vendorPatchCount = Object.keys(PATCHES).filter(
    (k) => !TOKENS_MANIFEST.some((e) => e.file === k)
  ).length

  const vendorResult = syncManifest({
    upstream,
    manifest: MANIFEST,
    shims: SHIMS,
    destRoot: VENDOR_ROOT,
    check: args.check,
  })

  const tokensResult = syncManifest({
    upstream,
    manifest: TOKENS_MANIFEST,
    shims: [],
    destRoot: REPO_ROOT,
    orphanSubdirs: TOKENS_ORPHAN_SCAN_DIRS,
    orphanIgnore: TOKENS_ORPHAN_IGNORE,
    check: args.check,
  })

  console.log(`upstream   ${upstream}`)
  report('src/vendor/opticom', vendorPatchCount, SHIMS.length, vendorResult, args.check)
  report('token pipeline (repo root)', PATCHES['scripts/build-tokens.js'] ? 1 : 0, 0, tokensResult, args.check)

  const drift =
    vendorResult.added.length ||
    vendorResult.changed.length ||
    vendorResult.orphans.length ||
    vendorResult.missingShims.length ||
    tokensResult.added.length ||
    tokensResult.changed.length ||
    tokensResult.orphans.length

  if (args.check && drift) {
    console.error(
      '\nsrc/vendor/opticom and/or the token pipeline are NOT (upstream + the recorded ' +
        'patches). Re-run without --check.'
    )
    process.exit(1)
  }
  if (vendorResult.missingShims.length) {
    console.error('\nA shim listed in SHIMS is missing. The vendored files will not resolve.')
    process.exit(1)
  }
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}
