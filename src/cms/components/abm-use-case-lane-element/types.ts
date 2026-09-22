import displayTemplates from './display-settings'

export interface AbmUseCaseLaneElementProps {
  Lane?: string
  Need?: string
  Solution?: string
  Outcome?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmUseCaseLaneElementDisplaySettings =
  (typeof displayTemplates)[0]['settings']
