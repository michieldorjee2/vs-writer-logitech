/**
 * AbmThesisElement — the why-now argument for one account.
 *
 * No optimizely.com upstream exists for this content type, so nothing could be ported whole.
 * What IS ported is the treatment of each of its three parts, from the nearest upstream
 * neighbours, so the element reads as optimizely.com rather than as a new invention:
 *
 *   headline     the opticom display register — `font-nudge`, extrabold, the token size
 *                ladder, no colour of its own so the section decides
 *   body         the same plain-text paragraph split `text-content-element` does, in the
 *                same `font-body text-body-base leading-[1.45]` body register
 *   quote        `components/block/blockquote-block`, line for line: the goodtogo rail, the
 *                extruded `"` built out of `StackedHeading`, `text-body-base` copy and a
 *                `text-body-xxs` attribution
 *
 * WHY THE QUOTE REUSES `StackedHeading` AND WHERE IT COMES FROM. Upstream's blockquote is
 * `<StackedHeading text='##"##' as="span" animationMode="none" extrusionCount={5} … />` — the
 * quote mark IS the brand extrusion mechanic, not a typographic glyph, and rebuilding it here
 * would mean a second copy of the nine-colour ramp and the layer geometry. `blockquote-block`
 * is not part of the vendored slice (`src/vendor/opticom/` stops at `_ui`, `icon-element`,
 * `row`, `column`, `blank-section`), so the treatment is reproduced here and the mechanic is
 * imported from `../stacked-heading-element`, exactly as upstream imports it from
 * `@/components/element/stacked-heading-element`.
 *
 * That import is a deliberate, reported exception to RENDERER-SPEC.md's "do not import from
 * another component folder". The rule guards against two things: a merge conflict between
 * parallel agents, and a circular import. Neither applies — both folders belong to the same
 * renderer group and the same task, and `stacked-heading-element` imports nothing from here.
 * If a reviewer would still rather not have it, the single fix is to replace the
 * `<StackedHeading>` below with a plain `"` in `font-nudge`; nothing else depends on it.
 *
 * COLOUR. Upstream's blockquote picks its palette from a `colorScheme` display setting. This
 * content type has no such setting, so the same two upstream palettes are keyed on the one
 * background this element can actually know about — its own `backgroundColor`. `gray_800`
 * paints a panel, so the panel sets `text-primary-1` once and the headline and body inherit
 * it; `none` paints nothing, so headline and body inherit the section's colour and the quote
 * keeps upstream's default dark pair. An editor who puts a `none` thesis on a `dark_forest`
 * section should switch it to `gray_800`; the element cannot see the section from here.
 *
 * ALIGNMENT. `none` adds NO padding, on purpose. This is an element in a column with no
 * knowledge of its siblings, so its left edge has to be the column's left edge or it will
 * not line up with the `text-content-element` above it. Only the panel variant insets.
 */
import { cva } from 'class-variance-authority'
import { EditableField } from '@/lib/optimizely/features/draft'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import { StackedHeading } from '../stacked-heading-element'
import type { AbmThesisElementProps } from './types'

/** The values this folder's `display-settings.ts` can hand back, after parsing. */
interface DisplaySettingValues extends Record<string, unknown> {
  backgroundColor?: 'none' | 'gray_800'
  /** A `checkbox` setting: the CMS may send a boolean, the repo default arrives as `'false'`. */
  bordersRounded?: string | boolean
}

const thesisVariants = cva('element abm-thesis-element flex w-full flex-col gap-6', {
  variants: {
    backgroundColor: {
      none: '',
      // No `gray-800` exists in the opticom token set; `fir-darkfir` is the brand's dark
      // panel and the colour `blank-section`'s own `dark_forest` variant uses.
      gray_800: 'bg-fir-darkfir text-primary-1 p-6 md:p-8',
    } satisfies Record<NonNullable<DisplaySettingValues['backgroundColor']>, string>,
    bordersRounded: {
      // 24px — `blank-section` rounds to the same step.
      true: 'rounded-module-med',
      false: '',
    },
  },
  defaultVariants: {
    backgroundColor: 'none',
    bordersRounded: false,
  },
})

