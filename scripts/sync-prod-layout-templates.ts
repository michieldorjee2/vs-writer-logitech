/**
 * Regenerate src/cms/sections/blank-section-display.ts and src/cms/layout/{row,column}-display.ts
 * from optimizely.com PROD's live CMS display templates.
 *
 *   npx tsx scripts/sync-prod-layout-templates.ts <prod-displaytemplates.json>
 *
 * The JSON is `GET /preview3/displaytemplates` against the prod instance (opti01saas4uc99p001).
 * Defaults are chosen so an unset setting produces exactly the class prod's renderer produces
 * with nothing set: prod's cva defaultVariants where it has one, otherwise an option whose class
 * is empty, otherwise `inherit`. Never "the first option" — that would inject classes prod never
 * adds (contentAlign `start` -> items-start where prod adds nothing).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fromCmsDisplayTemplate, type RepoDisplayTemplate } from '../src/cms/display-template-transform'
import { PROD_LAYOUT as M } from '../src/cms/layout-prod/maps'

const SECTION_DEFAULTS: Record<string, string> = {
  ...(M.section.defaultVariants as Record<string, string>),
  roundedCorners: 'top',
  borderRadius: 'default',
  borderRadiusLg: 'lg',
  containerWidth: 'full',
}
const ROW_DEFAULTS = M.row.defaultVariants as Record<string, string>

const src = process.argv[2]
if (!src) throw new Error('usage: npx tsx scripts/sync-prod-layout-templates.ts <prod-displaytemplates.json>')
const prod = JSON.parse(fs.readFileSync(src, 'utf8')) as Array<Record<string, unknown>>

function neutral(options: readonly { value: string }[], classMap: Record<string, string> | undefined): string | undefined {
  const values = options.map((o) => o.value)
  if (classMap) {
    const empty = values.find((v) => classMap[v] === '')
    if (empty) return empty
  }
  return values.includes('inherit') ? 'inherit' : undefined
}

function build(key: string, maps: Record<string, Record<string, string>>, defaults: Record<string, string>): RepoDisplayTemplate {
  const cms = prod.find((t) => t.key === key)
  if (!cms) throw new Error(`prod has no display template ${key}`)
  const repo = fromCmsDisplayTemplate(cms as never)
  return {
    ...repo,
    settings: repo.settings.map((s) => {
      if (s.type !== 'select') return { ...s, defaultValue: s.defaultValue ?? false }
      const opts = s.options ?? []
      const d = defaults[s.key] ?? neutral(opts, maps[s.key]) ?? opts[0]?.value
      return { ...s, defaultValue: d }
    }),
  }
}

const templates: Array<[string, string, Record<string, Record<string, string>>, Record<string, string>]> = [
  ['BlankSectionDisplayTemplate', 'src/cms/sections/blank-section-display.ts', { ...M.section.variants, ...M.sectionBreakpoints } as never, SECTION_DEFAULTS],
  ['RowDisplayTemplate', 'src/cms/layout/row-display.ts', M.row.variants as never, ROW_DEFAULTS],
  ['ColumnDisplayTemplate', 'src/cms/layout/column-display.ts', M.column.variants as never, {}],
]

for (const [key, file, maps, defaults] of templates) {
  const t = build(key, maps, defaults)
  const body = `/**
 * GENERATED from optimizely.com PROD's live \`${key}\` by scripts/sync-prod-layout-templates.ts.
 * Do not hand-edit — re-run the script. Rendered by src/cms/layout-prod, whose class maps come
 * from the same prod source. ${t.settings.length} settings.
 */
import type { RepoDisplayTemplate } from '${path.relative(path.dirname(file), 'src/cms/display-template-transform').replace(/^([^.])/, './$1')}'

const displayTemplates: RepoDisplayTemplate[] = [${JSON.stringify(t, null, 2)}]

export default displayTemplates
`
  fs.writeFileSync(file, body)
  console.log(`${key.padEnd(30)} ${t.settings.length} settings -> ${file}`)
}
