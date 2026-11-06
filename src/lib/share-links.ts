/**
 * Personal links: a rep's note to one person about one Showcase page, behind a short link
 * (showcase.optimizely.com/s/<code>). The rail's Share sheet makes them (src/components/ShareSheet.tsx),
 * the recipient reads the note before the page (src/components/InviteNote.tsx), and the Report lists
 * them with whether they were opened and whether a CTA followed.
 *
 * Shared by the browser and the server: the shapes, and the one check of what a rep types.
 * The store and its keys are server-only (api/_lib/share-store.ts).
 */

/** Eight letters and digits: 62^8, so codes can't be walked. */
export const SHARE_CODE_RE = /^[A-Za-z0-9]{8}$/
/** The query parameter /s/<code> lands on the page with. */
export const SHARE_PARAM = 'p'
/** The code this tab arrived with, for the CTA ping (sessionStorage). */
export const SHARE_SESSION_KEY = 'showcase.share'

export const SHARE_LIMITS = { name: 120, title: 120, email: 254, message: 1200 } as const

export interface ShareRecipient {
  name: string
  title: string
  /** Empty when the rep didn't give one. */
  email: string
}

export interface SharePerson {
  name: string
  email: string
}

/** One link as stored (api/_lib/share-store.ts). */
export interface ShareLink {
  code: string
  /** The page: "lenovo", or "logitech/ben-yu" for a person page. */
  path: string
  message: string
  recipient: ShareRecipient
  sender: SharePerson
  /** Epoch seconds. */
  created: number
}

export interface ShareStats {
  opens: number
  firstOpen: number | null
  lastOpen: number | null
  ctas: number
  lastCta: number | null
}

/** A link as the Report and the Share sheet list it: no addresses. */
export interface ShareLinkRow {
  code: string
  recipient: { name: string; title: string }
  sender: { name: string }
  message: string
  created: number
  stats: ShareStats
}

/** What the recipient's note shows: no addresses, nothing about who else was sent one. */
export interface ShareNote {
  to: { name: string; title: string }
  from: { name: string }
  message: string
  created: number
}

export const shareCodeOf = (value: unknown): string | null => (typeof value === 'string' && SHARE_CODE_RE.test(value) ? value : null)

export const shareUrl = (origin: string, code: string): string => `${origin.replace(/\/+$/, '')}/s/${code}`

const SEGMENT = '[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?'
const ROUTE = new RegExp(`^/(?:en/)?(${SEGMENT})(?:/(${SEGMENT}))?/?$`, 'i')
const NOT_PAGES = new Set(['vb', 'search', 'preview', 'api', 's'])

/**
 * The page a link is for, from its path: an account page ("/lenovo/" -> "lenovo") or a person page
 * ("/logitech/ben-yu/" -> "logitech/ben-yu"). Null for anything else, offer pages included.
 */
export function sharePathOf(route: unknown): { path: string; person: boolean } | null {
  if (typeof route !== 'string') return null
  const m = ROUTE.exec(route.trim())
  if (!m || NOT_PAGES.has(m[1].toLowerCase())) return null
  return { path: (m[2] ? `${m[1]}/${m[2]}` : m[1]).toLowerCase(), person: !!m[2] }
}

/** One line: no control characters, single spaces, at most `max` characters. */
export function oneLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

/** A note: line breaks kept (at most one blank line in a row), other control characters gone. */
export function noteText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i

export const isEmail = (value: string): boolean => value.length <= SHARE_LIMITS.email && EMAIL_RE.test(value)

export type ShareInputCheck =
  | { ok: true; value: { path: string; person: boolean; recipient: ShareRecipient; message: string } }
  | { ok: false; field: 'route' | 'name' | 'email' | 'message'; error: string }

/** What a rep sends to make a link, checked: the browser shows the same errors the server returns. */
export function checkShareInput(body: unknown): ShareInputCheck {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const route = sharePathOf(b.route)
  if (!route) return { ok: false, field: 'route', error: 'Links are for account and person pages' }
  const r = (b.recipient && typeof b.recipient === 'object' ? b.recipient : {}) as Record<string, unknown>
  const name = oneLine(r.name, SHARE_LIMITS.name)
  const title = oneLine(r.title, SHARE_LIMITS.title)
  const email = oneLine(r.email, SHARE_LIMITS.email + 1).toLowerCase()
  const message = noteText(b.message, SHARE_LIMITS.message + 1)
  if (!name) return { ok: false, field: 'name', error: 'Who is it for?' }
  if (email && !isEmail(email)) return { ok: false, field: 'email', error: 'That email address doesn’t look right' }
  if (!message) return { ok: false, field: 'message', error: 'Write them a note' }
  if (message.length > SHARE_LIMITS.message) return { ok: false, field: 'message', error: `Keep it under ${SHARE_LIMITS.message} characters` }
  return { ok: true, value: { ...route, recipient: { name, title, email }, message } }
}

export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** A name from an address when a sign-in carries none: "michiel.dorjee@…" -> "Michiel Dorjee". */
export function nameFromEmail(email: string): string {
  return (email.split('@')[0] ?? '')
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
