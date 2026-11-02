import Image from '../../../_shims/next-image'
import { Badge } from '../../_ui/badge'
import { cn, isCmpPublicImageAsset } from '../../../lib/utils'
import { CompanyBlockFragment, type CompanyBlockProps } from './types'

export { CompanyBlockFragment, type CompanyBlockProps }

// Local minimal shape sufficient for reading the .Url field once the runtime
// type guard isCmpPublicImageAsset has narrowed the item.
type CmpPublicImageAssetUrl = { Url?: string | null }

type VariantConfig = {
  containerClasses: string
  cardClasses: string
  layoutClasses: string
  iconContainerSize: string
  iconSize: number
  textClasses: string
  hoverTranslate: string
  isInteractive: boolean
}

const variantConfigs: Record<string, VariantConfig> = {
  small: {
    containerClasses: 'rounded-xs p-px',
    cardClasses: 'rounded-[11px]',
    layoutClasses: 'flex flex-row items-center gap-4 py-2 pl-2 pr-6',
    iconContainerSize: 'size-10 rounded-5xs p-1',
    iconSize: 24,
    textClasses: 'font-body text-body-xs font-normal leading-[1.3]',
    hoverTranslate: 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
    isInteractive: true,
  },
  medium: {
    containerClasses: '',
    cardClasses: '',
    layoutClasses: 'flex flex-row items-center gap-3 pr-6',
    iconContainerSize: 'size-12 rounded-5xs p-1',
    iconSize: 24,
    textClasses: 'font-body text-body-s font-normal leading-[1.25]',
    hoverTranslate: '',
    isInteractive: false,
  },
  large: {
    containerClasses: 'rounded-xs p-px',
    cardClasses: 'rounded-[11px]',
    layoutClasses: 'flex flex-row items-center gap-5 py-1 pl-1 pr-10',
    iconContainerSize: 'size-16 rounded-xxs',
    iconSize: 32,
    textClasses: 'font-body text-body-xs font-normal leading-[1.3]',
    hoverTranslate: 'group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
    isInteractive: true,
  },
  xlarge: {
    containerClasses: 'rounded-xs p-px',
    cardClasses: 'rounded-[11px]',
    layoutClasses: 'flex flex-row items-center gap-8 py-2 pl-2 pr-16',
    iconContainerSize: 'size-24 rounded-xxs p-1',
    iconSize: 48,
    textClasses: 'font-body text-body-base font-normal leading-[1.25]',
    hoverTranslate: 'group-hover:translate-x-1 group-hover:-translate-y-1',
    isInteractive: true,
  },
}

// Editable inline placeholder shown when a company has no uploaded logo asset.
// Renders the company initial on a brand-tinted tile, sized to the variant icon.
function LogoFallback({
  initial,
  size,
  label,
}: {
  initial: string
  size: number
  label: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="12" fill="#e4f0da" />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="32"
        fontWeight="600"
        fill="#08251a"
      >
        {initial}
      </text>
    </svg>
  )
}