/** A blank line — optionally carrying whitespace — separates paragraphs. */
const PARAGRAPH_BREAK = /\n[ \t]*\n/

function splitParagraphs(body: string | undefined): string[] {
  if (!body) return []
  return body
    .split(PARAGRAPH_BREAK)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

/**
 * `types.ts` types `displaySettings` as `Record<string,string>` (COMPONENT-SPEC.md, Phase 0),
 * but the chain hands over Graph's ARRAY of `{key,value}` — `visual-builder.tsx` calls
 * `withContentTypeDefaults()`, which returns an array, and RENDERER-SPEC.md says so plainly.
 * Reported rather than fixed, because `types.ts` is outside this task's write scope. This
 * accepts either shape; `parseDisplaySettings` still does the parsing.
 */
function asDisplaySettings(value: unknown): DisplaySettings | undefined {
  if (Array.isArray(value)) return value as DisplaySettings
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, string>).map(([key, v]) => ({
      key,
      value: v,
    }))
  }
  return undefined
}

export default function AbmThesisElement({
  Headline,
  Body,
  Quote,
  Attribution,
  displaySettings,
}: AbmThesisElementProps) {
  const { backgroundColor, bordersRounded } = parseDisplaySettings<DisplaySettingValues>(
    asDisplaySettings(displaySettings)
  )

  const headline = Headline?.trim()
  const paragraphs = splitParagraphs(Body)
  const quote = Quote?.trim()
  const attribution = Attribution?.trim()

  // The thesis IS the headline and the reasoning. A bare quote is not one.
  if (!headline && paragraphs.length === 0) return null

  const background =
    backgroundColor === 'gray_800' ? 'gray_800' : 'none'
  // `extractDefaults()` stringifies every repo default, so the checkbox's `false` arrives as
  // the STRING 'false' — truthy. Compare, never test for truth.
  const rounded = bordersRounded === true || bordersRounded === 'true'
  const isDark = background === 'gray_800'

  return (
    <div
      className={cn(
        thesisVariants({ backgroundColor: background, bordersRounded: rounded })
      )}
    >
      {headline && (
        <EditableField
          field="Headline"
          as="h2"
          className="font-nudge text-body-xxl leading-[1.05] font-extrabold tracking-[-0.01em] md:text-7xl"
        >
          {headline}
        </EditableField>
      )}

      {paragraphs.length > 0 && (
        <EditableField
          field="Body"
          as="div"
          className="font-body text-body-base flex max-w-none flex-col gap-4 leading-[1.45]"
        >
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </EditableField>
      )}

      {quote && (
        <blockquote className="flex items-stretch gap-8">
          <div className="w-1 shrink-0 self-stretch rounded-full bg-(--color-primary-goodtogo)" />
          <div className="flex flex-col items-start pb-3">
            <StackedHeading
              text='##"##'
              as="span"
              animationMode="none"
              extrusionCount={5}
              className="-mb-3 text-[68px] leading-[0.9] md:text-[68px] lg:text-[68px]"
            />
            <div className="flex flex-col gap-4">
              <EditableField
                field="Quote"
                as="p"
                className={cn(
                  'font-body text-body-base leading-[1.45]',
                  isDark ? 'text-(--color-primary-1)' : 'text-(--color-secondary-darkfir)'
                )}
              >
                {quote}
              </EditableField>
              {attribution && (
                <EditableField
                  field="Attribution"
                  as="div"
                  className={cn(
                    'font-body text-body-xxs flex items-start gap-2 leading-[1.35] font-medium',
                    isDark
                      ? 'text-(--color-tertiary-2)'
                      : 'text-(--color-tertiary-midfir)'
                  )}
                >
                  {attribution}
                </EditableField>
              )}
            </div>
          </div>
        </blockquote>
      )}
    </div>
  )
}
