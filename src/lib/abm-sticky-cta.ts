/**
 * Sticky CTA Bar
 * - Slides in once the user scrolls past the hero
 * - Hides when approaching the final CTA section
 * - Text evolves through scroll phases, becoming more direct
 * - Glow intensity increases the further down you scroll
 *
 * Converted from aldus-hyper sticky-cta.js to TypeScript module
 */

// Store references for cleanup
let scrollHandler: (() => void) | null = null;
let scrollElHandler: (() => void) | null = null;
let resizeHandler: (() => void) | null = null;
let scrollElRef: Element | null = null;

export function initStickyCTA(): void {
  const bar = document.getElementById('sticky-cta');
  const textEl = document.getElementById('sticky-cta-text');
  const hero = document.getElementById('hero');
  const ctaSec = document.getElementById('cta');
  if (!bar || !textEl || !hero || !ctaSec) return;

  // Detect the actual scroll container -- body when html has overflow-x:clip
  const scrollEl =
    document.body.scrollHeight > document.documentElement.scrollHeight
      ? document.body
      : document.documentElement;
  scrollElRef = scrollEl;

  function getScrollY(): number {
    return scrollEl.scrollTop || window.scrollY || 0;
  }

  // Section-keyed copy -- ordered by vertical position on the page
  const phases = [
    { id: 'intel', text: 'Explore what Optimizely can do' },
    { id: 'challenge', text: 'See how we solve your challenges' },
    { id: 'comparison', text: 'Compare the platforms side by side' },
    { id: 'proof', text: 'Trusted by teams like yours' },
    { id: 'roi', text: 'See what this means for NovaTech' },
    { id: 'migration', text: 'Your migration path is ready' },
  ];

  // Cache section elements
  const sectionEls = phases
    .map((p) => ({
      el: document.getElementById(p.id),
      text: p.text,
    }))
    .filter((s): s is { el: HTMLElement; text: string } => s.el !== null);

  let currentText = '';
  // Cache viewport height -- on mobile, window.innerHeight changes as the
  // browser chrome (URL bar) collapses/expands during scroll, which causes
  // the show/hide threshold to oscillate. Only update on resize.
  let viewH = window.innerHeight;

  function update(): void {
    const scrollY = getScrollY();
    const heroBottom = hero!.offsetTop + hero!.offsetHeight;
    const ctaTop = ctaSec!.offsetTop;

    // Read visibility from DOM so external code (warp-cta) can hide us
    const visible = bar!.classList.contains('sticky-cta--visible');

    // Show after hero, hide 1 viewport before CTA section
    const shouldShow =
      scrollY > heroBottom - viewH * 0.3 && scrollY < ctaTop - viewH * 0.8;

    if (shouldShow && !visible) {
      bar!.classList.add('sticky-cta--visible');
      bar!.setAttribute('aria-hidden', 'false');
    } else if (!shouldShow && visible) {
      bar!.classList.remove('sticky-cta--visible');
      bar!.setAttribute('aria-hidden', 'true');
    }

    if (!shouldShow) return;

    // Determine which section the user is currently in
    let newText = phases[0].text;
    for (let i = sectionEls.length - 1; i >= 0; i--) {
      const sec = sectionEls[i];
      if (scrollY + viewH * 0.5 >= sec.el.offsetTop) {
        newText = sec.text;
        break;
      }
    }

    if (newText !== currentText) {
      currentText = newText;
      // Quick fade transition
      textEl!.style.opacity = '0';
      setTimeout(() => {
        textEl!.textContent = currentText;
        textEl!.style.opacity = '1';
      }, 180);
    }

    // Intensity: 0 at hero bottom -> 1 at migration section
    const scrollRange = ctaTop - heroBottom;
    const progress = Math.max(
      0,
      Math.min(1, (scrollY - heroBottom) / scrollRange)
    );
    bar!.style.setProperty('--sticky-intensity', progress.toFixed(2));

    // Border glow ramps up with progress
    const borderAlpha = 0.08 + progress * 0.25;
    bar!.style.borderTopColor = `rgba(60, 110, 255, ${borderAlpha.toFixed(2)})`;
  }

  // Listen on both window and the scroll element to catch all scroll sources
  let ticking = false;
  function onScroll(): void {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }
  }

  scrollHandler = onScroll;
  window.addEventListener('scroll', onScroll, { passive: true });

  if (scrollEl !== document.documentElement) {
    scrollElHandler = onScroll;
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
  }

  // Also handle resize (section offsets + viewport height change)
  resizeHandler = () => {
    viewH = window.innerHeight;
    update();
  };
  window.addEventListener('resize', resizeHandler, { passive: true });

  // Initial check
  update();

  // Smooth text transition
  textEl.style.transition = 'opacity 0.18s ease';
}

export function cleanupStickyCTA(): void {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }

  if (scrollElHandler && scrollElRef) {
    scrollElRef.removeEventListener('scroll', scrollElHandler);
    scrollElHandler = null;
    scrollElRef = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
}
