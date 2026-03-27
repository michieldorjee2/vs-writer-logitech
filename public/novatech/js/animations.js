// ===== GSAP ScrollTrigger Animations =====
// Scroll-driven reveals for every section

gsap.registerPlugin(ScrollTrigger);

// ===== Hero Scroll Parallax =====
// Canvas fade is handled by hero-3d.js ScrollTrigger
function initHeroAnimations() {
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
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('[data-animate]');

  animatedElements.forEach((el) => {
    const type = el.getAttribute('data-animate');
    const delay = parseFloat(el.getAttribute('data-delay') || 0);

    const props = {
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
      case 'fade-up':
        props.y = 0;
        break;
      case 'fade-right':
        props.x = 0;
        break;
      case 'fade-left':
        props.x = 0;
        break;
      case 'scale-up':
        props.scale = 1;
        break;
    }

    gsap.to(el, props);
  });
}

// ===== Animated Counters =====
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');

  counters.forEach((counter) => {
    const target = parseInt(counter.getAttribute('data-count'));

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
          counter.textContent = Math.round(this.targets()[0].innerText).toLocaleString();
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
function initComparisonAnimations() {
  const rows = document.querySelectorAll('.comparison__row');

  rows.forEach((row, i) => {
    gsap.fromTo(row,
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

// ===== Logo Wall Stagger =====
function initLogoAnimations() {
  const logos = document.querySelectorAll('.proof__logo-item');

  gsap.fromTo(logos,
    { opacity: 0, scale: 0.8 },
    {
      opacity: 0.5,
      scale: 1,
      duration: 0.5,
      stagger: 0.06,
      ease: 'back.out(1.5)',
      scrollTrigger: {
        trigger: '.proof__logos',
        start: 'top 95%',
        toggleActions: 'play none play none',
      },
    }
  );
}

// ===== Migration Timeline Progressive Reveal =====
function initTimelineAnimations() {
  const phases = document.querySelectorAll('.migration__phase');

  phases.forEach((phase, i) => {
    // Animate the phase number circle
    const marker = phase.querySelector('.migration__phase-number');
    gsap.fromTo(marker,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(2)',
        scrollTrigger: {
          trigger: phase,
          start: 'top 95%',
          toggleActions: 'play none play none',
        },
      }
    );

    // Animate the line growing down
    const line = phase.querySelector('.migration__phase-line');
    if (line && !line.classList.contains('migration__phase-line--final')) {
      gsap.fromTo(line,
        { scaleY: 0, transformOrigin: 'top' },
        {
          scaleY: 1,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: phase,
            start: 'top 92%',
            toggleActions: 'play none play none',
          },
        }
      );
    }
  });
}

// ===== ROI Projection Glow =====
function initROIAnimations() {
  // Box glow removed — the 3D extruded value provides its own glow
}

// ===== CTA Section =====
function initCTAAnimations() {
  gsap.fromTo('.cta__content',
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

// ===== Initialize Everything =====
document.addEventListener('DOMContentLoaded', () => {
  initHeroAnimations();
  initScrollAnimations();
  initCounters();
  initComparisonAnimations();
  initLogoAnimations();
  initTimelineAnimations();
  initROIAnimations();
  initCTAAnimations();
});
