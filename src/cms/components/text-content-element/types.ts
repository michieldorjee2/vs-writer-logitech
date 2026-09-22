import displayTemplates from './display-settings'

export interface TextContentElementProps {
  /**
   * Body copy. A bare long string, not upstream's RichText object — read `MainBody`, never
   * `MainBody.html`. Blank lines separate paragraphs.
   */
  MainBody?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type TextContentElementDisplaySettings = (typeof displayTemplates)[0]['settings']
