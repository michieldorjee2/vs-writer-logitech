/**
 * AbmAnalystCardElement — one analyst or third-party proof point.
 *
 * There is no upstream component to port (optimizely.com's block catalogue has no analyst
 * card), so this is assembled out of the vendored vocabulary rather than reinterpreted from
 * scratch: `TaxonomyTag` for the category chip, the `--color-*` tokens for every colour, and
 * the same card grammar `card-customer-quote-block` inherits from upstream — a rounded
 * module, a hover lift, an arrow that leans out on hover, and a focus ring on the anchor.
 * `colorScheme` is deliberately the same select `blockquote-block` carries upstream, because
 * the two render side by side in the `analyst-proof` slot and have to flip together.
 *
 * WHY THE GRID TEMPLATE IS FIXED, and why it is not `auto auto 1fr`. This is an ELEMENT. The
 * `analystCards` feed is `cardinality: 'many'`, so N of these are placed as N independent
 * nodes and none of them can see the others. Anything that has to line up across siblings has
 * to line up by construction:
 *
 *   row 1  1.25rem   the source overline — a FIXED band, not `auto`. `auto` collapses to zero
 *                    on a card whose Source is empty, which drops that card's badge half a
 *                    line above its neighbours'. 20px clears Roboto Mono at 14px/1.2.
 *   row 2  1fr       the badge. Absorbs every difference in claim length, so the row below it
 *                    is pinned to the bottom edge instead of floating at the end of the text.
 *   row 3  auto      the chip + arrow, bottom-anchored on every card.
 *
 * With `h-full` on the anchor the card fills whatever height the column gives it, so three
 * cards in three columns of one row share a bottom rule and a badge baseline without any of
 * them knowing the others exist.
 */
import { cva } from 'class-variance-authority'
import { ArrowUpRight } from 'lucide-react'
import { TaxonomyTag } from '@/components/_ui/taxonomy-tag'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { AbmAnalystCardElementProps } from './types'

type ColorScheme = 'dark' | 'neutral'

type DisplaySettingValues = {
  colorScheme?: ColorScheme
}

/** A CMS `url` property (`{ default }`), upstream's link object, or a bare string. */
function resolveUrl(value: unknown): string | undefined {
  if (!value) return undefined
  if (typeof value === 'string') return value || undefined
  if (typeof value !== 'object') return undefined

  const candidate = value as { default?: unknown; url?: { default?: unknown } }
  if (typeof candidate.default === 'string') return candidate.default || undefined
  if (typeof candidate.url?.default === 'string') return candidate.url.default || undefined
  return undefined
}

const card = cva(
  'grid h-full grid-rows-[1.25rem_1fr_auto] gap-5 rounded-(--radius-module-med) border p-6 transition-colors duration-200 ease-out',
  {
    variants: {
      colorScheme: {
        dark: 'border-(--color-tertiary-4) bg-(--color-primary-1) text-(--color-secondary-darkfir) group-hover:border-(--color-primary-goodtogo)',
        neutral:
          'border-white/20 bg-white/5 text-(--color-primary-1) group-hover:border-(--color-primary-lfgreen)',
      } satisfies Record<ColorScheme, string>,
    },
    defaultVariants: { colorScheme: 'dark' },
  }
)

const source = cva(
  'font-overline text-body-xxs truncate leading-5 tracking-[0.42px] uppercase',
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

const arrow = cva('shrink-0 transition-transform duration-200 ease-out', {
  variants: {
    colorScheme: {
      dark: 'text-(--color-primary-goodtogo)',
      neutral: 'text-(--color-primary-lfgreen)',
    } satisfies Record<ColorScheme, string>,
  },
  defaultVariants: { colorScheme: 'dark' },
})

/**
 * `TaxonomyTag`'s `className` REPLACES its default rather than merging with it, so the light
 * variant has to restate the whole chip. The default is the dark one, verbatim from the
 * vendored primitive, and is left to it.
 */
const NEUTRAL_CHIP =
  'font-overline text-body-xxs rounded-[8px] border border-(--color-tertiary-2) px-3 py-2 leading-[1.2] tracking-[0.42px] text-(--color-tertiary-2) uppercase'

export default function AbmAnalystCardElement({
  Badge,
  Source,
  Category,
  Url,
  displaySettings,
}: AbmAnalystCardElementProps) {
  // The badge IS the proof point. Without it the card is chrome around nothing.
  if (!Badge) return null

  // `displaySettings` arrives as an ARRAY of {key,value} (RENDERER-SPEC.md, and
  // `withContentTypeDefaults` in ../../rendering/display-defaults.ts returns one). types.ts
  // declares the write-side `Record<string,string>`; the cast reconciles the two without
  // editing a file this task does not own. `parseDisplaySettings` guards the non-array case.
  const { colorScheme } = parseDisplaySettings<DisplaySettingValues>(
    displaySettings as unknown as DisplaySettings
  )
  const scheme: ColorScheme = colorScheme === 'neutral' ? 'neutral' : 'dark'

  const href = resolveUrl(Url)

  const body = (
    <div className={cn(card({ colorScheme: scheme }))}>
      <p data-epi-edit="Source" className={cn(source({ colorScheme: scheme }))}>
        {Source}
      </p>

      <p
        data-epi-edit="Badge"
        className="font-body text-body-lg leading-[1.25] font-(--font-weight-body-medium)"
      >
        {Badge}
      </p>

      <div className="flex items-end justify-between gap-4">
        {Category ? (
          <TaxonomyTag
            label={Category}
            className={scheme === 'neutral' ? NEUTRAL_CHIP : undefined}
          />
        ) : (
          <span />
        )}
        {href && (
          <ArrowUpRight
            aria-hidden="true"
            size={24}
            className={cn(
              arrow({ colorScheme: scheme }),
              'group-hover:translate-x-1 group-hover:-translate-y-1'
            )}
          />
        )}
      </div>
    </div>
  )

  // No link is a legitimate state — a recognition without a public page is still proof — so
  // the card renders either way and only the anchor is conditional.
  if (!href) return <div className="group h-full">{body}</div>

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block h-full rounded-(--radius-module-med) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary-goodtogo)"
    >
      {body}
    </a>
  )
}
