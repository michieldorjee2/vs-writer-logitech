/**
 * ABM · Tech Stack Item — one detected technology, drawn as a taxonomy tag.
 *
 * Renders on the vendored `_ui/taxonomy-tag` primitive, as `content-type.ts` says it should.
 * That primitive takes exactly two inputs — `label` and `className` — and its `className` is
 * `className ?? <its default>`, i.e. passing one REPLACES the whole look rather than adding
 * to it. So this file's job is to rebuild that default from the same token classes and vary
 * only what `tagStyle` / `textCase` / `ColorTag` are allowed to vary. The base string below
 * is upstream's, character for character; the colour moved out into `--tag-accent` so all
 * three styles can share it.
 *
 * COLOUR IS RESOLVED WITHOUT LOOKING AT SIBLINGS, and that is the whole trick here. Every
 * tag is its own element node in the column and knows nothing of the others, but two tags
 * carrying `ColorTag: "cms"` must still come out the same colour. So an unrecognised tag is
 * hashed to a fixed slot in an ordinal ramp: a pure function of the string, therefore stable
 * across siblings, across pages and across renders, with no coordination. A tag naming a
 * brand token or a hex takes that colour directly, and an empty one falls back to exactly
 * the colour the vendored primitive hard-codes today.
 *
 * `--tag-accent` is set inline on a wrapper rather than on the tag, because `TaxonomyTag`
 * accepts no `style`. Custom properties inherit, so the tag reads them through.
 */
import { cva } from 'class-variance-authority'
import type { CSSProperties } from 'react'
import { TaxonomyTag } from '@/components/_ui/taxonomy-tag'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { AbmTechStackItemElementProps } from './types'

/**
 * The scalars come from `./types`. `displaySettings` does not: Graph delivers it as an ARRAY
 * of `{key, value}` (see RENDERER-SPEC.md, and `withContentTypeDefaults` in
 * `../../rendering/display-defaults.ts`, which hands us one), while `types.ts` declares the
 * `Record<string, string>` that COMPONENT-SPEC.md's Phase-0 file layout asked for. The array
 * is what actually arrives and what `parseDisplaySettings` accepts, so it is overridden here
 * rather than in `types.ts`, which is not this task's file to change.
 */
type Props = Omit<AbmTechStackItemElementProps, 'displaySettings'> & {
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
type TagStyle = 'outline' | 'solid' | 'subtle'
type TextCase = 'uppercase' | 'normal'

type DisplaySettingValues = {
  tagStyle?: TagStyle
  textCase?: TextCase
}

const tagVariants = cva(
  'font-overline text-body-xxs rounded-[8px] px-3 py-2 leading-[1.2] tracking-[0.42px]',
  {
    variants: {
      tagStyle: {
        outline: 'border border-(--tag-accent) text-(--tag-text)',
        solid: 'border border-(--tag-accent) bg-(--tag-accent) text-(--tag-ink)',
        subtle: 'border border-transparent bg-(--tag-surface) text-(--tag-text)',
      } satisfies Record<TagStyle, string>,
      textCase: {
        uppercase: 'uppercase',
        normal: 'normal-case',
      } satisfies Record<TextCase, string>,
    },
    // Mirrors the `defaultValue` of each setting in `./display-settings.ts`. The chain has
    // already merged those in (`display-defaults.ts`), so this only catches a renderer
    // rendered in isolation — without it such a tag would come out with no border at all.
    defaultVariants: {
      tagStyle: 'outline',
      textCase: 'uppercase',
    },
  }
)

interface Accent {
  /** A CSS colour — always a token `var()`, or an author-supplied hex. */
  color: string
  /** True when text sitting ON this colour has to be dark. */
  light: boolean
}

/** What the vendored primitive hard-codes today, and so what an empty `ColorTag` keeps. */
const DEFAULT_ACCENT: Accent = {
  color: 'var(--color-secondary-darkfir)',
  light: false,
}

/** A `ColorTag` naming a brand colour. Keys are lowercased and stripped to letters. */
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

/**
 * The ordinal ramp a category name ("cms", "analytics", "crm") lands in. All five read on a
 * light surface and all five are dark enough to carry white text when `tagStyle` is solid,
 * which is what keeps `--tag-ink` a two-way choice rather than a per-colour table.
 */
const CATEGORY_RAMP: Accent[] = [
  { color: 'var(--color-tertiary-darkblue)', light: false },
  { color: 'var(--color-tertiary-darkpink)', light: false },
  { color: 'var(--color-tertiary-lightfir)', light: false },
  { color: 'var(--color-tertiary-7)', light: false },
  { color: 'var(--color-tertiary-midfir)', light: false },
]

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** FNV-ish string hash. Deterministic, so two siblings with the same tag agree. */
function rampIndex(value: string, buckets: number): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % buckets
}

/** sRGB relative luminance, so an author-supplied hex still gets legible solid-tag text. */
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

function resolveAccent(colorTag?: string): Accent {
  const raw = colorTag?.trim()
  if (!raw) return DEFAULT_ACCENT
  if (HEX.test(raw)) return { color: raw, light: hexIsLight(raw) }

  const named = NAMED_ACCENTS[raw.toLowerCase().replace(/[^a-z]/g, '')]
  if (named) return named

  return CATEGORY_RAMP[rampIndex(raw.toLowerCase(), CATEGORY_RAMP.length)] ?? DEFAULT_ACCENT
}

export default function AbmTechStackItemElement({ Name, ColorTag, displaySettings }: Props) {
  const { tagStyle, textCase } = parseDisplaySettings<DisplaySettingValues>(displaySettings)

  const label = Name?.trim()
  if (!label) return null

  const accent = resolveAccent(ColorTag)
  const style = {
    '--tag-accent': accent.color,
    '--tag-ink': accent.light
      ? 'var(--color-secondary-darkfir)'
      : 'var(--color-primary-1)',
    '--tag-surface': `color-mix(in srgb, ${accent.color} 14%, transparent)`,
    // A light accent (lime, aqua) cannot be the TEXT colour on a light surface — measured at
    // 1.23:1 and 1.57:1 on white. It stays the border/surface; the label drops to Dark Fir ink.
    '--tag-text': accent.light ? 'var(--color-secondary-darkfir)' : accent.color,
  } as CSSProperties

  return (
    // `my-1` because a column is `flex flex-col` with no gap: these stack vertically, one
    // per node, and nothing else puts space between them. `w-fit` keeps the chip its own
    // width instead of stretching to the column.
    <span className="element abm-tech-stack-item-element my-1 inline-flex w-fit" style={style}>
      <TaxonomyTag label={label} className={cn(tagVariants({ tagStyle, textCase }))} />
    </span>
  )
}
