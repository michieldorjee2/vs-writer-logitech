/**
 * BlockquoteBlock — a port of optimizely.com's `components/block/blockquote-block/index.tsx`.
 *
 * Structure, spacing, type scale and colour pairs are upstream's, line for line: the
 * `--color-primary-goodtogo` rule down the left, the 68px quote glyph overhanging the copy by
 * `-mb-3`, `text-body-base` at `leading-[1.45]` for the quote, and the
 * `AuthorName | AuthorTitle` line at `text-body-xxs`.
 *
 * ONE DIVERGENCE, and it is the quote glyph. Upstream draws it with
 * `<StackedHeading text='##"##' animationMode="none" extrusionCount={5} />` — the brand's
 * extrusion mechanic, nine framer-motion layers deep. `stacked-heading-element` is NOT part of
 * the vendored slice (`src/vendor/opticom/UPSTREAM.md` vendors `icon-element` only), and
 * RENDERER-SPEC.md forbids importing another component folder, so the layered component is not
 * reachable from here. Rather than drop the mechanic and render a flat glyph, the static
 * result of `animationMode="none"` is reproduced as a `text-shadow` ramp over the same
 * `--color-extrusion-*` tokens: upstream's five layers resolve to the extrusion-1 face with
 * extrusion-2/3/4 trailing up-left at ~5px steps (LAYER_OFFSET 10 × 5/9, tanh-dampened).
 * What is lost is the mouse/scroll parallax, which `animationMode="none"` already switched
 * off. When `stacked-heading-element` lands, this span is the single thing to replace.
 */
import { cva } from 'class-variance-authority'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { BlockquoteBlockProps } from './types'

type ColorScheme = 'dark' | 'neutral'

type DisplaySettingValues = {
  colorScheme?: ColorScheme
}

/**
 * The static form of upstream's five-layer extrusion. Face is extrusion-1; the darker layers
 * trail up-left, which is the same silhouette `animationMode="none"` settles into.
 */
const EXTRUSION_RAMP = [
  '-5px -5px 0 var(--color-extrusion-2)',
  '-10px -10px 0 var(--color-extrusion-3)',
  '-15px -15px 0 var(--color-extrusion-4)',
].join(', ')

const quoteText = cva('font-body text-body-base leading-[1.45]', {
  variants: {
    colorScheme: {
      dark: 'text-(--color-secondary-darkfir)',
      neutral: 'text-(--color-primary-1)',
    } satisfies Record<ColorScheme, string>,
  },
  defaultVariants: { colorScheme: 'dark' },
})

const attribution = cva(
  'font-body text-body-xxs flex items-start gap-2 leading-[1.35]',
  {
    variants: {
      colorScheme: {
        dark: 'text-(--color-tertiary-midfir)',
        neutral: 'text-(--color-tertiary-2)',
      } satisfies Record<ColorScheme, string>,
    },
    defaultVariants: { colorScheme: 'dark' },
  }
)

export default function BlockquoteBlock({
  Quote,
  AuthorName,
  AuthorTitle,
  displaySettings,
}: BlockquoteBlockProps) {
  // Upstream's guard: no quote, no shell. `required: true` in the content type is enforced on
  // write, not on read, so an older version of a page can still arrive without it.
  if (!Quote) return null

  // `displaySettings` reaches a renderer as an ARRAY of {key,value} (RENDERER-SPEC.md, and
  // `withContentTypeDefaults` in ../../rendering/display-defaults.ts returns one). types.ts
  // declares the write-side `Record<string,string>`; the cast reconciles the two without
  // editing a file this task does not own. `parseDisplaySettings` guards the non-array case.
  const { colorScheme } = parseDisplaySettings<DisplaySettingValues>(
    displaySettings as unknown as DisplaySettings
  )
  const scheme: ColorScheme = colorScheme === 'neutral' ? 'neutral' : 'dark'

  return (
    <blockquote className="flex items-stretch gap-8">
      <div className="w-1 shrink-0 self-stretch rounded-full bg-(--color-primary-goodtogo)" />
      <div className="flex flex-col items-start pb-3">
        <span
          aria-hidden="true"
          className="font-nudge -mb-3 text-[68px] leading-[0.9] font-extrabold tracking-[-0.01em] text-(--color-extrusion-1)"
          style={{ textShadow: EXTRUSION_RAMP, paintOrder: 'stroke fill' }}
        >
          {'"'}
        </span>
        <div className="flex flex-col gap-4">
          <p data-epi-edit="Quote" className={cn(quoteText({ colorScheme: scheme }))}>
            {Quote}
          </p>
          {(AuthorName || AuthorTitle) && (
            <div className={cn(attribution({ colorScheme: scheme }))}>
              {AuthorName && (
                <span data-epi-edit="AuthorName" className="font-medium">
                  {AuthorName}
                </span>
              )}
              {AuthorName && AuthorTitle && <span>|</span>}
              {AuthorTitle && <span data-epi-edit="AuthorTitle">{AuthorTitle}</span>}
            </div>
          )}
        </div>
      </div>
    </blockquote>
  )
}
