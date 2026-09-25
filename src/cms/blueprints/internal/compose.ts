/**
 * The blueprint authoring kit: one declaration per slot produces BOTH the composition node
 * and the slot binding, so the two cannot drift.
 *
 * A blueprint is a composition skeleton scoped to one content type. It is the primitive the
 * template tools use: create it once, and instantiating a page becomes "copy this tree and
 * mint node ids", rather than "assemble a tree from prose every time".
 *
 * WHAT A SLOT IS. Each section in a blueprint is one slot — one band of the page with one
 * job. A slot has a stable `slotId` taken from the component vocabulary
 * (`src/lib/limitless/component-plan.ts`'s `ComponentId`), which is what makes the three
 * systems agree: the decision engine says `include: false` for `comparison-table`, the
 * blueprint's `comparison-table` section is the thing left out, and Phase 3's flat tool call
 * writes `comparisonTableRows` into the `comparison-table` slot. Same string, three layers.
 *
 * WHY THE SLOT IDS ARE NOT NODE IDS. The API strips every node `id` on read-back, so a
 * blueprint stores its skeleton without them and ids are minted when it is instantiated onto
 * a page — deterministically, as `uuidv5(pageKey + slotId + index)`, never `randomUUID()`.
 * Random ids would change on every re-render, which breaks the merge contract ("keys you
 * don't pass keep their values"), Visual Builder's editing continuity, and any node-level
 * reference held elsewhere. The `slotId` is the stable half of that derivation, which is why
 * it is recorded alongside the blueprint rather than inside it.
 *
 * ONE ROW PER FEED, ONE COLUMN PER ITEM. Every feed in `SlotSpec.feeds` gets its OWN row
 * (`section > row* > column*`), and that row holds one column per item the feed supplies —
 * one column for a `one` feed, N for a `many` feed with N items. This is a correction, not the
 * original shape, and it went through TWO wrong shapes before this one:
 *
 *   1. Phase 1 gave every slot exactly one column holding every feed's elements flattened
 *      together, so a `many` feed's items could not be arranged without also rearranging the
 *      slot's headings and text — they were the same node.
 *   2. The first fix tried was one column PER FEED, with the arranging vocabulary
 *      (`displayMode` / `gridColumns` / `gap`, copied from `RowDisplayTemplate`) added to
 *      `ColumnDisplayTemplate` and patched into the vendored Column component. That renders
 *      correctly — but it does not survive the CMS: `POST`ing a composition with an unknown
 *      key in a `column` node's `displaySettings.settings` is accepted with a 200 and the
 *      unknown key is silently dropped on read-back, MEASURED against the live Showcase CMS
 *      (every one of six new column settings, on eight different column nodes, came back
 *      missing; the column's own pre-existing `colSpan` survived every time). The CMS's
 *      `column` node type only recognises the nine grid-CELL settings it shipped with
 *      (`colSpan` and friends); `row` nodes are not limited the same way, because
 *      `RowDisplayTemplate`'s grid-CONTAINER vocabulary already existed upstream and the CMS
 *      already honours it.
 *
 * So the arranging setting has to live on a ROW, never a column, and a `many` feed that wants
 * to arrange several items needs a row of its own to put that setting on — hence one row per
 * feed. A feed with nothing to arrange (a `one` feed, or a `many` feed left at Row's default
 * `gridColumns: cols_1`) still gets its own row; it is simply a row with one column, which is
 * indistinguishable from the old shape. The Column patch (`ColumnDisplayTemplate` gaining the
 * same six settings, and the vendored component honouring them) is left in place rather than
 * reverted: it is correct, forward-compatible code that would take effect the day the CMS's
 * built-in column vocabulary is ever extended, and `SlotFeed.column` / `SlotSpec.column` still
 * exist for the settings a column DOES keep working (`colSpan` and its siblings) — but neither
 * this file nor any blueprint uses the six new ones to solve the layout problem; `SlotFeed.row`
 * does.
 *
 * `SlotSpec.sharedRow` is the one case that inverts this: two or more DIFFERENT feeds sitting
 * side by side (`customer-stories`'s two testimonials) need to share ONE row so that row's
 * `gridColumns` can seat them as its columns — the opposite arrangement from a single feed
 * arranging its own many items. It is `false` (each feed gets its own row) unless a slot opts
 * in.
 *
 * DISPLAY SETTINGS ARE DEVIATIONS ONLY. The CMS stores no defaults, so defaults are applied
 * client-side at compose time from the repo's own display templates (`extractDefaults`).
 * Writing the full default set into every node would therefore duplicate, in 100 places, a
 * value that already has exactly one source — and hide the interesting part. A blueprint
 * records only what it changes, which is why `backgroundTreatment: 'gradient_galaxy'` on the
 * hero is legible as a decision.
 *
 * Every override is checked against the display templates at import time: an unknown setting
 * key, or a value outside that setting's options, throws. A typo in a display setting is
 * otherwise invisible — the CMS accepts the string and the renderer silently falls back.
 *
 * NEVER AUTHOR `nodes: []`. An empty column round-trips from the API as
 * `{"nodeType": "column"}` with no `nodes` key at all. Authoring `nodes: []` would make
 * `apply.ts`'s subset comparison fail forever (an array is never a subset of `undefined`) and
 * every run would re-PATCH an unchanged blueprint.
 */

