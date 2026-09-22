import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
export function parseDisplaySettings<TValues extends Record<string, unknown>>(
  settings?: DisplaySettings
): Partial<TValues> {
  if (!settings || !Array.isArray(settings)) {
    return {} as Partial<TValues>
  }

  const result = settings.reduce(
    (acc, setting) => {
      if (setting && setting.key) {
        acc[setting.key] = setting.value
      }
      return acc
    },
    {} as Record<string, string | boolean>
  )

  return result as Partial<TValues>
}
