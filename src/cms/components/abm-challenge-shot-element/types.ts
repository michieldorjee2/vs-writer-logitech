import displayTemplates from './display-settings'

export interface AbmChallengeShotElementProps {
  Headline?: string
  ScreenshotUrl?: string
  ScreenshotAlt?: string
  /** The fake browser chrome's address label. A display string, not a link. */
  BrowserUrl?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmChallengeShotElementDisplaySettings =
  (typeof displayTemplates)[0]['settings']
