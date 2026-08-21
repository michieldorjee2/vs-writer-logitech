// ===========================================================================
// Retail — GSAP scroll choreography
// Magazine-grade reveals: parallax hero, masked image reveals, hairline draws,
// scroll-progress hairline in the left rail.
// ===========================================================================

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let initialized = false;
let resizeRaf = 0;

/* ---- Hero parallax ---- */
function initHeroParallax(): void {
  const hero = document.querySelector<HTMLElement>('.retail-hero');
  const slate = document.querySelector<HTMLElement>('.retail-hero__slate');
  const content = document.querySelector<HTMLElement>('.retail-hero__content');
  const scrollhint = document.querySelector<HTMLElement>('.retail-hero__scrollhint');
  if (!hero || !slate || !content) return;

  // Slate drifts up slightly slower than the foreground
  gsap.to(slate, {
    y: '12vh',
    scale: 1.04,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.6,
    },
  });

  // Content drifts up faster, fades out
  gsap.to(content, {
    y: -48,
    opacity: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom 70%',
      scrub: 0.8,
    },
  });

  if (scrollhint) {
    gsap.to(scrollhint, {
      opacity: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: '5% top',
        end: '20% top',
        scrub: 0.4,
      },
    });
  }
}

/* ---- Reveal-on-scroll (opacity + translateY) ---- */
function initReveals(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-retail-reveal]');
  els.forEach((el) => {
    const delay = parseFloat(el.getAttribute('data-retail-delay') || '0');
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        setTimeout(() => el.classList.add('is-revealed'), delay);
      },
    });
  });
}

/* ---- Masked image reveals (cover-slides-up) ---- */
function initMaskReveals(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-retail-mask]');
  els.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 80%',
      once: true,
      onEnter: () => el.classList.add('is-revealed'),
    });
  });
}

/* ---- Hairline draws (gold underline expand) ---- */
function initHairlines(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-retail-hairline]');
  els.forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => el.classList.add('is-revealed'),
    });
  });
}

/* ---- Lookbook frame staggered reveal ---- */
function initLookbookStagger(): void {
  const frames = gsap.utils.toArray<HTMLElement>('.retail-heldforyou__frame');
  if (frames.length === 0) return;

  frames.forEach((frame, i) => {
    gsap.fromTo(
      frame,
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        delay: i * 0.12,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: frame,
          start: 'top 88%',
          once: true,
        },
      }
    );
  });
}

/* ---- Atelier plate parallax ---- */
function initAtelierParallax(): void {
  const plate = document.querySelector<HTMLElement>('.retail-atelier__plate');
  if (!plate) return;

  gsap.fromTo(
    plate,
    { y: 20 },
    {
      y: -40,
      ease: 'none',
      scrollTrigger: {
        trigger: '.retail-atelier',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    }
  );
}

/* ---- Top-bar visibility ---- */
function initTopbar(): void {
  const topbar = document.querySelector<HTMLElement>('.retail-topbar');
  const hero = document.querySelector<HTMLElement>('.retail-hero');
  if (!topbar || !hero) return;

  ScrollTrigger.create({
    trigger: hero,
    start: 'bottom 80%',
    onEnter: () => topbar.classList.add('is-visible'),
    onLeaveBack: () => topbar.classList.remove('is-visible'),
  });
}

/* ---- Scroll progress rail ---- */
function initProgressRail(): void {
  const fill = document.querySelector<HTMLElement>('.retail-progress__fill');
  if (!fill) return;

  gsap.to(fill, {
    height: '100%',
    ease: 'none',
    scrollTrigger: {
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4,
    },
  });
}

/* ---- Hero word reveal (handled by CSS class but kick the timing) ---- */
function initHeroEntrance(): void {
  const hero = document.querySelector<HTMLElement>('.retail-hero');
  if (!hero) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => hero.classList.add('is-loaded'));
  });
}

/* ---- Page mount fade-in ---- */
function initPageMount(): void {
  const page = document.querySelector<HTMLElement>('.retail-page');
  if (!page) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => page.classList.add('is-mounted'));
  });
}

