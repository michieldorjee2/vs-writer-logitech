import { lazy, Suspense, type ReactNode } from 'react'
import type { AnimationMode } from './types'

// Defers the motion/extrusion layers (and the motion runtime) to a client-only
// chunk. Until that chunk loads, the Suspense fallback renders the plain text
// passed by the server component, so the heading is present in the initial HTML
// and on first paint -- the animation enhances it in place once hydrated.
const StackedText = lazy(() =>
  import('./stacked-text').then((mod) => ({ default: mod.StackedText }))
)

interface StackedTextIslandProps {
  text: string
  animationMode: AnimationMode
  extrusionCount: number
  children: ReactNode
}

export function StackedTextIsland({
  text,
  animationMode,
  extrusionCount,
  children,
}: StackedTextIslandProps) {
  return (
    <Suspense fallback={children}>
      <StackedText
        text={text}
        animationMode={animationMode}
        extrusionCount={extrusionCount}
      />
    </Suspense>
  )
}
