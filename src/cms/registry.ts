/// <reference types="node" />
/**
 * Auto-discovery for the Visual Builder content model.
 *
 * There are two discovery paths, because this directory is consumed from two very different
 * runtimes:
 *
 *   - Vite (the app / Phase 1 renderers) — `import.meta.glob`, eager and synchronous.
 *   - plain Node (apply.ts under tsx, outside Vite) — readdir + dynamic import, async.
 *
 * `import.meta.glob` is a BUILD-TIME transform, not a runtime function: Vite rewrites the call
 * into a static import map, and under tsx the property simply does not exist. So every glob
 * call sits in a try/catch — Vite never reaches the catch, Node always does. Do not "fix" this
 * by testing `typeof import.meta.glob === 'function'`: after Vite's transform that test is
 * false in the browser too, and the whole registry would come back empty.
 *
 * A component folder is `src/cms/components/<kebab-case-of-key>/` holding `content-type.ts`,
 * `display-settings.ts`, `types.ts` and, from Phase 1 onward, `index.tsx`. Discovery must not
 * break when `index.tsx` is absent, which it is for every component in Phase 0.
 *
 * FIVE discovery paths, not three. Beyond the component folders there are:
 *
 *   - `experiences/*.ts`      one content type definition per file (the composition roots)
 *   - `sections/*.ts`         one content type definition/patch per file, EXCLUDING `*-display.ts`
 *   - `sections/*-display.ts`
 *     and `layout/*.ts`       display templates that belong to no component — the `BlankSection`
 *                             template and the `row` / `column` layout templates
 *   - `blueprints/*.ts`       one blueprint per file
 *
 * `index.ts` IS SKIPPED in every single-file path. A barrel re-exporting one of its siblings as
 * its default (which `blueprints/index.ts` does) would otherwise be discovered a second time
 * under the same id, and every barrel added later would silently inflate the counts. Helper
 * modules belong in `internal/`; the globs are single-level and do not descend.
 */

import type { ContentTypeDefinition } from './property-builders'
import type { RepoDisplayTemplate } from './display-template-transform'
import type { CompositionNode } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentEntry {
  /** The folder name, kebab-case of the content type key. */
  dir: string
  /** The content type key, taken from content-type.ts (the folder name is only a hint). */
  key: string
  contentType: ContentTypeDefinition
  /** Zero or more display templates in repo shape. Empty when display-settings.ts is absent. */
  displayTemplates: RepoDisplayTemplate[]
  /** True once a Phase 1 index.tsx exists. */
  hasRenderer: boolean
  /** The default export of index.tsx, on the Vite path only. */
  renderer?: unknown
  /** Anything that made the folder unusable, e.g. a missing default export. */
  problems: string[]
}

/** `src/cms/experiences/<name>.ts` default-exports a content type definition. */
export interface ExperienceEntry {
  file: string
  key: string
  contentType: ContentTypeDefinition
  problems: string[]
}

/**
 * `src/cms/sections/<name>.ts` (never `*-display.ts`) default-exports a content type
 * definition. In practice these are PATCHES against types the CMS already ships — the
 * `BlankSection` entry deliberately omits `displayName` so a reconcile cannot re-title it —
 * so `key` and `baseType` are required here but `displayName` is not.
 */
export interface SectionEntry {
  file: string
  key: string
  contentType: ContentTypeDefinition
  problems: string[]
}

/**
 * A display template module that belongs to no component folder: `sections/*-display.ts` for
 * a section's own template, `layout/*.ts` for the `row` and `column` templates. Same repo
 * shape as a component's `display-settings.ts` — a default-exported ARRAY.
 */
export interface LayoutTemplateEntry {
  /** `sections/blank-section-display.ts`, `layout/row-display.ts`, … — relative to src/cms. */
  file: string
  templates: RepoDisplayTemplate[]
  problems: string[]
}

/** What `src/cms/blueprints/<name>.ts` default-exports. */
export interface BlueprintDefinition {
  /**
   * A stable human-readable id. `blueprintKeyFor(blueprintId)` hashes it into the
   * GUID-formatted CMS key, so the same id always resolves to the same blueprint.
   */
  blueprintId: string
  contentType: string
  displayName: string
  /** The skeleton, authored WITHOUT node ids — the API strips them on read-back. */
  composition?: CompositionNode
}

export interface BlueprintEntry {
  file: string
  blueprint: BlueprintDefinition
  problems: string[]
}

