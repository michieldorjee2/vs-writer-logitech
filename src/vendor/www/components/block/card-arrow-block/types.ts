import { graphql, type FragmentOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

export const CardArrowBlockFragment = graphql(`
  fragment CardArrowBlockFragment on CardArrowBlock {
    Headline
    CardArrowDescription: Description
    ResourceUrl {
      url {
        default
      }
      text
      title
      target
    }
  }
`)

export type CardArrowColorScheme =
  | 'darkGreen'
  | 'neutral'
  | 'white'
  | 'pink'
  | 'blue'
  | 'green'

export type CardArrowBlockDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type CardArrowBlockProps = FragmentOf<typeof CardArrowBlockFragment> & {
  displaySettings?: Partial<CardArrowBlockDisplaySettings>
  preview?: boolean
}
