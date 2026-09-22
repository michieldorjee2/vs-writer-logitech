import displayTemplates from './display-settings'

/** The `selectOne` enum shared by both verdict properties. */
export type AbmComparisonVerdict = 'Yes' | 'No' | 'Limited'

export interface AbmComparisonRowElementProps {
  Category?: string
  OurValue?: AbmComparisonVerdict
  OurDetail?: string
  CompetitorValue?: AbmComparisonVerdict
  CompetitorDetail?: string
  displaySettings?: Record<string, string>
  preview?: boolean
}

export type AbmComparisonRowElementDisplaySettings =
  (typeof displayTemplates)[0]['settings']
