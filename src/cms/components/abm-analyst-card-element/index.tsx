/**
 * AbmAnalystCardElement — one analyst or third-party recognition, rendered as a FEATURE ITEM:
 * an icon tile, the recognition as the title (Badge), and who said it and in what as the
 * description (Source · Category). This is the right-hand list of the reports layout in the
 * `analyst-proof` slot (see src/cms/blueprints/abm-takeout.ts).
 *
 * Revised 2026-09-25 from a chip card to this shape at Michiel's direction. Items stack in one
 * column with the column's own gap, so there is no cross-sibling alignment to engineer. On a dark
 * band the icon tile flips via the section's `data-band` (src/cms/rendering/band.ts).
 */
import { ArrowUpRight, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AbmAnalystCardElementProps } from './types'

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


export default function AbmAnalystCardElement({
  Badge,
  Source,
  Category,
  Url,
}: AbmAnalystCardElementProps) {
  // The badge IS the proof point. Without it the card is chrome around nothing.
  if (!Badge) return null


  const href = resolveUrl(Url)

  // A FEATURE ITEM, not a card: icon tile, title, one line of description — the right-hand
  // column of the reports layout. The recognition (Badge) is the title; who said it (Source)
  // and in what (Category) are the description.
  const body = (
    <div className="flex items-start gap-4">
      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-2xl bg-(--color-neutral-2) text-(--color-secondary-darkfir)',
          '[[data-band=dark]_&]:bg-white/10 [[data-band=dark]_&]:text-(--color-primary-lfgreen)'
        )}
        aria-hidden="true"
      >
        <Award size={22} strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          data-epi-edit="Badge"
          className="font-body text-body-lg leading-[1.25] font-(--font-weight-body-medium) text-current"
        >
          {Badge}
          {href && (
            <ArrowUpRight
              aria-hidden="true"
              size={18}
              className="ml-1 inline-block align-baseline opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          )}
        </p>
        <p className="font-body text-body-base leading-[1.45] opacity-75">
          <span data-epi-edit="Source">{Source}</span>
          {Category && (
            <>
              {' · '}
              <span data-epi-edit="Category">{Category}</span>
            </>
          )}
        </p>
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
