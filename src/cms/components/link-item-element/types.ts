import displayTemplates from './display-settings'

export interface LinkItemElementProps {
  Label?: string
  Url?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type LinkItemElementDisplaySettings = (typeof displayTemplates)[0]['settings']
