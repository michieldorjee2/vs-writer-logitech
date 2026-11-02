import { cva } from 'class-variance-authority'
import { cn, decodeText } from '../../../lib/utils'
import type { CardColor } from './types'

export const portraitTextQuoteCardVariants = cva(
  'relative flex flex-col overflow-hidden rounded-xl border border-solid lg:rounded-3xl',
  {
    variants: {
      cardColor: {
        lfgreen: 'bg-(--color-green-lfgreen) border-(--color-green-grass)',
        grass: 'bg-(--color-green-grass) border-(--color-green-goodtogo)',
        goodtogo: 'bg-(--color-green-goodtogo) border-(--color-green-goodtogo)',
        primary_3: 'bg-(--color-primary-3) border-(--color-tertiary-4)',
        tertiary_4: 'bg-(--color-tertiary-4) border-(--color-tertiary-5)',
        ltblue: 'bg-(--color-blue-ltblue) border-(--color-blue-darkblue)/30',
        ltpink: 'bg-(--color-pink-ltpink) border-(--color-pink-darkpink)/40',
      } satisfies Record<CardColor, string>,
    },
    defaultVariants: {
      cardColor: 'ltblue',
    },
  }
)

export interface PortraitTextQuoteCardProps {
  Badge?: string | null
  Quote?: string | null
  AuthorName?: string | null
  AuthorTitle?: string | null
  cardColor?: CardColor
  companyLogoUrl?: string | null
  companyName?: string | null
}

export function PortraitTextQuoteCard({
  Badge,
  Quote,
  AuthorName,
  AuthorTitle,
  cardColor = 'ltblue',
  companyLogoUrl,
  companyName,
}: PortraitTextQuoteCardProps) {
  if (!Quote && !Badge && !AuthorName) return null

  return (
    <article
      className={cn(
        portraitTextQuoteCardVariants({ cardColor }),
        'aspect-279/325 w-full max-w-[564px] select-none lg:aspect-564/658'
      )}
    >
      {Badge && (
        <div className="px-[15px] pt-[15px] lg:px-8 lg:pt-8">
          <span className="text-body-4xs rounded-xxs lg:text-overline-base inline-flex h-7 items-center border border-solid border-(--color-secondary-darkfir) px-2 font-mono leading-none tracking-[0.3px] text-(--color-secondary-darkfir) uppercase lg:h-9 lg:px-4 lg:tracking-[0.48px]">
            {decodeText(Badge)}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col justify-center gap-3 px-[15px] lg:gap-6 lg:px-8">
        {Quote && (
          <blockquote className="font-headline text-headline-3xs lg:text-headline-l max-w-[452px] leading-[1.04] font-(--font-weight-headline-extrabold) text-(--color-secondary-darkfir)">
            {decodeText(Quote)}
          </blockquote>
        )}

        {(AuthorName || AuthorTitle) && (
          <div className="font-body text-body-xxs/tight lg:text-body-s flex flex-col text-(--color-secondary-darkfir)">
            {AuthorName && <span>{decodeText(AuthorName)}</span>}
            {AuthorTitle && <span>{decodeText(AuthorTitle)}</span>}
          </div>
        )}
      </div>

      {companyLogoUrl && (
        <div className="px-[15px] pb-[15px] lg:px-8 lg:pb-[33px]">
          <img
            loading="lazy"
            decoding="async"
            src={companyLogoUrl}
            alt={companyName ?? ''}
            className={cn(
              'h-8 w-auto object-contain object-left lg:h-10',
              cardColor === 'tertiary_4' && 'invert'
            )}
          />
        </div>
      )}
    </article>
  )
}
