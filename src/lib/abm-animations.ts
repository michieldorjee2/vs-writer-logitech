// ===== GSAP ScrollTrigger Animations =====
// Scroll-driven reveals for every section
// Converted from aldus-hyper animations.js to TypeScript module

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ===== Hero Scroll Parallax =====
// Canvas fade is handled by hero-3d.ts ScrollTrigger
function initHeroAnimations(): void {
  const heroContent = document.querySelector('.hero__content');
  const hero = document.getElementById('hero');
  if (!heroContent || !hero) return;

  // Parallax the hero content on scroll
  gsap.to('.hero__content', {
    y: -120,
    opacity: 0,
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1,
    },
  });

  // Fade the light sweep
  gsap.to('.hero__light-sweep', {
    opacity: 0,
    scrollTrigger: {
      trigger: '#hero',
      start: '30% top',
      end: '70% top',
      scrub: 1,
    },
  });
}

// ===== Generic Scroll-In Animation =====
function initScrollAnimations(): void {
  const animatedElements = document.querySelectorAll('[data-animate]');
  if (animatedElements.length === 0) return;

  animatedElements.forEach((el) => {
    const type = el.getAttribute('data-animate');
    const delay = parseFloat(el.getAttribute('data-delay') || '0');

    // Explicit from/to so animations work regardless of CSS cascade order
    const fromProps: any = { opacity: 0 };
    const toProps: any = {
      opacity: 1,
      duration: 0.55,
      delay: delay * 0.5,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 95%',
        toggleActions: 'play none play none',
      },
    };

    switch (type) {
      case 'fan-out':
        return; // handled by initStakeholderFanOut()
      case 'fade-up':
        fromProps.y = 24;
        toProps.y = 0;
        break;
      case 'fade-right':
        fromProps.x = -24;
        toProps.x = 0;
        break;
      case 'fade-left':
        fromProps.x = 24;
        toProps.x = 0;
        break;
      case 'scale-up':
        fromProps.scale = 0.9;
        toProps.scale = 1;
        break;
    }

    gsap.fromTo(el, fromProps, toProps);
  });
}

// ===== Animated Counters =====
function initCounters(): void {
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length === 0) return;

  counters.forEach((counter) => {
    const target = parseInt(counter.getAttribute('data-count') || '0');

    let hasRun = false;
    const runCounter = () => {
      if (hasRun) return;
      hasRun = true;
      gsap.to(counter, {
        innerText: target,
        duration: 2,
        ease: 'power2.out',
        snap: { innerText: 1 },
        onUpdate: function () {
          (counter as HTMLElement).textContent = Math.round(
            (this.targets()[0] as any).innerText
          ).toLocaleString();
        },
      });
    };
    ScrollTrigger.create({
      trigger: counter,
      start: 'top 95%',
      onEnter: runCounter,
      onEnterBack: runCounter,
    });
  });
}

// ===== Comparison Row Stagger =====
function initComparisonAnimations(): void {
  const rows = document.querySelectorAll('.comparison__row');
  if (rows.length === 0) return;

  rows.forEach((row, i) => {
    gsap.fromTo(
      row,
      { opacity: 0, x: -20 },
      {
        opacity: 1,
        x: 0,
        duration: 0.5,
        delay: i * 0.05,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: row,
          start: 'top 95%',
          toggleActions: 'play none play none',
        },
      }
    );
  });
}

// ===== Logo Wall Stagger + "You?" Ripple =====
let logoObserver: IntersectionObserver | null = null;

function initLogoAnimations(): void {
  const logos = document.querySelectorAll('.proof__logo-item');
  const youSlot = document.getElementById('proof-logo-you');
  if (logos.length === 0) return;

  // Initial fade-in stagger for all logo items
  gsap.fromTo(
    logos,
    { opacity: 0, scale: 0.85 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      stagger: 0.07,
      ease: 'back.out(1.5)',
      scrollTrigger: {
        trigger: '.proof__logos',
        start: 'top 90%',
        toggleActions: 'play none play none',
      },
    }
  );

  // "You?" ripple: fires when logo row is near the center of the viewport
  if (youSlot) {
    gsap.set(youSlot, {
      width: 0,
      opacity: 0,
      paddingLeft: 0,
      paddingRight: 0,
      borderWidth: 0,
    });

    const leftLogos = Array.from(
      document.querySelectorAll('[data-logo-side="left"]')
    ).reverse();
    const rightLogos = Array.from(
      document.querySelectorAll('[data-logo-side="right"]')
    );

    const fireRipple = () => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
      tl.to(leftLogos, { x: -18, duration: 0.28, stagger: 0.06 }, 0.15)
        .to(rightLogos, { x: 18, duration: 0.28, stagger: 0.06 }, 0.15)
        .to(
          youSlot,
          {
            width: 148,
            paddingLeft: 20,
            paddingRight: 20,
            borderWidth: 2,
            opacity: 1,
            duration: 0.55,
            ease: 'back.out(1.4)',
          },
          0.3
        )
        .to(
          leftLogos,
          {
            x: 0,
            duration: 0.7,
            stagger: 0.05,
            ease: 'elastic.out(1, 0.45)',
          },
          0.65
        )
        .to(
          rightLogos,
          {
            x: 0,
            duration: 0.7,
            stagger: 0.05,
            ease: 'elastic.out(1, 0.45)',
          },
          0.65
        );
    };

    const logosContainer = document.querySelector('.proof__logos');
    if (logosContainer) {
      logoObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            logoObserver?.disconnect();
            fireRipple();
          }
        },
        { rootMargin: '-25% 0px -25% 0px', threshold: 0 }
      );
      logoObserver.observe(logosContainer);
    }
  }
}

