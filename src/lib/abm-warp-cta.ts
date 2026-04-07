/**
 * Warp CTA -- laser wormhole button animation
 * States: idle -> hover -> warp (click) -> open -> closing -> idle
 *
 * Converted from aldus-hyper warp-cta.js to TypeScript module
 */

import gsap from 'gsap';

// ---- Module-level state for cleanup ----
let rafId: number | null = null;
let resizeHandler: (() => void) | null = null;
let btnClickHandler: (() => void) | null = null;
let stickyBtnClickHandler: (() => void) | null = null;
let closeBtnClickHandler: ((e: Event) => void) | null = null;
let modalClickHandler: ((e: Event) => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
const hoverHandlers: Array<{
  el: HTMLElement;
  enter: () => void;
  leave: () => void;
}> = [];

export function initWarpCTA(brandAccentColor?: string | null): void {
  const accentHex = brandAccentColor || null;
  const btn = document.getElementById('cta-connect-btn') as HTMLElement | null;
  const stickyBtn = document.getElementById(
    'sticky-connect-btn'
  ) as HTMLElement | null;
  const stickyBar = document.getElementById('sticky-cta');
  const warpCanvas = document.getElementById(
    'warp-canvas'
  ) as HTMLCanvasElement | null;
  const modal = document.getElementById('connect-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  if (!btn || !warpCanvas || !modal) return;

  const wCtx = warpCanvas.getContext('2d');
  if (!wCtx) return;

  // All warp-btn elements share the spin animation
  const allBtns = [btn, stickyBtn].filter(Boolean) as HTMLElement[];

  // ---- State ----
  let state: 'idle' | 'warp' | 'open' | 'closing' = 'idle';
  let warpT = 0;
  let closeT = 0;
  let btnCx = 0;
  let btnCy = 0;
  let closingLengths: number[] = [];

  // ---- Button spin (JS-driven for smooth speed transitions) ----
  let spinAngle = 0;
  let spinRate = 36;
  let isHovering = false;

  allBtns.forEach((b) => {
    const enter = () => {
      isHovering = true;
    };
    const leave = () => {
      isHovering = false;
    };
    b.addEventListener('mouseenter', enter);
    b.addEventListener('mouseleave', leave);
    hoverHandlers.push({ el: b, enter, leave });
  });

  // ---- Warp canvas setup ----
  Object.assign(warpCanvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '999',
    opacity: '0',
  });

  let lastWarpW = innerWidth;
  function resizeWarp(): void {
    const dpr = devicePixelRatio || 1;
    warpCanvas!.width = innerWidth * dpr;
    warpCanvas!.height = innerHeight * dpr;
    wCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeWarp();

  resizeHandler = () => {
    const newW = innerWidth;
    if (newW === lastWarpW) return;
    lastWarpW = newW;
    resizeWarp();
  };
  addEventListener('resize', resizeHandler);

  // ---- Display P3 colors ----
  const COLORS = [
    'color(display-p3 0 0.2 1)',
    'color(display-p3 0.1 0.5 1)',
    'color(display-p3 0 0.85 1)',
    'color(display-p3 0.4 0.1 1)',
    'color(display-p3 0.65 0.2 1)',
    'color(display-p3 0.8 0.85 1)',
    'color(display-p3 0.05 0.6 1)',
    'color(display-p3 0 0.1 0.9)',
    'color(display-p3 0.3 0.05 1)',
    'color(display-p3 0 0.7 1)',
  ];

  // Inject brand accent color into ~30% of lasers
  if (accentHex && accentHex.length === 7) {
    const r = parseInt(accentHex.slice(1, 3), 16) / 255;
    const g = parseInt(accentHex.slice(3, 5), 16) / 255;
    const b = parseInt(accentHex.slice(5, 7), 16) / 255;
    const brandP3 = `color(display-p3 ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)})`;
    // Replace every 3rd color with the brand color
    for (let i = 0; i < COLORS.length; i += 3) {
      COLORS[i] = brandP3;
    }
  }

  // ---- Warp tunnel particles ----
  const WARP_COUNT = 700;
  const warpParticles: any[] = [];

  function initWarpParticle(p: any): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 80;
    p.x = Math.cos(angle) * dist;
    p.y = Math.sin(angle) * dist;
    p.z = Math.random() * 2500 + 400;
    p.speed = 3 + Math.random() * 9;
    p.color = COLORS[(Math.random() * COLORS.length) | 0];
    p.size = 0.4 + Math.random() * 1.8;
  }
  for (let i = 0; i < WARP_COUNT; i++) {
    const p: any = {};
    initWarpParticle(p);
    p.z = Math.random() * 2200;
    warpParticles.push(p);
  }

  // ---- Laser beams ----
  const LASER_COUNT = 48;
  const lasers: any[] = [];
  for (let i = 0; i < LASER_COUNT; i++) {
    lasers.push({
      angle:
        (i / LASER_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.12,
      length: 0,
      maxLength: 900 + Math.random() * 1500,
      speed: 800 + Math.random() * 1500,
      width: 1 + Math.random() * 2.5,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      delay: Math.random() * 0.1,
    });
  }

  // ---- Helpers ----
  function easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  const _colorCache = new Map<string, number[]>();
  function parseColor(c: string): number[] {
    if (_colorCache.has(c)) return _colorCache.get(c)!;
    const p3 = c.match(/display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    const rgb = p3
      ? [+p3[1], +p3[2], +p3[3]]
      : (() => {
          let h = c.replace('#', '');
          if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
          return [
            parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255,
          ];
        })();
    _colorCache.set(c, rgb);
    return rgb;
  }

  function withAlpha(color: string, a: number): string {
    a = Math.max(0, Math.min(1, a));
    const [r, g, b] = parseColor(color);
    return `color(display-p3 ${r} ${g} ${b} / ${a.toFixed(3)})`;
  }

  // ---- Events ----
  function triggerWarp(originBtn: HTMLElement): void {
    if (state === 'warp' || state === 'open') return;
    state = 'warp';
    warpT = 0;
    const r = originBtn.getBoundingClientRect();
    btnCx = r.left + r.width / 2;
    btnCy = r.top + r.height / 2;

    // Hide sticky bar immediately when warp begins
    if (stickyBar) {
      stickyBar.classList.remove('sticky-cta--visible');
      stickyBar.setAttribute('aria-hidden', 'true');
    }

    warpCanvas!.style.opacity = '1';
    warpCanvas!.style.pointerEvents = 'auto';

    // Reset lasers & particles
    lasers.forEach((l) => {
      l.length = 0;
    });
    warpParticles.forEach((p) => initWarpParticle(p));

    // Open modal after warp builds up
    setTimeout(() => {
      openModal();
    }, 1400);
  }

  btnClickHandler = () => triggerWarp(btn);
  btn.addEventListener('click', btnClickHandler);
  if (stickyBtn) {
    stickyBtnClickHandler = () => triggerWarp(stickyBtn);
    stickyBtn.addEventListener('click', stickyBtnClickHandler);
  }

  // ---- Open modal: show + GSAP bento fly-in ----
  function openModal(): void {
    const tiles = modal!.querySelectorAll('.bento');
    const innerModal = modal!.querySelector('.modal');

    // Reset floating/flat states
    if (innerModal) innerModal.classList.remove('modal--floating', 'modal--flat');

    // Hide tiles with opacity only
    gsap.set(tiles, { clearProps: 'all' });
    gsap.set(tiles, { opacity: 0 });

    modal!.classList.add('modal-overlay--active');
    modal!.setAttribute('aria-hidden', 'false');
    state = 'open';

    const originX = btnCx;
    const originY = btnCy;

    // Fly each bento tile in from the warp center to its grid position
    requestAnimationFrame(() => {
      tiles.forEach((tile, i) => {
        const tr = tile.getBoundingClientRect();
        const tileCx = tr.left + tr.width / 2;
        const tileCy = tr.top + tr.height / 2;
        const dx = originX - tileCx;
        const dy = originY - tileCy;

        gsap.fromTo(
          tile,
          { x: dx, y: dy, scale: 0.06, opacity: 0 },
          {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            duration: 0.7,
            delay: i * 0.09,
            ease: 'back.out(1.35)',
          }
        );
      });

      // Begin floating after all tiles have landed (hover-capable devices only)
      const lastDelay = tiles.length * 0.09 + 0.75;
      if (window.matchMedia('(hover: hover)').matches) {
        setTimeout(() => {
          if (state === 'open' && innerModal)
            innerModal.classList.add('modal--floating');
        }, lastDelay * 1000);
      }

      // Focus trap
      const modalTrap = document.querySelector('.modal') as HTMLElement;
      if (modalTrap) {
        const focusableEls = modalTrap.querySelectorAll<HTMLElement>(
          'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableEls[0];
        const lastFocusable = focusableEls[focusableEls.length - 1];

        firstFocusable?.focus();

        const trapFocus = (e: KeyboardEvent) => {
          if (e.key !== 'Tab') return;
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
              e.preventDefault();
              lastFocusable?.focus();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              e.preventDefault();
              firstFocusable?.focus();
            }
          }
        };

        modalTrap.addEventListener('keydown', trapFocus);
        // Store for cleanup
        (modalTrap as any).__trapFocus = trapFocus;
      }
    });
  }

  const modalEl = modal.querySelector('.modal');

  // ---- Close modal ----
  function closeModal(): void {
    if (state !== 'open' && state !== 'warp') return;
    state = 'closing';
    closeT = 0;

    // Remove focus trap
    const modalTrap = document.querySelector('.modal') as HTMLElement;
    if (modalTrap && (modalTrap as any).__trapFocus) {
      modalTrap.removeEventListener('keydown', (modalTrap as any).__trapFocus);
      delete (modalTrap as any).__trapFocus;
    }

    // Snapshot laser lengths for retract animation
    closingLengths = lasers.map((l) => l.length);

    if (modalEl) modalEl.classList.remove('modal--floating', 'modal--flat');

    // Fly each bento tile BACK toward button center
    const tiles = modal!.querySelectorAll('.bento');
    const btnR = btn!.getBoundingClientRect();
    const originX = btnR.left + btnR.width / 2;
    const originY = btnR.top + btnR.height / 2;

    tiles.forEach((tile, i) => {
      const tr = tile.getBoundingClientRect();
      const dx = originX - (tr.left + tr.width / 2);
      const dy = originY - (tr.top + tr.height / 2);

      gsap.to(tile, {
        x: dx,
        y: dy,
        scale: 0.06,
        opacity: 0,
        duration: 0.55,
        delay: (tiles.length - 1 - i) * 0.06,
        ease: 'power3.in',
      });
    });
  }

  if (closeBtn) {
    closeBtnClickHandler = (e: Event) => {
      e.preventDefault();
      closeModal();
    };
    closeBtn.addEventListener('click', closeBtnClickHandler);
  }

  // Close on click outside the bento tiles
  modalClickHandler = (e: Event) => {
    if (
      !(e.target as Element).closest('.bento') &&
      !(e.target as Element).closest('.modal__close')
    ) {
      closeModal();
    }
  };
  modal.addEventListener('click', modalClickHandler);

  keydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && (state === 'open' || state === 'warp'))
      closeModal();
  };
  document.addEventListener('keydown', keydownHandler);

  // ---- Draw warp tunnel + lasers ----
  function drawWarp(time: number, dt: number): void {
    if (state !== 'warp' && state !== 'open' && state !== 'closing') {
      return;
    }

    const W = innerWidth;
    const H = innerHeight;
    const cx = btnCx || W / 2;
    const cy = btnCy || H / 2;

    wCtx!.clearRect(0, 0, W, H);

    // -- Dark radial overlay expanding from button center --
    const bgProgress =
      state === 'closing'
        ? Math.max(0, 1 - closeT)
        : Math.min(1, warpT * 2.2);

    const maxR = Math.sqrt(W * W + H * H);
    const expandR = bgProgress * maxR * 1.1;
    const bgAlpha =
      state === 'closing'
        ? Math.max(0, 0.98 * (1 - closeT * 1.05))
        : Math.min(0.98, warpT * 2.0);

    if (expandR > 0 && bgAlpha > 0) {
      const bgGrad = wCtx!.createRadialGradient(cx, cy, 0, cx, cy, expandR);
      bgGrad.addColorStop(0, `rgba(3, 6, 18, ${bgAlpha})`);
      bgGrad.addColorStop(0.65, `rgba(3, 6, 18, ${bgAlpha * 0.97})`);
      bgGrad.addColorStop(0.9, `rgba(3, 6, 18, ${bgAlpha * 0.7})`);
      bgGrad.addColorStop(1, `rgba(3, 6, 18, 0)`);
      wCtx!.fillStyle = bgGrad;
      wCtx!.fillRect(0, 0, W, H);
    }

    // -- Lasers --
    const laserFade =
      state === 'closing'
        ? Math.max(0, 1 - closeT * 1.1)
        : warpT < 1.8
          ? Math.min(1, warpT * 4)
          : Math.max(0, 1 - (warpT - 1.8) * 2);

    if (laserFade > 0.01) {
      lasers.forEach((l, idx) => {
        if (state === 'closing') {
          const retract = Math.max(0, 1 - closeT);
          l.length = (closingLengths[idx] || l.maxLength) * (retract * retract);
        } else if (state !== 'open') {
          const t = Math.max(0, warpT - l.delay);
          l.length = Math.min(l.maxLength, t * l.speed);
        }
        if (l.length <= 2) return;

        const ex = cx + Math.cos(l.angle) * l.length;
        const ey = cy + Math.sin(l.angle) * l.length;

        // Core beam
        const grad = wCtx!.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(
          0,
          `color(display-p3 1 1 1 / ${0.98 * laserFade})`
        );
        grad.addColorStop(0.06, withAlpha(l.color, 0.9 * laserFade));
        grad.addColorStop(0.5, withAlpha(l.color, 0.4 * laserFade));
        grad.addColorStop(1, withAlpha(l.color, 0));
        wCtx!.beginPath();
        wCtx!.moveTo(cx, cy);
        wCtx!.lineTo(ex, ey);
        wCtx!.strokeStyle = grad;
        wCtx!.lineWidth = l.width;
        wCtx!.stroke();

        // Wide atmospheric glow
        const glowGrad = wCtx!.createLinearGradient(cx, cy, ex, ey);
        glowGrad.addColorStop(0, withAlpha(l.color, 0.18 * laserFade));
        glowGrad.addColorStop(0.5, withAlpha(l.color, 0.06 * laserFade));
        glowGrad.addColorStop(1, withAlpha(l.color, 0));
        wCtx!.beginPath();
        wCtx!.moveTo(cx, cy);
        wCtx!.lineTo(ex, ey);
        wCtx!.strokeStyle = glowGrad;
        wCtx!.lineWidth = l.width * 10;
        wCtx!.stroke();
      });
    }

    // -- Warp tunnel streaks --
    const alpha =
      state === 'closing' ? 1 - easeOut(closeT) : Math.min(1, warpT * 2.5);
    const speed =
      state === 'closing'
        ? Math.max(0, 1 - closeT * 1.1)
        : state === 'open'
          ? 0.25
          : Math.min(1.0, warpT * 1.4);

    const tunnelAlpha =
      state === 'closing'
        ? Math.max(0, 1 - closeT * 1.1)
        : Math.min(1, (warpT - 0.2) * 2);

    if (tunnelAlpha > 0.01) {
      const FOV = 280;
      const trailDepth = 18 + speed * 12;

      warpParticles.forEach((p) => {
        if (state === 'closing') {
          const reverseVel = 0.4 + closeT * 1.2;
          p.z += p.speed * reverseVel * 50 * dt;
          if (p.z > 2800) p.z = 2800;
        } else {
          p.z -= p.speed * speed * 45 * dt * (1 + warpT * 0.3);
          if (p.z <= 1) initWarpParticle(p);
        }

        const headScale = FOV / p.z;
        const hx = cx + p.x * headScale;
        const hy = cy + p.y * headScale;

        const tailZ = p.z + p.speed * trailDepth;
        const tailScale = FOV / tailZ;
        const tx = cx + p.x * tailScale;
        const ty = cy + p.y * tailScale;

        const offH =
          hx < -120 || hx > W + 120 || hy < -120 || hy > H + 120;
        const offT =
          tx < -120 || tx > W + 120 || ty < -120 || ty > H + 120;
        if (offH && offT) return;

        const brightness = Math.min(1, (1 - p.z / 2200) * 1.8);
        const a = brightness * tunnelAlpha * alpha;
        if (a < 0.02) return;

        const lineW = Math.max(0.5, p.size * headScale * 0.35);

        const grad = wCtx!.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0, `rgba(255, 255, 255, ${a * 0.95})`);
        grad.addColorStop(0.08, withAlpha(p.color, a * 0.9));
        grad.addColorStop(0.4, withAlpha(p.color, a * 0.35));
        grad.addColorStop(1, withAlpha(p.color, 0));

        wCtx!.beginPath();
        wCtx!.moveTo(hx, hy);
        wCtx!.lineTo(tx, ty);
        wCtx!.strokeStyle = grad;
        wCtx!.lineWidth = lineW;
        wCtx!.stroke();

        const glowGrad = wCtx!.createLinearGradient(hx, hy, tx, ty);
        glowGrad.addColorStop(0, withAlpha(p.color, a * 0.2));
        glowGrad.addColorStop(0.5, withAlpha(p.color, a * 0.05));
        glowGrad.addColorStop(1, withAlpha(p.color, 0));
        wCtx!.beginPath();
        wCtx!.moveTo(hx, hy);
        wCtx!.lineTo(tx, ty);
        wCtx!.strokeStyle = glowGrad;
        wCtx!.lineWidth = lineW * 5;
        wCtx!.stroke();

        if (brightness > 0.3) {
          const dotR = Math.max(0.8, lineW * 0.8);
          wCtx!.beginPath();
          wCtx!.arc(hx, hy, dotR, 0, Math.PI * 2);
          wCtx!.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
          wCtx!.fill();
          wCtx!.beginPath();
          wCtx!.arc(hx, hy, dotR * 3, 0, Math.PI * 2);
          wCtx!.fillStyle = withAlpha(p.color, a * 0.15);
          wCtx!.fill();
        }
      });
    }

    // -- Central flash / glow --
    if (alpha > 0.01) {
      const flash =
        state === 'warp' && warpT < 0.3 ? (1 - warpT / 0.3) * 0.3 : 0;
      const glowR =
        state === 'closing' ? 100 * (1 - closeT) : 40 + warpT * 50;

      if (flash > 0) {
        const fGrad = wCtx!.createRadialGradient(cx, cy, 0, cx, cy, 200);
        fGrad.addColorStop(0, `rgba(255, 255, 255, ${flash})`);
        fGrad.addColorStop(0.3, `rgba(200, 220, 255, ${flash * 0.4})`);
        fGrad.addColorStop(1, 'rgba(0,0,0,0)');
        wCtx!.fillStyle = fGrad;
        wCtx!.fillRect(cx - 200, cy - 200, 400, 400);
      }

      const grad = wCtx!.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grad.addColorStop(
        0,
        `color(display-p3 0.7 0.8 1 / ${0.45 * alpha})`
      );
      grad.addColorStop(
        0.4,
        `color(display-p3 0 0.3 1 / ${0.22 * alpha})`
      );
      grad.addColorStop(1, `color(display-p3 0 0.1 1 / 0)`);
      wCtx!.fillStyle = grad;
      wCtx!.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
    }
  }

  // ---- Main animation loop ----
  let lastTime = 0;
  function animate(time: number): void {
    rafId = requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (state === 'warp') warpT = Math.min(3, warpT + dt * 1.0);
    if (state === 'closing') {
      closeT = Math.min(1, closeT + dt * 0.725);
      if (closeT >= 1) {
        state = 'idle';
        warpT = 0;
        warpCanvas!.style.opacity = '0';
        warpCanvas!.style.pointerEvents = 'none';
        // NOW hide the modal overlay (animation is done)
        modal!.classList.remove('modal-overlay--active');
        modal!.setAttribute('aria-hidden', 'true');
        // Restore focus to trigger button
        const triggerBtn = document.getElementById('cta-connect-btn') || document.getElementById('sticky-connect-btn');
        triggerBtn?.focus({ preventScroll: true });
        // Clean up GSAP transforms on tiles
        const tiles = modal!.querySelectorAll('.bento');
        gsap.set(tiles, { clearProps: 'all' });
      }
    }

    // -- Smooth button spin --
    const targetRate = isHovering ? 200 : 36;
    spinRate += (targetRate - spinRate) * Math.min(1, dt * 3.5);
    spinAngle = (spinAngle + spinRate * dt) % 360;
    const spinVal = spinAngle.toFixed(2) + 'deg';
    allBtns.forEach((b) => b.style.setProperty('--warp-spin', spinVal));

    drawWarp(time, dt);
  }
  rafId = requestAnimationFrame(animate);
}

