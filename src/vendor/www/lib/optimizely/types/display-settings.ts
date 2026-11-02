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

/**
 * Transform the CMS-shape array of `{ key, value }` pairs into a keyed object.
 * Used at the CMS/registry boundary (mapper.tsx, wrapper.tsx, sections that
 * compose Row/Column from CMS data) to convert raw GraphQL output into the
 * object shape every component's prop type expects.
 */
export function displaySettingsToObject<T extends Record<string, unknown>>(
  arr: DisplaySettings | undefined | null
): Partial<T> {
  if (!arr || !Array.isArray(arr)) return {}
  const result: Record<string, string | boolean> = {}
  for (const setting of arr) {
    if (setting && setting.key) {
      result[setting.key] = setting.value
    }
  }
  return result as Partial<T>
}

/**
 * Coerce a display-setting value to a boolean. CMS serializes boolean and
 * boolean-valued-select settings as the strings `"true"` / `"false"`, so a
 * raw truthy check on `"false"` returns true. Use this at every read site
 * for a boolean display setting.
 */
export function parseBoolean(
  value: string | boolean | undefined | null
): boolean {
  return value === true || value === 'true'
}
