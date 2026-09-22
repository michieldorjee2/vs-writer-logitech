/**
 * AbmStickyCtaElement — the call to action that follows the reader down the page.
 *
 * CHROME, NOT A BAND. `abm-takeout`'s `sticky-cta` slot puts this in a section that is
 * `transparent / paddingY: none / paddingX: none / roundedCorners: none` precisely so the
 * element can leave the flow: "it floats over the page rather than occupying a band". So the
 * live render is `fixed`, a bottom-centred capsule, and the section it nominally belongs to
 * contributes nothing but a place in the composition tree.
 *
 * ONE LABEL, ONE BUTTON. The content type carries exactly `Text` and `Url`, so `Text` is the
 * button's label — it is not also repeated as bar copy beside it. The capsule around the
 * button is chrome: a translucent dark-fir pill with a blurred backdrop and a lime hairline,
 * the same treatment `.sticky-cta` already uses in `src/styles/abm-layout.css`, which is
 * what separates a floating control from the page scrolling underneath it. The button itself
 * is the vendored `Button`, read through the same `buttonVariant` / `buttonSize` settings
 * `button-block` reads, with upstream's `StrokeButtonWrapper` for the three stroke variants.
 *
 * IN PREVIEW IT RENDERS IN FLOW. A `fixed` element inside the Visual Builder canvas floats
 * over the editor and leaves its `EditableBlock` wrapper zero pixels high, so there is
 * nothing to select. `preview` swaps `fixed` for `relative`, which changes chrome and not
 * copy, as RENDERER-SPEC requires. The live page keeps the scroll reveal; preview shows the
 * capsule immediately, because an editor should not have to scroll a canvas to find it.
 */
import { useEffect, useState } from 'react'

import { Button } from '@/components/_ui/button'
import { StrokeButtonWrapper } from '@/components/_ui/button/stroke-wrapper'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'

import type { AbmStickyCtaElementProps } from './types'

type ButtonVariant =
  | 'primary'
  | 'dark'
  | 'white'
  | 'neutral'
  | 'whiteStroke'
  | 'opalStroke'
  | 'darkStroke'

type DisplaySettingValues = {
  buttonVariant: ButtonVariant
  buttonSize: 'sm' | 'default'
}

/** See the note in `button-block/index.tsx`: Graph delivers `displaySettings` as an array. */
type Props = Omit<AbmStickyCtaElementProps, 'displaySettings'> & {
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

/** Matches `.sticky-cta`'s reveal point in the existing ABM template. */
const REVEAL_AFTER_PX = 400

export default function AbmStickyCtaElement({
  Text,
  Url,
  displaySettings,
  preview,
}: Props) {
  const { buttonVariant, buttonSize } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  const [revealed, setRevealed] = useState(false)

  // Hooks run before the content guard below, so the guard can never change the hook order.
  useEffect(() => {
    if (preview) return

    const onScroll = () => setRevealed(window.scrollY > REVEAL_AFTER_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [preview])

  if (!Text || !Url) return null

  const variant: ButtonVariant = buttonVariant || 'primary'
  const size = buttonSize || 'default'

  const button = (
    <Button variant={variant} size={size} asChild>
      <a href={Url} data-epi-edit="Text">
        {Text}
      </a>
    </Button>
  )

  const stroke = strokeBorderColors[variant]

  return (
    <div
      className={cn(
        'inline-flex max-w-[calc(100vw-24px)] items-center rounded-[24px] border p-2',
        'border-(--color-primary-lfgreen)/20 bg-(--color-secondary-darkfir)/85 backdrop-blur-xl',
        preview
          ? 'relative self-start'
          : [
              'fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[900]',
              '-translate-x-1/2 transition-[opacity,transform] duration-500 ease-out',
              revealed
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-full opacity-0',
            ]
      )}
    >
      {stroke ? (
        <StrokeButtonWrapper size={size} borderColor={stroke.color} video={stroke.video}>
          {button}
        </StrokeButtonWrapper>
      ) : (
        button
      )}
    </div>
  )
}
