/**
 * ABM · Challenge Screenshot — the prospect's own page, in fake browser chrome.
 *
 * No upstream port exists. The visual is the one the live ABM page already draws, in
 * `src/components/ABMHyperPage.tsx` (`.challenge__screenshot` and friends, styled in
 * `src/styles/abm-layout.css:715-790`): a dark rounded frame, a chrome bar carrying three
 * dots and a mono address pill, and the screenshot cropped to the top of a 16:10 body at a
 * slight dim. Everything below is that visual re-expressed in opticom tokens.
 *
 * WHAT DELIBERATELY DID NOT COME ACROSS. The live version sets `margin-left: -35%; width:
 * 130%` and rocks the frame on a `perspective(800px) rotateY(14deg)` keyframe loop. Both are
 * properties of that page's bespoke two-column band — the frame is meant to bleed out of its
 * half — and neither survives contact with a Visual Builder column, which is a grid cell that
 * an element may not overflow and whose width it cannot know. A 130%-wide child would push a
 * horizontal scrollbar onto the whole page. The frame here fills its column instead.
 *
 * ALIGNING WITH SIBLINGS WITHOUT SEEING THEM. This is an element: it is rendered on its own
 * inside a column and knows nothing about the element in the next column. Anything that must
 * line up has to line up because the internal geometry is FIXED, not because two components
 * agreed. Three things do that work here:
 *
 *   - the chrome bar is `grid h-9 grid-cols-[auto_minmax(0,1fr)]`, so its height is 36px whatever the
 *     address says, and the address pill `truncate`s inside the `1fr` track instead of
 *     wrapping and growing the bar. Two shots side by side get bars of identical height even
 *     when one address is three times longer than the other.
 *   - the body is `aspect-[16/10]`, so at equal column widths the frames are equal heights.
 *     A screenshot's own dimensions never enter into it.
 *   - `mt-auto` on the figure inside an `h-full` flex column pushes the frame to the bottom
 *     of whatever height the row gives the column, so two shots whose headlines wrap to a
 *     different number of lines still have their frames sitting on one baseline.
 *
 * `display-settings.ts` declares this template with an EMPTY settings array — there was no
 * upstream template to copy settings from and the instruction was to copy rather than invent
 * — so there is nothing to read out of `displaySettings`.
 */
import { EditableField } from '@/lib/optimizely/features/draft'
import { cn } from '@/lib/utils'
import type { AbmChallengeShotElementProps } from './types'

/**
 * `isFirst` is threaded to every renderer by `content-area/mapper` and by
 * `visual-builder.tsx`, but `types.ts` is a Phase 0 file owned by the model, not the
 * renderer, and this task may not edit it. Declared here instead of widened there.
 */
interface Props extends AbmChallengeShotElementProps {
  isFirst?: boolean
}

/** The three window dots. Decorative, so the group carries one `aria-hidden` and no text. */
function ChromeDots() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      <span className="block size-2.5 rounded-full bg-(--color-fir-lightfir)" />
      <span className="block size-2.5 rounded-full bg-(--color-fir-lightfir)" />
      <span className="block size-2.5 rounded-full bg-(--color-fir-lightfir)" />
    </span>
  )
}

export default function AbmChallengeShotElement({
  Headline,
  ScreenshotUrl,
  ScreenshotAlt,
  BrowserUrl,
  isFirst,
}: Props) {
  const headline = Headline?.trim()
  const browserUrl = BrowserUrl?.trim()

  if (!headline && !ScreenshotUrl) return null

  return (
    <div className="flex h-full w-full flex-col">
      {headline ? (
        <EditableField
          as="h3"
          field="Headline"
          className={cn(
            'font-headline text-headline-xs lg:text-headline-s max-w-[20ch] leading-[1.04] font-(--font-weight-headline-extrabold) text-balance text-(--color-secondary-darkfir)',
            // The gap between headline and frame lives on the HEADLINE, not on the figure.
            // The figure carries `mt-auto`, and a second margin-top there would collide with
            // it — `cn`'s tailwind-merge keeps one and drops the other, silently.
            ScreenshotUrl && 'mb-8'
          )}
        >
          {headline}
        </EditableField>
      ) : null}

      {ScreenshotUrl ? (
        <figure className="mt-auto w-full overflow-hidden rounded-(--radius-module-med) bg-(--color-tertiary-midfir) shadow-2xl ring-1 ring-black/5">
          {/* The chrome. `bg-white/5` lifts the bar off the frame the way the live page's
              --vulcan-90 does, without pinning a hex that a brand change would strand. */}
          {/* `minmax(0,1fr)`, not `1fr`: a grid track's implicit `min-width:auto` refuses to
              shrink below its content, which would let a long address widen the bar instead
              of letting the pill `truncate` inside it. */}
          <div className="grid h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 bg-white/5 px-4">
            <ChromeDots />
            {browserUrl ? (
              <EditableField
                as="span"
                field="BrowserUrl"
                className="truncate rounded-(--radius-4xs) bg-black/25 px-2 py-1 font-roboto text-body-xxs leading-none text-(--color-tertiary-5)"
              >
                {browserUrl}
              </EditableField>
            ) : (
              <span />
            )}
          </div>

          <div className="aspect-[16/10] w-full overflow-hidden border-t border-white/10">
            <img
              src={ScreenshotUrl}
              alt={ScreenshotAlt ?? 'Current website screenshot'}
              loading={isFirst ? 'eager' : 'lazy'}
              decoding="async"
              className="block h-full w-full object-cover object-top opacity-90"
            />
          </div>
        </figure>
      ) : null}
    </div>
  )
}
