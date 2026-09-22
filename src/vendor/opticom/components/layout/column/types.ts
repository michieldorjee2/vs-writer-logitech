import { VariantProps } from 'class-variance-authority'
import { ReactNode } from 'react'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { ExtractDisplaySettingValues } from '@/lib/optimizely/types/display-settings'
import displaySettingsData from './display-settings'

type DisplaySettingsData = typeof displaySettingsData
type ColumnDisplayTemplate = DisplaySettingsData[0]
type ColumnSettings = ColumnDisplayTemplate['settings']

export type DisplaySettingValues = ExtractDisplaySettingValues<ColumnSettings>

export interface ColumnProps
  extends VariantProps<typeof import('./index').columnVariants>,
    React.HTMLAttributes<HTMLDivElement> {
  displaySettings?: DisplaySettings
  className?: string
  children: ReactNode
  preview?: boolean
}

export type ColumnVariants = VariantProps<
  typeof import('./index').columnVariants
>
