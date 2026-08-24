/**
 * The showcase starfield.
 *
 * A faithful port of the star layer inside abm-hero-3d.ts, lifted out so the
 * person page sits in the same sky as the company page rather than in an
 * approximation of it. Same 600 stars, same depth-cubed size distribution,
 * same three-colour palette with the customer's accent as the rare third,
 * same fifty twinkle stars driven by three summed sines plus a flash wave,
 * same drift, same shooting stars.
 *
 * Two details that matter and are easy to miss:
 *
 *   - The canvas is FIXED and full-viewport, mounted on <body> behind
 *     everything. It is not a hero background — it stays put while the whole
 *     page scrolls, which is what makes the company page feel like it is set
 *     in space rather than decorated with stars at the top.
 *
 *   - The star canvas height only ever grows (`stableStarH`). Mobile browsers
 *     resize the viewport as the URL bar hides, and rebuilding the field on
 *     every one of those would make the sky visibly reshuffle mid-scroll.
 *
 * abm-hero-3d.ts still carries its own copy. Collapsing the two is worth doing,
 * but not while it also owns SVG extrusion, Brandfetch fallbacks and the intro
 * choreography for the page that matters most.
 */

interface StarDatum {
  x: number;
  y: number;
  size: number;
  bright: boolean;
  colorIdx: number;
  depth: number;
}

interface TwinkleStar extends StarDatum {
  phase1: number;
  phase2: number;
  phase3: number;
  speed1: number;
  speed2: number;
  speed3: number;
  baseAlpha: number;
  flashPhase: number;
  flashSpeed: number;
}

let el: HTMLCanvasElement | null = null;
let rafId: number | null = null;
let resizeHandler: (() => void) | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

const STAR_COUNT = 600;
const TWINKLE_COUNT = 50;
const SHOOT_VX = 12;
const SHOOT_VY = 4;

export interface StarfieldOptions {
  /** The customer's accent, used for the rare third star colour. */
  accent?: string | null;
  /** Element id, so more than one host can't collide. */
  id?: string;
}

