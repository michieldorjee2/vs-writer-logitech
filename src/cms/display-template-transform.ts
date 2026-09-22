/**
 * Display template transform — repo shape <-> CMS shape.
 *
 * The optimizely.com repo and the CMS disagree on the shape of a display template, so a push
 * needs a transform in both directions. Measured against the live `CallToActionSettings`
 * template (see mcp-optimizely-cms/docs/cms-visual-builder-api.md):
 *
 *   repo (`display-settings.ts`)              CMS (`/preview3/displaytemplates`)
 *   ----------------------------------------  ---------------------------------------------
 *   settings: [ { key, … } ]        (array)   settings: { <key>: { … } }        (keyed map)
 *   type: 'select'                            editor: 'select'
 *   options: [ { value, displayName } ]       choices: { <value>: { displayName, sortOrder } }
 *   type: 'checkbox' with no options          editor: 'checkbox', choices: {}
 *   defaultValue                              NO EQUIVALENT — the CMS stores no defaults
 *
 * That last row is the load-bearing one. Because the CMS cannot store a default, defaults are
 * applied CLIENT-SIDE at compose time from the repo's own `display-settings.ts` files, which
 * is why the repo stays the source of truth for display defaults. `extractDefaults()` below
 * mirrors upstream `tools/cms-mcp-server/display-settings-registry.ts`.
 *
 * Round-trip guarantee, proved by `display-template-transform.test.ts`:
 *   fromCmsDisplayTemplate(toCmsDisplayTemplate(t)) deep-equals
 *   normalizeRepoDisplayTemplate(t) with every `defaultValue` removed.
 *
 * "Normalize" covers exactly two presence/alias rules, both documented on
 * `normalizeRepoDisplayTemplate`. Nothing else is lost.
 *
 * This module is pure: no node, no vite, no I/O.
 */

// ---------------------------------------------------------------------------
// Repo shape
// ---------------------------------------------------------------------------

export interface RepoSettingOption {
  value: string
  displayName: string
}

/**
 * `select` and `checkbox` are the canonical repo types. `boolean` is an upstream alias for
 * `checkbox` (used by e.g. quote-block and the opti-forms elements) and normalises to it.
 */
export type RepoSettingType = 'select' | 'checkbox' | 'boolean'

export interface RepoSetting {
  key: string
  displayName: string
  description?: string
  type: RepoSettingType
  required?: boolean
  options?: readonly RepoSettingOption[]
  /** No CMS equivalent. Applied client-side at compose time. */
  defaultValue?: string | boolean
}

export interface RepoDisplayTemplate {
  key: string
  displayName: string
  description?: string
  /** Set for a content-type template. Mutually exclusive with `nodeType` in practice. */
  contentType?: string
  /** Set for a layout template ('row' / 'column'). */
  nodeType?: string
  isDefault?: boolean
  settings: readonly RepoSetting[]
}

/** What a component folder's `display-settings.ts` default-exports. */
export type RepoDisplayTemplates = readonly RepoDisplayTemplate[]

// ---------------------------------------------------------------------------
// CMS shape
// ---------------------------------------------------------------------------

export interface CmsDisplayChoice {
  displayName: string
  sortOrder: number
}

export interface CmsDisplaySetting {
  displayName: string
  editor: string
  sortOrder: number
  choices: Record<string, CmsDisplayChoice>
  /** Not present in the measured read shape — see `TransformOptions.measuredKeysOnly`. */
  description?: string
  /** Not present in the measured read shape — see `TransformOptions.measuredKeysOnly`. */
  required?: boolean
}

export interface CmsDisplayTemplate {
  key: string
  displayName: string
  description?: string
  contentType?: string
  nodeType?: string
  isDefault: boolean
  settings: Record<string, CmsDisplaySetting>
  /** Server-assigned, read-only. Never sent. */
  created?: string
  createdBy?: string
  lastModified?: string
  lastModifiedBy?: string
}

