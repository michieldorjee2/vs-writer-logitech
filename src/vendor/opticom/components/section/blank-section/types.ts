import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { ExtractDisplaySettingValues } from '@/lib/optimizely/types/display-settings'
import displaySettingsData from './display-settings'

export interface BlankSectionProps {
  displaySettings?: DisplaySettings
}

type DisplaySettingsData = typeof displaySettingsData
type DisplayTemplate = DisplaySettingsData[0]
type Settings = DisplayTemplate['settings']

export type DisplaySettingValues = ExtractDisplaySettingValues<Settings>