export interface RegistrySnapshot {
  components: ComponentEntry[]
  experiences: ExperienceEntry[]
  sections: SectionEntry[]
  layoutTemplates: LayoutTemplateEntry[]
  blueprints: BlueprintEntry[]
  /** Which discovery path produced this snapshot. */
  source: 'vite' | 'node'
}

/**
 * A barrel is not a definition. Every single-file discovery path skips this name, so a
 * `blueprints/index.ts` that re-exports a sibling as its default is not counted twice.
 */
export const BARREL_FILENAME = 'index.ts'

/** `sections/*-display.ts` holds display templates, not a content type. */
export const DISPLAY_MODULE_SUFFIX = '-display.ts'

function isBarrel(file: string): boolean {
  return file === BARREL_FILENAME
}

// ---------------------------------------------------------------------------
// Vite path (eager, synchronous)
// ---------------------------------------------------------------------------

const NO_MODULES: Record<string, unknown> = {}

function globContentTypes(): Record<string, unknown> {
  try {
    return import.meta.glob('./components/*/content-type.ts', { eager: true })
  } catch {
    return NO_MODULES
  }
}

function globDisplaySettings(): Record<string, unknown> {
  try {
    return import.meta.glob('./components/*/display-settings.ts', { eager: true })
  } catch {
    return NO_MODULES
  }
}

function globRenderers(): Record<string, unknown> {
  try {
    return import.meta.glob('./components/*/index.tsx', { eager: true })
  } catch {
    return NO_MODULES
  }
}

function globExperiences(): Record<string, unknown> {
  try {
    return import.meta.glob('./experiences/*.ts', { eager: true })
  } catch {
    return NO_MODULES
  }
}

function globBlueprints(): Record<string, unknown> {
  try {
    return import.meta.glob('./blueprints/*.ts', { eager: true })
  } catch {
    return NO_MODULES
  }
}

function globSections(): Record<string, unknown> {
  try {
    return import.meta.glob('./sections/*.ts', { eager: true })
  } catch {
    return NO_MODULES
  }
}

function globLayout(): Record<string, unknown> {
  try {
    return import.meta.glob('./layout/*.ts', { eager: true })
  } catch {
    return NO_MODULES
  }
}

/** True when this module is running inside Vite, i.e. the eager globs resolved. */
export function viteDiscoveryAvailable(): boolean {
  return globContentTypes() !== NO_MODULES
}

function dirOf(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 2] ?? path
}

function fileOf(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** Synchronous discovery. Returns an empty snapshot outside Vite. */
export function discoverComponentsVite(): ComponentEntry[] {
  const contentTypes = globContentTypes()
  if (contentTypes === NO_MODULES) return []

  const displaySettings = globDisplaySettings()
  const renderers = globRenderers()

  const byDir = new Map<string, ComponentEntry>()

  for (const [path, mod] of Object.entries(contentTypes)) {
    const dir = dirOf(path)
    const entry = readComponent(dir, mod, displaySettings[`./components/${dir}/display-settings.ts`])
    const renderer = renderers[`./components/${dir}/index.tsx`]
    if (renderer) {
      entry.hasRenderer = true
      entry.renderer = (renderer as { default?: unknown }).default ?? renderer
    }
    byDir.set(dir, entry)
  }

  return [...byDir.values()].sort((a, b) => a.dir.localeCompare(b.dir))
}

export function discoverExperiencesVite(): ExperienceEntry[] {
  const mods = globExperiences()
  if (mods === NO_MODULES) return []
  return Object.entries(mods)
    .map(([path, mod]) => readExperience(fileOf(path), mod))
    .sort((a, b) => a.file.localeCompare(b.file))
}

export function discoverBlueprintsVite(): BlueprintEntry[] {
  const mods = globBlueprints()
  if (mods === NO_MODULES) return []
  return Object.entries(mods)
    .map(([path, mod]) => [fileOf(path), mod] as const)
    .filter(([file]) => !isBarrel(file))
    .map(([file, mod]) => readBlueprint(file, mod))
    .sort((a, b) => a.file.localeCompare(b.file))
}

export function discoverSectionsVite(): SectionEntry[] {
  const mods = globSections()
  if (mods === NO_MODULES) return []
  return Object.entries(mods)
    .map(([path, mod]) => [fileOf(path), mod] as const)
    .filter(([file]) => !isBarrel(file) && !file.endsWith(DISPLAY_MODULE_SUFFIX))
    .map(([file, mod]) => readSection(file, mod))
    .sort((a, b) => a.file.localeCompare(b.file))
}

export function discoverLayoutTemplatesVite(): LayoutTemplateEntry[] {
  const sections = globSections()
  const layout = globLayout()
  if (sections === NO_MODULES && layout === NO_MODULES) return []

  const out: LayoutTemplateEntry[] = []
  for (const [path, mod] of Object.entries(sections)) {
    const file = fileOf(path)
    if (!file.endsWith(DISPLAY_MODULE_SUFFIX)) continue
    out.push(readLayoutTemplates(`sections/${file}`, mod))
  }
  for (const [path, mod] of Object.entries(layout)) {
    const file = fileOf(path)
    if (isBarrel(file)) continue
    out.push(readLayoutTemplates(`layout/${file}`, mod))
  }
  return out.sort((a, b) => a.file.localeCompare(b.file))
}

// ---------------------------------------------------------------------------
// Node path (async, no Vite)
// ---------------------------------------------------------------------------

/**
 * Node builtins are imported dynamically, through an opaque specifier, so that a Phase 1
 * browser bundle importing this module for its renderers never pulls `node:fs` into the
 * client graph — and so Vite does not even emit an "externalized for browser compatibility"
 * warning about it. The `typeof import(...)` types below are erased at compile time and
 * cost nothing at runtime, so the node path stays fully typed either way.
 */
type FsPromisesModule = typeof import('node:fs/promises')
type NodeUrlModule = typeof import('node:url')

function dynamicImport(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ specifier)
}

