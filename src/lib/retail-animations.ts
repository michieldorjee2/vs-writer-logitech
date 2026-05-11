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

/* ---- Polaroids: stack → fan + letter 3D unfold (scrub) ----
 *
 * Initial state (start of section):
 *   - Polaroids are stacked center, large, overlapping
 *   - Letter is folded closed (rotateX(-78deg), scale 0.96)
 *
 * As the user scrolls, polaroids fly to their final slot positions
 * (recorded by .retail-polaroid--slot-* CSS placement) while the letter
 * unfolds (rotateX → 0, scale → 1). The whole arc runs over ~80% of the
 * section's scrollable height with scrub:0.6 so it feels smooth, not
 * jittery.
 *
 * We use gsap.fromTo on each polaroid: starts at a center-stacked
 * position, ends at "do nothing" (its CSS-placed slot). Letter has its
 * own timeline.
 */
function initPolaroidFanOut(): void {
  const section = document.querySelector<HTMLElement>('.retail-letter-section');
  const polaroids = gsap.utils.toArray<HTMLElement>('.retail-polaroid--falling');
  const letter = document.querySelector<HTMLElement>('[data-retail-letter]');
  if (!section || polaroids.length === 0) return;

  // 3D perspective on the section so the letter unfold reads as fold-open
  section.style.perspective = '1600px';

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 80%',
      end: 'bottom 30%',
      scrub: 0.6,
    },
  });

  // Polaroids — compute the delta from each polaroid's CSS-placed slot to
  // the letter's center, then animate FROM that center back to 0,0 (rest).
  // This makes the stack-to-fan effect feel like the polaroids dropped on
  // top of the letter and then dealt outwards.
  const letterRect = letter?.getBoundingClientRect();
  const letterCenterX = letterRect ? letterRect.left + letterRect.width / 2 : 0;
  const letterCenterY = letterRect ? letterRect.top + letterRect.height / 2 : 0;

  polaroids.forEach((p, i) => {
    const rect = p.getBoundingClientRect();
    const polCenterX = rect.left + rect.width / 2;
    const polCenterY = rect.top + rect.height / 2;
    const dx = letterCenterX - polCenterX;
    const dy = letterCenterY - polCenterY;
    const stackOffsetX = (i - 2.5) * 10;
    const stackOffsetY = (i - 2.5) * 14;
    const stackRot = (i - 2.5) * 5;

    tl.fromTo(
      p,
      {
        x: dx + stackOffsetX,
        y: dy + stackOffsetY,
        rotate: stackRot,
        scale: 1.15,
        opacity: 0.45,
      },
      {
        x: 0,
        y: 0,
        rotate: 'var(--rotate)',
        scale: 1,
        opacity: 1,
        ease: 'power2.out',
      },
      i * 0.05
    );
  });

  if (letter) {
    // Letter unfolds — starts hidden + tilted, ends flat
    tl.fromTo(
      letter,
      {
        rotateX: -78,
        scaleY: 0.6,
        opacity: 0,
        transformOrigin: '50% 0%',
      },
      {
        rotateX: 0,
        scaleY: 1,
        opacity: 1,
        ease: 'power3.out',
      },
      0
    );
  }
}

/* ---- Letter — paragraph-by-paragraph reveal as user scrolls down ---- */
function initLetterReveal(): void {
  const paragraphs = gsap.utils.toArray<HTMLElement>('[data-retail-letter-line]');
  const signoff = document.querySelector<HTMLElement>('.retail-letter__signoff');

  paragraphs.forEach((p, i) => {
    ScrollTrigger.create({
      trigger: p,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        setTimeout(() => p.classList.add('is-revealed'), i * 60);
      },
    });
  });

  if (signoff) {
    ScrollTrigger.create({
      trigger: signoff,
      start: 'top 90%',
      once: true,
      onEnter: () => signoff.classList.add('is-revealed'),
    });
  }
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
  initLetterReveal();
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
