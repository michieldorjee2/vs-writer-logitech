/**
 * One dated headline in an account page's news rail.
 *
 * There is no optimizely.com component to port — this is the element form of the account
 * page's `newsItems` list — so the brief drives it: a compact date + headline + link row
 * that reads as a LIST ITEM, not a card, because account-intel stacks several of them.
 *
 * THE ONE THING THAT MAKES A STACK OF THESE LOOK RIGHT. Each item is its own element node
 * in a column (an `elementEnabled` type cannot hold an array of components), so a rail of
 * five headlines is five independently-rendered siblings and none of them can see the
 * others. Anything that has to line up therefore has to line up by construction:
 *
 *   - The row is a FIXED three-column grid — date, headline, arrow — so every headline in
 *     the rail starts at the same x regardless of how long its neighbour's date is.
 *   - The arrow column is reserved whether or not this item has a `Url`, so an unlinked
 *     item does not widen its headline past a linked one's.
 *   - `tabular-nums` on the date keeps the digits themselves in column.
 *
 * COLOUR IS INHERITED, NOT DECLARED. The two cards beside this one paint their own
 * background and can hardcode a foreground against it. A bare list row cannot: it sits
 * directly on whichever of `BlankSection`'s six background colours the editor chose. So the
 * headline takes `currentColor`, and the date, the arrow and the divider are alpha
 * variations of it — legible on a light and a dark section without knowing which it is.
 *
 * `isFirst` (the chain passes it for the first element in a column) suppresses the divider,
 * so N stacked items draw N-1 rules instead of a stray line above the rail.
 *
 * Nothing reads `displaySettings`: `display-settings.ts` declares the default template with
 * `settings: []`, following the cards it sits beside.
 */
import { MaterialIcon } from '@/components/element/icon-element'
import { cn } from '@/lib/utils'
import type { AbmNewsItemElementProps } from './types'

/**
 * The fixed grid. The date column is a length, not `auto` — `auto` would size to this row's
 * own date and break alignment with its siblings, which is the whole failure mode this
 * component has to design around.
 *
 * The three lengths are spelled `theme(spacing.N)` rather than bare rem literals (5rem,
 * 1.5rem, 7.5rem) because this app's root font-size is rescaled 1.6x (tailwind.config.js's
 * rem-scale-mismatch comment): a literal `5rem` in an arbitrary value renders at 50px here,
 * not the 80px a 16px-root reading of "5rem" means, while `theme(spacing.20)` resolves
 * through that same rescaled theme. `spacing.30` (7.5rem) is a custom step added there for
 * exactly this line — Tailwind's own default scale has no step between 7rem and 8rem.
 */
const ROW =
  'grid grid-cols-[theme(spacing.20)_1fr_theme(spacing.6)] items-baseline gap-x-4 py-4 sm:grid-cols-[theme(spacing.30)_1fr_theme(spacing.6)]'

export default function AbmNewsItemElement({
  NewsDate,
  Headline,
  Url,
  isFirst,
}: AbmNewsItemElementProps & { isFirst?: boolean }) {
  if (!Headline) return null

  const row = (
    <div className={cn(ROW, !isFirst && 'border-t border-current/15')}>
      {/* Printed verbatim: the source publishes at whatever precision it has ("Mar 2026"),
          so this is a display string and not an instant to reformat. */}
      <span className="font-overline text-body-xxs leading-[1.4] tabular-nums text-current/70">
        {NewsDate}
      </span>
      <span className="font-body text-body-s leading-[1.4] font-(--font-weight-body-medium) group-hover:underline underline-offset-4">
        {Headline}
      </span>
      <span className="self-center justify-self-end text-current/60 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-current">
        {Url && <MaterialIcon name="arrow_outward" size="20" />}
      </span>
    </div>
  )

  if (!Url) return row

  return (
    <a
      href={Url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
    >
      {row}
    </a>
  )
}
