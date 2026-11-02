export interface CardResourceDetailsProps {
  resourceType?: string | null
  date?: string | null
  duration?: string | null
  colorScheme?: 'dark' | 'light' | 'auto'
  textColor?: string
  className?: string
  showResourceType?: boolean
  iconOverride?: string
}

export const ICON_MAP: Record<string, string> = {
  event: 'calendar_month',
  video: 'play_arrow',
  webinar: 'play_arrow',
  article: 'article',
  guide: 'menu_book',
  report: 'description',
  press: 'description',
  'customer-story': 'digital_wellbeing',
}

export const LABEL_MAP: Record<string, string> = {
  event: 'Event',
  video: 'Video',
  webinar: 'Webinar',
  article: 'Article',
  guide: 'Guide',
  report: 'Report',
  'customer-story': 'Customer story',
  press: 'Press release',
}
