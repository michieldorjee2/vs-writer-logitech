import displayTemplates from './display-settings'

/**
 * Props for the Phase 1 renderer, following the upstream component convention: the CMS
 * property names verbatim, plus `displaySettings` and `preview`.
 *
 * `Url` is a CMS `url` property, typed as `string` per COMPONENT-SPEC.md's worked example.
 * Phase 1 should confirm the Graph read shape of a `url` property before dereferencing it —
 * upstream's link-shaped properties arrive as `{ url: { default } }`.
 */
export interface AbmAnalystCardElementProps {
  Badge?: string
  Source?: string
  Category?: string
  Url?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmAnalystCardElementDisplaySettings = (typeof displayTemplates)[0]['settings']