import type { CompositionNode } from '../../client'
import {
  extractDefaults,
  type RepoDisplayTemplate,
  type RepoSetting,
} from '../../display-template-transform'
import columnTemplates from '../../layout/column-display'
import rowTemplates from '../../layout/row-display'
import type { BlueprintDefinition } from '../../registry'
import blankSectionTemplates from '../../sections/blank-section-display'
import { blueprintKeyFor } from './blueprint-key'

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Every slot id in the model, in page order. These are exactly
 * `component-plan.ts`'s `ComponentId` values — the vocabulary the decision engine, the
 * renderers and the flat tools already share. A new slot id belongs there first.
 */
export const SLOT_IDS = [
  'nav-rail',
  'hero',
  'signal-pills',
  'use-case-matrix',
  'why-now-thesis',
  'friction-points',
  'account-intel',
  'challenge-shot',
  'comparison-table',
  'proof-wall',
  'roi-projection',
  'migration-timeline',
  'analyst-proof',
  'customer-stories',
  'offer-card',
  'contact-close',
  'sticky-cta',
  'offer-hosts',
  'offer-outcomes',
  'offer-agenda',
  'offer-fit',
  'offer-faq',
] as const

export type SlotId = (typeof SLOT_IDS)[number]

/** The one section type every page is built from. */
export const SECTION_CONTENT_TYPE = 'BlankSection'

/** `one` fills a slot with a single element node; `many` explodes an array into N nodes. */
export type Cardinality = 'one' | 'many'

/**
 * One element type in a slot, and the legacy flat key that feeds it. Each feed gets its own
 * ROW (see `sectionNodeFor`), so a feed is also the unit that knows its own cardinality and
 * therefore its own layout.
 *
 * A slot usually has several: `account-intel` holds a heading, then the tech stack, then the
 * news items, then the stakeholders — four element types from four flat keys, four rows in
 * one section. Collapsing that to a single binding would force Phase 3 to guess.
 */
