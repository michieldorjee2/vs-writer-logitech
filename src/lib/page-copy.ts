/**
 * A page's own copy on the agent platform template: the headlines and body text the template
 * writes for every page (src/www/agent-platform/library.ts), which one page can now say its own
 * way (Michiel, 3 Nov: "labels are fine as not editable, but things like H1 also weren't. Most
 * content should be").
 *
 * The CMS has no property for this copy and the account page content type stays as it is, so
 * it is kept beside the page: Mark sends each change in Edit mode as an edit with the field
 * "copy.<key>" and the full new text as its value, api/opal-edit-stream.ts saves the applied ones
 * (api/_lib/page-copy.ts, the site's Redis), and every render of the page (the server render,
 * /api/content) carries them as `pageCopy`. Anything not saved is the template's own text.
 *
 * Editable: headings, lead lines and body text. Not editable: labels (eyebrows, captions,
 * buttons, the "Our homework" tags), the proof stories' numbers (verified customer results), and
 * everything a page field drives (those are edited through their fields).
 */
/** The template's use-case themes (THEME_ORDER in src/www/agent-platform/library.ts; check:www holds them equal). Kept here so the server functions don't pull in the template. */
export const COPY_THEMES = ['content-ops', 'personalization', 'geo', 'optimization', 'analytics'] as const

export const COPY_PREFIX = 'copy.'

/** The keys one page can set, beyond the use-case cards (themeKeys). */
export const COPY_KEYS = [
  'hero.h1',
  'hero.sub',
  'who.heading',
  'who.tile1.title',
  'who.tile1.body',
  'who.tile2.title',
  'who.tile2.body',
  'who.tile3.title',
  'who.tile3.body',
  'fit.heading',
  'fit.lead',
  'language.heading',
  'language.question',
  'language.generic',
  'language.checks',
  'usecases.heading',
  'usecases.closing',
  'proof.heading',
  'ninety.heading',
  'ninety.step1.title',
  'ninety.step1.body',
  'ninety.step2.title',
  'ninety.step2.body',
  'ninety.step3.title',
  'ninety.step3.body',
  'ninety.step4.title',
  'ninety.step4.body',
  'ninety.governance',
  'close.heading',
  'close.reason1',
  'close.reason2',
  'close.reason3',
  'close.line',
] as const

/** Use-case cards are keyed by their theme, so an edit stays with its card when the order changes. */
export const themeKeys = (id: string) => [`usecases.${id}.title`, `usecases.${id}.body`, `usecases.${id}.strip.title`, `usecases.${id}.strip.body`]

const ALLOWED = new Set<string>([...COPY_KEYS, ...COPY_THEMES.flatMap(themeKeys)])
/** The keys whose value is a list of lines. */
const LISTS = new Set(['language.checks'])

export type PageCopy = Record<string, string | string[]>

/** "copy.hero.h1" -> "hero.h1", for a field this page can store; otherwise null. */
export function copyKey(field: unknown): string | null {
  if (typeof field !== 'string' || !field.startsWith(COPY_PREFIX)) return null
  const key = field.slice(COPY_PREFIX.length)
  return ALLOWED.has(key) ? key : null
}

export const isCopyField = (field: unknown): boolean => copyKey(field) !== null

const MAX_TEXT = 700
const MAX_LINE = 240
const MAX_LINES = 6

/** Plain text, one paragraph: no markup, no control characters, trimmed. */
function clean(s: string): string {
  const printable = [...s.replace(/<[^>]*>/g, '')].filter((ch) => {
    const n = ch.charCodeAt(0)
    return n >= 32 ? n !== 127 : ch === '\t' || ch === '\n' || ch === '\r'
  })
  return printable.join('').replace(/\s+/g, ' ').trim()
}

/** A value for that key, checked and cleaned; null when it isn't one (refused, not stored). */
export function copyValue(key: string, value: unknown): string | string[] | null {
  if (LISTS.has(key)) {
    if (!Array.isArray(value)) return null
    const lines = value.filter((v): v is string => typeof v === 'string').map(clean).filter(Boolean)
    if (!lines.length || lines.length > MAX_LINES || lines.some((l) => l.length > MAX_LINE)) return null
    return lines
  }
  if (typeof value !== 'string') return null
  const text = clean(value)
  return text && text.length <= MAX_TEXT ? text : null
}

/** A stored copy object, every entry checked again (what Redis hands back is not trusted). */
export function readCopy(raw: unknown): PageCopy {
  const out: PageCopy = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue
    const val = copyValue(k, v)
    if (val !== null) out[k] = val
  }
  return out
}

/** The page's text for a key: its own when it has one, otherwise the template's. */
export function copyText(copy: PageCopy | null | undefined, key: string, fallback: string): string {
  const v = copy?.[key]
  return typeof v === 'string' && v ? v : fallback
}

export function copyLines(copy: PageCopy | null | undefined, key: string, fallback: string[]): string[] {
  const v = copy?.[key]
  return Array.isArray(v) && v.length ? v : fallback
}

/**
 * The copy edits in Mark's events: applied edits on a copy field with a valid value, the last
 * one per key winning. What api/opal-edit-stream.ts saves.
 */
export function copyEdits(events: Array<Record<string, unknown>>): PageCopy {
  const out: PageCopy = {}
  for (const e of events) {
    if (!e || e.type !== 'edit' || e.status === 'skipped') continue
    const key = copyKey(e.field)
    if (!key) continue
    const val = copyValue(key, e.value)
    if (val !== null) out[key] = val
  }
  return out
}

/**
 * A part's fields with each "copy.x.*" spread into the copy keys the page shows under it
 * ("copy.ninety.*" -> the heading, the four steps, the governance line). Edit mode, agent
 * platform page.
 */
export function expandFields(fields: readonly string[] | undefined, shown: Record<string, unknown>): string[] {
  return [
    ...new Set(
      (fields ?? []).flatMap((f) =>
        f.endsWith('.*') ? Object.keys(shown).map((k) => `${COPY_PREFIX}${k}`).filter((k) => k.startsWith(f.slice(0, -1))) : [f],
      ),
    ),
  ]
}
