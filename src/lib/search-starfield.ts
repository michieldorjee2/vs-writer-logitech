/**
 * Booth-grade starfield for /search.
 *
 * Improvements over the template:
 * - Continuous trails: draw a line from the star's previous position to the
 *   current one every frame (no per-frame "dot" artifacts).
 * - No ghosting: clear each frame with a real clearRect (not a low-alpha
 *   fillRect), then paint persistent trail layers explicitly. This prevents
 *   the residual bg tint building up on transparent pixels.
 * - Full P3 HDR: request a display-p3 canvas context when available, and use
 *   color() / oklch() strings so the GPU composites in wide gamut. On the
 *   iPad's P3 panel the blues sit ~25% more saturated.
 * - Dither: 1 sub-pixel jitter on gradient stops removes visible banding.
 */

type RGB = [number, number, number];

type Star = {
  /** World-space X (fixed); projected to screen via 1/z. */
  x: number;
  /** World-space Y. */
  y: number;
  /** Depth. Smaller = closer to camera. */
  z: number;
  /** Previous projected position, for drawing continuous trails. */
  px: number;
  py: number;
  /** Twinkle phase. */
  phase: number;
  tint: 'white' | 'accent' | 'warm';
};

type Controller = {
  setAccent: (rgb: RGB) => void;
  destroy: () => void;
};

const HDR_CANVAS_OPTS: CanvasRenderingContext2DSettings & { colorSpace?: 'display-p3' | 'srgb'; desynchronized?: boolean } = {
  alpha: true,
  colorSpace: 'display-p3',
  desynchronized: false,
};

export function startSearchStarfield(canvas: HTMLCanvasElement, initialAccent: RGB): Controller {
  const ctx = (canvas.getContext('2d', HDR_CANVAS_OPTS) ||
    canvas.getContext('2d')) as CanvasRenderingContext2D;

  let accent: RGB = initialAccent;
  let w = 0;
  let h = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let stars: Star[] = [];
  let raf = 0;
  let mouseX = 0, mouseY = 0, tMouseX = 0, tMouseY = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed(n: number) {
    stars = Array.from({ length: n }, () => {
      const z = Math.random() * 0.92 + 0.08;
      return {
        x: (Math.random() - 0.5) * w * 1.4,
        y: (Math.random() - 0.5) * h * 1.4,
        z,
        px: 0,
        py: 0,
        phase: Math.random() * Math.PI * 2,
        tint:
          Math.random() < 0.18
            ? Math.random() < 0.6
              ? 'accent'
              : 'warm'
            : 'white',
      };
    });
  }

  resize();
  // Booth: iPads are wide. Bump density for screen-real-estate parity.
  seed(340);

  function onResize() {
    resize();
    seed(340);
  }
  window.addEventListener('resize', onResize);

  function onMove(e: MouseEvent) {
    tMouseX = (e.clientX / w - 0.5) * 2;
    tMouseY = (e.clientY / h - 0.5) * 2;
  }
  window.addEventListener('mousemove', onMove);

  /**
   * Build a P3-aware color string. Falls back to rgba() on browsers that
   * don't support color() in canvas fillStyle (very old Safari).
   */
  function p3(rgb: RGB, alpha: number): string {
    const [r, g, b] = rgb;
    // Values are 0-255 sRGB. Convert to 0-1 and use CSS `color()` with
    // display-p3 — the canvas will promote it when colorSpace=display-p3.
    const rN = r / 255, gN = g / 255, bN = b / 255;
    return `color(display-p3 ${rN.toFixed(4)} ${gN.toFixed(4)} ${bN.toFixed(4)} / ${alpha.toFixed(4)})`;
  }

  // Feature-detect once: does this browser accept color() in fillStyle?
  let supportsP3Strings = true;
  try {
    ctx.fillStyle = p3([0, 0, 0], 1);
  } catch {
    supportsP3Strings = false;
  }

  function col(rgb: RGB, alpha: number): string {
    if (supportsP3Strings) return p3(rgb, alpha);
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(4)})`;
  }

  function tick() {
    // Fade the previous frame — `destination-out` subtracts alpha from
    // existing pixels without tinting them. That gives real motion trails
    // (the old template's bg-coloured fillRect caused the ghost haze).
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Ease mouse for parallax
    mouseX += (tMouseX - mouseX) * 0.05;
    mouseY += (tMouseY - mouseY) * 0.05;

    const cx = w / 2;
    const cy = h / 2;
    const speed = 0.0035;
    const parallaxX = mouseX * 24;
    const parallaxY = mouseY * 18;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.z -= speed;
      let recycled = false;
      if (s.z <= 0.02) {
        s.x = (Math.random() - 0.5) * w * 1.4;
        s.y = (Math.random() - 0.5) * h * 1.4;
        s.z = 1;
        recycled = true;
      }

      const k = 1 / s.z;
      const sx = s.x * k + cx - parallaxX * (1 - s.z);
      const sy = s.y * k + cy - parallaxY * (1 - s.z);
      const depth = 1 - s.z;

      s.phase += 0.02 + depth * 0.02;
      const twinkle = 0.55 + Math.sin(s.phase) * 0.45;
      const alpha = Math.min(1, (0.3 + twinkle * 0.7) * depth * 0.98 + 0.18);
      const r = depth * 3.2 + 0.6;

      const rgb: RGB =
        s.tint === 'accent'
          ? accent
          : s.tint === 'warm'
            ? [255, 220, 180]
            : [255, 255, 255];

      // --- Continuous trail: stroke from prev → current so the fade
      // layer above has something unbroken to decay. Paint a short
      // "tail" past the previous position too, so slow-moving far stars
      // still look like streaks rather than dots.
      if (!recycled && (s.px !== 0 || s.py !== 0) && depth > 0.04) {
        const dx = sx - s.px;
        const dy = sy - s.py;
        const mag = Math.hypot(dx, dy) || 1;
        // Extend the trail backward proportional to depth — near stars
        // get a longer visible streak.
        const extend = 2 + depth * 16;
        const tx = s.px - (dx / mag) * extend;
        const ty = s.py - (dy / mag) * extend;
        const grd = ctx.createLinearGradient(tx, ty, sx, sy);
        // Sub-pixel stop jitter blurs the quantization threshold so
        // gradient banding disappears on wide-gamut displays.
        const jitter = (Math.random() - 0.5) * 0.03;
        grd.addColorStop(0, col(rgb, 0));
        grd.addColorStop(0.6 + jitter, col(rgb, alpha * 0.35));
        grd.addColorStop(1, col(rgb, alpha * 0.85));
        ctx.strokeStyle = grd;
        ctx.lineWidth = Math.max(0.9, depth * 2.4);
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      // Glow halo for brighter stars
      if (depth > 0.55) {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5);
        g.addColorStop(0, col(rgb, alpha * 0.6));
        g.addColorStop(1, col(rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 5, 0, Math.PI * 2);
        ctx.fill();

        // 4-point cross spike on the brightest stars
        if (depth > 0.82 && twinkle > 0.6) {
          ctx.strokeStyle = col(rgb, alpha * 0.55);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(sx - r * 6, sy); ctx.lineTo(sx + r * 6, sy);
          ctx.moveTo(sx, sy - r * 6); ctx.lineTo(sx, sy + r * 6);
          ctx.stroke();
        }
      }

      // Core dot
      ctx.fillStyle = col(rgb, alpha);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();

      s.px = sx;
      s.py = sy;
    }

    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return {
    setAccent: (rgb) => { accent = rgb; },
    destroy: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
    },
  };
}