export function cleanupWarpCTA(): void {
  // Cancel RAF loop
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Remove resize listener
  if (resizeHandler) {
    removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  // Remove button click handlers
  const btn = document.getElementById('cta-connect-btn');
  const stickyBtn = document.getElementById('sticky-connect-btn');
  const closeBtn = document.getElementById('modal-close-btn');
  const modal = document.getElementById('connect-modal');

  if (btn && btnClickHandler) {
    btn.removeEventListener('click', btnClickHandler);
    btnClickHandler = null;
  }
  if (stickyBtn && stickyBtnClickHandler) {
    stickyBtn.removeEventListener('click', stickyBtnClickHandler);
    stickyBtnClickHandler = null;
  }
  if (closeBtn && closeBtnClickHandler) {
    closeBtn.removeEventListener('click', closeBtnClickHandler);
    closeBtnClickHandler = null;
  }
  if (modal && modalClickHandler) {
    modal.removeEventListener('click', modalClickHandler);
    modalClickHandler = null;
  }

  // Remove keydown handler
  if (keydownHandler) {
    document.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }

  // Remove hover handlers
  hoverHandlers.forEach(({ el, enter, leave }) => {
    el.removeEventListener('mouseenter', enter);
    el.removeEventListener('mouseleave', leave);
  });
  hoverHandlers.length = 0;
}
