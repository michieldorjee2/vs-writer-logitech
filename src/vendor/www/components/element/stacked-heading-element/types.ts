import { graphql, type ResultOf } from '../../../lib/optimizely/graphql'
import displaySettingsData from './display-settings'
import type { ExtractDisplaySettingValues } from '../../../lib/optimizely/types/display-settings'

// Hybrid pattern: StackedHeadingElement is composed both via the factory and
// directly via JSX in templates, blocks, and many stories that pass plain
// fields like `Text`, `HeadingLevel`, `DisplayAs`, `displaySettings`.
export const StackedHeadingElementFragment = graphql(`
  fragment StackedHeadingElementFragment on StackedHeadingElement {
    __typename
    Text {
      html
      json
    }
    HeadingLevel
    DisplayAs
    Anchor
  }
`)

export type StackedHeadingElementDisplaySettings = ExtractDisplaySettingValues<
  (typeof displaySettingsData)[0]['settings']
>

type DisplaySettingsData = typeof displaySettingsData
type DisplayTemplate = DisplaySettingsData[0]
type Settings = DisplayTemplate['settings']

type AnimationModeSetting = Extract<Settings[number], { key: 'animationMode' }>
type AnimationModeOptions = AnimationModeSetting['options']
export type AnimationMode = AnimationModeOptions[number]['value']

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span'
export type TextAlignment = 'left' | 'center' | 'right'

export type DisplayLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

// Hybrid prop type: derived from the fragment's selected fields, but wrapped
// in Partial<> because templates / blocks / stories construct
// StackedHeadingElement props directly without providing the GraphQL
// discriminator (`__typename`).
export type StackedHeadingElementProps = Partial<
  ResultOf<typeof StackedHeadingElementFragment>
> & {
  displaySettings?: Partial<StackedHeadingElementDisplaySettings>
}

export type FontFamily = 'nudge' | 'henrietta'

export interface StackedHeadingProps {
  text: string
  as?: HeadingLevel
  displayAs?: DisplayLevel
  className?: string
  // 'inherit' is canonical (tracks the container color via --prose-type-color);
  // 'default' is kept as a legacy alias for content saved before the rename.
  colorScheme?: 'inherit' | 'default' | 'dark' | 'white' | 'lfgreen'
  animationMode?: AnimationMode
  alignment?: TextAlignment
  curved?: boolean
  arcAmount?: number
  extrusionCount?: number
  fontFamily?: FontFamily
  fontSizeOverrides?: string
  leadingOverrides?: string
  id?: string
}

export interface StackedTextProps {
  text: string
  animationMode?: AnimationMode
  extrusionCount?: number
}

export interface TextPart {
  type: 'text' | 'stacked'
  content: string
}
