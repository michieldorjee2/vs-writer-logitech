import displayTemplates from './display-settings'

/** The four variants upstream's renderer actually styles. */
export type CalloutType = 'info' | 'warning' | 'error' | 'default'

export interface CalloutBlockProps {
  CalloutType?: CalloutType
  /** Added here; upstream has no heading property. See DIVERGENCE.md. */
  CalloutHeading?: string
  /** Plain long text, not a `{ html }` object — see DIVERGENCE.md. */
  CalloutText?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type CalloutBlockDisplaySettings = (typeof displayTemplates)[0]['settings']
