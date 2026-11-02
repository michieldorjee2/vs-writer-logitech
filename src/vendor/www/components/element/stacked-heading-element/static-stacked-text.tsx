import type { CSSProperties } from 'react'
import { cn } from '../../../lib/utils'

// Static, server-renderable mirror of the deferred extrusion stack. The
// constants and layer math mirror use-stacked-animation.ts (LAYER_OFFSET=10,
// REFERENCE_FONT_SIZE_PX=120, getExtrusionColors, tanh dampening). They are
// duplicated here rather than imported because that module is 'use client' and
// this renders in server components / as a pre-paint fallback.
const STACK_LAYER_OFFSET_PX = 10
const STACK_REFERENCE_FONT_PX = 120

// extrusion-9 (darkest) -> extrusion-1 (brightest); mirrors ALL_EXTRUSION_COLORS.
const EXTRUSION_COLOR_VARS = [
  'var(--color-extrusion-9)',
  'var(--color-extrusion-8)',
  'var(--color-extrusion-7)',
  'var(--color-extrusion-6)',
  'var(--color-extrusion-5)',
  'var(--color-extrusion-4)',
  'var(--color-extrusion-3)',
  'var(--color-extrusion-2)',
  'var(--color-extrusion-1)',
]

export function staticExtrusionColors(extrusionCount: number): string[] {
  const clamped = Math.min(9, Math.max(5, extrusionCount))
  return EXTRUSION_COLOR_VARS.slice(-clamped)
}

export const STACK_LAYER_STYLE: CSSProperties = {
  WebkitTextStroke: '0.025em var(--color-fir-darkfir)',
  paintOrder: 'stroke fill',
}

// Renders every extrusion layer at its resting offset using pure CSS, so the
// first paint is pixel-identical to the hydrated animation at rest. The client
// island then takes over for mouse/scroll/entrance motion (and, for curved
// headings, morphs this exact flat stack onto the arc). The resting offset per
// layer is tanh(1) * depth * (LAYER_OFFSET / REFERENCE) em, matching the
// dampened motion values exactly.
export function StaticStackedText({
  text,
  extrusionCount,
  className,
}: {
  text: string
  extrusionCount: number
  className?: string
}) {
  const colors = staticExtrusionColors(extrusionCount)
  const topIndex = colors.length - 1

  return (
    <span className={cn('relative inline-block', className)}>
      {colors.map((color, index) => {
        const isAnchor = index === 0
        const isTop = index === topIndex
        const offsetEm =
          (Math.tanh(1) * index * STACK_LAYER_OFFSET_PX) /
          STACK_REFERENCE_FONT_PX
        return (
          <span
            key={index}
            aria-hidden={!isTop}
            className={cn(
              'inline-block whitespace-pre-wrap',
              isAnchor ? 'relative' : 'absolute inset-0',
              !isTop && 'pointer-events-none select-none'
            )}
            style={{
              ...STACK_LAYER_STYLE,
              color,
              zIndex: 10 + index,
              ...(isAnchor
                ? {}
                : {
                    transform: `translate(${offsetEm.toFixed(3)}em, ${(-offsetEm).toFixed(3)}em)`,
                  }),
            }}
          >
            {text}
          </span>
        )
      })}
    </span>
  )
}
