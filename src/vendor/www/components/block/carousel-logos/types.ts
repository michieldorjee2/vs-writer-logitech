import { graphql, type FragmentOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

export const CarouselLogosFragment = graphql(`
  fragment CarouselLogosFragment on CarouselLogos {
    Items {
      key
    }
  }
`)

export type CarouselLogosDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type CarouselLogosProps = FragmentOf<typeof CarouselLogosFragment> & {
  displaySettings?: Partial<CarouselLogosDisplaySettings>
  preview?: boolean
  locale?: string
  children?: React.ReactNode
}
