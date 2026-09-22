import displayTemplates from './display-settings'

/**
 * Props for the Phase 1 renderer. Names are upstream's; every value arrives as a plain
 * string because all nine properties are scalars on an `elementEnabled` type.
 *
 * `ResourceUrl` is the one place upstream's renderer must change: it reads
 * `ResourceUrl?.url?.default` off a link object, and here the property IS the href.
 */
export interface CardCustomerBlockProps {
  Headline?: string
  Body?: string
  /** Absolute URL. */
  ImageUrl?: string
  ImageAlt?: string
  ResourceType?: string
  Duration?: string
  CompanyName?: string
  /** Absolute URL. */
  CompanyLogoUrl?: string
  /** Absolute URL — the card's href, flat rather than upstream's link object. */
  ResourceUrl?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type CardCustomerBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