export interface TransformOptions {
  /**
   * Emit ONLY the keys observed on the live `CallToActionSettings` template
   * (`displayName`, `editor`, `sortOrder`, `choices`), dropping `description` and `required`.
   *
   * MEASURED, after pushing all 30 templates at the live instance: a setting's `description`
   * and `required` are **accepted and then discarded**. The POST returns 201, the PATCH
   * returns 200, and the read-back carries neither field. So they are repo-only, exactly like
   * `defaultValue` — there is no error to react to, only a diff that never converges.
   *
   * `apply.ts` therefore writes with this flag on. Leaving it off is only useful for the
   * round-trip test, which needs the lossless form.
   */
  measuredKeysOnly?: boolean
}

/**
 * The keys the CMS demonstrably STORES on a display template. A template-level `description`
 * is discarded the same way a setting's is — `RowDisplayTemplate` was written with one and
 * reads back without it — so comparing it would make every run report a phantom change.
 *
 * This is the projection `apply.ts` compares against a remote template to decide whether a
 * write is needed at all.
 */
export function storedDisplayTemplateProjection(
  template: CmsDisplayTemplate
): Partial<CmsDisplayTemplate> {
  const out: Partial<CmsDisplayTemplate> = {
    key: template.key,
    displayName: template.displayName,
    isDefault: Boolean(template.isDefault),
    settings: {},
  }
  if (template.contentType !== undefined) out.contentType = template.contentType
  if (template.nodeType !== undefined) out.nodeType = template.nodeType

  for (const [key, setting] of Object.entries(template.settings ?? {})) {
    out.settings![key] = {
      displayName: setting.displayName,
      editor: setting.editor,
      sortOrder: setting.sortOrder,
      choices: setting.choices ?? {},
    }
  }
  return out
}

/** The step used for both setting and choice `sortOrder`. */
export const SORT_ORDER_STEP = 10

const EDITOR_BY_TYPE: Record<RepoSettingType, string> = {
  select: 'select',
  checkbox: 'checkbox',
  boolean: 'checkbox',
}

