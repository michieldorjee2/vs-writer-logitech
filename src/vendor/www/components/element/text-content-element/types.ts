import { graphql, type ResultOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

// Hybrid pattern: TextContentElement is composed both via the factory and
// directly via JSX in many stories that pass `MainBody={{ html: '...' }}`.
export const TextContentElementFragment = graphql(`
  fragment TextContentElementFragment on TextContentElement {
    __typename
    MainBody {
      html
      json
    }
  }
`)

export type TextContentElementDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

export type TextContentElementProps = ResultOf<
  typeof TextContentElementFragment
> & {
  displaySettings?: Partial<TextContentElementDisplaySettings>
}

// Backwards-compat alias for any out-of-scope import sites.
export type ExtendedTextContentElementProps = TextContentElementProps
