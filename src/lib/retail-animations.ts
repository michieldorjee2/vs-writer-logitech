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

/* ---- Polaroids + Letter — stack-and-fall + 3D tri-fold unfold ----
 *
 * The arc spans ~120% of section height (scrub 0.6 for smoothness):
 *
 *   Phase A (0-40%):  Polaroids are stacked center, paperclipped together.
 *                     Letter folded into thirds (top + bottom panels
 *                     rotateX -90°/+90° around the crease lines, middle
 *                     scaled down vertically).
 *   Phase B (35-65%): Paperclip releases (lifts off, fades). Polaroids
 *                     spring apart toward their slot positions.
 *   Phase C (55-100%): Letter unfolds — top panel rotates from -90° to 0
 *                      around its bottom edge, bottom from +90° to 0
 *                      around its top edge, middle scales back to 1.
 *
 * Implementation: GSAP timeline with scrub. The three "panels" of the
 * letter live as separate divs in the DOM, but the unfolding is done
 * with CSS transforms on the wrapper (rotateX) since the middle panel
 * carries all the actual content.
 */
function initPolaroidFanOut(): void {
  const section = document.querySelector<HTMLElement>('.retail-letter-section');
  const collage = document.querySelector<HTMLElement>('.retail-collage');
  const polaroids = gsap.utils.toArray<HTMLElement>('.retail-polaroid--falling');
  const letter = document.querySelector<HTMLElement>('[data-retail-letter]');
  const midPanel = document.querySelector<HTMLElement>('[data-retail-panel="mid"]');
  const topPanel = document.querySelector<HTMLElement>('[data-retail-panel="top"]');
  const botPanel = document.querySelector<HTMLElement>('[data-retail-panel="bottom"]');
  const stackClip = document.querySelector<HTMLElement>('[data-retail-stack-clip]');
  if (!section || !collage || polaroids.length === 0) return;

  section.style.perspective = '1800px';
  // Letter needs preserve-3d for the panel rotations to read as folds
  if (letter) letter.style.transformStyle = 'preserve-3d';
  if (midPanel) midPanel.style.transformStyle = 'preserve-3d';

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top 75%',
      end: 'bottom 25%',
      scrub: 0.6,
    },
  });

  // ---- Compute per-polaroid delta from slot to letter center ----
  const letterRect = letter?.getBoundingClientRect();
  const letterCenterX = letterRect ? letterRect.left + letterRect.width / 2 : 0;
  const letterCenterY = letterRect ? letterRect.top + letterRect.height / 2 : 0;

  // ---- A. Initial stack state for each polaroid ----
  polaroids.forEach((p, i) => {
    const rect = p.getBoundingClientRect();
    const polCenterX = rect.left + rect.width / 2;
    const polCenterY = rect.top + rect.height / 2;
    const dx = letterCenterX - polCenterX;
    const dy = letterCenterY - polCenterY;
    // Tight stack — small offsets between cards so the bundle looks held
    const stackOffsetX = (i - 2.5) * 6;
    const stackOffsetY = (i - 2.5) * 4;
    const stackRot = (i - 2.5) * 3;

    // Pre-set the "stacked" position before the timeline runs
    gsap.set(p, {
      x: dx + stackOffsetX,
      y: dy + stackOffsetY,
      rotate: stackRot,
      scale: 1.05,
      zIndex: 10 + i,
    });

    // Animate FROM stacked TO settled (slot)
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
      0.3 + i * 0.08, // tiny stagger so they don't all fly at once
    );
  });

  // ---- B. Paperclip — visible at start, releases as polaroids spread ----
  if (stackClip) {
    // Position the clip at the stack centre on first paint
    if (letterRect) {
      gsap.set(stackClip, {
        left: letterCenterX - (section.getBoundingClientRect().left),
        top: letterCenterY - (section.getBoundingClientRect().top) - 80,
      });
    }
    tl.to(
      stackClip,
      {
        y: -120,
        rotate: -45,
        opacity: 0,
        ease: 'power2.in',
        duration: 0.8,
      },
      0.2,
    );
  }

  // ---- C. Letter tri-fold unfolds ----
  if (letter && topPanel && botPanel && midPanel) {
    // Initial: letter is folded into thirds and small.
    // The middle panel carries the content; the top/bottom panels are
    // empty placeholder divs that flip down/up to reveal it.
    gsap.set(letter, { scale: 0.9, opacity: 0 });
    gsap.set(midPanel, {
      scaleY: 0.34,
      transformOrigin: '50% 50%',
    });
    gsap.set(topPanel, {
      rotateX: -180,
      transformOrigin: '50% 100%',
      height: '33%',
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      background: '#fbf6e8',
      borderBottom: '1px solid rgba(123, 95, 60, 0.16)',
    });
    gsap.set(botPanel, {
      rotateX: 180,
      transformOrigin: '50% 0%',
      height: '33%',
      width: '100%',
      position: 'absolute',
      bottom: 0,
      left: 0,
      background: '#fbf6e8',
      borderTop: '1px solid rgba(123, 95, 60, 0.16)',
    });

    // Phase 1: letter appears (still folded)
    tl.to(
      letter,
      { scale: 1, opacity: 1, ease: 'power2.out', duration: 0.5 },
      0.3,
    );

    // Phase 2: top panel unfolds first
    tl.to(
      topPanel,
      { rotateX: 0, ease: 'power3.out', duration: 1 },
      0.5,
    );

    // Phase 3: middle panel expands to full height
    tl.to(
      midPanel,
      { scaleY: 1, ease: 'power3.out', duration: 1 },
      0.7,
    );

    // Phase 4: bottom panel unfolds last
    tl.to(
      botPanel,
      { rotateX: 0, ease: 'power3.out', duration: 1 },
      1.1,
    );

    // Phase 5: hide top/bottom panel placeholders after unfold (they
    // covered the crease lines during the fold; we want the creases
    // visible on the laid-flat letter).
    tl.to(
      [topPanel, botPanel],
      { autoAlpha: 0, ease: 'power2.in', duration: 0.4 },
      1.9,
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
