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
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  useHeroDrift()
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

/**
 * Scroll waypoints. Each scene gets `is-in` the first time a fifth of it is on screen, which
 * plays its entrance (the parts rise, slide or settle in, in order; see "motion" in www.css).
 * The scene the reader is in gets `is-current`, for effects that follow the reader.
 */
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
    // A thin band across the middle of the window: whichever scene crosses it is current.
    const current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle('is-current', e.isIntersecting)
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    scenes.forEach((s) => {
      io.observe(s)
      current.observe(s)
    })
    return () => {
      io.disconnect()
      current.disconnect()
    }
  }, [])
}

/**
 * As the reader scrolls out of the hero, its landscape drifts slower than the page and the copy
 * lifts away: `--hero-p` runs 0 → 1 over the hero's height. Presentation only (a CSS variable);
 * reduced motion turns the effect off in CSS.
 */
function useHeroDrift() {
  useEffect(() => {
    const hero = document.getElementById('hero')
    if (!hero) return
    let raf = 0
    const update = () => {
      raf = 0
      const h = hero.offsetHeight || 1
      hero.style.setProperty('--hero-p', String(Math.min(1, Math.max(0, scrollY / h)).toFixed(3)))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    addEventListener('scroll', onScroll, { passive: true })
    return () => {
      removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
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

/**
 * The brand mark, anchored to the top-left corner of the hero (brand rule for a small logo).
 * Whose page this is is said once, by the AccountMark above the headline, not here as well.
 */
export function TopStrip() {
  return (
    <div className="www-strip">
      <a href="https://www.optimizely.com/" aria-label="Optimizely" className="shrink-0">
        <img src="/optimizely-logo-color.svg" alt="Optimizely" width={150} height={37} className="h-6 w-auto lg:h-7" />
      </a>
    </div>
  )
}

/**
 * The account's logo above the headline, with the page's one line of personalization beside it
 * ("Personalized for CDW"). Any logo sits on a white tile with room around it, so a transparent
 * mark, a square icon and a logo with its own white box all look deliberate.
 */
export function AccountMark({
  name,
  logo,
  label,
  xray,
  accent = false,
  edit,
}: {
  name: string
  logo?: string | null
  label: string
  xray?: string
  /** The takeout page's one use of the account's own colour (brandAccentColor): a stripe under the logo. */
  accent?: boolean
  /** The CMS editor's hooks on the logo and the label, in its preview (./cms-edit.tsx). */
  edit?: { logo?: Record<string, string>; label?: Record<string, string> }
}) {
  // A logo URL that no longer answers shows the initials instead of a broken-image icon. It may
  // fail before hydration (no onError then), so the effect also checks the image once mounted.
  // Presentation only: a data attribute the CSS reads, no state, so nothing can mismatch.
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) el.parentElement?.setAttribute('data-broken', '')
  }, [])
  return (
    <div className={cn('www-account', accent && 'www-account--accent')} data-xray={xray}>
      <span className="www-account__logo" {...edit?.logo}>
        {logo && (
          <img
            ref={img}
            src={logo}
            alt={`${name} logo`}
            width={40}
            height={40}
            onError={(e) => e.currentTarget.parentElement?.setAttribute('data-broken', '')}
          />
        )}
        <span className="www-account__initials" aria-hidden="true">
          {initialsOf(name)}
        </span>
      </span>
      <span className="www-account__label" {...edit?.label}>
        {label}
      </span>
    </div>
  )
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

/**
 * The hero landscape, in every size the scene set ships (960 to 2880 wide), so it stays sharp
 * on a large retina screen now that it runs to the window's edge.
 */
export function HeroImage({ scene, sizes = '(min-width: 992px) 48vw, 100vw' }: { scene: string; sizes?: string }) {
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={[960, 1280, 1600, 1920, 2400, 2880].map((w) => `${scene}-${w}.avif ${w}w`).join(', ')}
        sizes={sizes}
      />
      <img
        src={`${scene}-1600.webp`}
        srcSet={[960, 1600, 2400].map((w) => `${scene}-${w}.webp ${w}w`).join(', ')}
        sizes={sizes}
        alt=""
        className="www-hero__img"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  )
}

/**
 * The hero, full screen: edge to edge, three quarters of the window's height so the next scene
 * peeks in underneath. Copy on the left (aligned with the page's content column), the landscape
 * running to the right edge. It plays an intro on first paint (www.css "hero intro"), from the
 * server's HTML, before any script runs.
 */
export function HeroFrame({
  look = 'darkfir',
  state,
  scene,
  copy,
  visual,
  attrs,
}: {
  look?: string
  state?: string
  scene: string
  copy: ReactNode
  visual?: ReactNode
  /** Extra attributes for the section: the CMS editor's hook in its preview (./cms-edit.tsx). */
  attrs?: Record<string, string>
}) {
  return (
    <section id="hero" data-scene className="www-hero is-in" {...attrs}>
      <div className={cn('www-hero__card', `www-hero__card--${look}`)} data-state={state}>
        <div className="www-hero__copy">
          <TopStrip />
          <div className="www-hero__body">{copy}</div>
        </div>
        <div className="www-hero__visual">
          <HeroImage scene={scene} />
          {visual}
        </div>
      </div>
    </section>
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
  attrs,
  children,
}: {
  id?: string
  tone?: Tone
  fill?: boolean
  /** A short scene (a two-card block, an opening paragraph) takes its own height everywhere. */
  compact?: boolean
  className?: string
  innerClassName?: string
  /** Extra attributes for the section: the CMS editor's hook in its preview (./cms-edit.tsx). */
  attrs?: Record<string, string>
  children: ReactNode
}) {
  return (
    <section
      {...attrs}
      id={id}
      data-scene
      data-tone={tone}
      className={cn('www-scene', `www-scene--${tone}`, fill && 'www-scene--fill', compact && 'www-scene--compact', className)}
    >
      <div className={cn('www-scene__inner vb-container mx-auto w-full px-4 lg:px-8', innerClassName)}>{children}</div>
    </section>
  )
}

/** How a part enters at its scene's waypoint: rise (default), slide in from a side, drop, or settle from a little larger. */
export type RevealFx = 'up' | 'left' | 'right' | 'drop' | 'scale'

/** Staggered reveal: children of a scene enter, in order, as the scene reaches its waypoint. */
export function Reveal({
  i = 0,
  fx,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: {
  i?: number
  fx?: RevealFx
  as?: 'div' | 'li' | 'p' | 'span' | 'figure' | 'aside'
  className?: string
  children: ReactNode
  'aria-hidden'?: boolean | 'true'
  [key: `data-${string}`]: string | undefined
}) {
  return (
    <Tag data-reveal={fx && fx !== 'up' ? fx : ''} className={className} style={{ '--i': i } as CSSProperties} {...rest}>
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
 * How big a headline sized to its own length (`fit`) is drawn: the font size that fills about the
 * same area whatever the length, so a short headline is set large and a long one steps down
 * instead of running to five or six lines. The size goes as 1/√(characters), against the width
 * of the copy column and the window's height (www.css `.www-display--fit`). 33 characters
 * ("Optimizely at 6sense Breakthrough") is set as large as the display size allows, 74 about
 * two thirds of that.
 */
export function fitVars(text: string): CSSProperties {
  const n = Math.max(12, plain(text).length)
  const r = 1 / Math.sqrt(n)
  return { '--fit-w': (0.9 * r).toFixed(4), '--fit-h': (0.62 * r).toFixed(4) } as CSSProperties
}

/**
 * Headings. A `##run##` is the writer's emphasis: on most headings it becomes the accent
 * colour (the brand's "Clear" level). `extrude` turns it into the extruded run instead, via
 * optimizely.com's StackedHeading. The brand allows one extruded moment per design, so only the
 * offer's hero headline uses it. `fit` sizes a display headline to its length (fitVars).
 */
export function Heading({
  text,
  level = 'h2',
  size,
  align = 'left',
  extrude = false,
  fit = false,
  className,
}: {
  text: string
  level?: 'h1' | 'h2' | 'h3'
  size?: Size
  align?: 'left' | 'center'
  extrude?: boolean
  fit?: boolean
  className?: string
}) {
  if (!text) return null
  const sz = size ?? (level === 'h1' ? 'display' : level)
  const sizeClass = cn(`www-${sz}`, fit && 'www-display--fit')
  const fitted = (heading: ReactNode) => (fit ? <div style={fitVars(text)}>{heading}</div> : heading)
  if (extrude && text.includes('##')) {
    return fitted(
      <StackedHeading
        text={text}
        as={level}
        fontSizeOverrides={sizeClass}
        leadingOverrides="leading-[0.98]"
        alignment={align}
        animationMode="none"
        extrusionCount={5}
        colorScheme="inherit"
        className={cn('text-balance', className)}
      />,
    )
  }
  const Tag = level
  const lines = text.split('\n')
  // Each word is its own span so a heading can come in word by word at its scene's waypoint
  // (www.css "motion"). The spaces stay plain text, so the heading reads, wraps and copies as one.
  let w = 0
  const words = (s: string) =>
    s.split(/(\s+)/).map((part, k) =>
      !part || /^\s+$/.test(part) ? (
        part
      ) : (
        <span key={k} className="www-w" style={{ '--w': w++ } as CSSProperties}>
          {part}
        </span>
      ),
    )
  return fitted(
    <Tag className={cn(sizeClass, align === 'center' && 'text-center', 'text-balance', className)}>
      {lines.map((line, li) => (
        <span key={li} className={lines.length > 1 ? 'block' : undefined}>
          {line.split(/##(.+?)##/g).map((p, i) =>
            i % 2 === 1 ? (
              <span key={i} className="www-emph">
                {words(p)}
              </span>
            ) : (
              <Fragment key={i}>{words(p)}</Fragment>
            ),
          )}
        </span>
      ))}
    </Tag>,
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
  attrs,
}: {
  tone?: 'neutral' | 'white' | 'dark'
  className?: string
  children: ReactNode
  /** The X-ray / Edit mode hook (see ABM_XRAY_DEFAULTS in src/lib/xray-defaults.ts). */
  xray?: string
  /** Extra attributes: the CMS editor's hook in its preview (./cms-edit.tsx). */
  attrs?: Record<string, string>
}) {
  return (
    <div {...attrs} data-xray={xray} className={cn('www-card', `www-card--${tone}`, className)}>
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
export function Colophon({ children, xray, field }: { children: ReactNode; xray?: string; field?: string }) {
  return (
    <div className="www-colophon" data-xray={xray} data-field={field}>
      {children}
    </div>
  )
}

/* ---------------------------------------------------------------- steps */

/** Horizontal steps on a rule that draws itself as the scene enters; a vertical list on a phone. */
export function Steps({
  steps,
  xray,
  tone = 'light',
}: {
  steps: Array<{ label: string; title: string; body: string; attrs?: Record<string, string> }>
  xray?: string
  tone?: 'light' | 'dark'
}) {
  return (
    <ol className={cn('www-steps', `www-steps--${steps.length > 4 ? 'many' : steps.length}`, tone === 'dark' && 'www-steps--dark')} role="list">
      {steps.map((s, i) => (
        <Reveal key={i} as="li" i={3 + i} data-xray={xray} className="www-step" {...s.attrs}>
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

/**
 * The floating ask, shown between the hero and the closing scene. With `onAction` it is the
 * Limitless one-click button (it pings the team itself, see ConnectModal); with only `href` it is
 * a link (the offer page's sign-up).
 */
export function StickyCta({
  text,
  href = '#cta',
  label = 'Talk to your team',
  endId = 'cta',
  onAction,
}: {
  text: string
  href?: string
  label?: string
  endId?: string
  onAction?: () => void
}) {
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
      {onAction ? (
        <Button variant="primary" size="sm" className="www-btn shrink-0" tabIndex={visible ? 0 : -1} id="sticky-connect-btn" onClick={onAction}>
          {label}
        </Button>
      ) : (
        <Button asChild variant="primary" size="sm" className="www-btn shrink-0" tabIndex={visible ? 0 : -1}>
          <a href={href} id="sticky-connect-btn">
            {label}
          </a>
        </Button>
      )}
    </div>
  )
}
