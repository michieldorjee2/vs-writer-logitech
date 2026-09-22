import displayTemplates from './display-settings'

export interface AbmThesisElementProps {
  Headline?: string
  /** Plain text; blank lines separate paragraphs. */
  Body?: string
  /** Plain text, no surrounding quotation marks. Empty means "render no quote". */
  Quote?: string
  Attribution?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmThesisElementDisplaySettings = (typeof displayTemplates)[0]['settings']
