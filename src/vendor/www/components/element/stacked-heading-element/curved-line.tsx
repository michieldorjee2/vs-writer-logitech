import {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useMemo,
  useCallback,
} from 'react'
import {
  motion,
  useTransform,
  useMotionValue,
  useSpring,
  useInView,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion'
import { cn } from '../../../lib/utils'
import type { AnimationMode, TextPart } from './types'
import { StaticStackedText } from './static-stacked-text'
import {
  useStackedAnimation,
  getExtrusionColors,
  getMiddleLayerIndex,
  useScaledLayerOffset,
  FACING_INTENSITY,
  DEFAULT_EXTRUSION_COUNT,
} from './use-stacked-animation'

// Curved glyphs advance along the arc by their measured width, so the default
// arc-length between character centers equals each glyph's width. A sub-1 factor
// tightens that advance -- letters move closer without changing glyph size or radius.
const CURVE_TRACKING = 0.95

// Drives the flat -> curved morph on hydrate. The static fallback renders the
// flat text on the server; once measured and in view, every glyph springs from
// its flat line position into the arc (and the extrusion extrudes in with it),
// turning the can't-pre-render limitation into a deliberate entrance.
const MORPH_SPRING = { stiffness: 70, damping: 16, mass: 0.9 }

interface CharacterInfo {
  char: string
  isStacked: boolean
  rotationDeg: number
  // Horizontal centre of the glyph in the flat (un-arced) line, relative to the
  // line centre. The morph interpolates each glyph from here onto the arc.
  flatX: number
}

interface LineCurveMetrics {
  characters: CharacterInfo[]
  radius: number
  height: number
  verticalOffset: number
}

interface CurveMetrics {
  lines: LineCurveMetrics[]
  totalHeight: number
  lineGap: number
  // The natural text line-height (line box). Arc lines are positioned at this
  // spacing so they map onto the invisible flat text's lines, rather than the
  // arc's own (taller) per-line height.
  lineHeight: number
}

interface CurvedLineProps {
  parts: TextPart[]
  animationMode: AnimationMode
  arcAmount: number
  extrusionCount?: number
}

interface CurvedCharacterProps {
  char: string
  rotationDeg: number
  radius: number
  flatX: number
  isStacked: boolean
  inputX: MotionValue<number>
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  morphProgress: MotionValue<number>
  colors: string[]
  middleLayerIndex: number
  maxDepth: number
  layerOffset: number
}

function CurvedCharacter({
  char,
  rotationDeg,
  radius,
  flatX,
  isStacked,
  inputX,
  animationMode,
  entranceProgress,
  morphProgress,
  colors,
  middleLayerIndex,
  maxDepth,
  layerOffset,
}: CurvedCharacterProps) {
  // Shared by every extrusion layer of this glyph: at progress 0 the glyph sits
  // at its flat line position (rotation/radius zeroed, slid out to flatX); at
  // progress 1 it is fully placed on the arc.
  const outerTransform = useTransform(
    morphProgress,
    (p) =>
      `translateX(-50%) translate(${(flatX * (1 - p)).toFixed(2)}px, 0px) rotate(${(rotationDeg * p).toFixed(3)}deg) translateY(${(-radius * p).toFixed(2)}px)`
  )

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
              color={color}
              depthFromMiddle={depthFromMiddle}
              maxDepth={maxDepth}
              zIndex={zIndex}
              isTopLayer={isTopLayer}
              inputX={inputX}
              animationMode={animationMode}
              entranceProgress={entranceProgress}
              morphProgress={morphProgress}
              layerOffset={layerOffset}
              outerTransform={outerTransform}
            />
          )
        })}
      </>
    )
  }

  // Non-stacked character - single layer, dark color
  return (
    <motion.span
      className="text-fir-darkfir absolute bottom-0 left-1/2 z-10 inline-block origin-bottom"
      style={{ transform: outerTransform }}
    >
      {char}
    </motion.span>
  )
}