async function nodeFs() {
  const [fs, url] = (await Promise.all([
    dynamicImport('node:fs/promises'),
    dynamicImport('node:url'),
  ])) as [FsPromisesModule, NodeUrlModule]
  return { readdir: fs.readdir, stat: fs.stat, fileURLToPath: url.fileURLToPath }
}

/**
 * `src/cms/` as a file URL — resolved from this module, not from process.cwd().
 *
 * The base is a const rather than an inline literal so Vite's asset-URL plugin does not warn
 * that the path "doesn't exist at build time": this function only ever runs under Node.
 */
const CMS_DIR_RELATIVE = './'

function cmsDirUrl(): URL {
  return new URL(CMS_DIR_RELATIVE, import.meta.url)
}

async function exists(fileUrl: URL): Promise<boolean> {
  const { stat, fileURLToPath } = await nodeFs()
  try {
    await stat(fileURLToPath(fileUrl))
    return true
  } catch {
    return false
  }
}

async function importModule(fileUrl: URL): Promise<unknown> {
  // Vite would try to analyse a computed import; this path only ever runs under tsx.
  return dynamicImport(fileUrl.href)
}

async function listDirs(dirUrl: URL): Promise<string[]> {
  const { readdir } = await nodeFs()
  try {
    const entries = await readdir(dirUrl, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

async function listFiles(dirUrl: URL, suffix: string): Promise<string[]> {
  const { readdir } = await nodeFs()
  try {
    const entries = await readdir(dirUrl, { withFileTypes: true })
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(suffix) &&
          !e.name.startsWith('.') &&
          !e.name.endsWith('.test.ts') &&
          !e.name.endsWith('.d.ts')
      )
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

export async function discoverComponentsNode(): Promise<ComponentEntry[]> {
  const componentsUrl = new URL('components/', cmsDirUrl())
  const dirs = await listDirs(componentsUrl)
  const out: ComponentEntry[] = []

  for (const dir of dirs) {
    const folder = new URL(`${dir}/`, componentsUrl)
    const contentTypeUrl = new URL('content-type.ts', folder)
    if (!(await exists(contentTypeUrl))) {
      out.push({
        dir,
        key: dir,
        contentType: undefined as unknown as ContentTypeDefinition,
        displayTemplates: [],
        hasRenderer: false,
        problems: ['no content-type.ts — see COMPONENT-SPEC.md for the required files'],
      })
      continue
    }

    let contentTypeMod: unknown
    try {
      contentTypeMod = await importModule(contentTypeUrl)
    } catch (err) {
      out.push({
        dir,
        key: dir,
        contentType: undefined as unknown as ContentTypeDefinition,
        displayTemplates: [],
        hasRenderer: false,
        problems: [`content-type.ts failed to import: ${message(err)}`],
      })
      continue
    }

    const displaySettingsUrl = new URL('display-settings.ts', folder)
    let displaySettingsMod: unknown
    if (await exists(displaySettingsUrl)) {
      try {
        displaySettingsMod = await importModule(displaySettingsUrl)
      } catch (err) {
        displaySettingsMod = { __error: message(err) }
      }
    }

    const entry = readComponent(dir, contentTypeMod, displaySettingsMod)
    // index.tsx is only probed here, never imported: apply.ts must not pull React in.
    entry.hasRenderer = await exists(new URL('index.tsx', folder))
    out.push(entry)
  }

  return out
}

export async function discoverExperiencesNode(): Promise<ExperienceEntry[]> {
  const dirUrl = new URL('experiences/', cmsDirUrl())
  const files = (await listFiles(dirUrl, '.ts')).filter((f) => !isBarrel(f))
  const out: ExperienceEntry[] = []
  for (const file of files) {
    try {
      out.push(readExperience(file, await importModule(new URL(file, dirUrl))))
    } catch (err) {
      out.push({
        file,
        key: file.replace(/\.ts$/, ''),
        contentType: undefined as unknown as ContentTypeDefinition,
        problems: [`failed to import: ${message(err)}`],
      })
    }
  }
  return out
}

export async function discoverBlueprintsNode(): Promise<BlueprintEntry[]> {
  const dirUrl = new URL('blueprints/', cmsDirUrl())
  const files = (await listFiles(dirUrl, '.ts')).filter((f) => !isBarrel(f))
  const out: BlueprintEntry[] = []
  for (const file of files) {
    try {
      out.push(readBlueprint(file, await importModule(new URL(file, dirUrl))))
    } catch (err) {
      out.push({
        file,
        blueprint: undefined as unknown as BlueprintDefinition,
        problems: [`failed to import: ${message(err)}`],
      })
    }
  }
  return out
}

/**
 * `sections/*.ts`, minus `index.ts` and minus `*-display.ts` (those are display templates and
 * are picked up by `discoverLayoutTemplatesNode`).
 */
export async function discoverSectionsNode(): Promise<SectionEntry[]> {
  const dirUrl = new URL('sections/', cmsDirUrl())
  const files = (await listFiles(dirUrl, '.ts')).filter(
    (f) => !isBarrel(f) && !f.endsWith(DISPLAY_MODULE_SUFFIX)
  )
  const out: SectionEntry[] = []
  for (const file of files) {
    try {
      out.push(readSection(file, await importModule(new URL(file, dirUrl))))
    } catch (err) {
      out.push({
        file,
        key: file.replace(/\.ts$/, ''),
        contentType: undefined as unknown as ContentTypeDefinition,
        problems: [`failed to import: ${message(err)}`],
      })
    }
  }
  return out
}

/** `sections/*-display.ts` plus `layout/*.ts` — the templates that belong to no component. */
export async function discoverLayoutTemplatesNode(): Promise<LayoutTemplateEntry[]> {
  const sectionsUrl = new URL('sections/', cmsDirUrl())
  const layoutUrl = new URL('layout/', cmsDirUrl())

  const sources: Array<{ label: string; dirUrl: URL; file: string }> = []
  for (const file of await listFiles(sectionsUrl, DISPLAY_MODULE_SUFFIX)) {
    sources.push({ label: `sections/${file}`, dirUrl: sectionsUrl, file })
  }
  for (const file of (await listFiles(layoutUrl, '.ts')).filter((f) => !isBarrel(f))) {
    sources.push({ label: `layout/${file}`, dirUrl: layoutUrl, file })
  }

  const out: LayoutTemplateEntry[] = []
  for (const { label, dirUrl, file } of sources) {
    try {
      out.push(readLayoutTemplates(label, await importModule(new URL(file, dirUrl))))
    } catch (err) {
      out.push({ file: label, templates: [], problems: [`failed to import: ${message(err)}`] })
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file))
}

// ---------------------------------------------------------------------------
// Runtime-agnostic entry point
// ---------------------------------------------------------------------------

/** Vite when Vite is available, plain Node otherwise. */
export async function discover(): Promise<RegistrySnapshot> {
  if (viteDiscoveryAvailable()) {
    return {
      components: discoverComponentsVite(),
      experiences: discoverExperiencesVite(),
      sections: discoverSectionsVite(),
      layoutTemplates: discoverLayoutTemplatesVite(),
      blueprints: discoverBlueprintsVite(),
      source: 'vite',
    }
  }
  const [components, experiences, sections, layoutTemplates, blueprints] = await Promise.all([
    discoverComponentsNode(),
    discoverExperiencesNode(),
    discoverSectionsNode(),
    discoverLayoutTemplatesNode(),
    discoverBlueprintsNode(),
  ])
  return { components, experiences, sections, layoutTemplates, blueprints, source: 'node' }
}

// ---------------------------------------------------------------------------
// Module readers — shared by both paths
// ---------------------------------------------------------------------------

function readComponent(
  dir: string,
  contentTypeMod: unknown,
  displaySettingsMod: unknown
): ComponentEntry {
  const problems: string[] = []
  const contentType = defaultExport<ContentTypeDefinition>(contentTypeMod)

  if (!contentType) {
    problems.push('content-type.ts has no default export')
  } else {
    if (!contentType.key) problems.push('content-type.ts default export has no `key`')
    if (!contentType.baseType) problems.push('content-type.ts default export has no `baseType`')
    if (contentType.key && kebab(contentType.key) !== dir) {
      problems.push(
        `folder name '${dir}' is not the kebab-case of key '${contentType.key}' ` +
          `(expected '${kebab(contentType.key)}')`
      )
    }
  }

  let displayTemplates: RepoDisplayTemplate[] = []
  if (displaySettingsMod) {
    const asError = (displaySettingsMod as { __error?: string }).__error
    if (asError) {
      problems.push(`display-settings.ts failed to import: ${asError}`)
    } else {
      const templates = defaultExport<RepoDisplayTemplate[]>(displaySettingsMod)
      if (!templates) {
        problems.push('display-settings.ts has no default export')
      } else if (!Array.isArray(templates)) {
        problems.push('display-settings.ts must default-export an ARRAY of display templates')
      } else {
        displayTemplates = templates.map((t) => t)
        templates.forEach((t, i) => {
          if (!t?.key) problems.push(`display-settings.ts[${i}] has no \`key\``)
          if (!Array.isArray(t?.settings)) {
            problems.push(`display-settings.ts[${i}] has no \`settings\` array`)
          }
        })
      }
    }
  }

  return {
    dir,
    key: contentType?.key ?? dir,
    contentType: contentType as ContentTypeDefinition,
    displayTemplates,
    hasRenderer: false,
    problems,
  }
}

function readExperience(file: string, mod: unknown): ExperienceEntry {
  const problems: string[] = []
  const contentType = defaultExport<ContentTypeDefinition>(mod)
  if (!contentType) problems.push('no default export')
  else if (!contentType.key) problems.push('default export has no `key`')
  return {
    file,
    key: contentType?.key ?? file.replace(/\.ts$/, ''),
    contentType: contentType as ContentTypeDefinition,
    problems,
  }
}

/**
 * A section module. `displayName` is NOT required: `sections/blank-section.ts` omits it on
 * purpose so a reconcile against a type the CMS already ships cannot re-title it.
 */
function readSection(file: string, mod: unknown): SectionEntry {
  const problems: string[] = []
  const contentType = defaultExport<ContentTypeDefinition>(mod)
  if (!contentType) {
    problems.push('no default export')
  } else {
    if (!contentType.key) problems.push('default export has no `key`')
    if (!contentType.baseType) problems.push('default export has no `baseType`')
  }
  return {
    file,
    key: contentType?.key ?? file.replace(/\.ts$/, ''),
    contentType: contentType as ContentTypeDefinition,
    problems,
  }
}

/** A display-template module outside a component folder. Same shape as `display-settings.ts`. */
function readLayoutTemplates(file: string, mod: unknown): LayoutTemplateEntry {
  const problems: string[] = []
  const templates = defaultExport<RepoDisplayTemplate[]>(mod)

  if (!templates) {
    problems.push('no default export')
    return { file, templates: [], problems }
  }
  if (!Array.isArray(templates)) {
    problems.push('must default-export an ARRAY of display templates')
    return { file, templates: [], problems }
  }
  templates.forEach((t, i) => {
    if (!t?.key) problems.push(`[${i}] has no \`key\``)
    if (!Array.isArray(t?.settings)) problems.push(`[${i}] has no \`settings\` array`)
  })
  return { file, templates, problems }
}

function readBlueprint(file: string, mod: unknown): BlueprintEntry {
  const problems: string[] = []
  const blueprint = defaultExport<BlueprintDefinition>(mod)
  if (!blueprint) {
    problems.push('no default export')
  } else {
    if (!blueprint.blueprintId) problems.push('default export has no `blueprintId`')
    if (!blueprint.contentType) problems.push('default export has no `contentType`')
    if (!blueprint.displayName) problems.push('default export has no `displayName`')
  }
  return { file, blueprint: blueprint as BlueprintDefinition, problems }
}

function defaultExport<T>(mod: unknown): T | undefined {
  if (!mod || typeof mod !== 'object') return undefined
  const value = (mod as { default?: unknown }).default
  return (value ?? undefined) as T | undefined
}

/** `ABMPainPointElement` -> `abm-pain-point-element` */
export function kebab(key: string): string {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
