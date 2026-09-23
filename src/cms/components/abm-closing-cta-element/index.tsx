/**
 * AbmClosingCtaElement — the contact-close at the foot of an account page.
 *
 * A full band: headline, a short pitch, and the button that opens the scheduling link. It
 * has no upstream counterpart, so nothing here is invented — the treatment is optimizely.com's
 * own closing-CTA idiom, lifted from `components/block/card-resource-inline-block`'s card
 * (`flex flex-col items-center gap-8`, then
 * `font-headline text-headline-l max-w-[608px] text-center leading-[1.04]
 * font-(--font-weight-headline-extrabold)`, then a `Button`), and the settings are read the
 * way upstream reads them.
 *
 * NO BACKGROUND OF ITS OWN, deliberately. `colorScheme` here is `blockquote-block`'s
 * setting, copied key for key, and it means exactly what it means there: `dark` is dark text
 * for a light band, `neutral` is light text for a dark one. The band's background belongs to
 * the section — `contact-close` sets `dark_forest` — and `BlankSection` has already painted
 * it by the time this renders. Painting a second one here would fight it. So the two
 * schemes only pick text colours, as `blockquote-block` does, through the same
 * `text-(--color-…)` token form upstream uses.
 *
 * It is a band and not a card, so it takes the column's full width and centres a measured
 * text column inside itself. That internal max-width is what keeps it aligned with whatever
 * elements land above and below it in the same column, without knowing they are there.
 */
import { Button } from '@/components/_ui/button'
import { StrokeButtonWrapper } from '@/components/_ui/button/stroke-wrapper'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'

import type { AbmClosingCtaElementProps } from './types'

type ButtonVariant =
  | 'primary'
  | 'dark'
  | 'white'
  | 'neutral'
  | 'whiteStroke'
  | 'opalStroke'
  | 'darkStroke'

type DisplaySettingValues = {
  colorScheme: 'dark' | 'neutral'
  buttonVariant: ButtonVariant
  buttonSize: 'sm' | 'default'
}

/** See the note in `button-block/index.tsx`: Graph delivers `displaySettings` as an array. */
type Props = Omit<AbmClosingCtaElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

/** Upstream's table, verbatim — the same three variants carry a stroke ring. */
const strokeBorderColors: Record<string, { color?: string; video?: boolean }> = {
  whiteStroke: { color: 'var(--color-tertiary-2)' },
  opalStroke: { video: true },
  darkStroke: { color: 'var(--color-secondary-darkfir)' },
}

/**
 * `blockquote-block`'s pairing, same tokens: the heading takes the strong colour, the
 * supporting line the quieter one.
 */
const scheme = {
  // `dark` is dark INK, for a light surface. On a dark band it must flip to the neutral ink
  // or it paints the band's own colour — measured at 1.00:1 (title) and 1.28:1 (body).
  // `data-band` is set per section by src/cms/rendering/visual-builder.tsx.
  dark: {
    title: 'text-(--color-secondary-darkfir) [[data-band=dark]_&]:text-(--color-primary-1)',
    body: 'text-(--color-tertiary-midfir) [[data-band=dark]_&]:text-(--color-tertiary-2)',
  },
  neutral: {
    title: 'text-(--color-primary-1)',
    body: 'text-(--color-tertiary-2)',
  },
} satisfies Record<DisplaySettingValues['colorScheme'], { title: string; body: string }>

export default function AbmClosingCtaElement({
  Title,
  Description,
  ButtonText,
  ScheduleUrl,
  displaySettings,
}: Props) {
  const { colorScheme, buttonVariant, buttonSize } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  // The headline is the close. Without it there is nothing to render but chrome.
  if (!Title) return null

  const colors = scheme[colorScheme === 'neutral' ? 'neutral' : 'dark']
  const variant: ButtonVariant = buttonVariant || 'primary'
  const size = buttonSize || 'default'
  const stroke = strokeBorderColors[variant]

  // Upstream's rule for a CTA: no destination, no button — and its placeholder label when
  // the destination is set but the label has not been written yet.
  const button = ScheduleUrl ? (
    <Button variant={variant} size={size} asChild>
      <a href={ScheduleUrl} data-epi-edit="ButtonText">
        {ButtonText ?? 'Update Link Text'}
      </a>
    </Button>
  ) : null

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center md:gap-8">
      <EditableField
        as="h2"
        field="Title"
        className={cn(
          'font-headline text-headline-m md:text-headline-l max-w-[608px] leading-[1.04]',
          'font-(--font-weight-headline-extrabold)',
          colors.title
        )}
      >
        {Title}
      </EditableField>

      {Description && (
        <EditableField
          as="p"
          field="Description"
          className={cn(
            'font-body text-body-base max-w-[608px] leading-[1.45]',
            colors.body
          )}
        >
          {Description}
        </EditableField>
      )}

      {button &&
        (stroke ? (
          <StrokeButtonWrapper size={size} borderColor={stroke.color} video={stroke.video}>
            {button}
          </StrokeButtonWrapper>
        ) : (
          button
        ))}
    </div>
  )
}
