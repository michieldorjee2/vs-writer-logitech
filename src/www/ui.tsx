/**
 * The www-design shell: a 1:1 landing page, not a marketing-site page. No navigation and no
 * footer: one scroll path to one ask. The page is a sequence of SCENES, each one idea, each the
 * height of the window (type scales with the window's height as well as its width, so a scene
 * fits a laptop and a large monitor alike), revealed as it scrolls in.
 *
 * Colour follows the Optimizely brand rules: white and Neutral 3 backdrops, Dark Fir for the
 * two bookends (the hero and the ask), LFGreen only for the action and one accent. No tertiary
 * backgrounds, no gradients, Dark Fir as the only stroke, extrusion for one heroic moment.
 *
 * The building blocks are optimizely.com's own components (src/vendor/www: Button, Badge,
 * StackedHeading, StatBlock, TableBlock, the logo carousel, the quote and arrow cards, the
 * accordion). The composition and the scale are ours.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { StackedHeading } from '../vendor/www/components/element/stacked-heading-element'
import { Button } from '../vendor/www/components/_ui/button'
import { cn } from '../vendor/www/lib/utils'

/* ------------------------------------------------------------------ page root */

/**
 * Marks <html> before the first paint so the reveal styles only ever hide content when a
 * script is there to show it again. No JS, a crawler, or a print: everything is visible.
 */
const REVEAL_BOOT = "document.documentElement.classList.add('www-js')"

export function WwwPage({
  children,
  accent,
  className,
}: {
  children: ReactNode
  accent?: string | null
  className?: string
}) {
  useScenes()
  return (
    <div
      className={cn('www-page bg-primary-1 text-secondary-darkfir font-body flex min-h-screen w-full flex-col', className)}
      style={accent ? ({ '--www-accent': accent } as CSSProperties) : undefined}
    >
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
      <ScrollProgress />
      {children}
    </div>
  )
}

/** Adds `is-in` to each scene the first time a fifth of it is on screen. */
function useScenes() {
  useEffect(() => {
    const scenes = Array.from(document.querySelectorAll<HTMLElement>('.www-page [data-scene]'))
    if (typeof IntersectionObserver === 'undefined') {
      scenes.forEach((s) => s.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
    )
    scenes.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])
}

/** A hairline at the top of the window that fills as the reader moves through the page. */
function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - innerHeight
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  return <div ref={bar} aria-hidden="true" className="www-progress" />
}

