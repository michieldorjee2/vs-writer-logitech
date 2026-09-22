import { MaterialIcon } from '@/components/element/icon-element'
import { cn } from '@/lib/utils'

interface CardBottomBarProps {
  companyName?: string | null
  companyLogoUrl?: string | null
  companyLogoAlt?: string
  colorScheme?: 'dark' | 'light'
  externalLink?: boolean
  className?: string
}

export function CardBottomBar({
  companyName,
  companyLogoUrl,
  companyLogoAlt,
  colorScheme = 'dark',
  externalLink = false,
  className,
}: CardBottomBarProps) {
  const isDark = colorScheme === 'dark'

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4',
        isDark
          ? 'text-(--color-secondary-darkfir)'
          : 'text-(--color-tertiary-2)',
        className
      )}
    >
      <div className="flex items-center gap-3 pr-6">
        {companyLogoUrl && (
          <div className="flex shrink-0 items-center rounded-[12px] bg-(--color-tertiary-4) p-3">
            <img
              src={companyLogoUrl}
              alt={companyLogoAlt || companyName || 'Company logo'}
              className="h-6 w-auto object-contain"
            />
          </div>
        )}
        {companyName && (
          <span className="font-body text-body-s leading-[1.4]">
            {companyName}
          </span>
        )}
      </div>
      <MaterialIcon
        name="arrow_forward"
        size="40"
        color={
          isDark ? 'var(--color-secondary-darkfir)' : 'var(--color-tertiary-2)'
        }
        className={externalLink ? '-rotate-45' : undefined}
      />
    </div>
  )
}
