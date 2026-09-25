/**
 * ButtonBlock — one call-to-action button, or the same link rendered as text.
 *
 * A port of optimizely.com's `components/block/button-block/index.tsx`, followed line for
 * line: the same `parseDisplaySettings` read, the same "no destination, no button" early
 * return, the same `strokeBorderColors` table, the same `StrokeButtonWrapper` wrapping for
 * the three stroke variants, and the same `'Update Link Text'` placeholder.
 *
 * TWO DIVERGENCES, both forced by the content model and both recorded in DIVERGENCE.md:
 *
 *   1. Upstream reads a single `Link` CONTENT REFERENCE — `Link.url.default`, `Link.text`,
 *      `Link.title`, `Link.target`. A content reference is a 400 on an `elementEnabled`
 *      type, so the two values we keep arrive as the scalars `ButtonUrl` and `ButtonText`,
 *      and `title` / `target` are gone. `data-epi-edit` therefore names `ButtonText`, the
 *      field an editor actually edits, where upstream names `Link`.
 *
 *   2. `buttonVariant` (display setting) stays the source of truth, exactly as upstream has
 *      it. The content-level `Variant` property exists because a generating agent writes
 *      content and has no display settings to write into, so it is consulted ONLY when
 *      `buttonVariant` is absent or has been cleared — which through the render chain means
 *      an editor deliberately emptied it, since `display-defaults.ts` supplies `primary`
 *      otherwise.
 *
 * `iconType` is the one setting upstream declares and does not yet read. Its default is
 * `none`, so the default render is byte-identical to upstream's; `icon` / `iconSmall` add a
 * trailing arrow into the gap the Button's own `gap-3` already reserves. The arrow is a
 * lucide glyph rather than `MaterialIcon`, because this app does not load the Material
 * Symbols webfont — see the note in the phase report.
 */
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/_ui/button'
import { StrokeButtonWrapper } from '@/components/_ui/button/stroke-wrapper'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'

import type { ButtonBlockProps } from './types'

type ButtonVariant =
  | 'primary'
  | 'dark'
  | 'white'
  | 'neutral'
  | 'whiteStroke'
  | 'opalStroke'
  | 'darkStroke'

/** The option values of `display-settings.ts`, as the editor can store them. */
type DisplaySettingValues = {
  displayType: 'button' | 'link'
  buttonVariant: ButtonVariant
  buttonSize: 'sm' | 'default'
  iconType: 'none' | 'icon' | 'iconSmall'
}

/**
 * `types.ts` types `displaySettings` as `Record<string, string>`; Graph delivers an ARRAY of
 * `{key, value}` and that is what the render chain passes. The scalars come from `types.ts`
 * unchanged — only this one prop is restated, against the vendored type the helper reads.
 */
type Props = Omit<ButtonBlockProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

/** Upstream's table, verbatim. A variant absent from it renders without a stroke ring. */
const strokeBorderColors: Record<string, { color?: string; video?: boolean }> = {
  whiteStroke: { color: 'var(--color-tertiary-2)' },
  opalStroke: { video: true },
  darkStroke: { color: 'var(--color-secondary-darkfir)' },
}

/**
 * The authoring-time fallback: content `Variant` -> upstream's button vocabulary. `satisfies`
 * makes a new `Variant` option in `content-type.ts` a compile error here rather than a
 * silent `primary`.
 */
const variantFromContent = {
  primary: 'primary',
  secondary: 'neutral',
  ghost: 'whiteStroke',
} satisfies Record<NonNullable<ButtonBlockProps['Variant']>, ButtonVariant>

const arrowSize = {
  none: 0,
  icon: 20,
  iconSmall: 16,
} satisfies Record<DisplaySettingValues['iconType'], number>

export default function ButtonBlock({
  ButtonText,
  ButtonUrl,
  Variant,
  displaySettings,
}: Props) {
  const { displayType, buttonVariant, buttonSize, iconType } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  // Upstream: `if (!Link?.url?.default) return null`. A button with nowhere to go is not a
  // button, and an empty shell in a column is worse than a missing one.
  if (!ButtonUrl) return null

  const text = ButtonText ?? 'Update Link Text'
  const variant: ButtonVariant =
    buttonVariant || (Variant ? variantFromContent[Variant] : undefined) || 'primary'
  const size = buttonSize || 'default'

  const icon =
    iconType && iconType !== 'none' ? (
      <ArrowRight size={arrowSize[iconType]} strokeWidth={2} aria-hidden="true" />
    ) : null

  const label = (
    <a href={ButtonUrl} data-epi-edit="ButtonText">
      {text}
      {icon}
    </a>
  )

  if (displayType === 'link') {
    return (
      <Button variant="link" asChild>
        {label}
      </Button>
    )
  }

  // `w-fit`: a column is flex-col with align-items stretch, so without it the button
  // stretched to the whole column (measured 721px / 912px). optimizely.com's are compact.
  const button = (
    <Button variant={variant} size={size} className="w-fit" asChild>
      {label}
    </Button>
  )

  const stroke = strokeBorderColors[variant]

  if (stroke) {
    return (
      <StrokeButtonWrapper size={size} borderColor={stroke.color} video={stroke.video}>
        {button}
      </StrokeButtonWrapper>
    )
  }

  return button
}
