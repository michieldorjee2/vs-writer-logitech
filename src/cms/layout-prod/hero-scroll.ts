/**
 * Scroll waypoints for the full-bleed hero (`treatment: hero` + a non-card container width).
 *
 * The hero's backdrop is `position: fixed` behind the page (index.css `.vb-hero__backdrop`); the
 * white sections after it scroll up OVER it. This hook publishes one number, `--vb-hero-p`, on
 * <html>: 0 at the top of the page, 1 once the hero has scrolled fully away. index.css maps it:
 *
 *   p 0.00 -> backdrop at full strength, hero copy at rest
 *   p 0.35 -> copy starts to lift and fade (waypoint 1)
 *   p 0.75 -> backdrop mostly gone, dissolving into the white page (waypoint 2)
 *   p 1.00 -> backdrop hidden, so it costs nothing further down
 *
 * It also reveals each later row as it enters the viewport. Rows are hidden only once this has
 * run, so a page without JavaScript (or a crawler) sees everything. `prefers-reduced-motion`
 * skips the reveal and keeps the fade, which is a change of colour, not motion.
 */
import { useEffect, type RefObject } from 'react'

export function useHeroScroll(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const hero = ref.current
    if (!enabled || !hero || typeof window === 'undefined') return
    const root = document.documentElement

    let frame = 0
    const update = () => {
      frame = 0
      const height = hero.offsetHeight || window.innerHeight
      const p = Math.min(1, Math.max(0, window.scrollY / height))
      root.style.setProperty('--vb-hero-p', p.toFixed(3))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    // Waypoint reveals for everything below the hero.
    let observer: IntersectionObserver | undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced && 'IntersectionObserver' in window) {
      const page = hero.closest('.vb-experience') ?? document
      const rows = [...page.querySelectorAll<HTMLElement>('.vb-row')].filter((row) => !hero.contains(row))
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            entry.target.classList.add('vb-in')
            observer?.unobserve(entry.target)
          }
        },
        { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
      )
      for (const row of rows) {
        // Rows already on screen at load stay as they are; only those still below the fold wait.
        if (row.getBoundingClientRect().top < window.innerHeight * 0.9) continue
        row.classList.add('vb-pre')
        observer.observe(row)
      }
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      observer?.disconnect()
      root.style.removeProperty('--vb-hero-p')
    }
  }, [ref, enabled])
}
