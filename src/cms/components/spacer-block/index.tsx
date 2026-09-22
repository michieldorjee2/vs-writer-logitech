/**
 * Spacer — a faithful port of upstream `components/block/spacer-block/index.tsx`.
 *
 * The four props are PIXEL COUNTS, not tokens (see `content-type.ts` for why), and the
 * cascade is upstream's: an omitted breakpoint inherits the next smaller one at render time,
 * which is what the `?? ?? ??` chains below express. They are copied verbatim.
 *
 * `display-settings.ts` declares this template with an EMPTY settings array — the block
 * takes its whole appearance from its four space props — so there is nothing to read out of
 * `displaySettings` and `parseDisplaySettings` is deliberately not called.
 *
 * Two deliberate departures from upstream, both invisible when the block is authored:
 *
 *   - the early `return null`. Upstream always paints a div, which with no props set is a
 *     0px-high `aria-hidden` box. RENDERER-SPEC asks for `null` over an empty shell, and the
 *     two render identically, so nothing is lost. `== null` rather than a falsy test, because
 *     an authored `0` is a value.
 *   - `w-full shrink-0`. A Column is `flex flex-col`, so a fixed-height child is a shrinkable
 *     flex item; `shrink-0` stops a spacer being the thing that collapses if a column is ever
 *     height-constrained. Upstream's column is flex too, so this is a hardening, not a
 *     restyle — the computed height is the same in every case that renders today.
 */
import type { CSSProperties } from 'react'
import type { SpacerBlockProps } from './types'

export default function SpacerBlock({
  SpaceDefault,
  SpaceMd,
  SpaceLg,
  SpaceXl,
}: SpacerBlockProps) {
  if (
    SpaceDefault == null &&
    SpaceMd == null &&
    SpaceLg == null &&
    SpaceXl == null
  ) {
    return null
  }

  const style = {
    '--space-default': `${SpaceDefault ?? 0}px`,
    '--space-md': `${SpaceMd ?? SpaceDefault ?? 0}px`,
    '--space-lg': `${SpaceLg ?? SpaceMd ?? SpaceDefault ?? 0}px`,
    '--space-xl': `${SpaceXl ?? SpaceLg ?? SpaceMd ?? SpaceDefault ?? 0}px`,
  } as CSSProperties

  return (
    <div
      style={style}
      className="h-(--space-default) w-full shrink-0 md:h-(--space-md) lg:h-(--space-lg) xl:h-(--space-xl)"
      aria-hidden="true"
    />
  )
}
