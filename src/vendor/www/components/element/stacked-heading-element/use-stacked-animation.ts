import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useLayoutEffect,
} from 'react'
import {
  useMotionValue,
  useTransform,
  useScroll,
  useSpring,
  useInView,
  useReducedMotion,
} from 'framer-motion'
import type { AnimationMode } from './types'

// All available extrusion colors from darkest to brightest
const ALL_EXTRUSION_COLORS = [
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

// Generate extrusion colors based on count (5-9)
export function getExtrusionColors(count: number): string[] {
  const clampedCount = Math.min(9, Math.max(5, count))
  // Take the last N colors (brightest ones)
  return ALL_EXTRUSION_COLORS.slice(-clampedCount)
}

// Anchor (no-offset) layer is the first/darkest layer so the stack extrudes
// up-right from a single back layer rather than radiating from the centre.
export function getMiddleLayerIndex(_count: number): number {
  return 0
}

export const LAYER_OFFSET = 10
export const MOUSE_INFLUENCE = 15
export const SCROLL_INFLUENCE = 15
export const FACING_INTENSITY = 1.25
export const DEFAULT_EXTRUSION_COUNT = 5
export const MAX_EXTRUSION_COUNT = 9
export const MAX_LAYER_DISTANCE = 30
export const LAYER_SCALE_FACTOR = 0.02

// LAYER_OFFSET is calibrated for a ~120px desktop heading. On smaller
// breakpoints (e.g. mobile text-5xl ≈ 48px) a fixed 10px offset looks
// disproportionately large, so we scale by the actual rendered font-size.
export const REFERENCE_FONT_SIZE_PX = 120

export function useScaledLayerOffset(
  ref: React.RefObject<HTMLElement | null>
): number {
  const [offset, setOffset] = useState(LAYER_OFFSET)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const fontSizePx = parseFloat(getComputedStyle(el).fontSize)
      if (fontSizePx > 0) {
        setOffset((fontSizePx / REFERENCE_FONT_SIZE_PX) * LAYER_OFFSET)
      }
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return offset
}

const SPRING_CONFIG = { stiffness: 80, damping: 8, mass: 0.5 }
const ENTRANCE_SPRING_CONFIG = { stiffness: 60, damping: 12, mass: 0.8 }

export function useStackedAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  animationMode: AnimationMode = 'mouse'
) {
  const isInView = useInView(containerRef, {
    once: true,
    amount: 'all',
  })
  const hasAnimated = useRef(false)
  const reduceMotion = useReducedMotion()
  // Cached container rect so the mousemove handler never reads layout (a
  // getBoundingClientRect per pointer move forces a reflow at move frequency).
  const rectRef = useRef<DOMRect | null>(null)

  const entranceValue = useMotionValue(0)
  const entranceProgress = useSpring(entranceValue, ENTRANCE_SPRING_CONFIG)

  const mouseX = useMotionValue(0)

  const smoothMouseX = useSpring(mouseX, SPRING_CONFIG)

  const { scrollYProgress } = useScroll()
  const scrollInput = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [SCROLL_INFLUENCE, 0, -SCROLL_INFLUENCE]
  )
  const smoothScrollX = useSpring(scrollInput, SPRING_CONFIG)

  // Trigger entrance animation
  useEffect(() => {
    if (hasAnimated.current) return

    // Reduced motion: settle on the resting state immediately, no entrance.
    if (reduceMotion) {
      hasAnimated.current = true
      entranceValue.jump(1)
      return
    }

    if (isInView) {
      hasAnimated.current = true
      entranceValue.set(1)
      return
    }

    let cancelled = false

    const checkVisibility = () => {
      if (cancelled || hasAnimated.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const vh = window.innerHeight
      const fullyVisible = rect.top >= 0 && rect.bottom <= vh
      const fillsViewport =
        rect.height > vh && rect.top <= 0 && rect.bottom >= vh
      if (fullyVisible || fillsViewport) {
        hasAnimated.current = true
        entranceValue.set(1)
        window.removeEventListener('scroll', checkVisibility)
        window.removeEventListener('resize', checkVisibility)
      }
    }

    checkVisibility()

    if (!hasAnimated.current) {
      window.addEventListener('scroll', checkVisibility, { passive: true })
      window.addEventListener('resize', checkVisibility)
    }

    return () => {
      cancelled = true
      window.removeEventListener('scroll', checkVisibility)
      window.removeEventListener('resize', checkVisibility)
    }
  }, [isInView, entranceValue, containerRef, reduceMotion])

  // Mouse move handler - only tracks within TRACK_PADDING around the heading
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const rect = rectRef.current
      if (!rect) return

      const trackPadding = 300
      const expandedLeft = rect.left - trackPadding
      const expandedRight = rect.right + trackPadding
      const expandedTop = rect.top - trackPadding
      const expandedBottom = rect.bottom + trackPadding

      if (
        e.clientX < expandedLeft ||
        e.clientX > expandedRight ||
        e.clientY < expandedTop ||
        e.clientY > expandedBottom
      ) {
        mouseX.set(0)
        return
      }

      const centerX = rect.left + rect.width / 2
      const halfTrackWidth = rect.width / 2 + trackPadding
      const normalizedX = (e.clientX - centerX) / halfTrackWidth

      mouseX.set(normalizedX * MOUSE_INFLUENCE)
    },
    [mouseX]
  )

  useEffect(() => {
    if (animationMode !== 'mouse' || reduceMotion) return

    const updateRect = () => {
      if (containerRef.current) {
        rectRef.current = containerRef.current.getBoundingClientRect()
      }
    }

    let frame = 0
    const scheduleRectUpdate = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateRect)
    }

    updateRect()
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('scroll', scheduleRectUpdate, { passive: true })
    window.addEventListener('resize', scheduleRectUpdate)
    const observer = new ResizeObserver(scheduleRectUpdate)
    if (containerRef.current) observer.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', scheduleRectUpdate)
      window.removeEventListener('resize', scheduleRectUpdate)
      observer.disconnect()
    }
  }, [animationMode, handleMouseMove, reduceMotion, containerRef])

  const inputX = animationMode === 'scroll' ? smoothScrollX : smoothMouseX

  return {
    entranceValue,
    entranceProgress,
    inputX,
    mouseX,
  }
}
