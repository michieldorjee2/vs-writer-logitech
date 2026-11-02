type ReadonlyURLSearchParams = URLSearchParams | { toString(): string }
import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { decode } from 'html-entities'
import { getEventTimezone } from './utils/timezones'

// Local mirrors of generic schema types previously imported from generated.ts.
// These mirror the fields actually consumed by the helpers + their callers
// (slider-zoom-block reads `Url` on the narrowed asset types via these guards).
type Maybe<T> = T | null | undefined
type ContentReference = { key?: Maybe<string> }

export interface PublicAssetBase {
  __typename?: string
  Url?: Maybe<string>
  Width?: Maybe<number>
  Height?: Maybe<number>
  Title?: Maybe<string>
  DateModified?: Maybe<Date>
  Description?: Maybe<string>
}

export type cmp_PublicVideoAsset = PublicAssetBase & {
  __typename?: 'cmp_PublicVideoAsset'
  AltText?: Maybe<string>
}

export type cmp_PublicImageAsset = PublicAssetBase & {
  __typename?: 'cmp_PublicImageAsset'
  AltText?: Maybe<string>
}

export type cmp_PublicRawFileAsset = PublicAssetBase & {
  __typename?: 'cmp_PublicRawFileAsset'
}

const isCustomFontSize = (value: string) =>
  /^body-|^headline-|^overline-|^extruded-/.test(value)

const isCustomColor = (value: string) =>
  /^(primary|secondary|tertiary|neutral|lfgreen|dust|fir|label|accent|card|destructive|muted|popover)-|^\(--color-/.test(
    value
  )

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [isCustomFontSize] }],
      'text-color': [{ text: [isCustomColor] }],
    },
  },
})

export const createUrl = (
  pathname: string,
  params: URLSearchParams | ReadonlyURLSearchParams
) => {
  const paramsString = params.toString()
  const queryString = `${paramsString.length ? '?' : ''}${paramsString}`

  return `${pathname}${queryString}`
}

export const leadingSlashUrlPath = (pathname: string) => {
  return `${pathname.startsWith('/') ? '' : '/'}${pathname}`
}
export const trailingSlashUrlPath = (pathname: string) => {
  return `${pathname}${pathname.endsWith('/') ? '' : '/'}`
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function richTextToHtml(input: string): string {
  if (!input) {
    return ''
  }

  // Escape HTML to ensure safety
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const escaped = escapeHtml(input)

  const lines = escaped.split('\n')
  const html: string[] = []

  let inUl = false
  let inOl = false
  let inBlockquote = false

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>')
      inUl = false
    }
    if (inOl) {
      html.push('</ol>')
      inOl = false
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Empty line → paragraph break
    if (!trimmed) {
      closeLists()
      if (inBlockquote) {
        html.push('</blockquote>')
        inBlockquote = false
      }
      html.push('<p></p>')
      continue
    }

    // Blockquote: > text
    if (trimmed.startsWith('>')) {
      closeLists()
      if (!inBlockquote) {
        html.push('<blockquote>')
        inBlockquote = true
      }
      html.push(trimmed.replace(/^>\s?/, ''))
      continue
    } else if (inBlockquote) {
      html.push('</blockquote>')
      inBlockquote = false
    }

    // Numbered list: "1. something"
    if (/^\d+\.\s+/.test(trimmed)) {
      if (!inOl) {
        closeLists()
        html.push('<ol>')
        inOl = true
      }
      html.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`)
      continue
    }

    // Bulleted list: "-" or "*"
    if (/^[-*]\s+/.test(trimmed)) {
      if (!inUl) {
        closeLists()
        html.push('<ul>')
        inUl = true
      }
      html.push(`<li>${trimmed.replace(/^[-*]\s+/, '')}</li>`)
      continue
    }

    // Close list blocks when encountering normal text
    closeLists()

    // Normal paragraph line (with preserved <br>)
    html.push(`<p>${trimmed.replace(/\n/g, '<br />')}</p>`)
  }

  // Close any open tags
  closeLists()
  if (inBlockquote) {
    html.push('</blockquote>')
  }

  return html.join('\n')
}
export function formatDate(
  date: Date | string,
  locale: 'en' | 'de' | 'sv' | 'no',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) {
    return ''
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }

  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(d)
}

export function formatDateTime(
  date: Date | string,
  locale: 'en' | 'de' | 'sv' | 'no',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) {
    return ''
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }

  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(d)
}

export function formatRelativeTime(
  date: Date | string,
  locale: 'en' | 'de' | 'sv' | 'no'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) {
    return ''
  }

  const diff = d.getTime() - Date.now()

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
    ['second', 1000],
  ]

  for (const [unit, ms] of units) {
    const value = Math.round(diff / ms)
    if (Math.abs(value) >= 1) return rtf.format(value, unit)
  }

  return rtf.format(0, 'second')
}

export function getTimezoneAbbr(date: Date, tz: string): string {
  if (Number.isNaN(date.getTime())) {
    return tz
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(date)
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
}

export function formatTime(date: Date, tz: string): string {
  return date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    })
    .toLowerCase()
}

// Returns true only for zone ids the runtime accepts. Guards against legacy
// free-text values like "BST"/"EDT" that make Intl throw a RangeError. Note
// that "EST"/"MST" etc. ARE accepted by the runtime as fixed zones.
export function isValidTimeZone(timeZone?: string | null): boolean {
  if (!timeZone) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

// Offset (ms) of `timeZone` at the given instant: (wall-clock in zone) - (UTC).
export function getZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const map: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = Number(p.value)
    }
  }
  const hour = map.hour === 24 ? 0 : map.hour
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    hour,
    map.minute,
    map.second
  )
  return asUTC - date.getTime()
}

// Clean 3-letter abbreviation for a curated event zone, DST-correct for the
// instant (EST vs EDT, AEST vs AEDT). Falls back to Intl, then to the raw
// string for legacy free-text values.
export function getEventTzAbbr(
  instant: Date,
  timeZone?: string | null
): string {
  if (!timeZone || Number.isNaN(instant.getTime())) {
    return ''
  }
  const meta = getEventTimezone(timeZone)
  if (meta) {
    if (meta.std === meta.dst) {
      return meta.std
    }
    const year = instant.getUTCFullYear()
    const jan = getZoneOffsetMs(new Date(Date.UTC(year, 0, 1)), timeZone)
    const jul = getZoneOffsetMs(new Date(Date.UTC(year, 6, 1)), timeZone)
    const cur = getZoneOffsetMs(instant, timeZone)
    return cur === Math.max(jan, jul) && jan !== jul ? meta.dst : meta.std
  }
  return isValidTimeZone(timeZone)
    ? getTimezoneAbbr(instant, timeZone)
    : timeZone
}

export function getCookieOrNull(name: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const cookies = document.cookie.split('; ')
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`))

  return found ? decodeURIComponent(found.split('=').slice(1).join('=')) : null
}