export interface SlotFeed {
  /** The element content type written into this feed's column(s). */
  contentType: string
  /**
   * The property on the legacy flat page type that supplies it — `painPoints`,
   * `comparisonTableRows`, `intelStats`. This is the key the agent-facing tool keeps taking,
   * which is what lets Phase 3's tool calls stay flat while the storage is a tree.
   */
  flatKey: string
  cardinality: Cardinality
  /** Field-level mapping, or anything a reader would otherwise have to infer. */
  note?: string
  /**
   * Marks this feed as the slot's PRIMARY binding — the one mirrored onto `SlotBinding`'s
   * top-level `contentType` / `flatKey` / `cardinality`. Render order is simply this feed's
   * position in `SlotSpec.feeds`; the two used to be conflated (`feeds[0]` read as both "renders
   * first" and "is primary"), which is wrong wherever a heading's own copy says it renders
   * ABOVE the thing that is nonetheless the slot's primary write — the hero's eyebrow is the
   * documented case. At most one feed per slot may set this; omitted, the first feed is
   * primary, which is the old behaviour and keeps every already-correct slot unchanged.
   */
  primary?: boolean
  /**
   * Deviations from `RowDisplayTemplate`'s defaults for the row THIS FEED OWNS (merged on top
   * of the slot's own `row` — this wins on a shared key; ignored when the slot sets
   * `sharedRow`, where `SlotSpec.row` is what matters instead). This is where a `many` feed
   * arranges its own items — `displayMode: 'grid'` plus `gridColumns` / `gridColumnsMd` /
   * `gridColumnsLg` / `gridColumnsXl` / `gap` turns its per-item columns into an N-up strip or
   * grid. It has to be the ROW, not the column each item sits in: see this file's header for
   * the measured reason a column-level equivalent does not survive the CMS.
   */
  row?: Record<string, string>
  /**
   * Deviations from `ColumnDisplayTemplate`'s defaults for each of this feed's own item
   * column(s) — merged on top of the slot's own `column`. Only the settings a `column` node
   * actually keeps (`colSpan` and its siblings) take effect; see this file's header.
   */
  column?: Record<string, string>
  /**
   * Display settings for each ELEMENT this feed writes — keyed against the element type's own
   * `<ContentType>DisplayTemplate`. Blueprints never place element nodes (a required property
   * would 400 an empty one), so this rides on SLOT_MAP and is applied by whatever instantiates
   * the page (`scripts/create-sample-page.mjs`). E.g. `{ presentation: 'extruded' }` on the one
   * StatBlock a page extrudes.
   */
  element?: Record<string, string>
}

/** What a blueprint file declares per section. */
export interface SlotSpec {
  slotId: SlotId
  /** The section's `displayName` in Visual Builder. */
  displayName: string
  /** Why this slot is in this blueprint, or the shape it takes here. */
  why?: string
  /** Deviations from `BlankSectionDisplayTemplate`'s defaults. */
  section?: Record<string, string>
  /**
   * Deviations from `RowDisplayTemplate`'s defaults. Normally this is the BASE merged under
   * every feed's own row (a feed's own `row` wins on a shared key) — usually left unset, since
   * a feed's own row already defaults to a one-column grid (one item per line). When
   * `sharedRow` is true, this is instead the settings of the ONE row every feed shares — e.g.
   * `customer-stories` sets `gridColumns` here to seat its two testimonial columns side by
   * side.
   */
  row?: Record<string, string>
  /**
   * Deviations from `ColumnDisplayTemplate`'s defaults, applied as the BASE for every column
   * this slot builds (a feed's own `column` merges on top and wins).
   */
  column?: Record<string, string>
  /**
   * True seats every feed's column in ONE shared row, side by side, instead of giving each
   * feed its own row — the arrangement two or more DIFFERENT feeds need to sit next to each
   * other (`customer-stories`'s two testimonials). False (the default) gives every feed its
   * own row, which is what a `many` feed needs to arrange its own items without dragging its
   * sibling feeds into the same grid.
   */
  sharedRow?: boolean
  /**
   * In render order — render order and "is the primary binding" are separate questions now
   * (see `SlotFeed.primary`), so a slot is free to declare its heading feed before its primary
   * list without lying about which one is primary.
   */
  feeds: SlotFeed[]
}

/**
 * A resolved slot. The primary feed's `contentType` / `flatKey` / `cardinality` are mirrored
 * onto the binding itself, so a caller that wants "the type and key for this slot" reads
 * three fields, and a caller that needs the whole column reads `feeds`.
 */
