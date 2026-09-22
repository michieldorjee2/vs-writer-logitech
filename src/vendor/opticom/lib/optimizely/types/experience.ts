import type { BlankExperience } from '@/lib/optimizely/types/generated'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'

export interface Grid {
  key: string
  rows?: Row[]
}

export interface Row {
  key: string
  displaySettings?: DisplaySettings
  columns?: Column[]
}

export interface Column {
  key: string
  displaySettings?: DisplaySettings
  elements?: ExperienceElement[]
}

export interface ExperienceElement {
  key: string
  displaySettings?: DisplaySettings
  component?: Record<string, unknown> & { __typename?: string }
}

export interface VisualBuilderNode {
  nodeType: 'section' | 'component' | 'step'
  key: string
  displaySettings?: DisplaySettings
  component?: Record<string, unknown> & { __typename?: string }
  rows?: Row[]
  steps?: Array<Record<string, unknown>>
  section?: Record<string, unknown> & { __typename?: string }
  elements?: ExperienceElement[]
}

export type SafeVisualBuilderExperience = {
  composition?: {
    nodes?: VisualBuilderNode[]
  }
} & BlankExperience
