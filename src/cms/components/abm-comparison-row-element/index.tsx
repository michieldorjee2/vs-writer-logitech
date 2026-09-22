/**
 * ABM · Comparison Row — ONE row of a comparison table, rendered as ONE element node.
 *
 * THE ALIGNMENT CONTRACT. N of these stack inside a single column to form a table, and no
 * row can see its siblings: there is no `<table>`, no `<colgroup>`, no shared context, and
 * `EditableBlock` even inserts a wrapper `<div>` around each node in edit mode, so
 * `:first-child` / `:last-child` are not reliable either. Columns therefore line up for
 * exactly one reason — every row applies the SAME grid template, the SAME horizontal padding
 * and the SAME border widths, unconditionally. Three rules follow, and breaking any one of
 * them is the visual defect this component exists to avoid:
 *
 *   1. `GRID_TEMPLATE` is in the cva BASE string, never in a variant. No display setting may
 *      change the column template, the padding or a border WIDTH.
 *   2. The `emphasis` accent is a border COLOUR on a left border that every row carries at
 *      `border-l-4`; the default row paints it `transparent`. A row that only grew a border
 *      when highlighted would shift its own columns 4px out of line with its neighbours.
 *   3. All three cells are always emitted, even when empty, so the competitor verdict cannot
 *      slide into the "ours" column when `OurValue` is absent. The placeholder is
 *      `hidden md:block`: `display:none` removes an element from grid placement entirely, so
 *      it holds its column at md+ and adds no stray gap in the stacked mobile layout.
 *
 * There is no header row, and one cannot be synthesised here — `isFirst` is true only when a
 * row happens to be the first element in its column, which the blueprint does not guarantee.
 * Each cell is self-labelling instead: the verdict renders as an icon PLUS its word, and a
 * small side label ("Ours" / "Competitor") is visible while the row is stacked and drops to
 * `sr-only` at md+, where column position carries the same meaning.
 *
 * Icons are `lucide-react`, not `MaterialIcon`. The vendored `MaterialIcon` needs the
 * Material Symbols webfont, which this app does not load (see index.html) — it would print
 * the literal ligature text "check_circle". `lucide-react` ships real SVG and is already
 * used by the vendored `_ui` primitives.
 */
import { cva } from 'class-variance-authority'
import { CircleCheck, CircleMinus, CircleX, type LucideIcon } from 'lucide-react'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import { EditableField } from '@/lib/optimizely/features/draft'
import { cn } from '@/lib/utils'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import type {
  AbmComparisonRowElementProps,
  AbmComparisonVerdict,
} from './types'

/**
 * `display-settings.ts` is annotated `RepoDisplayTemplate[]`, which widens `options` to
 * `{value: string}[]` and throws the literals away, so `ExtractDisplaySettingValues` cannot
 * recover them. Restated here so the `satisfies` clauses below still make a missing variant
 * a compile error.
 */
type DisplaySettingValues = {
  valueDisplay?: 'icon' | 'iconOnly' | 'text'
  colorScheme?: 'neutral' | 'white'
  emphasis?: 'default' | 'highlighted'
}

/**
 * `types.ts` declares `displaySettings?: Record<string, string>` (the shape COMPONENT-SPEC.md
 * prescribes for all 27 folders). Graph actually delivers an ARRAY of `{key, value}` — see
 * RENDERER-SPEC.md and every vendored `types.ts`, e.g. `blank-section/types.ts`. Corrected at
 * this boundary because `types.ts` is outside this task's write scope; reported upward.
 */
type Props = Omit<AbmComparisonRowElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
}

/** The one template every row shares. Never varied by a display setting. */
const GRID_TEMPLATE =
  'grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-y-0'

const rowVariants = cva(
  cn(
    GRID_TEMPLATE,
    'w-full border-b border-l-4 px-5 py-4 text-fir-darkfir md:px-6'
  ),
  {
    variants: {
      colorScheme: {
        neutral: 'border-neutral-4 bg-neutral-2',
        white: 'border-neutral-3 bg-primary-1',
      } satisfies Record<NonNullable<DisplaySettingValues['colorScheme']>, string>,
      emphasis: {
        default: 'border-l-transparent',
        highlighted: 'border-l-tertiary-lightfir',
      } satisfies Record<NonNullable<DisplaySettingValues['emphasis']>, string>,
    },
    defaultVariants: { colorScheme: 'neutral', emphasis: 'default' },
  }
)