export function initStarfield(opts: StarfieldOptions = {}): void {
  // Idempotent — a second init would orphan the first loop, which would keep
  // drawing to a detached canvas forever.
  cleanupStarfield();
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const accentHex = opts.accent || '#91dbda';

  el = document.createElement('canvas');
  el.id = opts.id || 'star-field';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '0',
  });
  document.body.insertBefore(el, document.body.firstChild);

  const ctx = el.getContext('2d');
  if (!ctx) return;

  const starColors = ['#c3ceaf', '#7ddd3d', accentHex];

  const starData: StarDatum[] = Array.from({ length: STAR_COUNT }, () => {
    const depth = Math.random();
    return {
      x: Math.random(),
      y: Math.random(),
      // Cubed depth means most stars are 1px and a handful are 2-3px, which is
      // what reads as distance rather than as a scatter of dots.
      size: Math.max(1, Math.round(0.5 + Math.pow(depth, 3) * 2)),
      bright: depth > 0.75,
      colorIdx: Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : 2) : 0,
      depth: 0.3 + depth * 0.7,
    };
  });

  const twinkleStars: TwinkleStar[] = [];
  for (let i = 0; i < starData.length && twinkleStars.length < TWINKLE_COUNT; i++) {
    const s = starData[i];
    if (s.bright && s.size >= 2) {
      twinkleStars.push({
        ...s,
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        phase3: Math.random() * Math.PI * 2,
        speed1: 1.5 + Math.random() * 2.5,
        speed2: 0.3 + Math.random() * 0.6,
        speed3: 4.0 + Math.random() * 6.0,
        baseAlpha: 0.45 + Math.random() * 0.15,
        flashPhase: Math.random() * Math.PI * 2,
        flashSpeed: 0.15 + Math.random() * 0.25,
      });
    }
  }

  let bitmap: HTMLCanvasElement | null = null;

  function buildStarField(w: number, h: number): void {
    bitmap = document.createElement('canvas');
    bitmap.width = w;
    bitmap.height = h;
    const bctx = bitmap.getContext('2d');
    if (!bctx) return;
    bctx.clearRect(0, 0, w, h);
    for (const s of starData) {
      bctx.fillStyle = starColors[s.colorIdx];
      bctx.globalAlpha = 0.5 + (s.bright ? 0.3 : 0);
      const r = s.size * 0.5;
      bctx.beginPath();
      bctx.arc(Math.round(s.x * w) + r, Math.round(s.y * h) + r, Math.max(r, 0.5), 0, Math.PI * 2);
      bctx.fill();
    }
  }

  // Grows only. See the note at the top about the mobile URL bar.
  let stableStarH = window.innerHeight;

  function setRes(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    stableStarH = Math.max(stableStarH, h);
    el!.width = w;
    el!.height = stableStarH;
    buildStarField(w, stableStarH);
  }
  setRes();

  let lastWidth = window.innerWidth;
  let lastHeight = window.innerHeight;
  resizeHandler = () => {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    if (newW === lastWidth && newH === lastHeight) return;
    lastWidth = newW;
    lastHeight = newH;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(setRes, 200);
  };
  window.addEventListener('resize', resizeHandler);

  let driftOffset = 0;
  let shootingStars: Array<{ x: number; y: number; life: number }> = [];
  let last = performance.now();

  function draw(): void {
    const now = performance.now();
    const dt = Math.min(now - last, 200);
    last = now;

    driftOffset += 0.000018 * dt;
    const sw = el!.width;
    const sh = el!.height;
    ctx!.clearRect(0, 0, sw, sh);

    // Blit the pre-rendered field twice so the drift wraps seamlessly.
    const driftPx = (driftOffset * sh * 0.5) % sh;
    if (bitmap) {
      ctx!.globalAlpha = 1;
      ctx!.drawImage(bitmap, 0, -driftPx);
      if (driftPx > 0) ctx!.drawImage(bitmap, 0, sh - driftPx);
    }

    // Twinkle: three summed sines give an irregular shimmer that never reads
    // as a loop, and a rare fourth wave spikes into a brief flash.
    const tSec = now * 0.001;
    for (const t of twinkleStars) {
      const px = Math.round(t.x * sw);
      const py = (Math.round(t.y * sh) - driftPx + sh) % sh;
      const flicker =
        Math.sin(tSec * t.speed1 + t.phase1) * 0.15 +
        Math.sin(tSec * t.speed2 + t.phase2) * 0.12 +
        Math.sin(tSec * t.speed3 + t.phase3) * 0.08;
      const flashWave = Math.sin(tSec * t.flashSpeed + t.flashPhase);
      const flash = flashWave > 0.92 ? (flashWave - 0.92) * 6.0 : 0;
      ctx!.globalAlpha = Math.max(0.05, Math.min(1, t.baseAlpha + flicker + flash));
      ctx!.fillStyle = starColors[t.colorIdx];
      const r = t.size * 0.5 + (flash > 0 ? 1.5 : 0.5);
      ctx!.beginPath();
      ctx!.arc(px, py, Math.max(r, 0.5), 0, Math.PI * 2);
      ctx!.fill();
    }

    if (Math.random() < 0.004) {
      shootingStars.push({ x: Math.random() * sw * 0.6, y: Math.random() * sh * 0.4, life: 1 });
    }
    if (shootingStars.length > 0) {
      ctx!.strokeStyle = '#c8ff8f';
      ctx!.lineWidth = 1.5;
      shootingStars = shootingStars.filter((s) => {
        ctx!.globalAlpha = s.life * 0.5;
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(s.x - SHOOT_VX * 4, s.y - SHOOT_VY * 4);
        ctx!.stroke();
        s.x += SHOOT_VX;
        s.y += SHOOT_VY;
        s.life -= 0.012;
        return s.life > 0;
      });
    }

    ctx!.globalAlpha = 1;
    rafId = requestAnimationFrame(draw);
  }

  rafId = requestAnimationFrame(draw);
}

export function cleanupStarfield(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = null;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  resizeHandler = null;
  if (el && el.parentNode) el.parentNode.removeChild(el);
  el = null;
}
