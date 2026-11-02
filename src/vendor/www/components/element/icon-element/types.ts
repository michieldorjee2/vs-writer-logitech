import { graphql, type ResultOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type {
  DisplaySettings,
  ExtractDisplaySettingValues,
} from '../../../lib/optimizely/types/display-settings'

export const IconElementFragment = graphql(`
  fragment IconElementFragment on IconElement {
    Icon
    AltText
  }
`)

export type IconElementDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type IconElementProps = ResultOf<typeof IconElementFragment> & {
  displaySettings?: DisplaySettings | Partial<IconElementDisplaySettings>
}

export interface MaterialIconProps {
  name: string
  size?: string
  weight?: string
  fill?: string
  grade?: string
  color?: string
  className?: string
  altText?: string
}
