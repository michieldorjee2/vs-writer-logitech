import displayTemplates from './display-settings'

/**
 * Props for the Phase 1 renderer. The names match upstream's
 * `ExtendedCardCustomerQuoteBlockProps` so the vendored React component drops in unchanged.
 *
 * `CompanyLogoUrl` and `ResourceUrl` are CMS `url` properties. Upstream reads `ResourceUrl` as
 * a link object (`ResourceUrl?.url?.default`) and `CompanyLogoUrl` as a bare string; both are
 * typed as `string` here, which is the convention in COMPONENT-SPEC.md's worked example.
 * Phase 1 must confirm the real Graph shape of a `url` property against a live query and widen
 * these two — the contract doc measured the write side only. See DIVERGENCE.md.
 */
export interface CardCustomerQuoteBlockProps {
  QuoteText?: string
  Attribution?: string
  ResourceType?: string
  Duration?: string
  CompanyName?: string
  CompanyLogoUrl?: string
  ResourceUrl?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type CardCustomerQuoteBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
