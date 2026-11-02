// Single source of truth for the curated event timezone list. The same entries
// are mirrored into the CMS `Timezone` selectOne enums (AgendaSection,
// EventExperience) as { value: <IANA>, displayName: <label> }.
//
// `value` is an IANA zone id so DST is handled correctly (EST vs EDT) and online
// times can be converted exactly. `std`/`dst` force clean 3-letter abbreviations
// even where `Intl ... timeZoneName: 'short'` would emit e.g. "GMT+2".

export interface EventTimezone {
  value: string
  label: string
  std: string
  dst: string
}

export const EVENT_TIMEZONES: readonly EventTimezone[] = [
  { value: 'America/New_York', label: 'ET (Eastern)', std: 'EST', dst: 'EDT' },
  { value: 'America/Chicago', label: 'CT (Central)', std: 'CST', dst: 'CDT' },
  { value: 'America/Denver', label: 'MT (Mountain)', std: 'MST', dst: 'MDT' },
  {
    value: 'America/Los_Angeles',
    label: 'PT (Pacific)',
    std: 'PST',
    dst: 'PDT',
  },
  { value: 'Europe/London', label: 'UK', std: 'GMT', dst: 'BST' },
  { value: 'Europe/Paris', label: 'CET (Europe)', std: 'CET', dst: 'CEST' },
  { value: 'Asia/Singapore', label: 'SGT', std: 'SGT', dst: 'SGT' },
  { value: 'Australia/Sydney', label: 'AET', std: 'AEST', dst: 'AEDT' },
  { value: 'UTC', label: 'UTC', std: 'UTC', dst: 'UTC' },
] as const

const BY_VALUE = new Map(EVENT_TIMEZONES.map((tz) => [tz.value, tz]))

export function getEventTimezone(value?: string | null): EventTimezone | null {
  if (!value) {
    return null
  }
  return BY_VALUE.get(value) ?? null
}
