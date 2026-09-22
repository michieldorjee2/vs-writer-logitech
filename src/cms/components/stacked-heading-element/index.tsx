/**
 * StackedHeadingElement — the brand extrusion mechanic.
 *
 * Ported from optimizely.com `components/element/stacked-heading-element`, which is FIVE
 * files upstream: `index.tsx`, `stacked-text.tsx`, `curved-line.tsx`,
 * `use-stacked-animation.ts` and `types.ts`. None of them is vendored under
 * `src/vendor/opticom/` — the vendored slice stops at `_ui`, `icon-element`, `row`, `column`
 * and `blank-section` — so the engine is inlined here rather than imported. Four of the five
 * upstream files land in this one, because this task may only write `index.tsx`: the layer
 * geometry, the colour ramp, the animation hook, the flat renderer and the curved renderer
 * are all below, in upstream's order, with upstream's constants.
 *
 * WHAT CHANGED, AND WHY (everything else is upstream, line for line):
 *
 *   1. `motion/react` -> `framer-motion`. The `motion` package is not installed here;
 *      framer-motion v12 is, and `motion/react` is a re-export of it. Same swap
 *      `src/vendor/opticom/components/_ui/accordion` carries as a recorded patch.
 *
 *   2. `Text` is a plain `string`, not upstream's `RichText` object — see DIVERGENCE.md. So
 *      `parseRichTextHtml()` is gone entirely: there is no markup to strip, no entities to
 *      decode, and NO ALIGNMENT TO INFER. Upstream reads `text-align` out of the stored HTML
 *      and passes it down; a bare string cannot carry that. `alignment` therefore has no
 *      default here and emits no class when absent, so a centred column centres the heading
 *      by inheritance instead of being overridden by a hard `text-left`. The `##phrase##`
 *      markers and the newline-per-line convention are untouched.
 *
 *   3. `--color-extrusion-9` DOES NOT EXIST. The Figma token set stops at `extrusion-8`, both
 *      here and upstream (`tokens/TailwindCSS/Default.json`), but both display templates offer
 *      a `layers_9` option, so upstream's deepest layer renders with an unresolved custom
 *      property. The ramp below gives that one entry a `var(…, var(--color-fir-midfir))`
 *      fallback so `layers_9` degrades to the darkest fir rather than to inherited colour.
 *
 *   4. The font-size ladder. Upstream is `text-5xl md:text-7xl lg:text-9xl`, which on
 *      optimizely.com resolves to 32 / 40 / 56px off the token scale. Here `src/index.css`
 *      clears `--text-5xl` from the theme on purpose (a documented collision with the app's
 *      own 10px-root ramp), so `.text-5xl` falls back to `tailwind.config.js`'s 4.8rem = 48px
 *      and the ladder would SHRINK from 48px to 40px at `md`. `text-body-xxl` is the token
 *      that still carries 32px, so the ladder below is `text-body-xxl md:text-7xl lg:text-9xl`
 *      — the same three rendered sizes optimizely.com ships, every one of them a token.
 *
 * The heading renders no wrapper element of its own, exactly as upstream: it is the `Tag`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type {
  AnimationMode,
  HeadingLevel,
  StackedHeadingElementProps,
} from './types'

// ---------------------------------------------------------------------------
// types.ts — the members this folder's own types.ts does not declare
// ---------------------------------------------------------------------------

export type TextAlignment = 'left' | 'center' | 'right'

export interface TextPart {
  type: 'text' | 'stacked'
  content: string
}

export interface StackedHeadingProps {
  text: string
  /**
   * Wider than this folder's `HeadingLevel`, which the CMS `selectOne` narrows to h1–h4.
   * Upstream's own union also carries `span`, and the blockquote treatment needs it: an
   * extruded quote mark is decoration and must not enter the page outline as a heading.
   */
  as?: HeadingLevel | 'span' | 'div'
  className?: string
  animationMode?: AnimationMode
  /**
   * No default, unlike upstream. A bare-string `Text` carries no `text-align`, so an absent
   * alignment emits no class and the column's own alignment is inherited.
   */
  alignment?: TextAlignment
  curved?: boolean
  arcAmount?: number
  extrusionCount?: number
  invertExtrusion?: boolean
}

export interface StackedTextProps {
  text: string
  animationMode?: AnimationMode
  extrusionCount?: number
  invertExtrusion?: boolean
}

