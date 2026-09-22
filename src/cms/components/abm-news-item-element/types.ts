import displayTemplates from './display-settings'

/**
 * Props for the Phase 1 renderer.
 *
 * `NewsDate` is a display string ("Mar 2026"), not an instant — print it as given, do not parse
 * or reformat it.
 */
export interface AbmNewsItemElementProps {
  /** Display string, e.g. "Mar 2026". Print verbatim. */
  NewsDate?: string
  Headline?: string
  /** Absolute URL. */
  Url?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmNewsItemElementDisplaySettings = (typeof displayTemplates)[0]['settings']
