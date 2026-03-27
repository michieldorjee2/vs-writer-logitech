// ===== Smooth Scrolling =====
// Lenis disabled for performance — it runs a JS RAF loop on every frame
// that conflicts with ScrollTrigger + canvas animation.
// Using native CSS smooth scroll instead (compositor-thread, zero JS cost).

// Just ensure ScrollTrigger works with native scroll:
if (typeof ScrollTrigger !== 'undefined') {
  ScrollTrigger.defaults({ scroller: window });
}
