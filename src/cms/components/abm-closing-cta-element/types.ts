import displayTemplates from './display-settings'

export interface AbmClosingCtaElementProps {
  Title?: string
  Description?: string
  ButtonText?: string
  ScheduleUrl?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmClosingCtaElementDisplaySettings = (typeof displayTemplates)[0]['settings']