export default function CompanyBlock({
  CompanyName,
  LogoMark,
  LogoMarkLight,
  FullColorLogoContentLink,
  WebsiteUrl,
  displaySettings,
}: CompanyBlockProps) {
  const {
    variant = 'large',
    colorScheme = 'neutral',
    background = 'none',
    sponsorTier = 'none',
  } = displaySettings ?? {}

  const config = variantConfigs[variant] || variantConfigs.large

  const isDarkScheme = colorScheme === 'dark'
  const isWhiteScheme = colorScheme === 'white'

  const logoUrl = (() => {
    if (
      isDarkScheme &&
      LogoMarkLight &&
      isCmpPublicImageAsset(LogoMarkLight?.item)
    ) {
      return (LogoMarkLight?.item as CmpPublicImageAssetUrl).Url ?? null
    }

    if (LogoMark && isCmpPublicImageAsset(LogoMark?.item)) {
      return (LogoMark?.item as CmpPublicImageAssetUrl).Url ?? null
    } else if (
      FullColorLogoContentLink &&
      isCmpPublicImageAsset(FullColorLogoContentLink?.item)
    ) {
      return (
        (FullColorLogoContentLink?.item as CmpPublicImageAssetUrl).Url ?? null
      )
    }

    return null
  })()

  const fallbackInitial = (CompanyName?.trim()?.[0] ?? 'O').toUpperCase()

  const getContainerBg = () => {
    if (variant === 'medium') {
      return ''
    }

    if (isDarkScheme) {
      return 'bg-(--color-tertiary-midfir)'
    }

    if (isWhiteScheme) {
      return 'bg-(--color-tertiary-4)'
    }

    return 'bg-(--color-tertiary-4)'
  }

  const getCardStyles = () => {
    if (variant === 'medium') {
      const bgMap: Record<string, string> = {
        none: '',
        neutral: 'bg-(--color-tertiary-2)',
        opal: 'bg-(--color-primary-3)',
        green: 'bg-(--color-primary-lfgreen)',
        pink: 'bg-(--color-tertiary-ltpink)',
        blue: 'bg-(--color-secondary-ltblue)',
      }

      const bgClass = bgMap[background] || ''
      if (background !== 'none') {
        return cn(bgClass, 'rounded-xs px-3 py-2')
      }
      return bgClass
    }

    if (isDarkScheme) {
      return 'bg-(--color-tertiary-midfir)'
    }

    if (isWhiteScheme) {
      return 'bg-(--color-primary-1)'
    }
    return 'bg-(--color-tertiary-2)'
  }

  const getIconContainerStyles = () => {
    if (variant === 'medium') {
      return ''
    }

    if (variant === 'small' && isDarkScheme) {
      return 'bg-(--color-tertiary-midfir)'
    }

    return 'bg-(--color-primary-3)'
  }

  const getTextStyles = () => {
    if (isDarkScheme && variant !== 'medium') {
      return 'text-(--color-primary-1)'
    }
    return 'text-(--color-secondary-darkfir)'
  }

  const showSponsorTier = sponsorTier !== 'none' && variant === 'xlarge'
  const sponsorTierLabel =
    sponsorTier && sponsorTier !== 'none'
      ? sponsorTier.charAt(0).toUpperCase() + sponsorTier.slice(1)
      : ''

  const content = (
    <div
      className={cn(
        config.cardClasses,
        getCardStyles(),
        config.isInteractive &&
          'transition-all duration-200 ease-out group-active:translate-x-0 group-active:translate-y-0',
        config.isInteractive && config.hoverTranslate
      )}
    >
      <div className={config.layoutClasses}>
        <div
          className={cn(
            config.iconContainerSize,
            getIconContainerStyles(),
            'flex shrink-0 items-center justify-center'
          )}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={CompanyName || 'Company logo'}
              width={config.iconSize}
              height={config.iconSize}
              className="object-contain"
            />
          ) : (
            <LogoFallback
              initial={fallbackInitial}
              size={config.iconSize}
              label={CompanyName || 'Company logo'}
            />
          )}
        </div>
        {CompanyName && (
          <div className="flex flex-col gap-1">
            <span className={cn(config.textClasses, getTextStyles())}>
              {CompanyName}
            </span>
            {showSponsorTier && (
              <Badge
                label={sponsorTierLabel}
                color={isDarkScheme ? 'neutral' : 'darkgreen'}
                filled={false}
                size="sm"
                className="self-start"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )

  const websiteHref = WebsiteUrl?.default

  if (config.isInteractive && websiteHref) {
    return (
      <a
        href={websiteHref}
        className={cn(
          'group inline-block',
          config.containerClasses,
          getContainerBg()
        )}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    )
  }

  if (config.isInteractive) {
    return (
      <div
        className={cn(
          'group inline-block',
          config.containerClasses,
          getContainerBg()
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <div className={cn('inline-block', config.containerClasses)}>{content}</div>
  )
}
