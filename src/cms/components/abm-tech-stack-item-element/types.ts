import displayTemplates from './display-settings'

export interface AbmTechStackItemElementProps {
  Name?: string
  ColorTag?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmTechStackItemElementDisplaySettings =
  (typeof displayTemplates)[0]['settings']
