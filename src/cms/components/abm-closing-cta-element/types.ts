import displayTemplates from './display-settings'

export interface AbmClosingCtaElementProps {
  Title?: string
  Description?: string
  ButtonText?: string
  ScheduleUrl?: string
  /** Not a CMS field: set at render time when the offer chose the email form (src/lib/offer-signup.ts). */
  SignupOfferId?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmClosingCtaElementDisplaySettings = (typeof displayTemplates)[0]['settings']
