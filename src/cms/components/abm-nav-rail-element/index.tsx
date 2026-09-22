/**
 * AbmNavRailElement — the foot of the left nav rail: up to three short context lines.
 *
 * This is CHROME, and it is written to stay chrome. The type is the smallest in the
 * vocabulary (`text-body-4xs`, 10px) in the overline face (Roboto Mono, `font-overline`),
 * uppercased and letter-spaced, and every colour is a muted step of the scheme rather than a
 * brand accent — the one exception being the first line, which the rail has always tinted
 * because it carries the account eyebrow. It is the same treatment `.uc-rail__foot` in
 * `src/styles/use-case-layout.css` paints today (mono, ~10px, 0.09em tracking, 1.9 leading,
 * first line in lime), restated in opticom tokens so it follows a brand change instead of a
 * hard-coded rgba.
 *
 * ALIGNING WITHOUT SIBLINGS. The element is one node in a column and cannot see what sits
 * above or below it, so the rhythm is held internally: a one-column grid with `auto-rows-min`
 * and a fixed `leading-[1.9]` per line. Every line therefore occupies the same height for
 * the same number of wrapped lines, whatever the neighbouring element does, and a rail foot
 * with two lines is exactly two lines shorter than one with four rather than being
 * redistributed. `RailLines` is capped at three by the content type; the slice here is
 * belt-and-braces for a node written before the cap existed.
 */
import { cva } from 'class-variance-authority'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { AbmNavRailElementProps } from './types'

/**
 * `types.ts` follows `COMPONENT-SPEC.md`, which specifies
 * `displaySettings?: Record<string, string>`. Graph delivers an ARRAY of `{key, value}` and
 * `RENDERER-SPEC.md` is written against the array, so the scalars come from `./types` and
 * that one prop is re-declared. Reported rather than fixed in place — `types.ts` is not a
 * file this task owns.
 */
type Props = Omit<AbmNavRailElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

type ColorScheme = 'neutral' | 'light'
type Dividers = 'none' | 'between'

type DisplaySettingValues = {
  colorScheme?: ColorScheme
  dividers?: Dividers
}

const MAX_LINES = 3

const railVariants = cva(
  'font-overline text-body-4xs grid list-none auto-rows-min grid-cols-1 uppercase tracking-[0.09em]',
  {
    variants: {
      colorScheme: {
        // Light text on the dark rail — the default, and what the account pages ship.
        neutral: 'text-primary-1/40',
        light: 'text-tertiary-7',
      } satisfies Record<ColorScheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

/** The eyebrow line. Tinted, because it names the account; everything under it stays quiet. */
const leadLineVariants = cva('', {
  variants: {
    colorScheme: {
      neutral: 'text-primary-lfgreen',
      light: 'text-tertiary-lightfir',
    } satisfies Record<ColorScheme, string>,
  },
  defaultVariants: { colorScheme: 'neutral' },
})

const dividerVariants = cva('', {
  variants: {
    dividers: {
      none: '',
      // `border-current` inherits whatever the scheme set, so one rule serves both.
      between: 'mt-1 border-t border-current/20 pt-1',
    } satisfies Record<Dividers, string>,
  },
  defaultVariants: { dividers: 'none' },
})

export default function AbmNavRailElement({ RailLines, displaySettings }: Props) {
  const lines = (RailLines ?? [])
    .filter((line) => typeof line === 'string' && line.trim() !== '')
    .slice(0, MAX_LINES)

  if (lines.length === 0) return null

  const { colorScheme, dividers } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  const scheme = (colorScheme as ColorScheme) || 'neutral'
  const rule = (dividers as Dividers) || 'none'

  return (
    <ul className={cn(railVariants({ colorScheme: scheme }))}>
      {lines.map((line, index) => (
        <li
          key={index}
          className={cn(
            'leading-[1.9]',
            index === 0 && leadLineVariants({ colorScheme: scheme }),
            index > 0 && dividerVariants({ dividers: rule })
          )}
        >
          {line}
        </li>
      ))}
    </ul>
  )
}
