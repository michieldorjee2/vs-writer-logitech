import displayTemplates from './display-settings'

/**
 * Upstream names this type `HeadingLevel` and widens it to h1–h6 | span. The CMS property is a
 * `selectOne` with four values, so the union is narrower here; the name is kept so vendored
 * upstream code resolves against it.
 */
export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'

/** Mirrors the `animationMode` options in display-settings.ts. */
export type AnimationMode = 'none' | 'scroll' | 'mouse'

export interface StackedHeadingElementProps {
  /**
   * Heading copy. A bare long string, not upstream's RichText object — so this is
   * `Text: string`, never `Text.html`. Newlines separate heading lines; `##phrase##` marks the
   * phrase to extrude.
   */
  Text?: string
  HeadingLevel?: HeadingLevel
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type StackedHeadingElementDisplaySettings = (typeof displayTemplates)[0]['settings']
