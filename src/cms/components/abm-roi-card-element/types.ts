import displayTemplates from './display-settings'

export interface AbmRoiCardElementProps {
  /** The bare number, digits and decimal point only. */
  Metric?: string
  /** The unit shown under the metric. */
  Unit?: string
  /** What the number measures. */
  Label?: string
  /** Where the number came from. */
  CitationText?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmRoiCardElementDisplaySettings = (typeof displayTemplates)[0]['settings']
