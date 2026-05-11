// ===========================================================================
// Retail — interactions
// Custom cursor (tiny ink dot → circle → labelled disk on imagery).
// Lookbook frame label tracking.
// ===========================================================================

let cursorEl: HTMLDivElement | null = null;
let labelEl: HTMLSpanElement | null = null;
let rafId = 0;
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let onMove: ((e: MouseEvent) => void) | null = null;
let onEnter: ((e: Event) => void) | null = null;
let onLeave: ((e: Event) => void) | null = null;
let attachedHover: HTMLElement[] = [];

function ensureCursor(): void {
  if (cursorEl) return;
  cursorEl = document.createElement('div');
  cursorEl.className = 'retail-cursor';
  labelEl = document.createElement('span');
  labelEl.className = 'retail-cursor__label';
  cursorEl.appendChild(labelEl);
  document.body.appendChild(cursorEl);
}

function tick(): void {
  if (!cursorEl) return;
  // Easing — eases toward target with ~22% step per frame
  currentX += (targetX - currentX) * 0.22;
  currentY += (targetY - currentY) * 0.22;
  cursorEl.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
  rafId = requestAnimationFrame(tick);
}

function setMode(mode: 'default' | 'link' | 'image', label?: string): void {
  if (!cursorEl || !labelEl) return;
  cursorEl.classList.remove('is-link', 'is-image');
  if (mode === 'link') cursorEl.classList.add('is-link');
  else if (mode === 'image') cursorEl.classList.add('is-image');
  labelEl.textContent = label ?? '';
}

export function initRetailInteractions(): void {
  // Cursor disabled by request — keep native cursor, skip everything below.
  return;

  // Mobile / coarse pointer: skip entirely
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!isFinePointer) return;

  ensureCursor();

  onMove = (e: MouseEvent) => {
    targetX = e.clientX;
    targetY = e.clientY;
  };
  window.addEventListener('mousemove', onMove, { passive: true });
  rafId = requestAnimationFrame(tick);

  // Default link hover
  const linkSelectors = ['a', 'button', '[data-retail-hover="link"]'].join(',');
  document.querySelectorAll<HTMLElement>(linkSelectors).forEach((el) => {
    const enter = () => setMode('link');
    const leave = () => setMode('default');
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    attachedHover.push(el);
  });

  // Image hover (lookbook frames, hero slate, atelier plate, invitation plate)
  const imageSelectors = [
    '.retail-heldforyou__frame',
    '.retail-atelier__plate',
    '.retail-invitation__plate',
    '[data-retail-hover="image"]',
  ].join(',');
  document.querySelectorAll<HTMLElement>(imageSelectors).forEach((el) => {
    const label = el.getAttribute('data-cursor-label') || 'voir';
    const enter = () => setMode('image', label);
    const leave = () => setMode('default');
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    attachedHover.push(el);
  });

  onEnter = () => {
    if (cursorEl) cursorEl.style.opacity = '1';
  };
  onLeave = () => {
    if (cursorEl) cursorEl.style.opacity = '0';
  };
  document.body.addEventListener('mouseenter', onEnter);
  document.body.addEventListener('mouseleave', onLeave);
}

export function cleanupRetailInteractions(): void {
  cancelAnimationFrame(rafId);
  if (onMove) window.removeEventListener('mousemove', onMove);
  if (onEnter) document.body.removeEventListener('mouseenter', onEnter);
  if (onLeave) document.body.removeEventListener('mouseleave', onLeave);
  attachedHover.forEach((el) => {
    // Clone-and-replace removes all listeners
    const clone = el.cloneNode(true);
    el.parentNode?.replaceChild(clone, el);
  });
  attachedHover = [];
  if (cursorEl && cursorEl.parentNode) {
    cursorEl.parentNode.removeChild(cursorEl);
  }
  cursorEl = null;
  labelEl = null;
}
