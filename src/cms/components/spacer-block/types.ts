import displayTemplates from './display-settings'

export interface SpacerBlockProps {
  /** Height in pixels at the smallest breakpoint. */
  SpaceDefault?: number
  /** Height in pixels from md up; inherits SpaceDefault when absent. */
  SpaceMd?: number
  /** Height in pixels from lg up; inherits SpaceMd when absent. */
  SpaceLg?: number
  /** Height in pixels from xl up; inherits SpaceLg when absent. */
  SpaceXl?: number
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type SpacerBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
