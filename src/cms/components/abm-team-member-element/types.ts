import displayTemplates from './display-settings'

export interface AbmTeamMemberElementProps {
  Initials?: string
  Name?: string
  Role?: string
  Email?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmTeamMemberElementDisplaySettings = (typeof displayTemplates)[0]['settings']
