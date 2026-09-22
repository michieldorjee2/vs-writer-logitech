import displayTemplates from './display-settings'

export interface AbmStickyCtaElementProps {
  Text?: string
  Url?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmStickyCtaElementDisplaySettings = (typeof displayTemplates)[0]['settings']