// ===== Stakeholder Fan-Out =====
// Two-act animation:
//   Act 1 -- Large profile pictures appear clustered, emoji sequence plays out
//   Act 2 -- Avatars shrink, cards materialize, info reveals
//   Total: ~4 seconds
function initStakeholderFanOut(): void {
  const row = document.querySelector('.intel__people-row') as HTMLElement | null;
  if (!row) return;

  const cards = row.querySelectorAll('.intel__person-card');
  if (cards.length === 0) return;

  const avatars = row.querySelectorAll('.intel__avatar');
  const infos = row.querySelectorAll('.intel__person-info');
  const highfive = row.querySelector('.intel__fan-emoji--highfive');
  const confetti = row.querySelector('.intel__fan-emoji--confetti');
  const confettiPieces = row.querySelectorAll('.intel__confetti-piece');

  // Mobile fallback: simple staggered fade-in
  if (window.matchMedia('(max-width: 768px)').matches) {
    gsap.fromTo(
      cards,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: row,
          start: 'top 95%',
          toggleActions: 'play none play none',
        },
      }
    );
    return;
  }

  // Fewer than 3 cards -- skip the full animation, just fade in
  if (cards.length < 3) {
    gsap.fromTo(
      row,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: row,
          start: 'top 90%',
          toggleActions: 'play none play none',
        },
      }
    );
    return;
  }

  // -- Calculate cluster positions dynamically --
  const cardsContainer = row.querySelector('.intel__people-cards');
  if (!cardsContainer) return;
  const containerRect = cardsContainer.getBoundingClientRect();
  const containerCx = containerRect.width / 2;
  const avatarRects = Array.from(avatars).map((a) => {
    const r = a.getBoundingClientRect();
    return { cx: r.left + r.width / 2 - containerRect.left };
  });

  // Target: avatars clustered in center, ~90px apart
  const clusterGap = 90;
  const clusterOffsets = [
    containerCx - clusterGap - avatarRects[0].cx,
    containerCx - avatarRects[1].cx,
    containerCx + clusterGap - avatarRects[2].cx,
  ];

  // -- Initial state: cards transparent, avatars large and clustered --
  gsap.set(row, { opacity: 0 });
  gsap.set(cards, {
    background: 'transparent',
    borderColor: 'transparent',
    opacity: 1,
  });
  gsap.set(infos, { opacity: 0, x: -12 });
  gsap.set(avatars, { scale: 1.8, opacity: 0 });
  gsap.set(cards[0], { x: clusterOffsets[0] });
  gsap.set(cards[1], { x: clusterOffsets[1] });
  gsap.set(cards[2], { x: clusterOffsets[2] });

  // Emoji initial state
  const emojis = [highfive, confetti].filter(Boolean) as Element[];
  gsap.set(emojis, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });
  const cw = containerRect.width;
  const av0cx = avatarRects[0].cx + clusterOffsets[0];
  const av1cx = avatarRects[1].cx + clusterOffsets[1];
  const av2cx = avatarRects[2].cx + clusterOffsets[2];
  if (highfive)
    gsap.set(highfive, { x: (av0cx + av1cx) / 2 - cw * 0.3333 });
  if (confetti)
    gsap.set(confetti, { x: (av1cx + av2cx) / 2 - cw * 0.6666 });
  if (confettiPieces.length)
    gsap.set(confettiPieces, { scale: 0, opacity: 0 });

  const tl = gsap.timeline({
    paused: true,
  });

  // Use a separate ScrollTrigger so the timeline fires reliably
  ScrollTrigger.create({
    trigger: row,
    start: 'top 92%',
    once: true,
    onEnter: () => tl.play(),
  });

  // ---- ACT 1: Profile Picture Showcase (0 - 2.5s) ----

  // 0.0s -- Row fades in
  tl.to(row, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0);

  // 0.1s -- Avatars pop in with stagger, bouncy entrance
  tl.to(avatars[1], {
    opacity: 1,
    scale: 1.8,
    duration: 0.4,
    ease: 'back.out(2.5)',
  }, 0.15);
  tl.to(avatars[0], {
    opacity: 1,
    scale: 1.8,
    duration: 0.4,
    ease: 'back.out(2.5)',
  }, 0.3);
  tl.to(avatars[2], {
    opacity: 1,
    scale: 1.8,
    duration: 0.4,
    ease: 'back.out(2.5)',
  }, 0.45);

  // 1.0s -- High-five pops in between avatars 1 & 2
  if (highfive) {
    tl.to(
      highfive,
      { opacity: 1, scale: 1.3, duration: 0.3, ease: 'back.out(4)' },
      1.0
    );
    tl.to(
      highfive,
      { scale: 1.05, duration: 0.2, ease: 'power2.out' },
      1.3
    );
    tl.to(
      highfive,
      { y: -30, opacity: 0, scale: 0.5, duration: 0.5, ease: 'power2.in' },
      1.55
    );
  }

  // 1.8s -- Confetti pops between avatars 2 & 3
  if (confetti) {
    tl.to(
      confetti,
      {
        opacity: 1,
        scale: 1.4,
        rotation: 15,
        duration: 0.25,
        ease: 'back.out(4)',
      },
      1.8
    );
    tl.to(
      confetti,
      { scale: 1.1, rotation: 5, duration: 0.15, ease: 'power2.out' },
      2.05
    );

    // 2.0s -- Confetti pieces burst outward
    if (confettiPieces.length) {
      confettiPieces.forEach((piece, i) => {
        const angle =
          (i / confettiPieces.length) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 35 + Math.random() * 40;
        tl.to(
          piece,
          {
            opacity: 1,
            scale: 1,
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist - 20,
            rotation: Math.random() * 360,
            duration: 0.45,
            ease: 'power2.out',
          },
          2.05 + i * 0.03
        );
        tl.to(
          piece,
          {
            opacity: 0,
            y: '+=' + (18 + Math.random() * 12),
            duration: 0.35,
            ease: 'power2.in',
          },
          2.5 + i * 0.02
        );
      });
    }

    // 2.4s -- Main confetti emoji fades
    tl.to(
      confetti,
      {
        y: -25,
        opacity: 0,
        scale: 0.4,
        rotation: -20,
        duration: 0.45,
        ease: 'power2.in',
      },
      2.35
    );
  }

  // ---- ACT 2: Card Reveal (2.6 - 4.0s) ----

  // 2.7s -- Avatars shrink to normal size
  tl.to(avatars, { scale: 1, duration: 0.5, ease: 'power3.inOut' }, 2.7);

  // 2.7s -- All cards slide to final grid positions
  tl.to(cards[0], { x: 0, duration: 0.6, ease: 'power3.inOut' }, 2.7);
  tl.to(cards[1], { x: 0, duration: 0.6, ease: 'power3.inOut' }, 2.7);
  tl.to(cards[2], { x: 0, duration: 0.6, ease: 'power3.inOut' }, 2.7);

  // 3.0s -- Card backgrounds and borders materialize
  tl.to(
    cards,
    {
      background: 'var(--bg-card)',
      borderColor: 'var(--border-subtle)',
      duration: 0.5,
      ease: 'power2.out',
    },
    3.0
  );

  // 3.2s -- Person info slides in with stagger
  tl.to(
    infos,
    { opacity: 1, x: 0, duration: 0.5, stagger: 0.12, ease: 'power3.out' },
    3.2
  );

  // ~4.0s -- Complete
}

