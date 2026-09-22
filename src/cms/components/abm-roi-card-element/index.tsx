/**
 * AbmRoiCardElement — one number in the ROI grid: metric, unit, what it measures, and where
 * it came from.
 *
 * Net-new, so there is no upstream `index.tsx` to follow line for line. The vocabulary is
 * borrowed instead: the card shell is `components/block/stat-block`'s (`rounded-3xl p-8`,
 * left-aligned, `font-body text-body-*` copy), and the small print follows
 * `components/block/blockquote-block`'s attribution line (`text-body-xxs`, muted fir). The
 * content order — metric, unit beside it, label, then a rule and the citation — is the one
 * `ABMHyperPage.tsx` already ships as `.roi__card`, so a migrated page keeps its reading
 * order.
 *
 * ALIGNING WITH SIBLINGS IT CANNOT SEE. Each card is its own element in its own column and
 * knows nothing about the cards beside it, so the grid is held by a FIXED internal row
 * template rather than by agreement between neighbours:
 *
 *     grid-rows-[auto_1fr_auto]   metric+unit · label · citation
 *
 * Row 1 is a single line at a fixed type size, so it is the same height in every card and
 * the numbers sit on one line across the row. Row 2 takes the slack, so a one-line label and
 * a three-line label both START at the same y. Row 3 is pushed to the bottom by that slack,
 * so the citations bottom-align. `h-full` makes the card fill a stretched column; when the
 * columns do not stretch the card falls back to its natural height and rows 1 and 2 still
 * align, which is the failure mode worth having.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cva } from 'class-variance-authority'
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { AbmRoiCardElementProps } from './types'

/**
 * `types.ts` follows `COMPONENT-SPEC.md`, which specifies
 * `displaySettings?: Record<string, string>`. Graph delivers an ARRAY of `{key, value}` and
 * `RENDERER-SPEC.md` is written against the array, so the scalars come from `./types` and
 * that one prop is re-declared. Reported rather than fixed in place — `types.ts` is not a
 * file this task owns.
 */
type Props = Omit<AbmRoiCardElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

type AnimationMode = 'none' | 'scroll' | 'mouse'
type ColorScheme = 'neutral' | 'green' | 'darkGreen'

type DisplaySettingValues = {
  animationMode?: AnimationMode
  countUp?: string
  colorScheme?: ColorScheme
}

const cardVariants = cva(
  'grid h-full grid-rows-[auto_1fr_auto] gap-4 rounded-3xl p-8 text-left',
  {
    variants: {
      colorScheme: {
        neutral: 'bg-neutral-2 text-secondary-darkfir',
        green: 'bg-primary-lfgreen text-secondary-darkfir',
        darkGreen: 'bg-secondary-darkfir text-primary-1',
      } satisfies Record<ColorScheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

const metricVariants = cva(
  'font-nudge text-8xl leading-[0.9] font-extrabold tracking-[-0.01em] tabular-nums',
  {
    variants: {
      colorScheme: {
        neutral: 'text-fir-lightfir',
        green: 'text-secondary-darkfir',
        darkGreen: 'text-primary-lfgreen',
      } satisfies Record<ColorScheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

const citationVariants = cva(
  'font-body text-body-xxs mt-2 border-t pt-3 leading-[1.35]',
  {
    variants: {
      colorScheme: {
        neutral: 'border-neutral-4 text-tertiary-7',
        green: 'border-primary-goodtogo/30 text-tertiary-midfir',
        darkGreen: 'border-fir-lightfir text-tertiary-4',
      } satisfies Record<ColorScheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

const COUNT_UP_SPRING = { stiffness: 60, damping: 18, mass: 1 }

/** Before paint on the client, plain `useEffect` on the server, where there is no layout. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * The count-up. `Metric` is authored as a bare number — `content-type.ts` tells the editor to
 * keep the unit out of the field — but a stray unit must not blank the card, so everything
 * but digits and the decimal point is stripped, exactly as `ABMHyperPage.tsx` does today.
 * The decimal places of the authored value are preserved, so "2.4" counts to 2.4 and not 2.
 *
 * THE FIRST RENDER IS THE FINAL NUMBER, not zero. `ABMHyperPage.tsx` ships `<div
 * data-count="38">0</div>`, so the server-rendered HTML of every ROI card currently says the
 * number is nought — which is what a crawler reads, what a reader with a failed bundle sees,
 * and what lands in a PDF print. Here the server and the first client render both paint the
 * real value; a layout effect swaps in the animated one before the browser paints, so the
 * count-up still starts from zero on screen and nothing flashes.
 */
function CountUpMetric({
  value,
  label,
  className,
}: {
  value: string
  label: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' })
  const [animated, setAnimated] = useState(false)

  const numeric = Number(value)
  const decimals = value.includes('.') ? value.split('.')[1].length : 0

  const progress = useMotionValue(0)
  const smooth = useSpring(progress, COUNT_UP_SPRING)
  const display = useTransform(smooth, (latest) => latest.toFixed(decimals))

  useIsomorphicLayoutEffect(() => setAnimated(true), [])

  useEffect(() => {
    if (isInView) progress.set(numeric)
  }, [isInView, numeric, progress])

  return (
    <motion.span ref={ref} className={className}>
      {animated ? display : label}
    </motion.span>
  )
}

export default function AbmRoiCardElement({
  Metric,
  Unit,
  Label,
  CitationText,
  displaySettings,
}: Props) {
  const prefersReducedMotion = useReducedMotion()

  if (!Metric) return null

  const { animationMode, countUp, colorScheme } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  const scheme = (colorScheme as ColorScheme) || 'neutral'
  const mode = (animationMode as AnimationMode) || 'scroll'

  /**
   * The two motion settings compose rather than compete: `countUp` asks for the animation
   * and `animationMode: 'none'` switches every animation on the card off, so the number is
   * only counted when both agree. A viewer who has asked their OS for reduced motion gets
   * the final value regardless.
   */
  const numeric = Metric.replace(/[^0-9.]/g, '')
  const animate =
    countUp !== 'false' &&
    mode !== 'none' &&
    !prefersReducedMotion &&
    numeric !== '' &&
    Number.isFinite(Number(numeric))

  const metricClass = metricVariants({ colorScheme: scheme })

  return (
    <div className={cn(cardVariants({ colorScheme: scheme }))}>
      <p className="row-start-1 flex flex-wrap items-baseline gap-x-1.5">
        {animate ? (
          <CountUpMetric value={numeric} label={Metric} className={metricClass} />
        ) : (
          <span className={metricClass}>{Metric}</span>
        )}
        {Unit && (
          <span className="font-nudge text-4xl leading-[0.9] font-extrabold tracking-[-0.01em] opacity-80">
            {Unit}
          </span>
        )}
      </p>

      {Label && (
        <p className="font-body text-body-s row-start-2 leading-[1.3] font-medium">
          {Label}
        </p>
      )}

      {CitationText && (
        <p className={cn('row-start-3', citationVariants({ colorScheme: scheme }))}>
          {CitationText}
        </p>
      )}
    </div>
  )
}