export interface SlotBinding extends SlotFeed {
  blueprintId: string
  slotId: SlotId
  displayName: string
  /** Mirrors `SlotSpec.sharedRow` — Phase 3 and `create-sample-page.mjs` both read it off the binding rather than re-deriving it from the composition shape. */
  sharedRow?: boolean
  /** Every element content type this column accepts, in render order, de-duplicated. */
  accepts: string[]
  /** Every flat key that feeds this slot, in render order, de-duplicated. */
  flatKeys: string[]
  /** All feeds, in render order. The primary one is whichever sets `primary: true` (or, absent that, the first). */
  feeds: SlotFeed[]
  why?: string
}

/** What a blueprint file default-exports. A superset of what `apply.ts` reads. */
export interface LimitlessBlueprint extends BlueprintDefinition {
  /** The same value as `blueprintId`, under the name the contract doc uses. */
  id: string
  /** `md5(blueprintId)`, the GUID-formatted CMS key. `apply.ts` recomputes it identically. */
  key: string
  description?: string
  /** Authored WITHOUT node ids: the API strips them, and ids are minted at instantiation. */
  composition: CompositionNode
  /** The slot order, recorded alongside the composition — Phase 3 binds on these. */
  slots: SlotBinding[]
}

export interface BlueprintInput {
  blueprintId: string
  contentType: string
  displayName: string
  description?: string
  slots: SlotSpec[]
}

// ---------------------------------------------------------------------------
// Display-setting validation
// ---------------------------------------------------------------------------

function templateByIndex(templates: RepoDisplayTemplate[], label: string): RepoDisplayTemplate {
  const template = templates[0]
  if (!template) throw new Error(`${label}: no display template found`)
  return template
}

const BLANK_SECTION_TEMPLATE = templateByIndex(blankSectionTemplates, 'BlankSection')
const ROW_TEMPLATE = templateByIndex(rowTemplates, 'row')
const COLUMN_TEMPLATE = templateByIndex(columnTemplates, 'column')

/**
 * The repo-side defaults, for the compose-time merge Phase 2 performs. The CMS has nowhere to
 * put a default, so these are the only ones that exist.
 */
export const SECTION_DEFAULTS: Record<string, string> = extractDefaults(
  BLANK_SECTION_TEMPLATE.settings
)
export const ROW_DEFAULTS: Record<string, string> = extractDefaults(ROW_TEMPLATE.settings)
export const COLUMN_DEFAULTS: Record<string, string> = extractDefaults(COLUMN_TEMPLATE.settings)

function settingByKey(
  template: RepoDisplayTemplate,
  key: string
): RepoSetting | undefined {
  return template.settings.find((setting) => setting.key === key)
}

/**
 * Reject an override the display template cannot honour. Both halves matter: an unknown key
 * is a typo that no renderer will ever read, and a value outside the setting's options is a
 * class name that will never be generated.
 */