/** The values this folder's `display-settings.ts` can hand back, after parsing. */
interface DisplaySettingValues extends Record<string, unknown> {
  animationMode?: AnimationMode
  curvedText?: string
  arcAmount?: string
  extrusionCount?: string
  invertExtrusion?: string
}

// ---------------------------------------------------------------------------
// use-stacked-animation.ts
// ---------------------------------------------------------------------------

/**
 * All available extrusion colours, darkest to brightest. Entry 9 carries a fallback: the
 * token set stops at 8 (see the header), and `layers_9` would otherwise paint the deepest
 * layer with an unresolved custom property.
 */
const ALL_EXTRUSION_COLORS = [
  'var(--color-extrusion-9, var(--color-fir-midfir))',
  'var(--color-extrusion-8)',
  'var(--color-extrusion-7)',
  'var(--color-extrusion-6)',
  'var(--color-extrusion-5)',
  'var(--color-extrusion-4)',
  'var(--color-extrusion-3)',
  'var(--color-extrusion-2)',
  'var(--color-extrusion-1)',
]

/** Generate extrusion colours based on count (5-9): the brightest N of the ramp. */
export function getExtrusionColors(count: number): string[] {
  const clampedCount = Math.min(9, Math.max(5, count))
  return ALL_EXTRUSION_COLORS.slice(-clampedCount)
}

/** Get middle layer index based on count. */
export function getMiddleLayerIndex(count: number): number {
  return Math.floor(count / 2)
}

const LAYER_OFFSET = 10
const MOUSE_INFLUENCE = 15
const SCROLL_INFLUENCE = 15
const FACING_INTENSITY = 1.25
const DEFAULT_EXTRUSION_COUNT = 5
const MAX_EXTRUSION_COUNT = 9
const MAX_LAYER_DISTANCE = 30
const LAYER_Z_OFFSET = 20
const LAYER_SCALE_FACTOR = 0.02

const SPRING_CONFIG = { stiffness: 80, damping: 8, mass: 0.5 }
const ENTRANCE_SPRING_CONFIG = { stiffness: 60, damping: 12, mass: 0.8 }

function useStackedAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  animationMode: AnimationMode = 'mouse'
) {
  const isInView = useInView(containerRef, {
    once: true,
    margin: '-35% 0px -35% 0px',
  })
  const hasAnimated = useRef(false)

  const entranceValue = useMotionValue(0)
  const entranceProgress = useSpring(entranceValue, ENTRANCE_SPRING_CONFIG)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const smoothMouseX = useSpring(mouseX, SPRING_CONFIG)
  const smoothMouseY = useSpring(mouseY, SPRING_CONFIG)

  const { scrollYProgress } = useScroll()
  const scrollInput = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [SCROLL_INFLUENCE, 0, -SCROLL_INFLUENCE]
  )
  const smoothScrollX = useSpring(scrollInput, SPRING_CONFIG)
  const smoothScrollY = useSpring(scrollInput, SPRING_CONFIG)

  // Trigger entrance animation
  useEffect(() => {
    if (hasAnimated.current) return

    if (isInView) {
      hasAnimated.current = true
      entranceValue.set(1)
      return
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0
      if (isVisible) {
        hasAnimated.current = true
        requestAnimationFrame(() => {
          entranceValue.set(1)
        })
      }
    }
  }, [isInView, entranceValue, containerRef])

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const normalizedX = (e.clientX - centerX) / (window.innerWidth / 2)
      const normalizedY = (e.clientY - centerY) / (window.innerHeight / 2)

      mouseX.set(normalizedX * MOUSE_INFLUENCE)
      mouseY.set(normalizedY * MOUSE_INFLUENCE)
    },
    [mouseX, mouseY, containerRef]
  )

  useEffect(() => {
    if (animationMode !== 'mouse') return

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [animationMode, handleMouseMove])

  const inputX = animationMode === 'scroll' ? smoothScrollX : smoothMouseX
  const inputY = animationMode === 'scroll' ? smoothScrollY : smoothMouseY

  return { entranceValue, entranceProgress, inputX, inputY, mouseX, mouseY }
}

// ---------------------------------------------------------------------------
// stacked-text.tsx
// ---------------------------------------------------------------------------

interface LayerProps {
  text: string
  color: string
  layerIndex: number
  depthFromMiddle: number
  maxDepth: number
  isTopLayer: boolean
  isFirstLayer: boolean
  inputX: MotionValue<number>
  inputY: MotionValue<number>
  zIndex: number
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  invertExtrusion: boolean
  extrusionCount: number
}

