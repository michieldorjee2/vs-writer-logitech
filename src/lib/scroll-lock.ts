/**
 * Holds the page still under a card (the Report, the Share card, a personal link's note): no
 * scrolling, and no jump either. Hiding the scrollbar widens the page by the scrollbar's width,
 * so the page is padded by exactly that much while it is held (`--scroll-lock-gap`, used in
 * activity-mode.css and invite-note.css). `scrollbar-gutter: stable` on the root was tried and
 * Chrome computed it without reserving the space. Returns the release.
 */
const LOCKS = ['activity-open', 'invite-open']

export function lockScroll(className: 'activity-open' | 'invite-open'): () => void {
  const root = document.documentElement
  // Measured only when nothing holds the page yet: once held, there is no scrollbar to measure.
  if (!LOCKS.some((c) => root.classList.contains(c))) {
    root.style.setProperty('--scroll-lock-gap', `${Math.max(0, window.innerWidth - root.clientWidth)}px`)
  }
  root.classList.add(className)
  return () => {
    root.classList.remove(className)
    if (!LOCKS.some((c) => root.classList.contains(c))) root.style.removeProperty('--scroll-lock-gap')
  }
}