function CurvedCharacterLayer({
  char,
  rotationDeg,
  color,
  depthFromMiddle,
  maxDepth: _maxDepth,
  zIndex,
  isTopLayer,
  inputX,
  animationMode,
  entranceProgress,
  morphProgress,
  layerOffset,
  outerTransform,
}: {
  char: string
  rotationDeg: number
  color: string
  depthFromMiddle: number
  maxDepth: number
  zIndex: number
  isTopLayer: boolean
  inputX: MotionValue<number>
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  morphProgress: MotionValue<number>
  layerOffset: number
  outerTransform: MotionValue<string>
}) {
  const baseOffsetX = depthFromMiddle * layerOffset
  const baseOffsetY = depthFromMiddle * layerOffset * -1
  const isFirstLayer = depthFromMiddle === 0

  const layerMax = Math.abs(depthFromMiddle) * layerOffset
  const dampen = (value: number) =>
    layerMax > 0 ? Math.tanh(value / layerMax) * layerMax : 0

  // The extrusion vector is authored in screen space (brighter layers sit
  // up-right) and is at FULL depth at every frame -- including the flat first
  // frame (mp=0), so it matches the fully-extruded static stack the server
  // renders. Only the counter-rotation tracks the morph (theta = rotationDeg*mp):
  // at mp=0 the glyph is upright so the depth points screen-up-right; at mp=1 the
  // glyph is arc-rotated and the counter-rotation keeps the depth pointing the
  // same way on screen. So the stack stays solid throughout and only the arc forms.
  const x = useTransform(
    [inputX, entranceProgress, morphProgress],
    ([input, progress, mp]: number[]) => {
      if (isFirstLayer) return 0
      const theta = ((rotationDeg * Math.PI) / 180) * mp
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      const dynamicOffset =
        animationMode === 'none'
          ? 0
          : input * depthFromMiddle * FACING_INTENSITY * progress
      const screenX = dampen(baseOffsetX + dynamicOffset)
      const screenY = dampen(baseOffsetY)
      return cosT * screenX + sinT * screenY
    }
  )

  const y = useTransform(
    [inputX, entranceProgress, morphProgress],
    ([input, progress, mp]: number[]) => {
      if (isFirstLayer) return 0
      const theta = ((rotationDeg * Math.PI) / 180) * mp
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      const dynamicOffset =
        animationMode === 'none'
          ? 0
          : input * depthFromMiddle * FACING_INTENSITY * progress
      const screenX = dampen(baseOffsetX + dynamicOffset)
      const screenY = dampen(baseOffsetY)
      return -sinT * screenX + cosT * screenY
    }
  )

  return (
    <motion.span
      className={cn(
        'absolute bottom-0 left-1/2 inline-block origin-bottom',
        !isTopLayer && 'pointer-events-none select-none'
      )}
      style={{ transform: outerTransform, zIndex }}
      aria-hidden={!isTopLayer}
    >
      <motion.span
        className="inline-block"
        style={{
          color,
          x,
          y,
          WebkitTextStroke: '0.025em var(--color-fir-darkfir)',
          paintOrder: 'stroke fill',
        }}
      >
        {char}
      </motion.span>
    </motion.span>
  )
}

interface CurvedLineRowProps {
  line: LineCurveMetrics
  topOffset: number
  lineHeight: number
  morphProgress: MotionValue<number>
  inputX: MotionValue<number>
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  colors: string[]
  middleLayerIndex: number
  maxDepth: number
  layerOffset: number
}

function CurvedLineRow({
  line,
  topOffset,
  lineHeight,
  morphProgress,
  inputX,
  animationMode,
  entranceProgress,
  colors,
  middleLayerIndex,
  maxDepth,
  layerOffset,
}: CurvedLineRowProps) {
  // Each row occupies the flat text's line box (top = lineIndex * lineHeight,
  // height = lineHeight), so it maps exactly onto the corresponding line of the
  // invisible flat spacer. Its bottom is that line's baseline: the morph's flat
  // first frame lands on the pre-rendered text, and the curve blooms up from
  // there. The inner baseline offset animates in lockstep with each glyph's
  // translateY(-radius*p) -- at p=0 both are 0 (flat on the baseline); at p=1 the
  // -verticalOffset cancels the glyphs' -radius lift to land them on the arc.
  const innerBottom = useTransform(
    morphProgress,
    (p) => line.verticalOffset * p
  )
  return (
    <span
      className="absolute inset-x-0"
      style={{ top: topOffset, height: lineHeight }}
    >
      <motion.span
        className="absolute inset-x-0"
        style={{ bottom: innerBottom }}
      >
        {line.characters.map((charInfo, i) => (
          <CurvedCharacter
            key={i}
            char={charInfo.char}
            rotationDeg={charInfo.rotationDeg}
            radius={line.radius}
            flatX={charInfo.flatX}
            isStacked={charInfo.isStacked}
            inputX={inputX}
            animationMode={animationMode}
            entranceProgress={entranceProgress}
            morphProgress={morphProgress}
            colors={colors}
            middleLayerIndex={middleLayerIndex}
            maxDepth={maxDepth}
            layerOffset={layerOffset}
          />
        ))}
      </motion.span>
    </span>
  )
}