function validateOverrides(
  template: RepoDisplayTemplate,
  overrides: Record<string, string> | undefined,
  where: string
): void {
  if (!overrides) return
  for (const [key, value] of Object.entries(overrides)) {
    const setting = settingByKey(template, key)
    if (!setting) {
      throw new Error(
        `${where}: '${key}' is not a setting on ${template.key}. ` +
          `Known settings: ${template.settings.map((s) => s.key).join(', ')}.`
      )
    }
    if (typeof value !== 'string') {
      throw new Error(`${where}: '${key}' must be a string — displaySettings is Record<string, string>.`)
    }
    if (setting.type === 'checkbox' || setting.type === 'boolean') {
      if (value !== 'true' && value !== 'false') {
        throw new Error(`${where}: '${key}' is a checkbox, so its value must be 'true' or 'false'.`)
      }
      continue
    }
    const allowed = (setting.options ?? []).map((option) => option.value)
    if (!allowed.includes(value)) {
      throw new Error(
        `${where}: '${value}' is not an option of ${template.key}.${key}. ` +
          `Allowed: ${allowed.join(', ')}.`
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Node building
// ---------------------------------------------------------------------------

/**
 * Attach a node's display settings in the shape the API actually accepts:
 * `{ displayTemplate, settings }`, with the overrides INSIDE `settings`.
 *
 * Three measured facts drive every line of this function, and the first two were found only
 * by pushing a composition at the live instance:
 *
 *  1. `displayTemplate` is required whenever `displaySettings` is present at all. A sibling
 *     `displayTemplateKey` next to `nodeType` does not satisfy it — the 400 names
 *     `DisplaySettings.DisplayTemplate` on every node.
 *  2. Overrides written as siblings of `displayTemplate`, rather than nested under
 *     `settings`, are **silently dropped**: 200 back, `"settings": {}` on read. There is no
 *     error to react to, which is exactly why the settings are nested explicitly here and
 *     never spread onto the node.
 *  3. Every value is validated server-side against the named template's choices, so the
 *     template must exist first. `validateOverrides` above already rejects a value the repo
 *     template does not offer, which keeps that failure local.
 *
 * `displaySettings` is written even when there are no overrides. It costs one object per node
 * and it binds the node to its template explicitly, which is what Visual Builder reads; an
 * omitted `displaySettings` round-trips as absent, so both forms are idempotent, and the
 * explicit one does not depend on the CMS and the repo agreeing about which template applies.
 */
function withSettings(
  node: CompositionNode,
  displayTemplate: string,
  overrides?: Record<string, string>
): CompositionNode {
  node.displaySettings = { displayTemplate, settings: { ...(overrides ?? {}) } }
  return node
}

/** A column skeleton: `spec.column` as the base, `feed.column` merged on top and winning. */
function columnFor(spec: SlotSpec, feed: SlotFeed): CompositionNode {
  return withSettings(
    { nodeType: 'column' },
    COLUMN_TEMPLATE.key,
    { ...(spec.column ?? {}), ...(feed.column ?? {}) }
  )
}

/**
 * `section > row* > column` — one row per feed (`spec.feeds` order), each holding ONE column
 * skeleton. `create-sample-page.mjs` clones that one column once per item at instantiation
 * time (a `many` feed's N items become N columns of its own row), which is also why the
 * skeleton never has more than one column here: the item count isn't known until then. A
 * feed's own `row` overrides merge on top of the slot's `row` (the feed wins on a shared key),
 * so a `many` feed's `gridColumns` only ever affects its own row, never its neighbours'.
 */
function ownRowFor(spec: SlotSpec, feed: SlotFeed): CompositionNode {
  const row = withSettings(
    { nodeType: 'row' },
    ROW_TEMPLATE.key,
    { ...(spec.row ?? {}), ...(feed.row ?? {}) }
  )
  row.nodes = [columnFor(spec, feed)]
  return row
}

/**
 * `section > row > column*` — every feed sharing the slot's one row, one column each, side by
 * side once that row's `gridColumns` says so. Only for `spec.sharedRow` slots.
 */
function sharedRowFor(spec: SlotSpec): CompositionNode {
  const row = withSettings({ nodeType: 'row' }, ROW_TEMPLATE.key, spec.row)
  row.nodes = spec.feeds.map((feed) => columnFor(spec, feed))
  return row
}

/**
 * `section > (sharedRowFor | one ownRowFor per feed)`, with no node ids and no empty `nodes`
 * arrays.
 *
 * Each node names its own display template — the section's comes from
 * `blank-section-display.ts`, the rows' and columns' from `layout/`, so the three keys are
 * read off the same modules `validateOverrides` checks against and cannot drift from them.
 */
function sectionNodeFor(spec: SlotSpec): CompositionNode {
  const rows = spec.sharedRow ? [sharedRowFor(spec)] : spec.feeds.map((feed) => ownRowFor(spec, feed))

  const section: CompositionNode = {
    nodeType: 'section',
    layoutType: 'grid',
    displayName: spec.displayName,
    component: { contentType: SECTION_CONTENT_TYPE, properties: {} },
  }
  withSettings(section, BLANK_SECTION_TEMPLATE.key, spec.section)
  section.nodes = rows
  return section
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

// ---------------------------------------------------------------------------
// The factory
// ---------------------------------------------------------------------------

/**
 * Build a blueprint from its slot list. Validates as it goes, and throws rather than
 * returning something half-formed: a blueprint module that fails to import is reported by
 * `registry.ts` as a problem and refused by `apply.ts`, which is the loud failure this wants.
 */
export function defineBlueprint(input: BlueprintInput): LimitlessBlueprint {
  const { blueprintId, contentType, displayName } = input

  if (!blueprintId) throw new Error('defineBlueprint: blueprintId is required')
  if (!contentType) throw new Error(`${blueprintId}: contentType is required`)
  if (!displayName) throw new Error(`${blueprintId}: displayName is required`)
  if (!input.slots || input.slots.length === 0) {
    throw new Error(`${blueprintId}: a blueprint with no slots would instantiate an empty page`)
  }

  const seen = new Set<SlotId>()
  const slots: SlotBinding[] = []
  const nodes: CompositionNode[] = []

  for (const spec of input.slots) {
    const where = `${blueprintId}/${spec.slotId}`

    if (!SLOT_IDS.includes(spec.slotId)) {
      throw new Error(
        `${where}: unknown slot id. It must be one of component-plan.ts's ComponentId values: ` +
          `${SLOT_IDS.join(', ')}.`
      )
    }
    if (seen.has(spec.slotId)) {
      throw new Error(
        `${where}: duplicate slot id. Phase 3 binds on blueprintId + slotId, so two sections ` +
          `sharing one id in a blueprint would be indistinguishable.`
      )
    }
    seen.add(spec.slotId)

    if (!spec.feeds || spec.feeds.length === 0) {
      throw new Error(
        `${where}: at least one feed is required — a slot nothing feeds is an empty band.`
      )
    }
    for (const feed of spec.feeds) {
      if (!feed.contentType) throw new Error(`${where}: a feed is missing its contentType`)
      if (!feed.flatKey) throw new Error(`${where}: ${feed.contentType} feed is missing its flatKey`)
    }

    validateOverrides(BLANK_SECTION_TEMPLATE, spec.section, `${where} section`)
    validateOverrides(ROW_TEMPLATE, spec.row, `${where} row`)
    validateOverrides(COLUMN_TEMPLATE, spec.column, `${where} column`)
    for (const feed of spec.feeds) {
      validateOverrides(ROW_TEMPLATE, feed.row, `${where} ${feed.flatKey} row`)
      validateOverrides(COLUMN_TEMPLATE, feed.column, `${where} ${feed.flatKey} column`)
    }

    const primaryCandidates = spec.feeds.filter((feed) => feed.primary)
    if (primaryCandidates.length > 1) {
      throw new Error(
        `${where}: ${primaryCandidates.length} feeds set 'primary: true' ` +
          `(${primaryCandidates.map((feed) => feed.flatKey).join(', ')}). A slot mirrors ` +
          `exactly one feed onto its binding, so at most one may claim it.`
      )
    }
    const primary = primaryCandidates[0] ?? spec.feeds[0]
    const binding: SlotBinding = {
      blueprintId,
      slotId: spec.slotId,
      displayName: spec.displayName,
      contentType: primary.contentType,
      flatKey: primary.flatKey,
      cardinality: primary.cardinality,
      accepts: unique(spec.feeds.map((feed) => feed.contentType)),
      flatKeys: unique(spec.feeds.map((feed) => feed.flatKey)),
      feeds: spec.feeds.map((feed) => ({ ...feed })),
    }
    if (spec.sharedRow !== undefined) binding.sharedRow = spec.sharedRow
    if (primary.note !== undefined) binding.note = primary.note
    if (spec.why !== undefined) binding.why = spec.why
    slots.push(binding)

    nodes.push(sectionNodeFor(spec))
  }

  const blueprint: LimitlessBlueprint = {
    blueprintId,
    id: blueprintId,
    key: blueprintKeyFor(blueprintId),
    contentType,
    displayName,
    composition: { nodeType: 'experience', layoutType: 'outline', nodes },
    slots,
  }
  if (input.description !== undefined) blueprint.description = input.description
  return blueprint
}