const TYPE_BY_EDITOR: Record<string, RepoSettingType> = {
  select: 'select',
  checkbox: 'checkbox',
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * The fixed point of the round-trip. Four rules, and only these four:
 *
 *  1. `isDefault` becomes explicitly present (`!!t.isDefault`). The CMS always returns the
 *     flag, so an omitted `isDefault` comes back as `false`.
 *  2. `type: 'boolean'` becomes `type: 'checkbox'`. The CMS has one editor for both, so the
 *     upstream alias cannot survive a trip through it.
 *  3. A `select` setting always has an `options` array (`[]` when it had none). An empty
 *     `choices` map is indistinguishable from an absent one on read-back.
 *  4. Keys outside the canonical repo shape are dropped. The canonical shape is
 *     `{key, displayName, description?, contentType?, nodeType?, isDefault?, settings}` and
 *     `{key, displayName, description?, type, required?, options?, defaultValue?}` per
 *     setting — exactly what COMPONENT-SPEC.md tells component authors to emit. Upstream's
 *     layout-only extras (`hasDisplayTypes`, `hasDirectory`, `hasComponent`,
 *     `isVisualBuilderEnabled`, `inCMS`) are outside it and are not part of this contract.
 *
 * `defaultValue` is untouched here — it is dropped by the transform itself, not by
 * normalisation, because the CMS has nowhere to put it.
 */
export function normalizeRepoDisplayTemplate(t: RepoDisplayTemplate): RepoDisplayTemplate {
  const out: RepoDisplayTemplate = {
    key: t.key,
    displayName: t.displayName,
    isDefault: Boolean(t.isDefault),
    settings: t.settings.map((s) => {
      const type: RepoSettingType = s.type === 'boolean' ? 'checkbox' : s.type
      const setting: RepoSetting = {
        key: s.key,
        displayName: s.displayName,
        type,
      }
      if (s.description !== undefined) setting.description = s.description
      if (s.required !== undefined) setting.required = s.required
      if (s.options !== undefined) {
        setting.options = s.options.map((o) => ({ ...o }))
      } else if (type === 'select') {
        setting.options = []
      }
      if (s.defaultValue !== undefined) setting.defaultValue = s.defaultValue
      return setting
    }),
  }
  if (t.description !== undefined) out.description = t.description
  if (t.contentType !== undefined) out.contentType = t.contentType
  if (t.nodeType !== undefined) out.nodeType = t.nodeType
  return reorder(out)
}

/** Strip every `defaultValue`, the one field the CMS cannot store. */
export function stripDefaults(t: RepoDisplayTemplate): RepoDisplayTemplate {
  return {
    ...t,
    settings: t.settings.map((s) => {
      const copy: RepoSetting = { ...s }
      delete copy.defaultValue
      if (s.options !== undefined) copy.options = s.options.map((o) => ({ ...o }))
      return copy
    }),
  }
}

/**
 * Rebuild the object with a fixed key order so deep comparison in a test is not defeated by
 * declaration order. Only the ORDER of keys changes; no key is added or removed.
 */
function reorder(t: RepoDisplayTemplate): RepoDisplayTemplate {
  const out = {} as RepoDisplayTemplate
  const template: Array<keyof RepoDisplayTemplate> = [
    'key',
    'displayName',
    'description',
    'contentType',
    'nodeType',
    'isDefault',
    'settings',
  ]
  for (const k of template) {
    if (t[k] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(out as any)[k] = t[k]
    }
  }
  out.settings = t.settings.map((s) => {
    const setting = {} as RepoSetting
    const order: Array<keyof RepoSetting> = [
      'key',
      'displayName',
      'description',
      'type',
      'required',
      'options',
      'defaultValue',
    ]
    for (const k of order) {
      if (s[k] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(setting as any)[k] = s[k]
      }
    }
    return setting
  })
  return out
}

// ---------------------------------------------------------------------------
// repo -> CMS
// ---------------------------------------------------------------------------

export function toCmsDisplayTemplate(
  repo: RepoDisplayTemplate,
  opts: TransformOptions = {}
): CmsDisplayTemplate {
  const settings: Record<string, CmsDisplaySetting> = {}

  repo.settings.forEach((setting, index) => {
    const editor = EDITOR_BY_TYPE[setting.type] ?? setting.type
    const choices: Record<string, CmsDisplayChoice> = {}
    ;(setting.options ?? []).forEach((option, optionIndex) => {
      choices[option.value] = {
        displayName: option.displayName,
        sortOrder: (optionIndex + 1) * SORT_ORDER_STEP,
      }
    })

    const cmsSetting: CmsDisplaySetting = {
      displayName: setting.displayName,
      editor,
      sortOrder: (index + 1) * SORT_ORDER_STEP,
      choices,
    }
    if (!opts.measuredKeysOnly) {
      if (setting.description !== undefined) cmsSetting.description = setting.description
      if (setting.required !== undefined) cmsSetting.required = setting.required
    }
    settings[setting.key] = cmsSetting
  })

  const out: CmsDisplayTemplate = {
    key: repo.key,
    displayName: repo.displayName,
    isDefault: Boolean(repo.isDefault),
    settings,
  }
  if (repo.description !== undefined) out.description = repo.description
  if (repo.contentType !== undefined) out.contentType = repo.contentType
  if (repo.nodeType !== undefined) out.nodeType = repo.nodeType
  return out
}

/** The POST/PATCH body: the CMS shape minus every server-assigned field. */
export function toCmsDisplayTemplateBody(
  repo: RepoDisplayTemplate,
  opts: TransformOptions = {}
): CmsDisplayTemplate {
  const full = toCmsDisplayTemplate(repo, opts)
  delete full.created
  delete full.createdBy
  delete full.lastModified
  delete full.lastModifiedBy
  return full
}

// ---------------------------------------------------------------------------
// CMS -> repo
// ---------------------------------------------------------------------------

export function fromCmsDisplayTemplate(cms: CmsDisplayTemplate): RepoDisplayTemplate {
  const settings: RepoSetting[] = Object.entries(cms.settings ?? {})
    .map(([key, value], index) => ({ key, value, index }))
    .sort((a, b) => sortKey(a.value.sortOrder, a.index) - sortKey(b.value.sortOrder, b.index))
    .map(({ key, value }) => {
      const setting: RepoSetting = {
        key,
        displayName: value.displayName,
        type: TYPE_BY_EDITOR[value.editor] ?? (value.editor as RepoSettingType),
      }
      if (value.description !== undefined) setting.description = value.description
      if (value.required !== undefined) setting.required = value.required

      const choices = Object.entries(value.choices ?? {})
      if (choices.length > 0) {
        setting.options = choices
          .map(([choiceValue, choice], index) => ({ choiceValue, choice, index }))
          .sort(
            (a, b) => sortKey(a.choice.sortOrder, a.index) - sortKey(b.choice.sortOrder, b.index)
          )
          .map(({ choiceValue, choice }) => ({
            value: choiceValue,
            displayName: choice.displayName,
          }))
      } else if (value.editor === 'select') {
        // A select that came back with no choices really had none.
        setting.options = []
      }
      return setting
    })

  const out: RepoDisplayTemplate = {
    key: cms.key,
    displayName: cms.displayName,
    isDefault: Boolean(cms.isDefault),
    settings,
  }
  if (cms.description !== undefined) out.description = cms.description
  if (cms.contentType !== undefined) out.contentType = cms.contentType
  if (cms.nodeType !== undefined) out.nodeType = cms.nodeType
  return reorder(out)
}

/** Stable sort: honour `sortOrder`, fall back to insertion order when it is missing or tied. */
function sortKey(sortOrder: number | undefined, index: number): number {
  const primary = typeof sortOrder === 'number' ? sortOrder : (index + 1) * SORT_ORDER_STEP
  return primary * 1000 + index
}

// ---------------------------------------------------------------------------
// Defaults registry — mirrors upstream display-settings-registry.ts
// ---------------------------------------------------------------------------

/**
 * Pull the repo-side defaults for one template's settings, for client-side application at
 * compose time. Mirrors upstream `extractDefaults` in
 * `tools/cms-mcp-server/display-settings-registry.ts`:
 *
 *   - an explicit `defaultValue` wins;
 *   - otherwise the FIRST option's value is used;
 *   - a setting with neither is omitted.
 *
 * Values are coerced with String() because a composition node's `displaySettings` is a
 * Record<string, string>; upstream's `type: 'boolean'` settings carry a boolean
 * `defaultValue` (e.g. `false`), which must land as `'false'`.
 */
export function extractDefaults(
  settings: ReadonlyArray<Pick<RepoSetting, 'key' | 'defaultValue' | 'options'>>
): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const setting of settings ?? []) {
    if (setting.defaultValue !== undefined && setting.defaultValue !== null) {
      defaults[setting.key] = String(setting.defaultValue)
    } else if (setting.options?.length) {
      defaults[setting.key] = String(setting.options[0].value)
    }
  }
  return defaults
}

/** `{ [templateKey]: { [settingKey]: defaultValue } }` across many templates. */
export function extractTemplateDefaults(
  templates: RepoDisplayTemplates
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const template of templates ?? []) {
    if (!template?.key) continue
    out[template.key] = extractDefaults(template.settings ?? [])
  }
  return out
}

/**
 * Which template key applies to a node. Mirrors upstream `resolveTemplate`: a content-type
 * match wins over a nodeType match, and only `isDefault` templates are candidates.
 */
export function resolveDefaultTemplateKey(
  templates: RepoDisplayTemplates,
  target: { nodeType?: string; contentType?: string }
): string | undefined {
  let byNodeType: string | undefined
  for (const template of templates ?? []) {
    if (!template?.key || !template.isDefault) continue
    if (target.contentType && template.contentType === target.contentType) {
      return template.key
    }
    if (target.nodeType && template.nodeType === target.nodeType && !byNodeType) {
      byNodeType = template.key
    }
  }
  return byNodeType
}
