/**
 * Repo-side display-setting defaults, applied at render time.
 *
 * WHY THIS FILE EXISTS. The CMS has no `defaultValue`. A display template's settings go up
 * as `{displayName, editor, sortOrder, choices}` and come back the same way — the concept is
 * simply absent from `/displaytemplates` (measured; see the "What a display template does
 * NOT store" section of `docs/cms-visual-builder-api.md` in mcp-optimizely-cms). So the repo
 * is the source of truth for defaults, and they can only be applied client-side. Upstream
 * does the same thing in `tools/cms-mcp-server/display-settings-registry.ts`.
 *
 * WHAT THE GRAPH ACTUALLY HANDS US, and why the merge is shaped the way it is:
 *
 *   - `displaySettings` on a composition node is an **ARRAY of {key, value}**, not an
 *     object. It is written nested (`{displayTemplate, settings:{…}}`) and read flat.
 *   - That array carries **no template key**. The query selects `displaySettings {key value}`
 *     and nothing else, so at render time we cannot ask "which template was this?". We can
 *     only ask "what kind of node is this?" — a row, a column, or a component of type X.
 *   - A node that was never touched in Visual Builder comes back with an **empty** array, not
 *     a populated one. Without this merge every such node renders with whatever the `cva`
 *     `defaultVariants` happen to be, which is not the same set of values.
 *
 * So templates are indexed twice: by `nodeType` for the layout templates ('row', 'column')
 * and by `contentType` for everything else. `resolve()` merges defaults under the stored
 * values and returns an ARRAY again, because that is what the vendored `getDisplayValue()`
 * reads and rewriting it into a Record would break every vendored component.
 *
 * Templates are globbed directly rather than read through `src/cms/registry.ts`. The
 * registry's Vite path eagerly imports all 27 `content-type.ts` modules as well, and the
 * content model has no business in a browser bundle whose job is to paint.
 */
import {
  extractDefaults,
  type RepoDisplayTemplate,
} from '../display-template-transform'
import type {
  DisplaySetting,
  DisplaySettings,
} from '@/lib/optimizely/types/display-settings'

const NO_MODULES: Record<string, unknown> = {}

function glob(loader: () => Record<string, unknown>): Record<string, unknown> {
  try {
    return loader()
  } catch {
    return NO_MODULES
  }
}

/**
 * Every display template in the repo: one `display-settings.ts` per component folder, the
 * `row` / `column` templates in `layout/`, and `sections/*-display.ts`. Same three sources
 * `registry.ts` reconciles against the CMS, so a default applied here belongs to a template
 * that actually exists on the instance.
 */
function allTemplates(): RepoDisplayTemplate[] {
  const sources = [
    glob(() => import.meta.glob('../components/*/display-settings.ts', { eager: true })),
    glob(() => import.meta.glob('../layout/*.ts', { eager: true })),
    glob(() => import.meta.glob('../sections/*-display.ts', { eager: true })),
  ]

  const out: RepoDisplayTemplate[] = []
  for (const modules of sources) {
    if (modules === NO_MODULES) continue
    for (const mod of Object.values(modules)) {
      const templates = (mod as { default?: unknown }).default
      if (Array.isArray(templates)) out.push(...(templates as RepoDisplayTemplate[]))
    }
  }
  return out
}

interface Index {
  byContentType: Record<string, Record<string, string>>
  byNodeType: Record<string, Record<string, string>>
  byTemplateKey: Record<string, Record<string, string>>
}

function build(): Index {
  const index: Index = { byContentType: {}, byNodeType: {}, byTemplateKey: {} }

  for (const template of allTemplates()) {
    if (!template?.key || !Array.isArray(template.settings)) continue
    const defaults = extractDefaults(template.settings)
    index.byTemplateKey[template.key] = defaults

    // `isDefault` wins a tie. Two templates for one content type is legal in the CMS; only
    // the default one is what an untouched node renders with.
    if (template.contentType) {
      const existing = index.byContentType[template.contentType]
      if (!existing || template.isDefault) index.byContentType[template.contentType] = defaults
    }
    if (template.nodeType) {
      const existing = index.byNodeType[template.nodeType]
      if (!existing || template.isDefault) index.byNodeType[template.nodeType] = defaults
    }
  }

  return index
}

const INDEX: Index = build()

/** What an untouched node of this content type renders with. `{}` when nothing declares it. */
export function defaultsForContentType(contentType: string | undefined): Record<string, string> {
  if (!contentType) return {}
  return INDEX.byContentType[contentType] ?? {}
}

/** Same, for a structure node: `'row'` or `'column'`. */
export function defaultsForNodeType(nodeType: string | undefined): Record<string, string> {
  if (!nodeType) return {}
  return INDEX.byNodeType[nodeType] ?? {}
}

/** Same, by display template key — the one lookup that needs no inference. */
export function defaultsForTemplate(templateKey: string | undefined): Record<string, string> {
  if (!templateKey) return {}
  return INDEX.byTemplateKey[templateKey] ?? {}
}

/**
 * Merge repo defaults UNDER what the CMS stored, and hand back the array shape the vendored
 * components read.
 *
 * A stored key always wins, including when its value is the empty string: an editor who
 * cleared a setting meant to clear it, and re-defaulting would make the field impossible to
 * empty. Only a key Graph did not send at all takes its default.
 */
export function mergeDisplaySettings(
  defaults: Record<string, string>,
  stored?: DisplaySettings | null
): DisplaySettings {
  const merged = new Map<string, DisplaySetting>()

  for (const [key, value] of Object.entries(defaults)) {
    merged.set(key, { key, value })
  }
  for (const setting of stored ?? []) {
    if (!setting?.key) continue
    merged.set(setting.key, setting)
  }

  return [...merged.values()]
}

/** A component node's settings, defaulted from its content type's template. */
export function withContentTypeDefaults(
  contentType: string | undefined,
  stored?: DisplaySettings | null
): DisplaySettings {
  return mergeDisplaySettings(defaultsForContentType(contentType), stored)
}

/** A row or column node's settings, defaulted from the layout template. */
export function withNodeTypeDefaults(
  nodeType: 'row' | 'column',
  stored?: DisplaySettings | null
): DisplaySettings {
  return mergeDisplaySettings(defaultsForNodeType(nodeType), stored)
}

/** Every template key the repo declares, sorted. Useful when checking a composition. */
export function knownTemplateKeys(): string[] {
  return Object.keys(INDEX.byTemplateKey).sort()
}
