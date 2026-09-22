/**
 * ABM · Use-Case Lane — one need-to-solution card, one element node per lane.
 *
 * A port of the Showcase's existing `.uc-lane` card (`src/styles/use-case-layout.css`) onto
 * opticom tokens: mono-cased eyebrow, the need as the card heading, a "We'd use" label, the
 * solution as a pill, then the outcome as body copy. The register is deliberately kept —
 * Michiel's brief was more consistent with optimizely.com, "but not look more boring" — so
 * the lime pill and the tight uppercase eyebrow survive; only the hard-coded hexes are gone.
 *
 * ALIGNMENT. Lanes are independent element nodes, usually one per column of a row, and no
 * lane can see its neighbours. `h-full` is what makes a row of them read as one band: a
 * `Column` is `flex flex-1 flex-col` inside a `Row` grid, so it already stretches to the
 * tallest sibling, and `height: 100%` fills that. Where the parent height is indefinite
 * (lanes stacked in one column) it resolves to `auto` and is a no-op, which is why it is
 * preferred over `flex-1` — that would set a zero flex-basis and fight the content.
 */
import { cva } from 'class-variance-authority'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft'
import { cn } from '@/lib/utils'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { AbmUseCaseLaneElementProps } from './types'

/**
 * `display-settings.ts` is annotated `RepoDisplayTemplate[]`, which widens `options` to
 * `{value: string}[]`, so `ExtractDisplaySettingValues` cannot recover the literals. Restated
 * here so the `satisfies` clauses below make a missing variant a compile error.
 */
type DisplaySettingValues = {
  layout?: 'stacked' | 'horizontal'
  colorScheme?: 'neutral' | 'darkGreen' | 'green' | 'blue' | 'pink'
}

/**
 * `types.ts` declares `displaySettings?: Record<string, string>`; Graph delivers an ARRAY of
 * `{key, value}`. See RENDERER-SPEC.md and the vendored `blank-section/types.ts`. Corrected
 * at this boundary because `types.ts` is outside this task's write scope; reported upward.
 */
type Props = Omit<AbmUseCaseLaneElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
}

type Scheme = NonNullable<DisplaySettingValues['colorScheme']>

const cardVariants = cva(
  'flex h-full flex-col rounded-module-xs border p-5 transition-colors',
  {
    variants: {
      colorScheme: {
        neutral: 'border-neutral-3 bg-primary-1 text-fir-darkfir',
        darkGreen: 'border-fir-darkfir bg-fir-darkfir text-primary-1',
        green: 'border-fir-200 bg-fir-100 text-fir-darkfir',
        blue: 'border-blue-300 bg-blue-100 text-fir-darkfir',
        pink: 'border-pink-300 bg-pink-100 text-fir-darkfir',
      } satisfies Record<Scheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

/**
 * `horizontal` splits the card into need | solution at md+, which is why the two halves are
 * always emitted as blocks rather than as a flat list of children.
 */
const bodyVariants = cva('flex min-w-0 flex-col gap-4', {
  variants: {
    layout: {
      stacked: '',
      horizontal: 'md:flex-row md:items-start md:gap-8',
    } satisfies Record<NonNullable<DisplaySettingValues['layout']>, string>,
  },
  defaultVariants: { layout: 'stacked' },
})

const eyebrowVariants = cva(
  'text-body-4xs font-medium uppercase tracking-[0.14em]',
  {
    variants: {
      colorScheme: {
        neutral: 'text-tertiary-lightfir',
        darkGreen: 'text-green-lfgreen',
        green: 'text-tertiary-lightfir',
        blue: 'text-tertiary-darkblue',
        pink: 'text-tertiary-darkpink',
      } satisfies Record<Scheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

const pillVariants = cva(
  'inline-flex self-start rounded-full px-3 py-1 text-body-xxs font-semibold',
  {
    variants: {
      colorScheme: {
        neutral: 'bg-green-lfgreen text-fir-darkfir',
        darkGreen: 'bg-green-lfgreen text-fir-darkfir',
        green: 'bg-fir-darkfir text-primary-1',
        blue: 'bg-tertiary-darkblue text-primary-1',
        pink: 'bg-tertiary-darkpink text-primary-1',
      } satisfies Record<Scheme, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

/** Labels and body copy: one step down from the card's own text colour. */
const mutedVariants = cva('', {
  variants: {
    colorScheme: {
      neutral: 'text-neutral-7',
      darkGreen: 'text-neutral-5',
      green: 'text-neutral-7',
      blue: 'text-neutral-7',
      pink: 'text-neutral-7',
    } satisfies Record<Scheme, string>,
  },
  defaultVariants: { colorScheme: 'neutral' },
})

export default function AbmUseCaseLaneElement({
  Lane,
  Need,
  Solution,
  Outcome,
  displaySettings,
}: Props) {
  const { layout, colorScheme } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  // `Need` is the card heading. Without it the card is an eyebrow over a pill.
  if (!Need) return null

  const muted = mutedVariants({ colorScheme })

  return (
    <article className={cardVariants({ colorScheme })}>
      <div className={bodyVariants({ layout })}>
        <div className="flex min-w-0 flex-col gap-2 md:flex-1">
          {Lane && (
            <EditableField
              field="Lane"
              as="p"
              className={eyebrowVariants({ colorScheme })}
            >
              {Lane}
            </EditableField>
          )}
          <EditableField
            field="Need"
            as="h3"
            className="text-body-med font-semibold leading-snug"
          >
            {Need}
          </EditableField>
        </div>

        {(Solution || Outcome) && (
          <div className="flex min-w-0 flex-col gap-2 md:flex-1">
            {Solution && (
              <>
                <p
                  className={cn(
                    'text-body-4xs font-medium uppercase tracking-[0.14em]',
                    muted
                  )}
                >
                  We&rsquo;d use
                </p>
                <EditableField
                  field="Solution"
                  as="span"
                  className={pillVariants({ colorScheme })}
                >
                  {Solution}
                </EditableField>
              </>
            )}
            {Outcome && (
              <EditableField
                field="Outcome"
                as="p"
                className={cn('text-body-xs leading-relaxed', muted)}
              >
                {Outcome}
              </EditableField>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
