/**
 * ABM · Friction Point — one "where it breaks" card: a named point and the paragraph under
 * it. A section is N of these element nodes.
 *
 * THE ORDINAL. `numbering` defaults to `large_numbers`, and the Showcase's current renderer
 * prints "01", "02", "03" above each title — but an element node cannot know its own index.
 * It has no siblings in scope, `isFirst` only distinguishes the first element in a column
 * from the rest, and `EditableBlock` wraps each node in edit mode so `nth-child` would not
 * survive either. A CSS counter is the one mechanism that numbers N independent siblings
 * without any of them coordinating: each card increments `abm-friction` in document order
 * and renders the value from a `::before`. The counter needs an ANCESTOR reset: without one,
 * each card instantiates its own counter and every card reads 01 (measured 2026-09-25).
 * index.css resets `abm-friction` on every `.vb-row`, so the cards in one row count 01, 02, 03.
 *
 * The ordinal is `aria-hidden`: it is a visual rhythm, not content, and a screen reader
 * already gets the list from the headings.
 */
import { cva } from 'class-variance-authority'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type { AbmFrictionPointElementProps } from './types'

/**
 * `display-settings.ts` is annotated `RepoDisplayTemplate[]`, which widens `options` to
 * `{value: string}[]`, so `ExtractDisplaySettingValues` cannot recover the literals. Restated
 * here so the `satisfies` clause below makes a missing variant a compile error.
 */
type DisplaySettingValues = {
  numbering?: 'large_numbers' | 'none'
  colorScheme?: 'neutral' | 'white'
}

/**
 * `types.ts` declares `displaySettings?: Record<string, string>`; Graph delivers an ARRAY of
 * `{key, value}`. See RENDERER-SPEC.md and the vendored `blank-section/types.ts`. Corrected
 * at this boundary because `types.ts` is outside this task's write scope; reported upward.
 */
type Props = Omit<AbmFrictionPointElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
}

const cardVariants = cva(
  'flex h-full flex-col gap-2 rounded-module-xs border p-5 text-fir-darkfir',
  {
    variants: {
      colorScheme: {
        neutral: 'border-neutral-3 bg-neutral-2',
        white: 'border-neutral-3 bg-primary-1',
      } satisfies Record<NonNullable<DisplaySettingValues['colorScheme']>, string>,
    },
    defaultVariants: { colorScheme: 'neutral' },
  }
)

export default function AbmFrictionPointElement({
  Title,
  Description,
  displaySettings,
}: Props) {
  const { numbering, colorScheme } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  // `Title` names the friction point; a description with nothing to name is not a card.
  if (!Title) return null

  /*
   * `||`, not `??`, and not a bare equality test. `numbering` drives whether an element is
   * rendered at all, so it cannot go through cva — but it must resolve a missing value the
   * way cva resolves one, or this card would disagree with its own `colorScheme`. cva reads
   * `falsyToString(prop) || falsyToString(defaultVariants[k])`, so BOTH an absent key and an
   * empty string fall back to the repo default; `||` reproduces that exactly.
   * `display-defaults.ts` normally supplies the default before we are called, and this keeps
   * a renderer handed a raw array (a preview, a test) behaving identically.
   *
   * Either branch is self-consistent for the counter: a card that shows no ordinal also
   * carries no `counter-increment`, so it never consumes a number it does not display.
   */
  const showOrdinal = (numbering || 'large_numbers') === 'large_numbers'

  return (
    <article className={cardVariants({ colorScheme })}>
      {showOrdinal && (
        <span
          aria-hidden
          className="block text-body-xl font-semibold tabular-nums text-tertiary-lightfir [counter-increment:abm-friction] before:[content:counter(abm-friction,decimal-leading-zero)]"
        />
      )}
      <EditableField
        field="Title"
        as="h3"
        className="text-body-med font-semibold leading-snug"
      >
        {Title}
      </EditableField>
      {Description && (
        <EditableField
          field="Description"
          as="p"
          className="text-body-xs leading-relaxed text-neutral-7"
        >
          {Description}
        </EditableField>
      )}
    </article>
  )
}
