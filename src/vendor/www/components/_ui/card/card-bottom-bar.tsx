import { MaterialIcon } from '../../element/icon-element'
import { cn } from '../../../lib/utils'

interface CardBottomBarProps {
  companyName?: string | null
  companyLogoUrl?: string | null
  companyLogoAlt?: string
  colorScheme?: 'dark' | 'light'
  externalLink?: boolean
  showArrow?: boolean
  className?: string
  logoStyle?: 'framed' | 'mono'
}

export function CardBottomBar({
  companyName,
  companyLogoUrl,
  companyLogoAlt,
  colorScheme = 'dark',
  externalLink = false,
  showArrow = true,
  className,
  logoStyle = 'framed',
}: CardBottomBarProps) {
  const isDark = colorScheme === 'dark'
  const isMono = logoStyle === 'mono'
  // A mono logo on a light card (dark color scheme) is recolored to dark fir so
  // any source mark reads as a single dark-green tint with no background frame.
  const isMonoTinted = isMono && isDark
  const isEmptyLeft = !companyLogoUrl && !companyName

  return (
    <div
      className={cn(
        'flex items-center p-4',
        isEmptyLeft ? 'justify-end' : 'justify-between',
        isDark
          ? 'text-(--color-secondary-darkfir)'
          : 'text-(--color-tertiary-2)',
        className
      )}
    >
      <div className="flex items-center gap-3 pr-6">
        {companyLogoUrl &&
          (isMonoTinted ? (
            <span
              role="img"
              aria-label={companyLogoAlt || companyName || 'Company logo'}
              className="size-6 shrink-0 bg-(--color-secondary-darkfir)"
              style={{
                maskImage: `url(${companyLogoUrl})`,
                WebkitMaskImage: `url(${companyLogoUrl})`,
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskPosition: 'center',
                maskSize: 'contain',
                WebkitMaskSize: 'contain',
              }}
            />
          ) : isMono ? (
            <img
              loading="lazy"
              decoding="async"
              src={companyLogoUrl}
              alt={companyLogoAlt || companyName || 'Company logo'}
              width={24}
              height={24}
              className="size-6 shrink-0 object-contain"
            />
          ) : (
            <div className="flex shrink-0 items-center rounded-xs bg-(--color-tertiary-4) p-3">
              <img
                loading="lazy"
                decoding="async"
                src={companyLogoUrl}
                alt={companyLogoAlt || companyName || 'Company logo'}
                width={24}
                height={24}
                className="size-6 object-contain"
              />
            </div>
          ))}
        {companyName && (
          <span className="font-body text-body-s leading-[1.4]">
            {companyName}
          </span>
        )}
      </div>
      {showArrow && (
        <MaterialIcon
          name="arrow_forward"
          size="40"
          color={
            isDark
              ? 'var(--color-secondary-darkfir)'
              : 'var(--color-tertiary-2)'
          }
          className={externalLink ? '-rotate-45' : undefined}
        />
      )}
    </div>
  )
}
