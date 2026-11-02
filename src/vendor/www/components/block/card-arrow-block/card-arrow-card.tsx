import { cva } from 'class-variance-authority'
import { cn, decodeText } from '../../../lib/utils'
import { MaterialIcon } from '../../element/icon-element'
import type { CardArrowColorScheme } from './types'

const shadowVariants = cva('relative rounded-[18px] p-px @md:rounded-[26px]', {
  variants: {
    colorScheme: {
      darkGreen: 'bg-(--color-tertiary-lightfir)',
      neutral: 'bg-(--color-tertiary-5)',
      white: 'bg-(--color-tertiary-4)',
      pink: 'bg-pink-300',
      blue: 'bg-blue-darkblue',
      green: 'bg-good-2-go-100',
    },
  },
  defaultVariants: { colorScheme: 'darkGreen' },
})

const faceVariants = cva(
  'relative overflow-clip rounded-[17px] transition-all duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-active:translate-x-0 group-active:translate-y-0 group-active:bg-transparent @md:rounded-[25px]',
  {
    variants: {
      colorScheme: {
        darkGreen: 'bg-(--color-tertiary-midfir)',
        neutral: 'bg-(--color-tertiary-4)',
        white: 'bg-white',
        pink: 'bg-(--color-tertiary-ltpink)',
        blue: 'bg-(--color-secondary-ltblue)',
        green: 'bg-(--color-primary-lfgreen)',
      },
    },
    defaultVariants: { colorScheme: 'darkGreen' },
  }
)

const textVariants = cva('', {
  variants: {
    colorScheme: {
      darkGreen: 'text-white',
      neutral: 'text-(--color-secondary-darkfir)',
      white: 'text-(--color-secondary-darkfir)',
      pink: 'text-(--color-secondary-darkfir)',
      blue: 'text-(--color-secondary-darkfir)',
      green: 'text-(--color-secondary-darkfir)',
    },
  },
  defaultVariants: { colorScheme: 'darkGreen' },
})

const headlineWeightVariants = cva(
  'font-headline text-headline-xxs md:text-headline-s leading-[1.04]',
  {
    variants: {
      colorScheme: {
        darkGreen: 'font-bold',
        neutral: 'font-(--font-weight-headline-extrabold)',
        white: 'font-(--font-weight-headline-extrabold)',
        pink: 'font-(--font-weight-headline-extrabold)',
        blue: 'font-(--font-weight-headline-extrabold)',
        green: 'font-(--font-weight-headline-extrabold)',
      },
    },
    defaultVariants: { colorScheme: 'darkGreen' },
  }
)

const bodyWeightVariants = cva('font-body text-body-xs leading-[1.3]', {
  variants: {
    colorScheme: {
      darkGreen: 'font-(--font-weight-body-normal)',
      neutral: 'font-(--font-weight-body-medium)',
      white: 'font-(--font-weight-body-medium)',
      pink: 'font-(--font-weight-body-medium)',
      blue: 'font-(--font-weight-body-medium)',
      green: 'font-(--font-weight-body-medium)',
    },
  },
  defaultVariants: { colorScheme: 'darkGreen' },
})

const arrowVariants = cva(
  'rounded-xxs flex shrink-0 items-center justify-center p-1',
  {
    variants: {
      colorScheme: {
        darkGreen: 'bg-(--color-primary-lfgreen)',
        neutral: 'bg-(--color-primary-lfgreen)',
        white: 'bg-(--color-primary-lfgreen)',
        pink: 'bg-(--color-tertiary-midfir)',
        blue: 'bg-(--color-secondary-darkfir)',
        green: 'bg-(--color-secondary-darkfir)',
      },
    },
    defaultVariants: { colorScheme: 'darkGreen' },
  }
)

const ARROW_COLORS: Record<CardArrowColorScheme, string> = {
  darkGreen: 'var(--color-secondary-darkfir)',
  neutral: 'var(--color-secondary-darkfir)',
  white: 'var(--color-secondary-darkfir)',
  pink: 'var(--color-neutral-1)',
  blue: 'var(--color-neutral-1)',
  green: 'var(--color-neutral-1)',
}

export interface CardArrowCardProps {
  headline?: string | null
  description?: string | null
  href?: string | null
  colorScheme?: CardArrowColorScheme
  fullHeight?: boolean
}

export function CardArrowCard({
  headline,
  description,
  href,
  colorScheme = 'darkGreen',
  fullHeight = true,
}: CardArrowCardProps) {
  if (!headline) return null

  const card = (
    <div className={cn('@container', fullHeight && 'h-full')}>
      <div
        className={cn(shadowVariants({ colorScheme }), fullHeight && 'h-full')}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[18px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-active:opacity-100 motion-reduce:hidden @md:rounded-[26px]">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="size-full object-cover"
            src="/assets/Slow_2.5m.mp4"
          />
        </div>
        <div
          className={cn(faceVariants({ colorScheme }), fullHeight && 'h-full')}
        >
          <div
            className={cn(
              'flex items-end gap-6 p-5 @md:gap-8 @md:p-8',
              textVariants({ colorScheme }),
              fullHeight && 'h-full'
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-4 @md:gap-6">
              <h3 className={headlineWeightVariants({ colorScheme })}>
                {decodeText(headline)}
              </h3>
              {description && (
                <p className={bodyWeightVariants({ colorScheme })}>
                  {decodeText(description)}
                </p>
              )}
            </div>
            <div className={arrowVariants({ colorScheme })}>
              <MaterialIcon
                name="chevron_right"
                size="32"
                color={ARROW_COLORS[colorScheme]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a
        className={cn(
          'group block focus-visible:outline-2 focus-visible:outline-(--color-secondary-ltblue)',
          fullHeight && 'h-full'
        )}
        href={href}
      >
        {card}
      </a>
    )
  }

  return card
}
