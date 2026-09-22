import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { ExtractDisplaySettingValues } from '@/lib/optimizely/types/display-settings'
import type { IconElement } from '@/lib/optimizely/types/generated'
import displaySettingsData from './display-settings'

// Extract display setting types from display-settings.ts
type DisplaySettingsData = typeof displaySettingsData
type DisplayTemplate = DisplaySettingsData[0]
type Settings = DisplayTemplate['settings']

export type DisplaySettingValues = ExtractDisplaySettingValues<Settings>

export type IconElementProps = IconElement

export interface ExtendedIconElementProps
  extends Pick<IconElementProps, 'Icon' | 'AltText'> {
  displaySettings?: DisplaySettings
}

export interface MaterialIconProps {
  name: string
  size?: string
  weight?: string
  fill?: string
  color?: string
  className?: string
  altText?: string
}
