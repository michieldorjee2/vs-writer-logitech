/**
 * Warp CTA — laser wormhole button animation
 * States: idle → hover → warp (click) → open → closing → idle
 */
(() => {
  const btn      = document.getElementById('cta-connect-btn');
  const warpCanvas = document.getElementById('warp-canvas');
  const modal    = document.getElementById('connect-modal');
  const closeBtn = document.getElementById('modal-close-btn');
  if (!btn || !warpCanvas || !modal) return;

  const wCtx = warpCanvas.getContext('2d');

  // ─── State ───
  let state = 'idle'; // idle | warp | open | closing
  let warpT = 0;
  let closeT = 0;
  let btnCx = 0, btnCy = 0;
  let closingLengths = []; // snapshot of laser lengths when retract begins

  // ─── Button spin (JS-driven for smooth speed transitions) ───
  let spinAngle    = 0;   // degrees, accumulates each frame
  let spinRate     = 36;  // current deg/sec
  let isHovering   = false;

  btn.addEventListener('mouseenter', () => { isHovering = true; });
  btn.addEventListener('mouseleave', () => { isHovering = false; });

  // ─── Warp canvas setup ───
  Object.assign(warpCanvas.style, {
    position: 'fixed', inset: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '999',
    opacity: '0',
  });

  function resizeWarp() {
    const dpr = devicePixelRatio || 1;
    warpCanvas.width  = innerWidth  * dpr;
    warpCanvas.height = innerHeight * dpr;
    wCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeWarp();
  addEventListener('resize', resizeWarp);

  // ─── Display P3 colors ───
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

  // ─── Warp tunnel particles ───
  const WARP_COUNT = 700;
  const warpParticles = [];

  function initWarpParticle(p) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 10 + Math.random() * 80;
    p.x     = Math.cos(angle) * dist;
    p.y     = Math.sin(angle) * dist;
    p.z     = Math.random() * 2500 + 400;
    p.speed = 3 + Math.random() * 9;
    p.color = COLORS[(Math.random() * COLORS.length) | 0];
    p.size  = 0.4 + Math.random() * 1.8;
  }
  for (let i = 0; i < WARP_COUNT; i++) {
    const p = {};
    initWarpParticle(p);
    p.z = Math.random() * 2200;
    warpParticles.push(p);
  }

  // ─── Laser beams ───
  const LASER_COUNT = 48;
  const lasers = [];
  for (let i = 0; i < LASER_COUNT; i++) {
    lasers.push({
      angle:     (i / LASER_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.12,
      length:    0,
      maxLength: 900 + Math.random() * 1500,
      speed:     800 + Math.random() * 1500,
      width:     1 + Math.random() * 2.5,
      color:     COLORS[(Math.random() * COLORS.length) | 0],
      delay:     Math.random() * 0.1,
    });
  }

  // ─── Events ───
  btn.addEventListener('click', () => {
    if (state === 'warp' || state === 'open') return;
    state  = 'warp';
    warpT  = 0;
    const r = btn.getBoundingClientRect();
    btnCx  = r.left + r.width  / 2;
    btnCy  = r.top  + r.height / 2;

    warpCanvas.style.opacity = '1';
    warpCanvas.style.pointerEvents = 'auto';

    // Reset lasers & particles
    lasers.forEach(l => { l.length = 0; });
    warpParticles.forEach(p => initWarpParticle(p));

    // Open modal after warp builds up — bento tiles fly in individually
    setTimeout(() => {
      openModal();
    }, 1400);
  });

  // ─── Open modal: show + GSAP bento fly-in ───
  function openModal() {
    const tiles = modal.querySelectorAll('.bento');
    const innerModal = modal.querySelector('.modal');

    // Reset floating/flat states
    if (innerModal) innerModal.classList.remove('modal--floating', 'modal--flat');

    // Hide tiles with opacity only (no scale) so getBoundingClientRect gives true layout positions
    if (typeof gsap !== 'undefined') {
      gsap.set(tiles, { clearProps: 'all' });
      gsap.set(tiles, { opacity: 0 });
    }

    modal.classList.add('modal-overlay--active');
    modal.setAttribute('aria-hidden', 'false');
    state = 'open';

    // Use the stored warp center (btnCx/btnCy) — that's where the lasers originate
    const originX = btnCx;
    const originY = btnCy;

    // Fly each bento tile in from the warp center to its grid position
    requestAnimationFrame(() => {
      tiles.forEach((tile, i) => {
        const tr = tile.getBoundingClientRect();
        const tileCx = tr.left + tr.width  / 2;
        const tileCy = tr.top  + tr.height / 2;
        const dx = originX - tileCx;
        const dy = originY - tileCy;

        if (typeof gsap !== 'undefined') {
          gsap.fromTo(tile,
            { x: dx, y: dy, scale: 0.06, opacity: 0 },
            {
              x: 0, y: 0, scale: 1, opacity: 1,
              duration: 0.7,
              delay: i * 0.09,
              ease: 'back.out(1.35)',
            }
          );
        } else {
          tile.style.opacity = '1';
          tile.style.transform = 'none';
        }
      });

      // Begin floating after all tiles have landed
      const lastDelay = tiles.length * 0.09 + 0.75;
      setTimeout(() => {
        if (state === 'open' && innerModal) innerModal.classList.add('modal--floating');
      }, lastDelay * 1000);
    });
  }

  // ─── Hover flatten / unflatten ───
  const modalEl = modal.querySelector('.modal');
  if (modalEl) {
    modalEl.addEventListener('mouseenter', () => {
      modalEl.classList.add('modal--flat');
      modalEl.classList.remove('modal--floating');
    });
    modalEl.addEventListener('mouseleave', () => {
      modalEl.classList.remove('modal--flat');
      setTimeout(() => {
        if (state === 'open') modalEl.classList.add('modal--floating');
      }, 400);
    });
  }

  // ─── Close modal ───
  function closeModal() {
    if (state !== 'open' && state !== 'warp') return;
    state   = 'closing';
    closeT  = 0;

    // Snapshot laser lengths for retract animation
    closingLengths = lasers.map(l => l.length);

    if (modalEl) modalEl.classList.remove('modal--floating', 'modal--flat');

    // Fly each bento tile BACK toward button center (reverse of fly-in)
    const tiles = modal.querySelectorAll('.bento');
    if (typeof gsap !== 'undefined') {
      const btnR = btn.getBoundingClientRect();
      const originX = btnR.left + btnR.width / 2;
      const originY = btnR.top + btnR.height / 2;

      tiles.forEach((tile, i) => {
        const tr = tile.getBoundingClientRect();
        const dx = originX - (tr.left + tr.width / 2);
        const dy = originY - (tr.top + tr.height / 2);

        gsap.to(tile, {
          x: dx, y: dy, scale: 0.06, opacity: 0,
          duration: 0.55,
          delay: (tiles.length - 1 - i) * 0.06, // reverse stagger (last tile first)
          ease: 'power3.in',
        });
      });
    }

    // DON'T hide the overlay yet — let the retract animation play out.
    // The overlay is hidden when closeT >= 1 in the animation loop.
  }

  closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

  // Close on click outside the bento tiles (overlay bg, transparent gaps, modal wrapper)
  modal.addEventListener('click', (e) => {
    if (!e.target.closest('.bento') && !e.target.closest('.modal__close')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (state === 'open' || state === 'warp')) closeModal();
  });

  // ─── Main animation loop ───
  let lastTime = 0;
  function animate(time) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (state === 'warp')    warpT = Math.min(3, warpT + dt * 1.0);
    if (state === 'closing') {
      closeT = Math.min(1, closeT + dt * 0.725); // 1/0.725 ≈ 1.38s — 30% faster than 1.8s warp-in
      if (closeT >= 1) {
        state = 'idle';
        warpT = 0;
        warpCanvas.style.opacity = '0';
        warpCanvas.style.pointerEvents = 'none';
        // NOW hide the modal overlay (animation is done)
        modal.classList.remove('modal-overlay--active');
        modal.setAttribute('aria-hidden', 'true');
        btn.focus({ preventScroll: true });
        // Clean up GSAP transforms on tiles
        const tiles = modal.querySelectorAll('.bento');
        if (typeof gsap !== 'undefined') gsap.set(tiles, { clearProps: 'all' });
      }
    }

    // ── Smooth button spin ──
    // Target: 36 deg/s idle, 200 deg/s on hover — lerp so speed ramps up/down
    const targetRate = isHovering ? 200 : 36;
    spinRate += (targetRate - spinRate) * Math.min(1, dt * 3.5);
    spinAngle = (spinAngle + spinRate * dt) % 360;
    btn.style.setProperty('--warp-spin', spinAngle.toFixed(2) + 'deg');

    drawWarp(time, dt);
  }
  requestAnimationFrame(animate);

  // ─── Draw warp tunnel + lasers ───
  function drawWarp(time, dt) {
    if (state !== 'warp' && state !== 'open' && state !== 'closing') {
      return;
    }

    const W  = innerWidth, H = innerHeight;
    const cx = btnCx || W / 2, cy = btnCy || H / 2;

    wCtx.clearRect(0, 0, W, H);

    // ── Dark radial overlay expanding from button center ──
    // Starts at button, expands to fill full screen
    const bgProgress = state === 'closing'
      ? Math.max(0, 1 - closeT)           // radial shrinks over full close duration
      : Math.min(1, warpT * 2.2);

    const maxR = Math.sqrt(W * W + H * H);
    const expandR = bgProgress * maxR * 1.1;
    const bgAlpha = state === 'closing'
      ? Math.max(0, 0.98 * (1 - closeT * 1.05))  // fades slightly after radial shrinks
      : Math.min(0.98, warpT * 2.0);

    if (expandR > 0 && bgAlpha > 0) {
      const bgGrad = wCtx.createRadialGradient(cx, cy, 0, cx, cy, expandR);
      bgGrad.addColorStop(0,    `rgba(3, 6, 18, ${bgAlpha})`);
      bgGrad.addColorStop(0.65, `rgba(3, 6, 18, ${bgAlpha * 0.97})`);
      bgGrad.addColorStop(0.9,  `rgba(3, 6, 18, ${bgAlpha * 0.7})`);
      bgGrad.addColorStop(1,    `rgba(3, 6, 18, 0)`);
      wCtx.fillStyle = bgGrad;
      wCtx.fillRect(0, 0, W, H);
    }

    // ── Lasers ──
    const laserFade = state === 'closing'
      ? Math.max(0, 1 - closeT * 1.1)    // fades across full retract duration
      : (warpT < 1.8 ? Math.min(1, warpT * 4) : Math.max(0, 1 - (warpT - 1.8) * 2));

    if (laserFade > 0.01) {
      lasers.forEach((l, idx) => {
        if (state === 'closing') {
          // Retract: pull beams back over full close duration (squared = fast-start ease-in)
          const retract = Math.max(0, 1 - closeT);
          l.length = (closingLengths[idx] || l.maxLength) * (retract * retract);
        } else if (state !== 'open') {
          const t = Math.max(0, warpT - l.delay);
          l.length = Math.min(l.maxLength, t * l.speed);
        }
        if (l.length <= 2) return;

        const ex = cx + Math.cos(l.angle) * l.length;
        const ey = cy + Math.sin(l.angle) * l.length;

        // Core beam — white-hot at origin, fades to color, then transparent
        const grad = wCtx.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(0,    `color(display-p3 1 1 1 / ${0.98 * laserFade})`);
        grad.addColorStop(0.06, withAlpha(l.color, 0.9 * laserFade));
        grad.addColorStop(0.5,  withAlpha(l.color, 0.4 * laserFade));
        grad.addColorStop(1,    withAlpha(l.color, 0));
        wCtx.beginPath();
        wCtx.moveTo(cx, cy);
        wCtx.lineTo(ex, ey);
        wCtx.strokeStyle = grad;
        wCtx.lineWidth = l.width;
        wCtx.stroke();

        // Wide atmospheric glow
        const glowGrad = wCtx.createLinearGradient(cx, cy, ex, ey);
        glowGrad.addColorStop(0,   withAlpha(l.color, 0.18 * laserFade));
        glowGrad.addColorStop(0.5, withAlpha(l.color, 0.06 * laserFade));
        glowGrad.addColorStop(1,   withAlpha(l.color, 0));
        wCtx.beginPath();
        wCtx.moveTo(cx, cy);
        wCtx.lineTo(ex, ey);
        wCtx.strokeStyle = glowGrad;
        wCtx.lineWidth = l.width * 10;
        wCtx.stroke();
      });
    }

    // ── Warp tunnel streaks ──
    const alpha = state === 'closing' ? 1 - easeOut(closeT) : Math.min(1, warpT * 2.5);
    const speed = state === 'closing'
      ? Math.max(0, 1 - closeT * 1.1)    // slows gradually (streaks decelerate into origin)
      : state === 'open' ? 0.25 : Math.min(1.0, warpT * 1.4);

    const tunnelAlpha = state === 'closing'
      ? Math.max(0, 1 - closeT * 1.1)    // fades in sync with retract
      : Math.min(1, (warpT - 0.2) * 2);

    if (tunnelAlpha > 0.01) {
      const FOV = 280;
      const trailDepth = 18 + speed * 12;

      warpParticles.forEach(p => {
        if (state === 'closing') {
          // REVERSE: particles fly back toward center (z increases = shrinks on screen)
          const reverseVel = 0.4 + closeT * 1.2; // starts moderate, accelerates (sucked in)
          p.z += p.speed * reverseVel * 50 * dt;
          if (p.z > 2800) p.z = 2800; // park far away, don't recycle
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

        const offH = hx < -120 || hx > W + 120 || hy < -120 || hy > H + 120;
        const offT = tx < -120 || tx > W + 120 || ty < -120 || ty > H + 120;
        if (offH && offT) return;

        const brightness = Math.min(1, (1 - p.z / 2200) * 1.8);
        const a = brightness * tunnelAlpha * alpha;
        if (a < 0.02) return;

        const lineW = Math.max(0.5, p.size * headScale * 0.35);

        const grad = wCtx.createLinearGradient(hx, hy, tx, ty);
        grad.addColorStop(0,    `rgba(255, 255, 255, ${a * 0.95})`);
        grad.addColorStop(0.08, withAlpha(p.color, a * 0.9));
        grad.addColorStop(0.4,  withAlpha(p.color, a * 0.35));
        grad.addColorStop(1,    withAlpha(p.color, 0));

        wCtx.beginPath();
        wCtx.moveTo(hx, hy);
        wCtx.lineTo(tx, ty);
        wCtx.strokeStyle = grad;
        wCtx.lineWidth = lineW;
        wCtx.stroke();

        const glowGrad = wCtx.createLinearGradient(hx, hy, tx, ty);
        glowGrad.addColorStop(0,   withAlpha(p.color, a * 0.2));
        glowGrad.addColorStop(0.5, withAlpha(p.color, a * 0.05));
        glowGrad.addColorStop(1,   withAlpha(p.color, 0));
        wCtx.beginPath();
        wCtx.moveTo(hx, hy);
        wCtx.lineTo(tx, ty);
        wCtx.strokeStyle = glowGrad;
        wCtx.lineWidth = lineW * 5;
        wCtx.stroke();

        if (brightness > 0.3) {
          const dotR = Math.max(0.8, lineW * 0.8);
          wCtx.beginPath();
          wCtx.arc(hx, hy, dotR, 0, Math.PI * 2);
          wCtx.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
          wCtx.fill();
          wCtx.beginPath();
          wCtx.arc(hx, hy, dotR * 3, 0, Math.PI * 2);
          wCtx.fillStyle = withAlpha(p.color, a * 0.15);
          wCtx.fill();
        }
      });
    }

    // ── Central flash / glow ──
    if (alpha > 0.01) {
      const flash = state === 'warp' && warpT < 0.3
        ? (1 - warpT / 0.3) * 0.3
        : 0;
      const glowR = state === 'closing'
        ? 100 * (1 - closeT)
        : 40 + warpT * 50;

      if (flash > 0) {
        const fGrad = wCtx.createRadialGradient(cx, cy, 0, cx, cy, 200);
        fGrad.addColorStop(0,   `rgba(255, 255, 255, ${flash})`);
        fGrad.addColorStop(0.3, `rgba(200, 220, 255, ${flash * 0.4})`);
        fGrad.addColorStop(1,   'rgba(0,0,0,0)');
        wCtx.fillStyle = fGrad;
        wCtx.fillRect(cx - 200, cy - 200, 400, 400);
      }

      const grad = wCtx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grad.addColorStop(0,   `color(display-p3 0.7 0.8 1 / ${0.45 * alpha})`);
      grad.addColorStop(0.4, `color(display-p3 0 0.3 1 / ${0.22 * alpha})`);
      grad.addColorStop(1,   `color(display-p3 0 0.1 1 / 0)`);
      wCtx.fillStyle = grad;
      wCtx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
    }
  }

  // ─── Helpers ───
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }

  const _colorCache = new Map();
  function parseColor(c) {
    if (_colorCache.has(c)) return _colorCache.get(c);
    const p3 = c.match(/display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    const rgb = p3
      ? [+p3[1], +p3[2], +p3[3]]
      : (() => {
          const h = c.replace('#','');
          return [parseInt(h.slice(0,2),16)/255, parseInt(h.slice(2,4),16)/255, parseInt(h.slice(4,6),16)/255];
        })();
    _colorCache.set(c, rgb);
    return rgb;
  }

  function withAlpha(color, a) {
    a = Math.max(0, Math.min(1, a));
    const [r, g, b] = parseColor(color);
    return `color(display-p3 ${r} ${g} ${b} / ${a.toFixed(3)})`;
  }
})();
