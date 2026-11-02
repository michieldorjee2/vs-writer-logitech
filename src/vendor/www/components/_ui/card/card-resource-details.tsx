import { MaterialIcon } from '../../element/icon-element'
import { cn } from '../../../lib/utils'
import { CardResourceDetailsProps, ICON_MAP, LABEL_MAP } from './types'

export function CardResourceDetails({
  resourceType,
  date,
  duration,
  colorScheme = 'dark',
  textColor: textColorOverride,
  className,
  iconOverride,
  showResourceType = true,
}: CardResourceDetailsProps) {
  if (!resourceType) {
    return null
  }
  const icon = iconOverride
    ? ICON_MAP[iconOverride]
    : (ICON_MAP[resourceType] ?? 'article')
  const label = LABEL_MAP[resourceType] ?? resourceType
  const resolvedColor =
    textColorOverride ??
    (colorScheme === 'auto'
      ? 'var(--prose-type-color)'
      : colorScheme === 'dark'
        ? 'var(--color-tertiary-7)'
        : 'var(--color-tertiary-2)')

  return (
    <div
      className={cn('flex items-center gap-4', className)}
      style={{ color: resolvedColor }}
    >
      <div className="flex items-center gap-2">
        <MaterialIcon name={icon} size="24" fill="1" color={resolvedColor} />
        {resourceType && showResourceType && (
          <span className="font-body text-base leading-[1.4] font-(--font-weight-body-medium) whitespace-nowrap">
            {label}
          </span>
        )}
      </div>
      {date && (
        <span className="font-body text-base leading-[1.4] font-(--font-weight-body-medium) whitespace-nowrap">
          {date}
        </span>
      )}
      {duration && (
        <span className="font-body text-base leading-[1.4] font-(--font-weight-body-medium) whitespace-nowrap">
          {duration}
        </span>
      )}
    </div>
  )
}
