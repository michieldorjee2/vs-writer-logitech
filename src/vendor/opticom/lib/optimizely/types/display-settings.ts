/**
 * Base display setting structure from Optimizely CMS
 */
export interface DisplaySetting {
  key: string
  value: string | boolean
  type?: 'boolean' | 'select'
}

/**
 * Array of display settings
 */
export type DisplaySettings = DisplaySetting[]

/**
 * Utility type to extract option values from display settings
 *
 * Supports both select types (with options) and boolean types
 *
 * @example
 * ```typescript
 * import displaySettingsData from './display-settings'
 *
 * type Settings = typeof displaySettingsData[0]['settings']
 * type Values = ExtractDisplaySettingValues<Settings>
 * // Result: {
 * //   layout: "default" | "wide",
 * //   spacing: "compact" | "loose",
 * //   enabled: boolean
 * // }
 * ```
 */
export type ExtractDisplaySettingValues<
  T extends readonly {
    key: string
    type?: string
    options?: readonly { value: string }[]
  }[],
> = {
  [K in T[number] as K['key']]: K extends { type: 'boolean' }
    ? boolean
    : K['options'] extends readonly { value: infer V }[]
      ? V
      : string | undefined
}
