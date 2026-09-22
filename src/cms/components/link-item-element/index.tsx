/**
 * LinkItemElement — one link in a list of links.
 *
 * Upstream has no counterpart to port: optimizely.com's `components/block/link-list-block`
 * is ONE block holding an array of link references, and an array of content is a 400 on an
 * `elementEnabled` type (DIVERGENCE.md). So a list of N links is N of these nodes in one
 * column, and `displayType` — which upstream chooses once for the whole list — now rides on
 * every node and has to be set identically across them.
 *
 * WHAT AN ELEMENT CANNOT DO, and why `horizontal` is shaped the way it is. This component is
 * rendered on its own inside a column and knows nothing about its siblings. The vendored
 * `Column` is `flex flex-1 flex-col`, so a child cannot put itself on the same line as the
 * child before it — no CSS on a flex item overrides its parent's `flex-direction`. The two
 * settings therefore mean:
 *
 *   vertical    a full-width row. Every sibling is full width too, so the labels start and
 *               the arrows end on the same two x-positions without any node knowing about
 *               the others — the fixed internal template, not coordination.
 *   horizontal  shrink-to-content, so the nodes sit side by side AS SOON AS the column is a
 *               row. That is a composition-level choice: set the column's `className`
 *               display setting to `flex-row flex-wrap items-center gap-x-6` on the column
 *               holding the list. Without it the nodes still stack, compactly.
 *
 * Colour is inherited rather than set. Upstream's link list renders a bare `<a>`, and these
 * lists sit in sections whose background the section chose, so inheriting is both faithful
 * and the only thing that survives a `dark_forest` band and a white one.
 */
import { ArrowRight } from 'lucide-react'

import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'

import type { LinkItemElementProps } from './types'

type DisplaySettingValues = {
  displayType: 'vertical' | 'horizontal'
}

/** See the note in `button-block/index.tsx`: Graph delivers `displaySettings` as an array. */
type Props = Omit<LinkItemElementProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

export default function LinkItemElement({ Label, Url, displaySettings }: Props) {
  const { displayType } = parseDisplaySettings<DisplaySettingValues>(displaySettings)

  // `Url` is the required property: upstream falls back to '#', but a link to nowhere in a
  // composition tree is a node that should have been pruned.
  if (!Url) return null

  const label = Label ?? 'Update Link Text'
  const isHorizontal = displayType === 'horizontal'

  return (
    <a
      href={Url}
      data-epi-edit="Label"
      className={cn(
        'group font-body text-body-s inline-flex items-center leading-[1.35] no-underline',
        'underline-offset-4 transition-colors hover:underline',
        'focus-visible:outline-2 focus-visible:outline-offset-2',
        isHorizontal
          ? 'w-auto gap-2 self-start'
          : 'w-full justify-between gap-4 border-b border-(--color-tertiary-7) py-3'
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <ArrowRight
        size={16}
        strokeWidth={2}
        aria-hidden="true"
        className="shrink-0 transition-transform group-hover:translate-x-0.5"
      />
    </a>
  )
}
