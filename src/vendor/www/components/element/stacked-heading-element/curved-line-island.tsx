import { lazy, Suspense, type ReactNode } from 'react'
import type { AnimationMode, TextPart } from './types'

// Curved text needs client-side glyph measurement, so it can't be server
// rendered. Until the chunk loads, the Suspense fallback renders the plain
// (flat) text passed by the server component, keeping the heading present on
// first paint; it reflows into the arc once hydrated.
const CurvedLine = lazy(() =>
  import('./curved-line').then((mod) => ({ default: mod.CurvedLine }))
)

interface CurvedLineIslandProps {
  parts: TextPart[]
  animationMode: AnimationMode
  arcAmount: number
  extrusionCount: number
  children: ReactNode
}

export function CurvedLineIsland({
  parts,
  animationMode,
  arcAmount,
  extrusionCount,
  children,
}: CurvedLineIslandProps) {
  return (
    <Suspense fallback={children}>
      <CurvedLine
        parts={parts}
        animationMode={animationMode}
        arcAmount={arcAmount}
        extrusionCount={extrusionCount}
      />
    </Suspense>
  )
}