function Layer({
  text,
  color,
  layerIndex,
  depthFromMiddle,
  maxDepth,
  isTopLayer,
  isFirstLayer,
  inputX,
  inputY,
  zIndex,
  animationMode,
  entranceProgress,
  invertExtrusion,
  extrusionCount,
}: LayerProps) {
  const directionX = 1
  const directionY = invertExtrusion ? -1 : 1
  const layerOffset = LAYER_OFFSET * (extrusionCount / MAX_EXTRUSION_COUNT)
  const baseOffsetX = depthFromMiddle * layerOffset * directionX
  const baseOffsetY = depthFromMiddle * layerOffset * directionY

  // 3D perspective: top layer is closest and largest, back layers recede
  const layersFromTop = maxDepth * 2 - layerIndex
  const translateZ = -layersFromTop * LAYER_Z_OFFSET
  const scale = 1 + layerIndex * LAYER_SCALE_FACTOR

  const scaledMaxDistance = MAX_LAYER_DISTANCE * (extrusionCount / MAX_EXTRUSION_COUNT)
  const layerMax =
    maxDepth > 0 ? scaledMaxDistance * (Math.abs(depthFromMiddle) / maxDepth) : 0
  // Soft dampening using tanh - asymptotically approaches layerMax
  const dampen = (value: number) =>
    layerMax > 0 ? Math.tanh(value / layerMax) * layerMax : 0

  const x = useTransform([inputX, entranceProgress], ([input, progress]: number[]) => {
    // First layer (back) is static anchor
    if (isFirstLayer) return 0
    const animatedBaseX = baseOffsetX * progress
    if (animationMode === 'none') return dampen(animatedBaseX)
    const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY * directionX
    return dampen(animatedBaseX + dynamicOffset * progress)
  })

  const y = useTransform([inputY, entranceProgress], ([input, progress]: number[]) => {
    // First layer (back) is static anchor
    if (isFirstLayer) return 0
    const animatedBaseY = baseOffsetY * progress
    if (animationMode === 'none') return dampen(animatedBaseY)
    const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY * directionY
    return dampen(animatedBaseY + dynamicOffset * progress)
  })

  return (
    <motion.span
      className={cn(
        'inline-block whitespace-pre',
        isFirstLayer ? 'relative' : 'absolute inset-0',
        !isTopLayer && 'pointer-events-none select-none'
      )}
      style={{
        color,
        x,
        y,
        z: translateZ,
        scale,
        zIndex,
        WebkitTextStroke: '1px var(--color-fir-darkfir)',
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
  invertExtrusion = false,
}: StackedTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  const { entranceProgress, inputX, inputY } = useStackedAnimation(containerRef, animationMode)

  const colors = useMemo(() => getExtrusionColors(extrusionCount), [extrusionCount])
  const middleLayerIndex = useMemo(
    () => getMiddleLayerIndex(extrusionCount),
    [extrusionCount]
  )
  // Maximum depth from middle (for outermost layers)
  const maxDepth = Math.max(middleLayerIndex, colors.length - 1 - middleLayerIndex)

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
            inputX={inputX}
            inputY={inputY}
            zIndex={zIndex}
            animationMode={animationMode}
            entranceProgress={entranceProgress}
            invertExtrusion={invertExtrusion}
            extrusionCount={extrusionCount}
          />
        )
      })}
    </span>
  )
}

// ---------------------------------------------------------------------------
// curved-line.tsx
// ---------------------------------------------------------------------------

interface CharacterInfo {
  char: string
  isStacked: boolean
  rotationDeg: number
}

interface CurveMetrics {
  characters: CharacterInfo[]
  radius: number
  height: number
  verticalOffset: number
}

interface CurvedLineProps {
  parts: TextPart[]
  animationMode: AnimationMode
  arcAmount: number
  extrusionCount?: number
  invertExtrusion?: boolean
}

