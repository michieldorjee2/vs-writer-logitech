// ===== Interactive Elements =====
// Converted from aldus-hyper interactions.js to TypeScript module

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Store event listeners for cleanup
let resizeHandler: (() => void) | null = null;
const tabClickHandlers: Array<{ el: Element; handler: () => void }> = [];
const hoverHandlers: Array<{
  el: Element;
  enter: () => void;
  leave: () => void;
}> = [];

// ===== Comparison Tab Switching =====
function initComparisonTabs(): void {
  const tabs = document.querySelectorAll('.comparison__tab');
  const groups = document.querySelectorAll('.comparison__group');
  const indicator = document.getElementById('tab-indicator');
  if (tabs.length === 0) return;

  // Radix-style indicator: use offsetLeft/offsetTop (relative to positioned
  // parent) instead of getBoundingClientRect (viewport-relative).
  function slideIndicatorTo(activeTab: HTMLElement): void {
    if (!indicator) return;
    indicator.style.width = activeTab.offsetWidth + 'px';
    indicator.style.height = activeTab.offsetHeight + 'px';
    indicator.style.transform = `translate(${activeTab.offsetLeft}px, ${activeTab.offsetTop}px)`;
  }

  // Set initial indicator position without transition -- must run after layout
  function positionInitialIndicator(): void {
    const active = document.querySelector(
      '.comparison__tab--active'
    ) as HTMLElement | null;
    if (!active || !indicator) return;
    indicator.style.transition = 'none';
    slideIndicatorTo(active);
    requestAnimationFrame(() => {
      indicator.style.transition = '';
    });
  }
  // setTimeout(0) forces a real task boundary so layout has settled
  setTimeout(positionInitialIndicator, 0);

  // Re-position on resize (e.g. orientation change)
  resizeHandler = () => {
    const active = document.querySelector(
      '.comparison__tab--active'
    ) as HTMLElement | null;
    if (active) slideIndicatorTo(active);
  };
  window.addEventListener('resize', resizeHandler);

  tabs.forEach((tab) => {
    const handler = () => {
      const product = tab.getAttribute('data-product');

      // Update active tab
      tabs.forEach((t) => t.classList.remove('comparison__tab--active'));
      tab.classList.add('comparison__tab--active');

      // Slide indicator
      slideIndicatorTo(tab as HTMLElement);

      // Show/hide groups
      groups.forEach((group) => {
        const groupProduct = group.getAttribute('data-product-group');
        if (groupProduct === product) {
          group.classList.remove('comparison__group--hidden');
          const rows = group.querySelectorAll('.comparison__row');
          gsap.fromTo(
            rows,
            { opacity: 0, x: -20 },
            {
              opacity: 1,
              x: 0,
              duration: 0.4,
              stagger: 0.06,
              ease: 'power2.out',
            }
          );
        } else {
          group.classList.add('comparison__group--hidden');
        }
      });
    };

    tab.addEventListener('click', handler);
    tabClickHandlers.push({ el: tab, handler });
  });
}

// ===== Highlight comparison rows on hover =====
function initComparisonHover(): void {
  const rows = document.querySelectorAll('.comparison__row');
  if (rows.length === 0) return;

  rows.forEach((row) => {
    const enter = () => {
      const optiCell = row.querySelector('.comparison__rating--full');
      if (optiCell) {
        gsap.to(optiCell, { scale: 1.02, duration: 0.2, ease: 'power2.out' });
      }
    };
    const leave = () => {
      const optiCell = row.querySelector('.comparison__rating--full');
      if (optiCell) {
        gsap.to(optiCell, { scale: 1, duration: 0.2, ease: 'power2.out' });
      }
    };

    row.addEventListener('mouseenter', enter);
    row.addEventListener('mouseleave', leave);
    hoverHandlers.push({ el: row, enter, leave });
  });
}

// ===== Pain Point Number Glow on Scroll =====
function initPainPointEffects(): void {
  const pains = document.querySelectorAll('.challenge__pain');
  if (pains.length === 0) return;

  // Read brand accent from CSS variable (set on .abm-page by React)
  const accentColor = getComputedStyle(document.querySelector('.abm-page') || document.documentElement)
    .getPropertyValue('--brand-accent').trim() || '#6366f1';

  pains.forEach((pain) => {
    const number = pain.querySelector('.challenge__pain-number');
    if (!number) return;

    ScrollTrigger.create({
      trigger: pain,
      start: 'top 70%',
      end: 'bottom 30%',
      onEnter: () => {
        gsap.to(number, { opacity: 1, color: accentColor, duration: 0.5 });
      },
      onLeave: () => {
        gsap.to(number, { opacity: 0.4, color: '#5a5a70', duration: 0.5 });
      },
      onEnterBack: () => {
        gsap.to(number, { opacity: 1, color: accentColor, duration: 0.5 });
      },
      onLeaveBack: () => {
        gsap.to(number, { opacity: 0.4, color: '#5a5a70', duration: 0.5 });
      },
    });
  });
}

// ===== Public API =====

export function initABMInteractions(): void {
  initComparisonTabs();
  initComparisonHover();
  initPainPointEffects();
}

export function cleanupABMInteractions(): void {
  // Remove resize listener
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  // Remove tab click handlers
  tabClickHandlers.forEach(({ el, handler }) => {
    el.removeEventListener('click', handler);
  });
  tabClickHandlers.length = 0;

  // Remove hover handlers
  hoverHandlers.forEach(({ el, enter, leave }) => {
    el.removeEventListener('mouseenter', enter);
    el.removeEventListener('mouseleave', leave);
  });
  hoverHandlers.length = 0;

  // Kill ScrollTrigger instances created by pain point effects
  ScrollTrigger.getAll().forEach((st) => st.kill());
}
