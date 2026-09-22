import displayTemplates from './display-settings'

export interface AbmFrictionPointElementProps {
  Title?: string
  Description?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmFrictionPointElementDisplaySettings =
  (typeof displayTemplates)[0]['settings']
