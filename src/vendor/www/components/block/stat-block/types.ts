import { graphql } from '../../../lib/optimizely/graphql'
import type { AnimationMode } from '../../element/stacked-heading-element'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

export const StatBlockFragment = graphql(`
  fragment StatBlockFragment on StatBlock {
    __typename
    StatValue
    StatDescription: Description
  }
`)

export type { AnimationMode }

// Hybrid pattern: StatBlock is composed directly in templates
// (e.g. CustomerStoryPageExperience) so it uses a plain Props interface
// rather than the FragmentOf brand. Keep the named selection field
// (StatDescription) here so template callsites continue to compile.
export type StatBlockDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export interface StatBlockProps {
  __typename?: 'StatBlock'
  StatValue?: string | null
  StatDescription?: string | null
  displaySettings?: Partial<StatBlockDisplaySettings>
  preview?: boolean
}
