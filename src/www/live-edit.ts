/**
 * Live edits on the account page, either template: while Mark streams an edit (Edit mode, booth
 * only), the page re-renders from the edited data, so the visitor watches the real layout change
 * (on the agent platform page the pills, the stack tiles, the homework notes and the use-case
 * evidence all re-derive together; on the takeout page the stored text and lists) instead of a
 * text overlay. Mark sends each changed field's full new value with the edit
 * (`field` + `value`, agent account_page_live_edit v1.4); this store holds those values until the
 * saved page is reloaded.
 *
 * Presentation only. Nothing here is saved: Mark's single update_page is the save, and the page
 * reloads from the CMS once it is published. The server snapshot is always empty, so the server
 * render and hydration never see a live edit.
 */
import { useMemo, useSyncExternalStore } from 'react'
import type { CompetitorComparisonPage } from '../lib/graph-types'
import { copyKey, copyValue, type PageCopy } from '../lib/page-copy'

type Patch = Record<string, unknown>

const EMPTY: Patch = Object.freeze({}) as Patch
let patch: Patch = EMPTY
const listeners = new Set<() => void>()

/**
 * The stored fields a live edit may change: the agent platform template's (USED_FIELDS that a
 * reader sees) and every text and list the takeout template shows. Link fields (`{ default }`)
 * are not live: their change shows when the saved page reloads.
 */
export const LIVE_FIELDS = [
  'intelStats', 'techStack', 'investments', 'stakeholders', 'teamMembers', 'customerLogo', 'footerTagline', 'footerLegal',
  // the takeout template's own
  'eyebrow', 'headline', 'subheadline', 'cta', 'intelEyebrow', 'intelHeadline', 'newsItems', 'brandDomain',
  'challengeHeadline', 'challengeScreenshotAlt', 'challengeBrowserUrl', 'painPoints',
  'comparisonHeadline', 'comparisonDescription', 'competitorName', 'comparisonTableRows', 'logoWallCustomerSlot',
  'testimonial1', 'testimonial1JobTitle', 'testimonial1Company', 'testimonial2', 'testimonial2JobTitle', 'testimonial2Company',
  'analystHeadline', 'analystQuote', 'analystSource', 'analystCTA', 'analystCards',
  'promoEyebrow', 'promoHeading', 'promoDescription', 'promoCTA',
  'roiTitle', 'roiDescription', 'roiProjectionValue', 'roiProjectionLabel', 'roiProjectionDetail', 'roiCards',
  'endHeadline', 'endSubheadline', 'endCTA', 'migrationTitle', 'migrationDescription', 'timelinePhases',
  'ctaTitle', 'ctaDescription', 'ctaButtonText', 'stickyCTAText', 'footerLinks',
] as const
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
    case 'newsItems':
      return rows(['Date', 'Headline'])
    case 'painPoints':
      return rows(['Title', 'Description'])
    case 'comparisonTableRows':
      return rows(['Category', 'OurValue', 'CompetitorValue'])
    case 'analystCards':
      return rows(['Badge', 'Source', 'Category'])
    case 'roiCards':
      return rows(['Metric', 'Unit', 'Label', 'CitationText'])
    case 'timelinePhases':
      return rows(['Title', 'Description'])
    case 'footerLinks':
      return rows(['Text'])
    default:
      return value === null || str(value) ? value : null
  }
}

/**
 * Applies one streamed field value. Returns false when the field or its value is not accepted.
 * A page-copy field ("copy.hero.h1", src/lib/page-copy.ts) goes into the page's `pageCopy`.
 */
export function applyLiveField(field: unknown, value: unknown): boolean {
  const ck = copyKey(field)
  if (ck) {
    const v = copyValue(ck, value)
    if (v === null) return false
    patch = { ...patch, pageCopy: { ...((patch.pageCopy as PageCopy | undefined) ?? {}), [ck]: v } }
    for (const l of listeners) l()
    return true
  }
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
export function changedLiveFields(fields: readonly string[], shown: Record<string, unknown>, saved: Record<string, unknown>): string[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  return fields.filter((f) => (isLiveField(f) || copyKey(f) !== null) && !same(liveFieldValue(shown, f), liveFieldValue(saved, f)))
}

/** A field's value on a page: a page property, or one entry of its `pageCopy`. */
export function liveFieldValue(page: Record<string, unknown> | null | undefined, field: string): unknown {
  const ck = copyKey(field)
  if (ck) return (page?.pageCopy as PageCopy | undefined)?.[ck]
  return page?.[field]
}

/** The page with the live values on top (its own copy merged key by key). Pure, for the renderer and the tests. */
export function mergeLive<T extends object>(page: T, p: Patch): T {
  if (p === EMPTY || !Object.keys(p).length) return page
  const merged = { ...page, ...p } as Record<string, unknown>
  if (p.pageCopy) merged.pageCopy = { ...((page as { pageCopy?: PageCopy }).pageCopy ?? {}), ...(p.pageCopy as PageCopy) }
  return merged as T
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

/**
 * The text each editable part of the agent platform page shows right now (agent-platform/copy.ts
 * resolveCopy), set by the page after each render on the client. Edit mode sends it to Mark with
 * a comment, since the page's own copy isn't in the CMS for Mark to read.
 */
let shownCopy: Record<string, string | string[]> = {}
export function setShownCopy(copy: Record<string, string | string[]>): void {
  shownCopy = copy
}
export function getShownCopy(): Record<string, string | string[]> {
  return shownCopy
}
