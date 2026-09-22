import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const isCustomFontSize = (value: string) =>
  /^body-|^headline-|^overline-/.test(value)

const isCustomColor = (value: string) =>
  /^(primary|secondary|tertiary|neutral|lfgreen|dust|fir|label|accent|card|destructive|muted|popover)-/.test(
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
  params: URLSearchParams | { toString(): string }
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

export function getDisplayValue<
  T extends string | boolean | undefined = string | undefined,
>(
  displaySettings: { key: string; value: string | boolean }[] | undefined,
  key: string
): T | undefined {
  return displaySettings?.find((setting) => setting.key === key)?.value as
    | T
    | undefined
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

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
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

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
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

export function getCookieOrNull(name: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const cookies = document.cookie.split('; ')
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`))

  return found ? decodeURIComponent(found.split('=').slice(1).join('=')) : null
}
