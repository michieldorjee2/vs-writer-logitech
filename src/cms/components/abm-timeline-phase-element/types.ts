import displayTemplates from './display-settings'

export interface AbmTimelinePhaseElementProps {
  Title?: string
  Description?: string
  MarkerColor?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmTimelinePhaseElementDisplaySettings =
  (typeof displayTemplates)[0]['settings']
