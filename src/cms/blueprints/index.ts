/**
 * The blueprint barrel, and the slot map Phase 3 binds on.
 *
 * Four blueprints, two content types:
 *
 *   abm-takeout        ABMExperience     13 slots — the full competitive takeout
 *   use-case-default   ABMExperience      7 slots — Laura's Use Case Template v2
 *   comparison         ABMExperience      5 slots — the plain category comparison
 *   person             PersonExperience   5 slots — written to one named individual
 *
 * WHY `SLOT_MAP` IS KEYED `blueprintId:slotId` AND NOT BY SLOT ALONE. A slot id names the
 * JOB of a band — `friction-points` is "where it breaks", wherever it appears. What fills it
 * depends on which page type the copy comes from, and the three cases below are real, not
 * hypothetical:
 *
 *   friction-points   painPoints on an ABM page, scorecard on a person page
 *   signal-pills      intelStats (many) on an ABM page, the keyNumber* cluster (one) on a person page
 *   proof-wall        a customer logo on an ABM page, peerProof quotes on a person page
 *
 * A map keyed by slot id alone would have to pick one of each pair, and the picker would be
 * whichever module happened to be imported last. `SLOT_MAP_BY_SLOT` is there for the other
 * question — "everywhere this slot appears" — and returns every binding rather than one.
 *
 * Each binding mirrors its PRIMARY feed's `contentType`, `flatKey` and `cardinality` at the
 * top level, so a caller that wants "the element type and the flat key for this slot" reads
 * three fields. A slot with several element types in its column — `account-intel` has four —
 * carries all of them in `feeds`, in render order.
 *
 * THIS BARREL HAS NO DEFAULT EXPORT, AND MUST NOT GET ONE. `registry.ts` discovers
 * blueprints by globbing `blueprints/*.ts` (eagerly under Vite, by `readdir` under tsx) and
 * treats every file directly in this directory as a blueprint module, requiring a
 * default-exported definition with a `blueprintId`, a `contentType` and a `displayName`.
 * Both discovery paths skip `index.ts` by name (`BARREL_FILENAME`), so a barrel is not a
 * blueprint. An earlier version of this file re-exported `abmTakeout` as its default to
 * satisfy a discovery pass that did not yet skip it; that made the takeout appear twice in
 * the apply table, reconciling to the same `md5` key and reporting `unchanged` on the second
 * pass. The skip removed the need, and the export is gone — adding one back would resurrect
 * the duplicate row. Helper modules avoid the question entirely by living in `internal/`:
 * the glob is single-level and does not descend.
 */

import abmTakeout from './abm-takeout'
import comparison from './comparison'
import {
  SLOT_IDS,
  type LimitlessBlueprint,
  type SlotBinding,
  type SlotFeed,
  type SlotId,
} from './internal/compose'
import offer from './offer'
import person from './person'
import useCaseDefault from './use-case-default'

export { abmTakeout, comparison, offer, person, useCaseDefault }

export {
  COLUMN_DEFAULTS,
  ROW_DEFAULTS,
  SECTION_CONTENT_TYPE,
  SECTION_DEFAULTS,
  SLOT_IDS,
} from './internal/compose'
export type {
  Cardinality,
  LimitlessBlueprint,
  SlotBinding,
  SlotFeed,
  SlotId,
} from './internal/compose'
export { blueprintKeyFor, md5Hex } from './internal/blueprint-key'

/** Every blueprint, longest first — the takeout is the reference the others subtract from. */
export const BLUEPRINTS: LimitlessBlueprint[] = [
  abmTakeout,
  useCaseDefault,
  comparison,
  person,
  offer,
]

export type BlueprintId = 'abm-takeout' | 'use-case-default' | 'comparison' | 'person' | 'offer'

export const BLUEPRINT_IDS: BlueprintId[] = BLUEPRINTS.map((b) => b.blueprintId as BlueprintId)

export const BLUEPRINTS_BY_ID: Record<string, LimitlessBlueprint> = Object.fromEntries(
  BLUEPRINTS.map((blueprint) => [blueprint.blueprintId, blueprint])
)

/** The composite key. Use it rather than building the string by hand. */
export function slotKey(blueprintId: string, slotId: SlotId | string): string {
  return `${blueprintId}:${slotId}`
}

/**
 * `blueprintId:slotId` -> the binding. Every slot of every blueprint, in blueprint order and
 * then page order.
 */
export const SLOT_MAP: Record<string, SlotBinding> = Object.fromEntries(
  BLUEPRINTS.flatMap((blueprint) =>
    blueprint.slots.map((slot) => [slotKey(blueprint.blueprintId, slot.slotId), slot] as const)
  )
)

/** `slotId` -> every binding for it, across blueprints. For "where does this slot appear?". */
export const SLOT_MAP_BY_SLOT: Record<string, SlotBinding[]> = (() => {
  const out: Record<string, SlotBinding[]> = {}
  for (const slotId of SLOT_IDS) out[slotId] = []
  for (const blueprint of BLUEPRINTS) {
    for (const slot of blueprint.slots) {
      ;(out[slot.slotId] ??= []).push(slot)
    }
  }
  return out
})()

/** The slots of one blueprint, in page order. Empty for an unknown id. */
export function slotsOf(blueprintId: string): SlotBinding[] {
  return BLUEPRINTS_BY_ID[blueprintId]?.slots ?? []
}

/** One binding, or undefined when that blueprint has no such slot. */
export function slotBinding(blueprintId: string, slotId: SlotId | string): SlotBinding | undefined {
  return SLOT_MAP[slotKey(blueprintId, slotId)]
}

/**
 * Which element content type a flat key writes into, for one blueprint. This is the lookup
 * the flat tools need in the other direction: the agent passes `comparisonTableRows`, and the
 * writer has to know it becomes N `AbmComparisonRowElement` nodes in the `comparison-table`
 * slot.
 */
export function feedFor(
  blueprintId: string,
  flatKey: string
): { slot: SlotBinding; feed: SlotFeed } | undefined {
  for (const slot of slotsOf(blueprintId)) {
    const feed = slot.feeds.find((candidate) => candidate.flatKey === flatKey)
    if (feed) return { slot, feed }
  }
  return undefined
}

/** Every element content type any blueprint places, de-duplicated. */
export const PLACED_CONTENT_TYPES: string[] = [
  ...new Set(BLUEPRINTS.flatMap((b) => b.slots.flatMap((slot) => slot.accepts))),
].sort()

// A copy-pasted blueprint that kept its id would silently collide on the md5 key and
// overwrite the original, so the barrel checks at import time rather than at apply time.
const duplicateIds = BLUEPRINT_IDS.filter((id, index) => BLUEPRINT_IDS.indexOf(id) !== index)
if (duplicateIds.length > 0) {
  throw new Error(
    `duplicate blueprintId(s): ${duplicateIds.join(', ')}. The CMS key is md5(blueprintId), ` +
      `so two blueprints sharing an id are one blueprint.`
  )
}

const keys = BLUEPRINTS.map((b) => b.key)
const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index)
if (duplicateKeys.length > 0) {
  throw new Error(`md5 key collision across blueprint ids: ${duplicateKeys.join(', ')}`)
}
