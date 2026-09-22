/**
 * Callout — a port of upstream `components/block/callout-block/index.tsx`.
 *
 * The variant table, the chip, the container classes and the `default`-fallback rule are
 * upstream's, unchanged. Three things differ, and all three follow from decisions already
 * recorded rather than from taste:
 *
 * 1. `CalloutText` IS PLAIN TEXT. Upstream selects `CalloutText { html }` and injects it with
 *    `dangerouslySetInnerHTML`; `format: 'richText'` cannot be created through the CMS API
 *    (COMPONENT-SPEC hard rule 2), so ours is a bare long `string` and React escapes it. That
 *    is also RENDERER-SPEC's rule: no `dangerouslySetInnerHTML` on a scalar. `whitespace-pre-line`
 *    is what replaces the lost `<p>` tags — an authored blank line still reads as a paragraph
 *    break instead of collapsing into one run-on line.
 *
 * 2. `CalloutHeading` is ours (see DIVERGENCE.md); upstream has no heading property. It is set
 *    in the brand headline face above the body, inside the same variant colour, and the
 *    component still renders correctly with only one of the two fields present. The early
 *    return therefore fires when BOTH are empty rather than on `CalloutText` alone — upstream's
 *    `if (!html) return null` is the same rule applied to the only field upstream has.
 *
 * 3. THE ICON IS LUCIDE, NOT `MaterialIcon`. Upstream draws `do_not_disturb_on` / `error` /
 *    `info` as Material Symbols ligatures. The `material-symbols-rounded` webfont is NOT
 *    loaded anywhere in this app — not in `index.html`, not in any stylesheet — so
 *    `MaterialIcon` would render the literal word "error" in a 24px box. The three lucide
 *    glyphs below are the same three symbols, in the same 24px chip, at the same 20px size and
 *    the same colour. If the Material Symbols font is ever added to `index.html`, swapping
 *    back to `MaterialIcon` is a four-line change.
 *
 * `display-settings.ts` declares this template with an EMPTY settings array (copied from
 * upstream, which varies the block by its `CalloutType` PROPERTY, not by a display setting),
 * so there is nothing to read out of `displaySettings`.
 */
import { CircleAlert, CircleMinus, Info, type LucideIcon } from 'lucide-react'
import { EditableField } from '@/lib/optimizely/features/draft'
import { cn } from '@/lib/utils'
import type { CalloutBlockProps, CalloutType } from './types'

const VARIANT_STYLES: Record<
  CalloutType,
  { border: string; text: string; iconBg: string; icon: LucideIcon | null }
> = {
  error: {
    border: 'border-(--color-tertiary-darkpink)',
    text: 'text-(--color-tertiary-darkpink)',
    iconBg: 'bg-(--color-tertiary-ltpink)',
    icon: CircleMinus,
  },
  warning: {
    border: 'border-(--color-tertiary-lightfir)',
    text: 'text-(--color-tertiary-midfir)',
    iconBg: 'bg-(--color-primary-lfgreen)',
    icon: CircleAlert,
  },
  info: {
    border: 'border-(--color-tertiary-darkblue)',
    text: 'text-(--color-tertiary-darkblue)',
    iconBg: 'bg-(--color-secondary-ltblue)',
    icon: Info,
  },
  default: {
    border: 'border-(--color-tertiary-5)',
    text: 'text-(--color-tertiary-7)',
    iconBg: '',
    icon: null,
  },
}

const VARIANTS = Object.keys(VARIANT_STYLES) as CalloutType[]

function CalloutIcon({ variant }: { variant: CalloutType }) {
  const { iconBg, icon: Icon } = VARIANT_STYLES[variant]
  if (!Icon) return null

  return (
    <div
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-(--radius-4xs)',
        iconBg
      )}
    >
      <Icon
        className="size-5 text-(--color-tertiary-midfir)"
        strokeWidth={2.25}
        aria-hidden="true"
      />
    </div>
  )
}

export default function CalloutBlock({
  CalloutType: calloutType,
  CalloutHeading,
  CalloutText,
}: CalloutBlockProps) {
  const heading = CalloutHeading?.trim()
  const text = CalloutText?.trim()

  if (!heading && !text) return null

  // Upstream's rule, verbatim in behaviour: anything outside the four styled variants —
  // including the `success` / `promo` values an older authoring pass may have stored — falls
  // through to the neutral treatment rather than rendering unstyled.
  const variant: CalloutType = VARIANTS.includes(calloutType as CalloutType)
    ? (calloutType as CalloutType)
    : 'default'

  const { border, text: textColor } = VARIANT_STYLES[variant]

  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border-2 bg-(--color-primary-1) py-6 pr-16 pl-6',
        border,
        textColor
      )}
    >
      <CalloutIcon variant={variant} />
      <div className="min-h-px min-w-px flex-1">
        {heading ? (
          <EditableField
            as="p"
            field="CalloutHeading"
            className="font-headline text-body-lg leading-tight font-(--font-weight-headline-extrabold)"
          >
            {heading}
          </EditableField>
        ) : null}
        {text ? (
          <EditableField
            as="div"
            field="CalloutText"
            className={cn(
              'font-body text-body-s leading-6 whitespace-pre-line',
              heading && 'mt-2'
            )}
          >
            {text}
          </EditableField>
        ) : null}
      </div>
    </div>
  )
}
