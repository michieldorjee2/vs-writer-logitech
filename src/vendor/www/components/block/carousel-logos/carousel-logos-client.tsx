import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { cn } from '../../../lib/utils'
import type { CarouselLogosDisplaySettings } from './types'

interface CarouselLogosClientProps {
  displaySettings?: Partial<CarouselLogosDisplaySettings>
  preview?: boolean
  children?: React.ReactNode
}

const DESKTOP_GAP = 16
const MOBILE_GAP = 8
const SPEED = 40
const DESKTOP_BREAKPOINT = 1024
const EASE_RATE = 4

export default function CarouselLogosClient({
  displaySettings,
  children,
}: CarouselLogosClientProps) {
  const { scrollDirection = 'left' } = displaySettings ?? {}

  // Recolor every logo to a uniform dark-fir silhouette (brightness-0 keeps
  // alpha). The logo always sits on the light CompanyBlock icon tile, so it
  // stays legible in both schemes; inverting it to white would hide it there.
  const logoFilter = '[&_img]:brightness-0'

  const containerObserver = useRef<ResizeObserver | null>(null)
  const measureObserver = useRef<ResizeObserver | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const velocityRef = useRef(0)
  const isHoveredRef = useRef(false)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef(0)
  const setWidthRef = useRef(0)

  const childArray = useMemo(() => React.Children.toArray(children), [children])
  const count = childArray.length

  const directionSign = scrollDirection === 'right' ? -1 : 1

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT - 1}px)`)
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (containerObserver.current) {
      containerObserver.current.disconnect()
      containerObserver.current = null
    }
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(node)
    containerObserver.current = ro
  }, [])

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (measureObserver.current) {
      measureObserver.current.disconnect()
      measureObserver.current = null
    }
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      setContentWidth(entry.contentRect.width)
    })
    ro.observe(node)
    measureObserver.current = ro
  }, [])

  const gap = isMobile ? MOBILE_GAP : DESKTOP_GAP
  const setWidth = contentWidth + gap
  const measured = contentWidth > 0 && containerWidth > 0

  const shouldScroll = !measured || contentWidth > containerWidth

  useEffect(() => {
    setWidthRef.current = setWidth
  }, [setWidth])

  useEffect(() => {
    if (!measured || !shouldScroll) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReducedMotion) return

    velocityRef.current = SPEED
    lastTimeRef.current = 0

    const tick = (now: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      const targetSpeed = isHoveredRef.current ? 0 : SPEED
      velocityRef.current +=
        (targetSpeed - velocityRef.current) * (1 - Math.exp(-dt * EASE_RATE))

      const sw = setWidthRef.current
      if (sw > 0) {
        positionRef.current += velocityRef.current * dt * directionSign
        positionRef.current = ((positionRef.current % sw) + sw) % sw

        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${-positionRef.current}px)`
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    const track = trackRef.current
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      positionRef.current = 0
      if (track) {
        track.style.transform = ''
      }
    }
  }, [measured, shouldScroll, directionSign])

  const onMouseEnter = useCallback(() => {
    isHoveredRef.current = true
  }, [])

  const onMouseLeave = useCallback(() => {
    isHoveredRef.current = false
  }, [])

  if (count === 0) return null

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full min-w-0 overflow-hidden contain-inline-size',
        logoFilter
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Logo carousel"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={cn(
          'flex items-center justify-center',
          !measured && 'invisible',
          measured && shouldScroll && 'invisible'
        )}
      >
        <div
          ref={measureRef}
          className="flex shrink-0 items-center"
          style={{ gap }}
        >
          {childArray.map((child, i) => (
            <div key={`m-${i}`} className="shrink-0" data-carousel-item="">
              {child}
            </div>
          ))}
        </div>
      </div>
      {measured && shouldScroll && (
        <div
          ref={trackRef}
          className="absolute inset-0 flex items-center"
          style={{ gap }}
        >
          <div className="flex shrink-0 items-center" style={{ gap }}>
            {childArray.map((child, i) => (
              <div key={`a-${i}`} className="shrink-0">
                {child}
              </div>
            ))}
          </div>
          <div
            className="flex shrink-0 items-center"
            style={{ gap }}
            aria-hidden="true"
            inert
          >
            {childArray.map((child, i) => (
              <div key={`b-${i}`} className="shrink-0">
                {child}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