/**
 * Ordinal, not decorative: deep fir for a win, teal for a partial, dark pink for a miss. The
 * brand greens fail contrast on a light surface, so `tertiary-lightfir` (the 27%-lightness
 * fir) carries "Yes" rather than `lfgreen`.
 */
const VERDICT = {
  Yes: { Icon: CircleCheck, tone: 'text-tertiary-lightfir' },
  No: { Icon: CircleX, tone: 'text-tertiary-darkpink' },
  Limited: { Icon: CircleMinus, tone: 'text-tertiary-darkblue' },
} satisfies Record<AbmComparisonVerdict, { Icon: LucideIcon; tone: string }>

interface VerdictCellProps {
  /** Visible while stacked, `sr-only` at md+ where the column position says the same thing. */
  sideLabel: string
  value?: AbmComparisonVerdict
  detail?: string
  valueField: string
  detailField: string
  valueDisplay: DisplaySettingValues['valueDisplay']
}

function VerdictCell({
  sideLabel,
  value,
  detail,
  valueField,
  detailField,
  valueDisplay,
}: VerdictCellProps) {
  const verdict = value ? VERDICT[value] : undefined
  // Tested against the two non-default values, so an absent or cleared `valueDisplay` lands
  // on `icon` — the same fallback cva applies to `colorScheme` and `emphasis` on the row.
  const showIcon = valueDisplay !== 'text' && Boolean(verdict)
  const showWord = valueDisplay !== 'iconOnly' && Boolean(value)
  const showDetail = valueDisplay !== 'iconOnly' && Boolean(detail)

  // Rule 3: hold the column rather than collapsing it.
  if (!verdict && !showDetail) {
    return <div aria-hidden className="hidden md:block" />
  }

  const Icon = verdict?.Icon

  return (
    <div className="min-w-0">
      <span className="block text-body-4xs font-medium uppercase tracking-[0.14em] text-neutral-7 md:sr-only">
        {sideLabel}
      </span>
      {value && (
        <EditableField
          field={valueField}
          as="span"
          className={cn(
            'mt-1 inline-flex items-center gap-2 text-body-xs font-medium md:mt-0',
            verdict?.tone
          )}
        >
          {showIcon && Icon && <Icon aria-hidden className="size-5 shrink-0" />}
          {showWord ? value : <span className="sr-only">{value}</span>}
        </EditableField>
      )}
      {showDetail && (
        <EditableField
          field={detailField}
          as="p"
          className="mt-1 text-body-xxs leading-relaxed text-neutral-7"
        >
          {detail}
        </EditableField>
      )}
    </div>
  )
}

export default function AbmComparisonRowElement({
  Category,
  OurValue,
  OurDetail,
  CompetitorValue,
  CompetitorDetail,
  displaySettings,
}: Props) {
  const { valueDisplay, colorScheme, emphasis } =
    parseDisplaySettings<DisplaySettingValues>(displaySettings)

  // `Category` is the row label; without it the row has nothing to compare against.
  if (!Category) return null

  return (
    <div className={rowVariants({ colorScheme, emphasis })}>
      <EditableField
        field="Category"
        as="div"
        className={cn(
          'min-w-0 text-body-s leading-snug',
          emphasis === 'highlighted' ? 'font-semibold' : 'font-medium'
        )}
      >
        {Category}
      </EditableField>
      <VerdictCell
        sideLabel="Ours"
        value={OurValue}
        detail={OurDetail}
        valueField="OurValue"
        detailField="OurDetail"
        valueDisplay={valueDisplay}
      />
      <VerdictCell
        sideLabel="Competitor"
        value={CompetitorValue}
        detail={CompetitorDetail}
        valueField="CompetitorValue"
        detailField="CompetitorDetail"
        valueDisplay={valueDisplay}
      />
    </div>
  )
}