/* ---- Polaroids — stacked-and-paperclipped, fan out on scroll ----
 *
 * Initial state: all 6 polaroids overlap at the letter's center, slightly
 * offset/rotated so the bundle looks held. The paperclip lives ON the
 * first polaroid, so visually it fastens the stack and rides with that
 * photo afterward (no separate floating clip).
 *
 * Scroll: each polaroid drifts from the stacked position out to its slot,
 * with a small per-card stagger. Pointer events are disabled on the cards
 * until the timeline finishes — opening one mid-flight would confuse the
 * Framer Motion shared-element transition and leave the closed card in
 * the wrong place.
 */
function initPolaroidFanOut(): void {
  const section = document.querySelector<HTMLElement>('.retail-letter-section');
  const collage = document.querySelector<HTMLElement>('.retail-collage');
  const polaroids = gsap.utils.toArray<HTMLElement>('.retail-polaroid--falling');
  const letter = document.querySelector<HTMLElement>('[data-retail-letter]');
  if (!section || !collage || polaroids.length === 0) return;

  // Disable clicks until the fan-out completes. This keeps the layoutId
  // shared transition (in LetterAndPolaroids) consistent — the polaroid's
  // settled bounding box matches its slot CSS rather than a mid-animation
  // transform.
  polaroids.forEach((p) => {
    p.style.pointerEvents = 'none';
  });

  const enableClicks = () => polaroids.forEach((p) => { p.style.pointerEvents = ''; });
  const disableClicks = () => polaroids.forEach((p) => { p.style.pointerEvents = 'none'; });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 70%',
      end: 'top 10%',
      scrub: 0.8,
      // Settled state: timeline at progress 1 → polaroids in their slots → safe to click.
      onLeave: enableClicks,
      onLeaveBack: enableClicks,
      // Scrubbing state: polaroids are mid-transform → block clicks so the
      // shared-element lightbox transition doesn't snap to the wrong source.
      onEnter: disableClicks,
      onEnterBack: disableClicks,
    },
  });

  // ---- Compute per-polaroid delta from slot back to letter center ----
  const letterRect = letter?.getBoundingClientRect();
  const letterCenterX = letterRect ? letterRect.left + letterRect.width / 2 : 0;
  const letterCenterY = letterRect ? letterRect.top + letterRect.height * 0.35 : 0;

  polaroids.forEach((p, i) => {
    const rect = p.getBoundingClientRect();
    const polCenterX = rect.left + rect.width / 2;
    const polCenterY = rect.top + rect.height / 2;
    const dx = letterCenterX - polCenterX;
    const dy = letterCenterY - polCenterY;
    const stackOffsetX = (i - 2.5) * 8;
    const stackOffsetY = (i - 2.5) * 5;
    const stackRot = (i - 2.5) * 3.5;

    // Initial: stacked at the letter center, paperclip on polaroid[0]
    // visually holds the bundle.
    gsap.set(p, {
      x: dx + stackOffsetX,
      y: dy + stackOffsetY,
      rotate: stackRot,
      scale: 1.04,
      zIndex: 10 - i, // first polaroid on top of the pile
    });

    tl.to(
      p,
      {
        x: 0,
        y: 0,
        rotate: 'var(--rotate)',
        scale: 1,
        zIndex: 1,
        ease: 'power3.out',
        duration: 1,
      },
      i * 0.08,
    );
  });
}

/* ===== Public API ===== */

export function initRetailAnimations(): void {
  if (initialized) return;
  initialized = true;

  initPageMount();
  initHeroEntrance();
  initHeroParallax();
  initReveals();
  initMaskReveals();
  initHairlines();
  initLookbookStagger();
  initPolaroidFanOut();
  initAtelierParallax();
  initTopbar();
  initProgressRail();

  // Recompute on resize (debounced)
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => ScrollTrigger.refresh());
  };
  window.addEventListener('resize', onResize, { passive: true });
}

export function cleanupRetailAnimations(): void {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  initialized = false;
  cancelAnimationFrame(resizeRaf);
}
