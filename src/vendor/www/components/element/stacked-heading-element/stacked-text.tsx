import { useRef, useMemo } from 'react'
import { motion, useTransform, type MotionValue } from 'framer-motion'
import { cn } from '../../../lib/utils'
import type { StackedTextProps, AnimationMode } from './types'
import {
  useStackedAnimation,
  getExtrusionColors,
  getMiddleLayerIndex,
  useScaledLayerOffset,
  FACING_INTENSITY,
  DEFAULT_EXTRUSION_COUNT,
} from './use-stacked-animation'

interface LayerProps {
  text: string
  color: string
  layerIndex: number
  depthFromMiddle: number
  maxDepth: number
  isTopLayer: boolean
  isFirstLayer: boolean
  isMiddleLayer: boolean
  inputX: MotionValue<number>
  zIndex: number
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  extrusionCount: number
  layerOffset: number
}

function Layer({
  text,
  color,
  layerIndex: _layerIndex,
  depthFromMiddle,
  maxDepth: _maxDepth,
  isTopLayer,
  isFirstLayer: _isFirstLayer,
  isMiddleLayer,
  inputX,
  zIndex,
  animationMode,
  entranceProgress,
  extrusionCount: _extrusionCount,
  layerOffset,
}: LayerProps) {
  const baseOffsetX = depthFromMiddle * layerOffset
  const baseOffsetY = depthFromMiddle * layerOffset * -1

  const layerMax = Math.abs(depthFromMiddle) * layerOffset
  const dampen = (value: number) =>
    layerMax > 0 ? Math.tanh(value / layerMax) * layerMax : 0

  // The full up-right offset is present on first paint (no entrance spread);
  // only the mouse/scroll dynamic offset eases in via entrance progress. Layers
  // share a uniform translate with no per-layer scale, so the extrusion stays
  // parallel and every glyph shifts by the same amount (no perspective skew).
  const x = useTransform(
    [inputX, entranceProgress],
    ([input, progress]: number[]) => {
      if (isMiddleLayer) return 0
      if (animationMode === 'none') return dampen(baseOffsetX)
      const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY
      return dampen(baseOffsetX + dynamicOffset * progress)
    }
  )

  const y = isMiddleLayer ? 0 : dampen(baseOffsetY)

  return (
    <motion.span
      className={cn(
        'inline-block whitespace-pre-wrap',
        isMiddleLayer ? 'relative' : 'absolute inset-0',
        !isTopLayer && 'pointer-events-none select-none'
      )}
      style={{
        color,
        x,
        y,
        zIndex,
        WebkitTextStroke: '0.025em var(--color-fir-darkfir)',
        paintOrder: 'stroke fill',
      }}
      aria-hidden={!isTopLayer}
    >
      {text}
    </motion.span>
  )
}

export function StackedText({
  text,
  animationMode = 'mouse',
  extrusionCount = DEFAULT_EXTRUSION_COUNT,
}: StackedTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  const { entranceProgress, inputX } = useStackedAnimation(
    containerRef,
    animationMode
  )

  const layerOffset = useScaledLayerOffset(containerRef)

  const colors = useMemo(
    () => getExtrusionColors(extrusionCount),
    [extrusionCount]
  )
  const middleLayerIndex = useMemo(
    () => getMiddleLayerIndex(extrusionCount),
    [extrusionCount]
  )
  // Maximum depth from middle (for outermost layers)
  const maxDepth = Math.max(
    middleLayerIndex,
    colors.length - 1 - middleLayerIndex
  )

  return (
    <span ref={containerRef} className="relative inline-block">
      {colors.map((color, index) => {
        const depthFromMiddle = index - middleLayerIndex
        const zIndex = 10 + depthFromMiddle
        return (
          <Layer
            key={index}
            text={text}
            color={color}
            layerIndex={index}
            depthFromMiddle={depthFromMiddle}
            maxDepth={maxDepth}
            isTopLayer={index === colors.length - 1}
            isFirstLayer={index === 0}
            isMiddleLayer={index === middleLayerIndex}
            inputX={inputX}
            zIndex={zIndex}
            animationMode={animationMode}
            entranceProgress={entranceProgress}
            extrusionCount={extrusionCount}
            layerOffset={layerOffset}
          />
        )
      })}
    </span>
  )
}