export function toArrayOrNull(
  value: Maybe<string[]>
): string[] | null | undefined {
  return value?.filter((t): t is string => Boolean(t)) ?? null
}

export function isCmpPublicAssetBase(item: unknown): item is PublicAssetBase {
  return isCmpPublicImageAsset(item) || isCmpPublicVideoAsset(item)
}

export function isCmpPublicVideoAsset(
  item: unknown
): item is cmp_PublicVideoAsset {
  return (
    typeof item === 'object' &&
    item !== null &&
    '__typename' in item &&
    (item as any).__typename === 'cmp_PublicVideoAsset'
  )
}

export function isCmpPublicImageAsset(
  item: unknown
): item is cmp_PublicImageAsset {
  return (
    typeof item === 'object' &&
    item !== null &&
    '__typename' in item &&
    (item as any).__typename === 'cmp_PublicImageAsset'
  )
}

export function getContentLinkAsArray(
  keys: Maybe<ContentReference>[]
): string[] {
  const flatKeys = keys
    ?.map((x) => x?.key)
    .filter((key): key is string => Boolean(key))

  return flatKeys
}

export function getEstimatedReadingTime(
  stringContent: string | null | undefined,
  averageReadingSpeed: number = 200
): string {
  if (!stringContent || stringContent.trim().length === 0) {
    return ''
  }

  const stripped = toPlainText(stringContent)
  const wordCount = countWords(stripped)
  const totalMinutes = Math.max(1, Math.ceil(wordCount / averageReadingSpeed))

  return `${totalMinutes} ${totalMinutes === 1 ? 'minute' : 'minutes'}`
}

export function countWords(input: string): number {
  return input.trim().split(/\s+/).filter(Boolean).length
}

export function truncateWithoutSplittingWords(
  stringContent: string,
  maxLength: number,
  suffix = '…'
): string {
  const cleanText = removeHtml(stringContent)

  if (cleanText.length <= maxLength) {
    return cleanText
  }

  const trimmed = cleanText.slice(0, maxLength + 1)
  const lastSpaceIndex = trimmed.lastIndexOf(' ')

  if (lastSpaceIndex === -1) {
    return cleanText.slice(0, maxLength) + suffix
  }

  return cleanText.slice(0, lastSpaceIndex) + suffix
}

export function removeHtml(stringContent: string): string {
  if (!stringContent.includes('<') && !stringContent.includes('>')) {
    return decodeText(stringContent)
  }
  const withoutTags = stringContent.replace(/<\/?[^>]+(>|$)/g, '')
  return decodeText(withoutTags)
}

export function toPlainText(stringContent: string): string {
  let text = removeHtml(stringContent)
  text = text.replace(/\s+/g, ' ')
  text = text.trim()

  return text
}

export function decodeText(value: string | null | undefined): string {
  return value ? decode(value) : ''
}

// Produces a URL-fragment-safe slug for use as an element id and matching
// `#anchor` href. Strips backslashes, spaces, and other characters that are not
// valid in a fragment, keeping the rendered id and the link href in sync.
export function slugify(text: string | null | undefined): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
