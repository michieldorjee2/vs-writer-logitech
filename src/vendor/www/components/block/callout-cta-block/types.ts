import { graphql, type FragmentOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

export const CalloutCtaBlockFragment = graphql(`
  fragment CalloutCtaBlockFragment on CalloutCtaBlock {
    Heading
    CalloutCtaDescription: Description {
      html
      json
    }
    Link {
      url {
        default
      }
      text
      title
      target
    }
  }
`)

export type CalloutCtaBlockDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type CalloutCtaBlockProps = FragmentOf<
  typeof CalloutCtaBlockFragment
> & {
  displaySettings?: Partial<CalloutCtaBlockDisplaySettings>
  preview?: boolean
}