/** The brand mark, anchored to the top-left corner (brand rule for a small logo), and whose page this is. */
export function TopStrip({ account }: { account?: { name: string; logo?: string | null } | null }) {
  return (
    <div className="www-strip vb-container mx-auto flex items-center justify-between gap-4 px-4 lg:px-8">
      <a href="https://www.optimizely.com/" aria-label="Optimizely" className="shrink-0">
        <img src="/optimizely-logo-color.svg" alt="Optimizely" width={150} height={37} className="h-6 w-auto lg:h-7" />
      </a>
      {account?.name && (
        <span className="text-body-3xs flex min-w-0 items-center gap-2 font-medium">
          {account.logo ? <img src={account.logo} alt="" className="size-6 shrink-0 rounded-md object-contain" /> : null}
          <span className="truncate">Made for {account.name}</span>
        </span>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------- scenes */

export type Tone = 'light' | 'neutral' | 'dark'

/**
 * One scene: at least the window's height, content centred in it. `fill` scenes (the bookends)
 * are always the full window; the others are too on a tablet or larger, and take their own
 * height on a phone, where a full-height short scene would only add empty space.
 */
export function Scene({
  id,
  tone = 'light',
  fill = false,
  compact = false,
  className,
  innerClassName,
  children,
}: {
  id?: string
  tone?: Tone
  fill?: boolean
  /** A short scene (a two-card block, an opening paragraph) takes its own height everywhere. */
  compact?: boolean
  className?: string
  innerClassName?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      data-scene
      data-tone={tone}
      className={cn('www-scene', `www-scene--${tone}`, fill && 'www-scene--fill', compact && 'www-scene--compact', className)}
    >
      <div className={cn('www-scene__inner vb-container mx-auto w-full px-4 lg:px-8', innerClassName)}>{children}</div>
    </section>
  )
}

/** Staggered reveal: children of a scene fade and rise in, in order, as the scene enters. */
export function Reveal({
  i = 0,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: {
  i?: number
  as?: 'div' | 'li' | 'p' | 'span' | 'figure'
  className?: string
  children: ReactNode
  [key: `data-${string}`]: string | undefined
}) {
  return (
    <Tag data-reveal className={className} style={{ '--i': i } as CSSProperties} {...rest}>
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------------ type */

/** Eyebrow: Die Grotesk, medium, with a small green mark. One per scene, above the heading. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null
  return <p className={cn('www-eyebrow', className)}>{children}</p>
}

/**
 * Converts the legacy rich headings (`We know <em>CDW</em>`, `You're on <span
 * class="text--highlight">AEM.</span><br>We hear you.`) into StackedHeading's `##run##`.
 */
export function richToStacked(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(em|strong|b)>([\s\S]*?)<\/\1>/gi, '##$2##')
    .replace(/<span[^>]*class="[^"]*highlight[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '##$1##')
    .replace(/<[^>]+>/g, '')
    .replace(/####/g, '')
    .trim()
}

/** Removes `##` emphasis marks, for places that show the words but not the emphasis. */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replace(/##/g, '').replace(/<[^>]+>/g, '').trim()
}

type Size = 'display' | 'h2' | 'h3'

/**
 * Headings. A `##run##` is the writer's emphasis: on most headings it becomes the accent
 * colour (the brand's "Clear" level). `extrude` turns it into the extruded run instead, via
 * optimizely.com's StackedHeading. The brand allows one extruded moment per design, so only the
 * offer's hero headline uses it.
 */
export function Heading({
  text,
  level = 'h2',
  size,
  align = 'left',
  extrude = false,
  className,
}: {
  text: string
  level?: 'h1' | 'h2' | 'h3'
  size?: Size
  align?: 'left' | 'center'
  extrude?: boolean
  className?: string
}) {
  if (!text) return null
  const sz = size ?? (level === 'h1' ? 'display' : level)
  if (extrude && text.includes('##')) {
    return (
      <StackedHeading
        text={text}
        as={level}
        fontSizeOverrides={`www-${sz}`}
        leadingOverrides="leading-[0.98]"
        alignment={align}
        animationMode="none"
        extrusionCount={5}
        colorScheme="inherit"
        className={cn('text-balance', className)}
      />
    )
  }
  const Tag = level
  const lines = text.split('\n')
  return (
    <Tag className={cn(`www-${sz}`, align === 'center' && 'text-center', 'text-balance', className)}>
      {lines.map((line, li) => (
        <span key={li} className={lines.length > 1 ? 'block' : undefined}>
          {line.split(/##(.+?)##/g).map((p, i) =>
            i % 2 === 1 ? (
              <span key={i} className="www-emph">
                {p}
              </span>
            ) : (
              p
            ),
          )}
        </span>
      ))}
    </Tag>
  )
}

/** Paragraphs from a plain-text body: blank lines split paragraphs, single newlines break lines. */
export function Paragraphs({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return (
    <div className={cn('flex flex-col gap-[0.8em]', className)}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- pieces */

/** The one card shape: 32px smoothed corners, white on Neutral 3 or Neutral 3 on white. */
export function Card({
  tone = 'neutral',
  className,
  children,
  xray,
}: {
  tone?: 'neutral' | 'white' | 'dark'
  className?: string
  children: ReactNode
  /** The X-ray / Edit mode hook (see ABM_XRAY_DEFAULTS in src/lib/xray-defaults.ts). */
  xray?: string
}) {
  return (
    <div data-xray={xray} className={cn('www-card', `www-card--${tone}`, className)}>
      {children}
    </div>
  )
}

/** Initials on a Neutral 3 tile (Dark Fir type): the brand's accessible pairing. */
export function Initials({ initials, className }: { initials: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('www-initials', className)}>
      {initials}
    </span>
  )
}

/**
 * A number that counts up when its scene enters. The server renders the final value, so a
 * reader without JS (or in reduced motion) simply sees it; only the prefix digits animate and
 * any suffix ("K", "%", "+", " sec") stays put.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    // Animates the text node directly: the count is presentation, not state, and the server
    // already rendered the final value, so nothing re-renders and nothing can mismatch.
    const el = ref.current
    const m = value.match(/^([^0-9]*)(\d+(?:[.,]\d+)?)(.*)$/)
    if (!el || !m || typeof IntersectionObserver === 'undefined') return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    if (r.top < innerHeight && r.bottom > 0) return // already on screen: no flash from 0
    const [, pre, num, post] = m
    const target = parseFloat(num.replace(',', '.'))
    const decimals = (num.split(/[.,]/)[1] || '').length
    el.textContent = `${pre}0${post}`
    let raf = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (t: number) => {
          const k = Math.min(1, (t - t0) / 1100)
          const eased = 1 - Math.pow(1 - k, 3)
          el.textContent = k < 1 ? `${pre}${(target * eased).toFixed(decimals)}${post}` : value
          if (k < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      el.textContent = value
    }
  }, [value])
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}

/** The page's own small print, at the end of the last scene (there is no footer). */
export function Colophon({ children }: { children: ReactNode }) {
  return <div className="www-colophon">{children}</div>
}

/* ---------------------------------------------------------------- steps */

/** Horizontal steps on a rule that draws itself as the scene enters; a vertical list on a phone. */
export function Steps({
  steps,
  xray,
  tone = 'light',
}: {
  steps: Array<{ label: string; title: string; body: string }>
  xray?: string
  tone?: 'light' | 'dark'
}) {
  return (
    <ol className={cn('www-steps', `www-steps--${steps.length > 4 ? 'many' : steps.length}`, tone === 'dark' && 'www-steps--dark')} role="list">
      {steps.map((s, i) => (
        <Reveal key={i} as="li" i={3 + i} data-xray={xray} className="www-step">
          <span className="www-step__dot" aria-hidden="true" />
          <p className="www-caption">{s.label}</p>
          <h3 className="www-h3 mt-2">{s.title}</h3>
          <p className="www-body mt-2 opacity-85">{s.body}</p>
        </Reveal>
      ))}
    </ol>
  )
}

/* ------------------------------------------------------------ sticky ask */

export function StickyCta({ text, href = '#cta', label = 'Talk to your team', endId = 'cta' }: { text: string; href?: string; label?: string; endId?: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const hero = document.getElementById('hero')
    const end = document.getElementById(endId)
    if (!hero || !end || typeof IntersectionObserver === 'undefined') return
    let pastHero = false
    let atEnd = false
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) pastHero = !e.isIntersecting
        if (e.target === end) atEnd = e.isIntersecting
      }
      setVisible(pastHero && !atEnd)
    })
    io.observe(hero)
    io.observe(end)
    return () => io.disconnect()
  }, [endId])
  return (
    <div className={cn('www-sticky', visible && 'www-sticky--visible')} aria-hidden={!visible}>
      <span className="www-small min-w-0 truncate pl-2 font-medium text-white">{text}</span>
      <Button asChild variant="primary" size="sm" className="www-btn shrink-0" tabIndex={visible ? 0 : -1}>
        <a href={href} id="sticky-connect-btn">
          {label}
        </a>
      </Button>
    </div>
  )
}
