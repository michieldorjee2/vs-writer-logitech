/**
 * ABM · Timeline Phase — one phase of a migration timeline.
 *
 * THE ALIGNMENT PROBLEM, AND HOW THIS FILE SOLVES IT. N of these stack in one column to form
 * a timeline, and each is an independent element node: it cannot see the phase above it, the
 * phase below it, or how many there are. So the markers can only line up if every phase
 * measures the rail the same way, regardless of its own content or its own settings. Hence
 * one FIXED internal grid — `grid-cols-[theme(spacing.12)_minmax(0,1fr)]`, a 2.5rem marker box
 * (`h-10 w-10`) at the start of that 3rem track, and the spine at `left-5` — written as
 * literals that no prop can reach. The grid track is spelled `theme(spacing.12)` rather than
 * the bare `3rem` literal because this app's root font-size is rescaled 1.6x from the
 * standard 16px (see tailwind.config.js's rem-scale-mismatch comment): a literal `3rem` in an
 * arbitrary Tailwind value renders at 30px here, not the 48px every other measurement in this
 * file assumes, while `theme(spacing.12)` resolves through the same rescaled theme `h-10` and
 * `left-5` already read from, landing on the correct 48px. `markerStyle` changes what is drawn
 * INSIDE the marker box and never its size, so a `number` phase and a `dot` phase put their
 * centres on the same 1.25rem line. Those numbers
 * are the ones the Showcase's own hand-written timeline already uses (`.timeline`,
 * `.timeline__marker`, `.timeline__track` in `src/styles/abm-layout.css`: 48px rail, 40px
 * marker, 2px track at 19-20px), so a ported phase sits where the CSS one did.
 *
 * THE SPINE IS DRAWN PER PHASE AND JOINS UP BY CONSTRUCTION. Each phase paints its own
 * full-height 2px segment; a column is `flex flex-col` with no gap, so consecutive segments
 * meet exactly and read as one line. The two ends are the only special cases, and both are
 * knowable without siblings: `isFirst` (the chain passes it) starts the line at the first
 * marker instead of above it, and `group-last:` — a plain CSS `:last-child` test, not a
 * coordination — stops the line at the last marker and drops the trailing padding. The
 * `group` class is withheld in `preview`, because `EditableBlock` wraps each element in a
 * div in draft mode, which would make every phase believe it was the last one.
 *
 * There is no upstream timeline component to port. The colour variants are upstream's
 * `name-tag-element` ones, verbatim — `display-settings.ts` says that is where they came
 * from — and everything else is token classes.
 */
import { cva } from 'class-variance-authority'
import type { CSSProperties } from 'react'
import { EditableField } from '@/lib/optimizely/features/draft'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { AbmTimelinePhaseElementProps } from './types'

/**
 * The scalars come from `./types`. `displaySettings` does not: Graph delivers it as an ARRAY
 * of `{key, value}` (see RENDERER-SPEC.md, and `withContentTypeDefaults` in
 * `../../rendering/display-defaults.ts`, which hands us one), while `types.ts` declares the
 * `Record<string, string>` that COMPONENT-SPEC.md's Phase-0 file layout asked for. The array
 * is what actually arrives and what `parseDisplaySettings` accepts, so it is overridden here
 * rather than in `types.ts`, which is not this task's file to change.
 */
type Props = Omit<AbmTimelinePhaseElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

/**
 * The option values of `./display-settings.ts`, restated. They cannot be derived from it:
 * that file annotates its export `RepoDisplayTemplate[]`, which widens every `value` to
 * `string`, where upstream's own `display-settings.ts` files use `as const` and keep the
 * literals. The `satisfies` clauses below therefore guard this union rather than the file's,
 * so the two must be kept in step by hand — see the note in the task report.
 */
type MarkerStyle = 'dot' | 'ring' | 'number'
type ColorVariant = 'default' | 'muted' | 'strong'

type DisplaySettingValues = {
  markerStyle?: MarkerStyle
  colorVariant?: ColorVariant
}

/** The card surface. Upstream `name-tag-element`'s three variants, unchanged. */
const cardVariants = cva(
  'rounded-module-sm px-6 py-5 text-(--color-secondary-darkfir)',
  {
    variants: {
      colorVariant: {
        default: 'bg-(--color-tertiary-2)',
        muted: 'bg-(--color-neutral-3)',
        strong: 'bg-(--color-tertiary-4)',
      } satisfies Record<ColorVariant, string>,
    },
    // Mirrors the `defaultValue` in `./display-settings.ts`. The chain has already merged
    // that in (`display-defaults.ts`); this only catches a renderer used in isolation.
    defaultVariants: { colorVariant: 'default' },
  }
)

interface Accent {
  /** A CSS colour — always a token `var()`, or an author-supplied hex. */
  color: string
  /** True when a digit sitting ON this colour has to be dark. */
  light: boolean
}

/**
 * The marker colour when `MarkerColor` is empty — "inherit the colour variant from the
 * display template", as the content type puts it. `default` is the lime the Showcase's
 * existing timeline marker already uses.
 */
const VARIANT_ACCENT: Record<ColorVariant, Accent> = {
  default: { color: 'var(--color-primary-lfgreen)', light: true },
  muted: { color: 'var(--color-tertiary-6)', light: true },
  strong: { color: 'var(--color-secondary-darkfir)', light: false },
}

