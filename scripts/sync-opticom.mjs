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

/** Every relative path the manifest resolves to, against a given upstream root. */
function manifestFiles(upstream) {
  const out = []
  for (const entry of MANIFEST) {
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

/** Everything currently on disk under src/vendor/opticom, relative and slash-joined. */
function vendoredOnDisk() {
  if (!existsSync(VENDOR_ROOT)) return []
  const out = []
  const stack = [VENDOR_ROOT]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else out.push(relative(VENDOR_ROOT, full).split(sep).join('/'))
    }
  }
  return out.sort()
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

  const wanted = manifestFiles(upstream)
  const shims = new Set(SHIMS)
  const added = []
  const changed = []
  const unchanged = []

  for (const relPath of wanted) {
    if (shims.has(relPath)) {
      throw new Error(`${relPath} is listed in both MANIFEST and SHIMS — pick one`)
    }
    const next = transform(relPath, readFileSync(join(upstream, relPath), 'utf8'))
    const dest = join(VENDOR_ROOT, relPath)
    const current = existsSync(dest) ? readFileSync(dest, 'utf8') : null

    if (current === null) added.push(relPath)
    else if (current !== next) changed.push(relPath)
    else {
      unchanged.push(relPath)
      continue
    }

    if (!args.check) {
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, next)
    }
  }

  const expected = new Set([...wanted, ...shims])
  const orphans = vendoredOnDisk().filter((f) => !expected.has(f))
  if (!args.check) {
    for (const orphan of orphans) rmSync(join(VENDOR_ROOT, orphan))
  }

  const missingShims = SHIMS.filter((s) => !existsSync(join(VENDOR_ROOT, s)))

  console.log(`upstream   ${upstream}`)
  console.log(`vendored   ${wanted.length} file(s)  (+${SHIMS.length} local shim(s))`)
  console.log(`patched    ${Object.keys(PATCHES).length} file(s) carry recorded edits`)
  for (const f of added) console.log(`  added     ${f}`)
  for (const f of changed) console.log(`  ${args.check ? 'DRIFT    ' : 'updated  '} ${f}`)
  for (const f of orphans) console.log(`  ${args.check ? 'ORPHAN   ' : 'removed  '} ${f}`)
  for (const f of missingShims) console.log(`  MISSING SHIM ${f}`)
  console.log(`unchanged  ${unchanged.length}`)

  if (args.check && (added.length || changed.length || orphans.length || missingShims.length)) {
    console.error('\nsrc/vendor/opticom is NOT (upstream + the recorded patches). Re-run without --check.')
    process.exit(1)
  }
  if (missingShims.length) {
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
