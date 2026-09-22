import displayTemplates from './display-settings'

export interface AbmNavRailElementProps {
  /** Up to three short context lines, in order. */
  RailLines?: string[]
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmNavRailElementDisplaySettings = (typeof displayTemplates)[0]['settings']