/** A `MarkerColor` naming a brand colour. Keys are lowercased and stripped to letters. */
const NAMED_ACCENTS: Record<string, Accent> = {
  lime: { color: 'var(--color-primary-lfgreen)', light: true },
  lfgreen: { color: 'var(--color-primary-lfgreen)', light: true },
  green: { color: 'var(--color-primary-lfgreen)', light: true },
  grass: { color: 'var(--color-green-grass)', light: true },
  ltblue: { color: 'var(--color-secondary-ltblue)', light: true },
  lightblue: { color: 'var(--color-secondary-ltblue)', light: true },
  darkblue: { color: 'var(--color-tertiary-darkblue)', light: false },
  teal: { color: 'var(--color-tertiary-darkblue)', light: false },
  pink: { color: 'var(--color-tertiary-darkpink)', light: false },
  darkpink: { color: 'var(--color-tertiary-darkpink)', light: false },
  fir: { color: 'var(--color-secondary-darkfir)', light: false },
  darkfir: { color: 'var(--color-secondary-darkfir)', light: false },
  midfir: { color: 'var(--color-tertiary-midfir)', light: false },
  lightfir: { color: 'var(--color-tertiary-lightfir)', light: false },
  neutral: { color: 'var(--color-tertiary-7)', light: false },
  grey: { color: 'var(--color-tertiary-7)', light: false },
  gray: { color: 'var(--color-tertiary-7)', light: false },
}

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** sRGB relative luminance, so an author-supplied hex still gets a legible digit on it. */
function hexIsLight(hex: string): boolean {
  const body = hex.slice(1)
  const full =
    body.length <= 4
      ? body
          .slice(0, 3)
          .split('')
          .map((char) => char + char)
          .join('')
      : body.slice(0, 6)

  const channel = (offset: number) => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4) > 0.45
}

function resolveAccent(markerColor: string | undefined, colorVariant: ColorVariant): Accent {
  const raw = markerColor?.trim()
  if (!raw) return VARIANT_ACCENT[colorVariant]
  if (HEX.test(raw)) return { color: raw, light: hexIsLight(raw) }

  return (
    NAMED_ACCENTS[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? VARIANT_ACCENT[colorVariant]
  )
}

/**
 * The ordinal for a `number` marker, read out of the title — "Phase 2 — Pilot" gives "2".
 * An element has no sibling index and no position in the column, so the title is the only
 * place a phase number can come from without coordination. No digits means no number, and
 * the marker falls back to the template's own default shape.
 */
function phaseNumber(title: string): string | null {
  const match = title.match(/\d{1,2}/)
  return match ? match[0] : null
}

export default function AbmTimelinePhaseElement({
  Title,
  Description,
  MarkerColor,
  displaySettings,
  isFirst,
  preview,
}: Props) {
  const { markerStyle, colorVariant } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  const title = Title?.trim()
  if (!title) return null

  const variant: ColorVariant = colorVariant ?? 'default'
  const accent = resolveAccent(MarkerColor, variant)
  const ordinal = markerStyle === 'number' ? phaseNumber(title) : null
  const shape: MarkerStyle =
    markerStyle === 'number' && !ordinal ? 'dot' : (markerStyle ?? 'dot')

  const style = {
    '--phase-accent': accent.color,
    '--phase-ink': accent.light
      ? 'var(--color-secondary-darkfir)'
      : 'var(--color-primary-1)',
    '--phase-halo': `color-mix(in srgb, ${accent.color} 30%, transparent)`,
    // The existing hand-written `.timeline__track`, to the percentage.
    '--phase-spine': 'color-mix(in srgb, var(--color-tertiary-4) 35%, transparent)',
  } as CSSProperties

  const description = Description?.trim()

  return (
    <div
      className={cn(
        'element abm-timeline-phase-element relative grid grid-cols-[theme(spacing.12)_minmax(0,1fr)]',
        // Only outside draft mode: see the header. In preview EditableBlock adds a wrapper
        // div, so `:last-child` would be true for every phase.
        !preview && 'group'
      )}
      style={style}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-5 w-0.5 -translate-x-1/2 bg-(--phase-spine)',
          // Start at the marker's centre on the first phase, at the top edge on the rest.
          isFirst ? 'top-5' : 'top-0',
          // Stop at the last marker's centre rather than running past it.
          'bottom-0 group-last:bottom-[calc(100%_-_theme(spacing.5))]'
        )}
      />

      {/* Fixed 2.5rem box at the start of the 3rem rail: centre always at 1.25rem. */}
      <div className="relative z-10 col-start-1 row-start-1 flex h-10 w-10 items-center justify-center">
        {shape === 'number' && ordinal ? (
          // 2rem inside the 2.5rem box, so the 3px halo stays within the 3rem rail.
          <span className="font-overline text-body-xxs flex h-8 w-8 items-center justify-center rounded-full bg-(--phase-accent) leading-none font-bold text-(--phase-ink) outline-[3px] outline-(--phase-halo)">
            {ordinal}
          </span>
        ) : shape === 'ring' ? (
          <span className="h-4 w-4 rounded-full border-2 border-(--phase-accent)" />
        ) : (
          <span className="h-3 w-3 rounded-full bg-(--phase-accent) outline-[3px] outline-(--phase-halo)" />
        )}
      </div>

      <div className="col-start-2 row-start-1 pb-10 group-last:pb-0">
        <div className={cn(cardVariants({ colorVariant }))}>
          <EditableField
            field="Title"
            as="h3"
            className="font-headline text-body-med leading-[1.2] font-bold tracking-[-0.01em]"
          >
            {title}
          </EditableField>

          {description && (
            <EditableField
              field="Description"
              as="p"
              className="font-body text-body-xs mt-2 leading-[1.5] text-(--color-tertiary-7)"
            >
              {description}
            </EditableField>
          )}
        </div>
      </div>
    </div>
  )
}
