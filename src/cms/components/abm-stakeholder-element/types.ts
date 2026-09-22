import displayTemplates from './display-settings'

/** The `EngagementTier` enum, kept in step with content-type.ts. */
export type AbmStakeholderEngagementTier = 'cold' | 'warm' | 'engaged' | 'champion'

export interface AbmStakeholderElementProps {
  Name?: string
  Role?: string
  Initials?: string
  AvatarColor?: string
  EngagementTier?: AbmStakeholderEngagementTier
  EngagementNote?: string
  PersonSlug?: string
  CrmContactId?: string
  LinkedInUrl?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmStakeholderElementDisplaySettings = (typeof displayTemplates)[0]['settings']