function CurvedCharacterLayer({
  char,
  rotationDeg,
  radius,
  color,
  layerIndex,
  depthFromMiddle,
  maxDepth,
  zIndex,
  isTopLayer,
  inputX,
  inputY,
  animationMode,
  entranceProgress,
  invertExtrusion,
}: {
  char: string
  rotationDeg: number
  radius: number
  color: string
  layerIndex: number
  depthFromMiddle: number
  maxDepth: number
  zIndex: number
  isTopLayer: boolean
  inputX: MotionValue<number>
  inputY: MotionValue<number>
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  invertExtrusion: boolean
}) {
  const direction = invertExtrusion ? -1 : 1
  const baseOffsetX = depthFromMiddle * LAYER_OFFSET * direction
  const baseOffsetY = depthFromMiddle * LAYER_OFFSET * direction
  const isFirstLayer = layerIndex === 0

  // 3D perspective: top layer is largest, back layers recede
  const scale = 1 + layerIndex * LAYER_SCALE_FACTOR

  // Scale max distance proportionally so all layers dampen at the same rate
  const layerMax =
    maxDepth > 0 ? MAX_LAYER_DISTANCE * (Math.abs(depthFromMiddle) / maxDepth) : 0
  // Soft dampening using tanh - asymptotically approaches layerMax
  const dampen = (value: number) =>
    layerMax > 0 ? Math.tanh(value / layerMax) * layerMax : 0

  const x = useTransform([inputX, entranceProgress], ([input, progress]: number[]) => {
    if (isFirstLayer) return 0
    const animatedBaseX = baseOffsetX * progress
    if (animationMode === 'none') return dampen(animatedBaseX)
    const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY * direction
    return dampen(animatedBaseX + dynamicOffset * progress)
  })

  const y = useTransform([inputY, entranceProgress], ([input, progress]: number[]) => {
    if (isFirstLayer) return 0
    const animatedBaseY = baseOffsetY * progress
    if (animationMode === 'none') return dampen(animatedBaseY)
    const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY * direction
    return dampen(animatedBaseY + dynamicOffset * progress)
  })

  return (
    <span
      className={cn(
        'absolute bottom-0 left-1/2 inline-block origin-bottom',
        !isTopLayer && 'pointer-events-none select-none'
      )}
      style={{
        transform: `translateX(-50%) rotate(${rotationDeg}deg) translateY(-${radius}px)`,
        zIndex,
      }}
      aria-hidden={!isTopLayer}
    >
      <motion.span
        className="inline-block"
        style={{
          color,
          x,
          y,
          scale,
          WebkitTextStroke: '1px var(--color-fir-darkfir)',
          paintOrder: 'stroke fill',
        }}
      >
        {char}
      </motion.span>
    </span>
  )
}

function CurvedCharacter({
  char,
  rotationDeg,
  radius,
  isStacked,
  inputX,
  inputY,
  animationMode,
  entranceProgress,
  colors,
  middleLayerIndex,
  maxDepth,
  invertExtrusion,
}: {
  char: string
  rotationDeg: number
  radius: number
  isStacked: boolean
  inputX: MotionValue<number>
  inputY: MotionValue<number>
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  colors: string[]
  middleLayerIndex: number
  maxDepth: number
  invertExtrusion: boolean
}) {
  if (isStacked) {
    return (
      <>
        {colors.map((color, layerIndex) => {
          const depthFromMiddle = layerIndex - middleLayerIndex
          const zIndex = 10 + depthFromMiddle
          const isTopLayer = layerIndex === colors.length - 1

          return (
            <CurvedCharacterLayer
              key={layerIndex}
              char={char}
              rotationDeg={rotationDeg}
              radius={radius}
              color={color}
              layerIndex={layerIndex}
              depthFromMiddle={depthFromMiddle}
              maxDepth={maxDepth}
              zIndex={zIndex}
              isTopLayer={isTopLayer}
              inputX={inputX}
              inputY={inputY}
              animationMode={animationMode}
              entranceProgress={entranceProgress}
              invertExtrusion={invertExtrusion}
            />
          )
        })}
      </>
    )
  }

  // Non-stacked character - single layer, dark color
  return (
    <span
      className="text-fir-darkfir absolute bottom-0 left-1/2 z-10 inline-block origin-bottom"
      style={{
        transform: `translateX(-50%) rotate(${rotationDeg}deg) translateY(-${radius}px)`,
      }}
    >
      {char}
    </span>
  )
}