// ===== Timeline Line =====
function initTimelineComet(): void {
  const timeline = document.querySelector('.timeline');
  if (!timeline) return;

  const track = timeline.querySelector('.timeline__track') as HTMLElement | null;
  const line = timeline.querySelector('.timeline__line') as HTMLElement | null;
  if (!track || !line) return;

  const phases = timeline.querySelectorAll('.timeline__phase');
  if (phases.length === 0) return;

  // Calculate where the line should stop: center of the last marker
  const lastMarker = phases[phases.length - 1].querySelector(
    '.timeline__marker'
  );
  if (!lastMarker) return;
  const trackRect = track.getBoundingClientRect();
  const markerRect = lastMarker.getBoundingClientRect();
  const endY = markerRect.top + markerRect.height / 2 - trackRect.top;

  // Set track height to stop at last marker
  track.style.height = endY + 'px';
  track.style.bottom = 'auto';

  gsap.set(line, { height: 0 });

  ScrollTrigger.create({
    trigger: timeline,
    start: 'top 80%',
    end: 'bottom 50%',
    scrub: 0.5,
    onUpdate: (self) => {
      const currentY = self.progress * endY;
      gsap.set(line, { height: currentY });
    },
  });
}

// ===== CTA Section =====
function initCTAAnimations(): void {
  const cta = document.getElementById('cta');
  if (!cta) return;

  gsap.fromTo(
    '.cta__content',
    { opacity: 0, y: 20 },
    {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '#cta',
        start: 'top 95%',
        toggleActions: 'play none play none',
      },
    }
  );
}

// ===== Public API =====

export function initABMAnimations(): void {
  initHeroAnimations();
  initScrollAnimations();
  initCounters();
  initComparisonAnimations();
  initLogoAnimations();
  initStakeholderFanOut();
  initTimelineComet();
  initCTAAnimations();
}

export function cleanupABMAnimations(): void {
  // Disconnect the logo IntersectionObserver
  if (logoObserver) {
    logoObserver.disconnect();
    logoObserver = null;
  }

  // Kill all ScrollTrigger instances created by this module
  ScrollTrigger.getAll().forEach((st) => st.kill());
}
