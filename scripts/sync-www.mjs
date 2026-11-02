#!/usr/bin/env node
/**
 * sync-www.mjs: vendors optimizely.com's own React components into src/vendor/www.
 *
 *   node scripts/sync-www.mjs --upstream <OptimizelyHeadless checkout>          # copy + patch
 *   node scripts/sync-www.mjs --upstream <OptimizelyHeadless checkout> --check  # prove, write nothing
 *
 * Why a second vendored tree next to src/vendor/opticom: that slice was taken from an OLDER
 * upstream snapshot (Next 16.2.0-canary, 31 blocks) and its files are live under every Visual
 * Builder page. The components the www-design account and offer pages use (StatBlock, the
 * logo carousel, CompanyBlock, CalloutCtaBlock, TableBlock, the quote and author cards, the
 * footer) only exist in the NEWER upstream (Next 16.2.4, 71 blocks), whose lib/utils.ts alone
 * differs from the old one by 270 lines. Upgrading the old slice in place would change live
 * pages; a separate tree changes nothing that is already served.
 *
 * The contract is the same as sync-opticom.mjs: every file listed in MANIFEST is upstream's
 * file plus the TRANSFORMS below plus its own PATCHES entry, and nothing else. --check exits
 * non-zero the moment that stops being true. Shims are ours and listed in SHIMS.
 *
 * TRANSFORMS (applied to every vendored file, in this order):
 *   1. a leading 'use client' directive is dropped (meaningless in a Vite SPA)
 *   2. `@/x` imports become relative paths inside src/vendor/www, so this tree never resolves
 *      into the older src/vendor/opticom slice through the shared `@/` alias
 *   3. `motion/react` -> `framer-motion` (motion/react re-exports framer-motion v12, installed)
 *   4. `next/image`, `next/link`, `next/navigation` -> the shims in _shims/
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEST = path.join(REPO, 'src/vendor/www')

const MANIFEST = [
  // primitives
  'components/_ui/badge/index.tsx',
  'components/_ui/button/index.tsx',
  'components/_ui/button/opal-wrapper.tsx',
  'components/_ui/button/stroke-wrapper.tsx',
  'components/_ui/button/with-stroke-wrapper.tsx',
  'components/_ui/card/index.tsx',
  'components/_ui/card/card-bottom-bar.tsx',
  'components/_ui/card/card-resource-details.tsx',
  'components/_ui/card/card-status-tag.tsx',
  'components/_ui/card/types.ts',
  'components/_ui/accordion/index.tsx',
  // elements
  'components/element/icon-element/index.tsx',
  'components/element/icon-element/types.ts',
  'components/element/icon-element/display-settings.ts',
  'components/element/stacked-heading-element/index.tsx',
  'components/element/stacked-heading-element/types.ts',
  'components/element/stacked-heading-element/display-settings.ts',
  'components/element/stacked-heading-element/stacked-text-island.tsx',
  'components/element/stacked-heading-element/stacked-text.tsx',
  'components/element/stacked-heading-element/curved-line-island.tsx',
  'components/element/stacked-heading-element/curved-line.tsx',
  'components/element/stacked-heading-element/static-stacked-text.tsx',
  'components/element/stacked-heading-element/use-stacked-animation.ts',
  'components/element/text-content-element/index.tsx',
  'components/element/text-content-element/types.ts',
  'components/element/text-content-element/display-settings.ts',
  // blocks
  'components/block/stat-block/index.tsx',
  'components/block/stat-block/types.ts',
  'components/block/stat-block/display-settings.ts',
  'components/block/card-customer-quote-block/card-customer-quote-card.tsx',
  'components/block/portrait-text-quote-card-block/portrait-text-quote-card.tsx',
  'components/block/portrait-text-quote-card-block/types.ts',
  'components/block/carousel-logos/carousel-logos-client.tsx',
  'components/block/carousel-logos/types.ts',
  'components/block/carousel-logos/display-settings.ts',
  'components/block/company-block/index.tsx',
  'components/block/company-block/types.ts',
  'components/block/company-block/display-settings.ts',
  'components/block/callout-cta-block/index.tsx',
  'components/block/callout-cta-block/types.ts',
  'components/block/callout-cta-block/display-settings.ts',
  'components/block/table-block/index.tsx',
  'components/block/table-block/types.ts',
  'components/block/table-block/display-settings.ts',
  'components/block/card-arrow-block/card-arrow-card.tsx',
  'components/block/card-arrow-block/types.ts',
  'components/block/card-arrow-block/display-settings.ts',
  // footer (the presentational partials; upstream's index.tsx fetches its own data from Graph)
  'components/layout/footer/partials/NavigationColumns.tsx',
  'components/layout/footer/partials/FooterLogo.tsx',
  'components/layout/footer/partials/types.ts',
  'components/layout/footer/assets/Wordmark.tsx',
  // lib
  'lib/utils.ts',
  'lib/utils/timezones.ts',
  'lib/image/cmp.ts',
  'lib/optimizely/types/display-settings.ts',
]

/** Per-file edits. Each `find` must occur exactly once in upstream, or the sync fails loudly. */
const PATCHES = {
  'lib/utils.ts': [
    {
      why: 'next/navigation is not installed; createUrl only needs the structural toString()',
      find: "import { ReadonlyURLSearchParams } from 'next/navigation'\n",
      replace: "type ReadonlyURLSearchParams = URLSearchParams | { toString(): string }\n",
    },
  ],
}

