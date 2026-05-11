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
