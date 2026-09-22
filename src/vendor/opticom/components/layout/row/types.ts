import { VariantProps } from 'class-variance-authority'
import { ReactNode } from 'react'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { ExtractDisplaySettingValues } from '@/lib/optimizely/types/display-settings'
import displaySettingsData from './display-settings'

type DisplaySettingsData = typeof displaySettingsData
type RowDisplayTemplate = DisplaySettingsData[0]
type RowSettings = RowDisplayTemplate['settings']

export type DisplaySettingValues = ExtractDisplaySettingValues<RowSettings>

export interface RowProps
  extends VariantProps<typeof import('./index').rowVariants>,
    React.HTMLAttributes<HTMLDivElement> {
  displaySettings?: DisplaySettings
  className?: string
  children: ReactNode
  preview?: boolean
}

export type RowVariants = VariantProps<typeof import('./index').rowVariants>
