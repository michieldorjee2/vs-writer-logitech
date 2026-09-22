import displayTemplates from './display-settings'

/**
 * Props for the Phase 1 renderer. Names are upstream's.
 *
 * Two values differ in shape from upstream: `ResourceUrl` IS the href (upstream reads
 * `ResourceUrl?.url?.default` off a link object), and `PublishDate` arrives as an ISO-8601
 * instant rather than a pre-formatted string like "19th Jan 2026", so the renderer formats it
 * instead of printing it raw.
 */
export interface CardPressBlockProps {
  Headline?: string
  Body?: string
  /** ISO-8601 instant. Format at render time. */
  PublishDate?: string
  CompanyName?: string
  /** Absolute URL. */
  CompanyLogoUrl?: string
  /** Absolute URL — the card's href, flat rather than upstream's link object. */
  ResourceUrl?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type CardPressBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
