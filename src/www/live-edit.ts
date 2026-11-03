/**
 * Live edits on the www agent platform page: while Mark streams an edit (Edit mode, booth only),
 * the page re-renders from the edited data, so the visitor watches the real layout change (the
 * pills, the stack tiles, the homework notes, the use-case evidence all re-derive together)
 * instead of a text overlay. Mark sends each changed field's full new value with the edit
 * (`field` + `value`, agent account_page_live_edit v1.4); this store holds those values until the
 * saved page is reloaded.
 *
 * Presentation only. Nothing here is saved: Mark's single update_page is the save, and the page
 * reloads from the CMS once it is published. The server snapshot is always empty, so the server
 * render and hydration never see a live edit.
 */
import { useMemo, useSyncExternalStore } from 'react'
import type { CompetitorComparisonPage } from '../lib/graph-types'

type Patch = Record<string, unknown>

const EMPTY: Patch = Object.freeze({}) as Patch
let patch: Patch = EMPTY
const listeners = new Set<() => void>()

/** The stored fields a live edit may change on this template (USED_FIELDS that a reader sees). */
export const LIVE_FIELDS = ['intelStats', 'techStack', 'investments', 'stakeholders', 'teamMembers', 'customerLogo', 'footerTagline', 'footerLegal'] as const
export type LiveField = (typeof LIVE_FIELDS)[number]

export function isLiveField(field: unknown): field is LiveField {
  return typeof field === 'string' && (LIVE_FIELDS as readonly string[]).includes(field)
}

/**
 * A value Mark sent, checked against the field's shape before it reaches the renderer: the
 * arrays must be arrays of objects with the field's text keys, the rest strings. Anything else is
 * refused (null) and the edit falls back to its card.
 */
export function liveValue(field: LiveField, value: unknown): unknown | null {
  const str = (v: unknown) => typeof v === 'string'
  const rows = (keys: string[]) =>
    Array.isArray(value) && value.every((r) => r && typeof r === 'object' && keys.every((k) => (r as Record<string, unknown>)[k] == null || str((r as Record<string, unknown>)[k])))
      ? value
      : null
  switch (field) {
    case 'intelStats':
      return rows(['Value', 'Label'])
    case 'techStack':
      return rows(['Name'])
    case 'investments':
      return rows(['Name'])
    case 'stakeholders':
      return rows(['Name', 'Role'])
    case 'teamMembers':
      return rows(['Name', 'Role'])
    default:
      return value === null || str(value) ? value : null
  }
}

/** Applies one streamed field value. Returns false when the field or its value is not accepted. */
export function applyLiveField(field: unknown, value: unknown): boolean {
  if (!isLiveField(field)) return false
  const v = liveValue(field, value)
  if (v === null && value !== null) return false
  patch = { ...patch, [field]: v }
  for (const l of listeners) l()
  return true
}

export function resetLive() {
  if (patch === EMPTY) return
  patch = EMPTY
  for (const l of listeners) l()
}

/** The live values so far (Edit mode compares the saved page against the page as shown). */
export function getLivePatch(): Patch {
  return patch
}

/**
 * The live fields among `fields` whose saved value differs from what the page shows now. Edit
 * mode replays these after the save, so a change Mark saved without narrating it still gets its
 * spotlight and its glow before the reload.
 */
export function changedLiveFields(fields: readonly string[], shown: Record<string, unknown>, saved: Record<string, unknown>): LiveField[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  return fields.filter((f): f is LiveField => isLiveField(f) && !same(shown[f], saved[f]))
}

/** The page with the live values on top. Pure, for the renderer and the tests. */
export function mergeLive<T extends object>(page: T, p: Patch): T {
  return p === EMPTY || !Object.keys(p).length ? page : ({ ...page, ...p } as T)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The page as the agent platform template should render it right now. */
export function useLivePage(page: CompetitorComparisonPage): CompetitorComparisonPage {
  const p = useSyncExternalStore(
    subscribe,
    () => patch,
    () => EMPTY,
  )
  return useMemo(() => mergeLive(page, p), [page, p])
}