export function CurvedLine({
  parts,
  animationMode = 'mouse',
  arcAmount = 0.35,
  extrusionCount = DEFAULT_EXTRUSION_COUNT,
  invertExtrusion = false,
}: CurvedLineProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const measurerRef = useRef<HTMLSpanElement>(null)
  const [curveMetrics, setCurveMetrics] = useState<CurveMetrics | null>(null)
  const prevArcAmount = useRef(arcAmount)

  const fullText = useMemo(() => parts.map((p) => p.content).join(''), [parts])

  const stackedIndices = useMemo(() => {
    const indices = new Set<number>()
    let currentIndex = 0
    for (const part of parts) {
      if (part.type === 'stacked') {
        for (let i = 0; i < part.content.length; i++) {
          indices.add(currentIndex + i)
        }
      }
      currentIndex += part.content.length
    }
    return indices
  }, [parts])

  const colors = useMemo(() => getExtrusionColors(extrusionCount), [extrusionCount])
  const middleLayerIndex = useMemo(
    () => getMiddleLayerIndex(extrusionCount),
    [extrusionCount]
  )
  const maxDepth = Math.max(middleLayerIndex, colors.length - 1 - middleLayerIndex)

  const { entranceValue, entranceProgress, inputX, inputY, mouseX, mouseY } =
    useStackedAnimation(containerRef, animationMode)

  // Reset all spring animations when arcAmount changes to prevent lag
  useEffect(() => {
    if (prevArcAmount.current !== arcAmount) {
      prevArcAmount.current = arcAmount
      entranceValue.jump(1)
      mouseX.jump(0)
      mouseY.jump(0)
    }
  }, [arcAmount, entranceValue, mouseX, mouseY])

  const measureCharacters = useCallback(() => {
    const measurer = measurerRef.current
    if (!measurer) return

    const chars = [...fullText]
    const widths: number[] = []

    const tempSpan = document.createElement('span')
    tempSpan.style.cssText = 'visibility: hidden; white-space: pre;'
    measurer.appendChild(tempSpan)

    for (const char of chars) {
      tempSpan.textContent = char
      widths.push(tempSpan.offsetWidth)
    }

    measurer.removeChild(tempSpan)

    const totalWidth = widths.reduce((sum, w) => sum + w, 0)
    const radius = totalWidth / (2 * Math.PI * arcAmount)

    let runningAngle = 0
    const totalAngle = widths.reduce((sum, w) => sum + w / radius, 0)
    const startOffset = -totalAngle / 2

    const characters: CharacterInfo[] = chars.map((char, i) => {
      const width = widths[i]
      const angle = width / radius
      const halfAngle = angle / 2
      const charAngle = startOffset + runningAngle + halfAngle
      runningAngle += angle

      return {
        char,
        isStacked: stackedIndices.has(i),
        rotationDeg: (charAngle * 180) / Math.PI,
      }
    })

    const maxAngle = totalAngle / 2

    // Calculate arc vertical extent
    const arcBottom = radius * Math.cos(maxAngle)
    const arcTop = radius
    const arcHeight = arcTop - arcBottom

    // Container height: arc height + text line height buffer
    const textHeight = 120
    const height = arcHeight + textHeight

    // Calculate vertical offset to center the arc in the container
    const arcCenter = (arcTop + arcBottom) / 2
    const verticalOffset = height / 2 - arcCenter

    setCurveMetrics({ characters, radius, height, verticalOffset })
  }, [fullText, arcAmount, stackedIndices])

  useEffect(() => {
    if (!measurerRef.current) return

    let cancelled = false

    const runMeasurement = () => {
      if (!cancelled) {
        measureCharacters()
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(runMeasurement)
    } else {
      runMeasurement()
    }

    return () => {
      cancelled = true
    }
  }, [measureCharacters])

  return (
    <span
      ref={containerRef}
      className="relative inline-block"
      style={{ ...(curveMetrics ? { height: curveMetrics.height } : {}) }}
    >
      {/* Hidden measurer text */}
      <span
        ref={measurerRef}
        className="inline-block whitespace-pre opacity-0"
        aria-hidden="true"
      >
        {fullText}
      </span>

      {/* Curved characters - wrapped with vertical offset for centering */}
      {curveMetrics && (
        <span
          className="absolute right-0 left-0"
          style={{ bottom: curveMetrics.verticalOffset }}
        >
          {curveMetrics.characters.map((charInfo, i) => (
            <CurvedCharacter
              key={i}
              char={charInfo.char}
              rotationDeg={charInfo.rotationDeg}
              radius={curveMetrics.radius}
              isStacked={charInfo.isStacked}
              inputX={inputX}
              inputY={inputY}
              animationMode={animationMode}
              entranceProgress={entranceProgress}
              colors={colors}
              middleLayerIndex={middleLayerIndex}
              maxDepth={maxDepth}
              invertExtrusion={invertExtrusion}
            />
          ))}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// index.tsx
// ---------------------------------------------------------------------------

/** `Some ##phrase## here` -> flat / stacked / flat. Upstream's parser, unchanged. */
function parseStackedText(text: string): TextPart[] {
  const regex = /##(.+?)##/g
  const parts: TextPart[] = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'stacked', content: match[1] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return parts
}

const ALIGNMENT_CLASSES: Record<TextAlignment, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

/**
 * The heading itself, exported so a sibling treatment can reuse the extrusion mechanic the
 * way upstream's `blockquote-block` does (`<StackedHeading text='##"##' … />`).
 */
export function StackedHeading({
  text,
  as = 'h1',
  className,
  animationMode = 'mouse',
  alignment,
  curved = false,
  arcAmount = 0.3,
  extrusionCount = 5,
  invertExtrusion = false,
}: StackedHeadingProps) {
  const lines = text.split('\n').filter((line) => line.trim() !== '')
  const Tag = as as ElementType

  return (
    <Tag
      className={cn(
        'font-nudge text-fir-darkfir text-body-xxl leading-[0.9] font-extrabold tracking-[-0.01em] md:text-7xl lg:text-9xl',
        alignment && ALIGNMENT_CLASSES[alignment],
        className
      )}
    >
      {lines.map((line, lineIndex) => {
        const parts = parseStackedText(line)

        // When curved, render entire line as CurvedLine
        if (curved) {
          return (
            <span key={lineIndex} className="block">
              <CurvedLine
                parts={parts}
                animationMode={animationMode}
                arcAmount={arcAmount}
                extrusionCount={extrusionCount}
                invertExtrusion={invertExtrusion}
              />
            </span>
          )
        }

        // Normal rendering - stacked text only for ## sections
        return (
          <span key={lineIndex} className="block">
            {parts.map((part, partIndex) =>
              part.type === 'stacked' ? (
                <StackedText
                  key={partIndex}
                  text={part.content}
                  animationMode={animationMode}
                  extrusionCount={extrusionCount}
                  invertExtrusion={invertExtrusion}
                />
              ) : (
                <span key={partIndex} className="relative z-10">
                  {part.content}
                </span>
              )
            )}
          </span>
        )
      })}
    </Tag>
  )
}

/**
 * `types.ts` types `displaySettings` as `Record<string,string>` (COMPONENT-SPEC.md, Phase 0),
 * but the chain hands over Graph's ARRAY of `{key,value}` — `visual-builder.tsx` calls
 * `withContentTypeDefaults()`, which returns an array, and RENDERER-SPEC.md says so plainly.
 * Reported rather than fixed, because `types.ts` is outside this task's write scope. This
 * accepts either shape; `parseDisplaySettings` still does the parsing.
 */
function asDisplaySettings(value: unknown): DisplaySettings | undefined {
  if (Array.isArray(value)) return value as DisplaySettings
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, string>).map(([key, v]) => ({
      key,
      value: v,
    }))
  }
  return undefined
}

export default function StackedHeadingElement({
  Text,
  HeadingLevel,
  displaySettings,
}: StackedHeadingElementProps) {
  const { animationMode, curvedText, arcAmount, extrusionCount, invertExtrusion } =
    parseDisplaySettings<DisplaySettingValues>(asDisplaySettings(displaySettings))

  // Upstream parses `Text.html` here. `Text` is a bare string (DIVERGENCE.md), so the only
  // normalisation left is upstream's own run-collapse: 3+ newlines become a paragraph break.
  const text = Text?.replace(/\n{3,}/g, '\n\n').trim()

  if (!text) return null

  const headingLevel = (HeadingLevel as HeadingLevel) || 'h1'
  const mode = (animationMode as AnimationMode) || 'mouse'
  const curved = curvedText === 'true'
  const arc = arcAmount ? parseInt(arcAmount.replace('arc_', ''), 10) / 100 : 0.3
  const layers = extrusionCount
    ? parseInt(extrusionCount.replace('layers_', ''), 10)
    : DEFAULT_EXTRUSION_COUNT
  const invert = invertExtrusion === 'true'

  return (
    <StackedHeading
      text={text}
      as={headingLevel}
      animationMode={mode}
      curved={curved}
      arcAmount={arc}
      extrusionCount={layers}
      invertExtrusion={invert}
    />
  )
}