export function CurvedLine({
  parts,
  animationMode = 'mouse',
  arcAmount = 0.35,
  extrusionCount = DEFAULT_EXTRUSION_COUNT,
}: CurvedLineProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const measurerRef = useRef<HTMLSpanElement>(null)
  const [curveMetrics, setCurveMetrics] = useState<CurveMetrics | null>(null)
  const prevArcAmount = useRef(arcAmount)
  const reduceMotion = useReducedMotion()

  // Memoize full text to prevent recalculation on every render
  const fullText = useMemo(() => parts.map((p) => p.content).join(''), [parts])

  // Memoize stacked indices Set to prevent recreation on every render
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

  // Memoize extrusion colors and middle layer index
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

  const { entranceValue, entranceProgress, inputX, mouseX } =
    useStackedAnimation(containerRef, animationMode)

  const layerOffset = useScaledLayerOffset(containerRef)

  // Flat -> curved morph progress. Held at 0 (flat, matching the static
  // fallback) until the glyphs are measured and the heading is in view, then
  // sprung to 1.
  const morphValue = useMotionValue(0)
  const morphProgress = useSpring(morphValue, MORPH_SPRING)
  const inView = useInView(containerRef, { once: true, amount: 'some' })

  useEffect(() => {
    if (curveMetrics && inView) {
      morphValue.set(1)
    }
  }, [curveMetrics, inView, morphValue])

  // Reset all spring animations when arcAmount changes to prevent lag
  useEffect(() => {
    if (prevArcAmount.current !== arcAmount) {
      prevArcAmount.current = arcAmount
      entranceValue.jump(1)
      mouseX.jump(0)
      morphValue.jump(1)
    }
  }, [arcAmount, entranceValue, mouseX, morphValue])

  // Calculate arc metrics for a subset of characters
  const calcLineMetrics = useCallback(
    (
      chars: string[],
      widths: number[],
      globalIndices: number[],
      measuredLineHeight: number,
      minRadius?: number
    ): LineCurveMetrics => {
      const totalWidth = widths.reduce((sum, w) => sum + w, 0)
      const naturalRadius = totalWidth / (2 * Math.PI * arcAmount)
      const radius = minRadius
        ? Math.max(naturalRadius, minRadius)
        : naturalRadius

      let runningAngle = 0
      const totalAngle = widths.reduce(
        (sum, w) => sum + (w * CURVE_TRACKING) / radius,
        0
      )
      const startOffset = -totalAngle / 2

      let runningWidth = 0
      const characters: CharacterInfo[] = chars.map((char, i) => {
        const width = widths[i]
        const angle = (width * CURVE_TRACKING) / radius
        const halfAngle = angle / 2
        const charAngle = startOffset + runningAngle + halfAngle
        runningAngle += angle

        // Flat position is the glyph's natural inline centre, matching the
        // pre-rendered (server) flat text exactly -- so the bloom begins from
        // the very layout the user already sees, with no snap when the arc takes
        // over. The morph then eases each glyph (and the letter-spacing) onto the
        // arc as part of the entrance.
        const flatX = runningWidth + width / 2 - totalWidth / 2
        runningWidth += width

        return {
          char,
          isStacked: stackedIndices.has(globalIndices[i]),
          rotationDeg: (charAngle * 180) / Math.PI,
          flatX,
        }
      })

      const maxAngle = totalAngle / 2
      const charHeight = measuredLineHeight * 0.85

      const mid = Math.floor(extrusionCount / 2)
      const topLayerDepth = extrusionCount - 1 - mid
      const extrusionOffset = topLayerDepth * layerOffset

      const visualTop = radius + charHeight + extrusionOffset
      const arcBottom = radius * Math.cos(maxAngle)
      const height = visualTop - arcBottom
      const verticalOffset = -arcBottom

      return { characters, radius, height, verticalOffset }
    },
    [arcAmount, stackedIndices, extrusionCount, layerOffset]
  )

  // Use the browser's text layout to find word break points at a constrained width
  const detectLineBreaks = useCallback(
    (measurer: HTMLSpanElement, targetWidth: number): string[][] => {
      const words = fullText.split(' ')
      if (words.length <= 1) return [words]

      const origWhiteSpace = measurer.style.whiteSpace
      const origDisplay = measurer.style.display
      const origWidth = measurer.style.width
      measurer.style.whiteSpace = 'normal'
      measurer.style.display = 'block'
      measurer.style.width = targetWidth + 'px'
      measurer.textContent = ''

      const wordSpans = words.map((word, i) => {
        if (i > 0) measurer.appendChild(document.createTextNode(' '))
        const span = document.createElement('span')
        span.textContent = word
        measurer.appendChild(span)
        return span
      })

      const lines: string[][] = [[]]
      let currentTop = wordSpans[0]?.offsetTop ?? 0
      for (let i = 0; i < wordSpans.length; i++) {
        if (wordSpans[i].offsetTop !== currentTop) {
          lines.push([])
          currentTop = wordSpans[i].offsetTop
        }
        lines[lines.length - 1].push(words[i])
      }

      measurer.style.whiteSpace = origWhiteSpace
      measurer.style.display = origDisplay
      measurer.style.width = origWidth
      measurer.textContent = fullText

      return lines
    },
    [fullText]
  )

  // Memoize measurement function to prevent recreation
  const measureCharacters = useCallback(() => {
    const measurer = measurerRef.current
    const container = containerRef.current
    if (!measurer || !container) return

    const chars = [...fullText]

    // Measure every glyph in a single layout pass. One span per glyph is
    // appended at once, then all geometry is read together with no interleaved
    // writes, so the browser lays out once. Mutating one span and reading its
    // width each iteration forces a reflow per character.
    const probe = document.createElement('span')
    probe.style.cssText = 'visibility: hidden; white-space: pre;'
    const charSpans = chars.map((char) => {
      const span = document.createElement('span')
      span.textContent = char
      probe.appendChild(span)
      return span
    })
    measurer.appendChild(probe)

    // Batched reads (no DOM writes between them).
    const widths = charSpans.map((span) => span.offsetWidth)
    const measuredLineHeight = measurer.offsetHeight || 40
    const parent = container.parentElement
    const parentWidth = parent?.clientWidth ?? 0
    const ownWidth = container.clientWidth ?? 0

    measurer.removeChild(probe)

    // Wrap to the parent element's available width so curved text respects
    // column constraints, falling back to the container's own width and
    // finally the viewport.
    const fallbackWidth =
      typeof window !== 'undefined' ? window.innerWidth : Infinity
    const containerWidth = parentWidth || ownWidth || fallbackWidth

    // Check if the curved arc overflows the viewport.
    // Calculate the full visual extent: for each character on the arc,
    // find its maximum horizontal reach including character width and height
    // projection due to rotation.
    const plainTextWidth = widths.reduce((sum, w) => sum + w, 0)
    const radius = plainTextWidth / (2 * Math.PI * arcAmount)
    const totalAngle = (plainTextWidth * CURVE_TRACKING) / radius
    const charHeight = measuredLineHeight * 0.85

    // Find the maximum horizontal extent from center, including extrusion
    const mid = Math.floor(extrusionCount / 2)
    const topLayerDepth = extrusionCount - 1 - mid
    const extrusionHorizontal = topLayerDepth * layerOffset

    let maxHorizontalExtent = 0
    let runAngle = 0
    const startOff = -totalAngle / 2
    for (let i = 0; i < chars.length; i++) {
      const w = widths[i]
      const angle = (w * CURVE_TRACKING) / radius
      const charAngle = startOff + runAngle + angle / 2
      runAngle += angle
      // Character center on arc + half width projected + height projected + extrusion
      const extent =
        Math.abs(radius * Math.sin(charAngle)) +
        (w / 2) * Math.abs(Math.cos(charAngle)) +
        charHeight * Math.abs(Math.sin(charAngle)) +
        extrusionHorizontal
      if (extent > maxHorizontalExtent) maxHorizontalExtent = extent
    }
    const arcVisualWidth = 2 * maxHorizontalExtent
    const needsWrap = arcVisualWidth > containerWidth && fullText.includes(' ')

    if (!needsWrap) {
      const globalIndices = chars.map((_, i) => i)
      const lineMetrics = calcLineMetrics(
        chars,
        widths,
        globalIndices,
        measuredLineHeight
      )
      setCurveMetrics({
        lines: [lineMetrics],
        totalHeight: lineMetrics.height,
        lineGap: 0,
        lineHeight: measuredLineHeight,
      })
    } else {
      // The arc expands the text by arcVisualWidth/plainTextWidth.
      // Scale down the target width so the browser wraps at the point
      // where each line's arc will fit within the container.
      const expansionRatio = arcVisualWidth / plainTextWidth
      const targetPlainWidth = containerWidth / expansionRatio

      const wrappedLines = detectLineBreaks(measurer, targetPlainWidth)

      // Use the full-text radius as a minimum so short lines
      // don't produce an overly tight arc
      const fullTextRadius = radius

      const lineMetricsList: LineCurveMetrics[] = []
      let charOffset = 0

      for (const lineWords of wrappedLines) {
        const lineText = lineWords.join(' ')
        const lineChars = [...lineText]
        const lineWidths = lineChars.map((_, i) => widths[charOffset + i] || 0)
        const lineIndices = lineChars.map((_, i) => charOffset + i)

        lineMetricsList.push(
          calcLineMetrics(
            lineChars,
            lineWidths,
            lineIndices,
            measuredLineHeight,
            fullTextRadius
          )
        )

        charOffset += lineText.length + 1
      }

      const mid = Math.floor(extrusionCount / 2)
      const topLayerDepth = extrusionCount - 1 - mid
      const extrusionOffset = topLayerDepth * layerOffset
      const lineGap = -(extrusionOffset + measuredLineHeight * 0.45)
      const totalHeight =
        lineMetricsList.reduce((sum, l) => sum + l.height, 0) +
        (lineMetricsList.length - 1) * lineGap

      setCurveMetrics({
        lines: lineMetricsList,
        totalHeight,
        lineGap,
        lineHeight: measuredLineHeight,
      })
    }
  }, [
    fullText,
    arcAmount,
    calcLineMetrics,
    detectLineBreaks,
    extrusionCount,
    layerOffset,
  ])

  // Measure characters for curved text and re-measure on resize. useLayoutEffect
  // for the initial measure so the first paint is the flat glyphs (matching the
  // server fallback) with no blank frame before the morph begins.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!measurerRef.current || !container) return

    // Reduced motion: skip measurement entirely. The render keeps the in-flow
    // StaticStackedText fallback visible and draws no curved overlay, so no
    // per-glyph layout work runs.
    if (reduceMotion) return

    let cancelled = false
    let frame = 0

    const runMeasurement = () => {
      if (!cancelled) measureCharacters()
    }

    // Coalesce re-measures (font load, resize) into one per frame.
    const scheduleMeasurement = () => {
      if (cancelled) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(runMeasurement)
    }

    // Initial measure is synchronous so the first paint is the flat glyphs,
    // matching the server fallback with no blank frame before the morph.
    runMeasurement()

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleMeasurement)
    }

    // Observing the container (w-full) catches available-width changes; a
    // separate window resize listener and a second observed node are redundant.
    const observer = new ResizeObserver(scheduleMeasurement)
    observer.observe(container)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [measureCharacters, reduceMotion])

  // Reduced motion (or before the first measurement) keeps the flat static
  // fallback and renders no curved overlay.
  const showCurved = !reduceMotion && !!curveMetrics

  return (
    // line-height 1 drives both the measured line height (arc geometry + line
    // spacing) and the in-flow flat spacer's line box, so the arc lines map
    // exactly onto the invisible flat text's lines and wrapped lines stay tight.
    <span
      ref={containerRef}
      className="relative inline-block w-full leading-none"
    >
      {/* Hidden measurer text -- absolutely positioned so it never contributes
          to layout (the in-flow flat text below owns the box). */}
      <span
        ref={measurerRef}
        className="pointer-events-none absolute top-0 left-0 inline-block whitespace-pre opacity-0"
        aria-hidden="true"
      >
        {fullText}
      </span>

      {/* The flat text is ALWAYS in flow, so the container is exactly one
          line-height tall in both states -- there is no height jump when the
          measured arc appears. Before measuring it is the visible fallback (so
          the heading is never blank, however the lazy boundary resolves); once
          curved it becomes an invisible spacer and the absolutely-positioned arc
          glyphs render on top, curving up into the heading's leading. */}
      <span
        className={cn('block w-full text-center', showCurved && 'invisible')}
      >
        <StaticStackedText
          text={fullText}
          extrusionCount={extrusionCount}
          className="z-10"
        />
      </span>

      {/* Curved characters - each line is its own arc, morphing in from flat.
          Each row is placed at the flat text's line-box position (lineIndex *
          lineHeight) so the arc lines sit directly on top of the invisible flat
          text's lines. */}
      {showCurved &&
        curveMetrics?.lines.map((line, lineIndex) => (
          <CurvedLineRow
            key={lineIndex}
            line={line}
            topOffset={lineIndex * curveMetrics.lineHeight}
            lineHeight={curveMetrics.lineHeight}
            morphProgress={morphProgress}
            inputX={inputX}
            animationMode={animationMode}
            entranceProgress={entranceProgress}
            colors={colors}
            middleLayerIndex={middleLayerIndex}
            maxDepth={maxDepth}
            layerOffset={layerOffset}
          />
        ))}
    </span>
  )
}