/** Ours. Never copied from upstream, never reported as orphans. */
const SHIMS = [
  'lib/optimizely/graphql.ts',
  'lib/optimizely/features/draft/index.ts',
  'lib/optimizely/features/draft/editable-field.tsx',
  'components/layout/footer/assets/index.ts',
  '_shims/next-image.tsx',
  '_shims/next-link.tsx',
  'UPSTREAM.md',
]

const NEXT_SHIMS = { 'next/image': '_shims/next-image', 'next/link': '_shims/next-link' }

function transform(rel, src) {
  let out = src.replace(/^(['"])use client\1;?\s*\n/, '')
  const fromDir = path.posix.dirname(rel)
  const toRel = (target) => {
    let r = path.posix.relative(fromDir, target)
    if (!r.startsWith('.')) r = './' + r
    return r
  }
  out = out.replace(/(from\s+|import\s*\(\s*)(['"])@\/([^'"]+)\2/g, (_m, pre, q, target) => `${pre}${q}${toRel(target)}${q}`)
  out = out.replace(/(['"])motion\/react\1/g, "$1framer-motion$1")
  for (const [mod, shim] of Object.entries(NEXT_SHIMS)) {
    out = out.replace(new RegExp(`(['"])${mod.replace('/', '\\/')}\\1`, 'g'), `$1${toRel(shim)}$1`)
  }
  for (const p of PATCHES[rel] ?? []) {
    const n = out.split(p.find).length - 1
    if (n !== 1) throw new Error(`patch for ${rel} expects its find string exactly once, found ${n}: ${p.why}`)
    out = out.replace(p.find, p.replace)
  }
  return out
}

const args = process.argv.slice(2)
const check = args.includes('--check')
const upIdx = args.indexOf('--upstream')
const upstream = upIdx >= 0 ? args[upIdx + 1] : process.env.WWW_UPSTREAM
if (!upstream) {
  console.error('usage: node scripts/sync-www.mjs --upstream <OptimizelyHeadless checkout> [--check]')
  process.exit(2)
}

let drift = 0
let written = 0
for (const rel of MANIFEST) {
  const srcPath = path.join(upstream, rel)
  if (!fs.existsSync(srcPath)) {
    console.error(`manifest lists ${rel}, which is not in the upstream tree`)
    process.exit(1)
  }
  const want = transform(rel, fs.readFileSync(srcPath, 'utf8'))
  const destPath = path.join(DEST, rel)
  const have = fs.existsSync(destPath) ? fs.readFileSync(destPath, 'utf8') : null
  if (have === want) continue
  if (check) {
    console.error(`DRIFT ${rel}${have === null ? ' (missing)' : ''}`)
    drift++
  } else {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, want)
    written++
  }
}

// Orphans: anything under DEST that is neither vendored nor a shim.
const known = new Set([...MANIFEST, ...SHIMS])
const orphans = []
const walk = (dir) => {
  if (!fs.existsSync(dir)) return
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else {
      const rel = path.relative(DEST, p).split(path.sep).join('/')
      if (!known.has(rel)) orphans.push(rel)
    }
  }
}
walk(DEST)
for (const o of orphans) console.error(`ORPHAN ${o}`)
for (const s of SHIMS) if (!fs.existsSync(path.join(DEST, s))) console.error(`MISSING SHIM ${s}`)

if (check) {
  const bad = drift + orphans.length
  console.log(`${MANIFEST.length} vendored, ${SHIMS.length} shims, ${Object.keys(PATCHES).length} patched; ${bad ? bad + ' problem(s)' : 'all match upstream + recorded patches'}`)
  process.exit(bad ? 1 : 0)
}
console.log(`${written} file(s) written, ${MANIFEST.length - written} already current, ${orphans.length} orphan(s)`)
