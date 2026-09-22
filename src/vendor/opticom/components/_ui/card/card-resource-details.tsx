import { MaterialIcon } from '@/components/element/icon-element'
import { cn } from '@/lib/utils'

interface CardResourceDetailsProps {
  resourceType?: string | null
  date?: string | null
  duration?: string | null
  colorScheme?: 'dark' | 'light'
  textColor?: string
  className?: string
}

const ICON_MAP: Record<string, string> = {
  event: 'calendar_month',
  video: 'play_arrow',
  webinar: 'play_arrow',
  article: 'article',
  guide: 'menu_book',
  report: 'description',
  'customer-story': 'digital_wellbeing',
}

const LABEL_MAP: Record<string, string> = {
  event: 'Event',
  video: 'Video',
  webinar: 'Webinar',
  article: 'Article',
  guide: 'Guide',
  report: 'Report',
  'customer-story': 'Customer story',
}

export function CardResourceDetails({
  resourceType,
  date,
  duration,
  colorScheme = 'dark',
  textColor: textColorOverride,
  className,
}: CardResourceDetailsProps) {
  if (!resourceType) return null

  const icon = ICON_MAP[resourceType] ?? 'article'
  const label = LABEL_MAP[resourceType] ?? resourceType
  const isDark = colorScheme === 'dark'
  const resolvedColor =
    textColorOverride ??
    (isDark ? 'var(--color-tertiary-7)' : 'var(--color-tertiary-2)')

  return (
    <div
      className={cn('flex items-center gap-4', className)}
      style={{ color: resolvedColor }}
    >
      <div className="flex items-center gap-2">
        <MaterialIcon name={icon} size="24" fill="1" color={resolvedColor} />
        <span className="font-body text-[16px] leading-[1.4] font-(--font-weight-body-medium) whitespace-nowrap">
          {label}
        </span>
      </div>
      {date && (
        <span className="font-body text-[16px] leading-[1.4] font-(--font-weight-body-medium) whitespace-nowrap">
          {date}
        </span>
      )}
      {duration && (
        <span className="font-body text-[16px] leading-[1.4] font-(--font-weight-body-medium) whitespace-nowrap">
          {duration}
        </span>
      )}
    </div>
  )
}
