/**
 * Person hero — the zoomed-in system.
 *
 * The company page's hero (abm-hero-3d.ts) is a wide starfield with two marks
 * orbiting: two organisations meeting in open space. This is the same universe
 * one level closer in. We have flown into that company's system, so:
 *
 *   - stars are fewer, larger, and drift slower, which is what "closer" looks
 *     like without saying it;
 *   - the company's own mark sits still at the centre as the star — established,
 *     dim, not the subject;
 *   - what orbits it are the Optimizely solutions that matter to THIS seat,
 *     ordered by the person's scorecard, so the picture and the argument agree.
 *
 * Written rather than parameterised off abm-hero-3d.ts on purpose. That module
 * is 1,049 lines carrying SVG path extrusion, Brandfetch fallbacks and a
 * multi-stage intro; threading a second camera through it would put the company
 * page at risk for no gain. This shares the visual grammar, not the code.
 *
 * Everything here is decorative. The page renders complete without it.
 */

export interface SolutionNode {
  /** Short label drawn on the node — "CMS", "Opal", "Experimentation". */
  label: string;
  /** 0 = most relevant to this seat. Drives size, brightness and orbit radius. */
  rank: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  depth: number;
  alpha: number;
  twinkle: number;
  phase: number;
}

interface Body {
  label: string;
  rank: number;
  angle: number;
  radiusX: number;
  radiusY: number;
  speed: number;
  size: number;
}

let rafId: number | null = null;
let resizeHandler: (() => void) | null = null;
let observer: IntersectionObserver | null = null;
let visible = true;

const PALETTE = {
  lime: '#abff44',
  limeSoft: '#c8ff8f',
  cyan: '#91dbda',
  paper: '#eff6e9',
  fir: '#08251a',
};

/** Solutions the seat cares least about still orbit, just further out and dimmer. */
function orbitFor(rank: number, w: number, h: number): { rx: number; ry: number; size: number } {
  const base = Math.min(w * 0.3, 340);
  return {
    rx: base * (0.62 + rank * 0.2),
    ry: Math.min(h * 0.12, 92) * (0.62 + rank * 0.2),
    size: Math.max(16, 30 - rank * 4),
  };
}

export function initPersonSystem(
  canvasId: string,
  solutions: SolutionNode[],
  opts: { companyLabel?: string | null; accent?: string | null } = {},
): void {
  // Idempotent: module-level rafId means a second init would orphan the first
  // loop, which then draws to the same canvas forever. Two or three re-renders
  // and the main thread is saturated.
  cleanupPersonSystem();

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const accent = opts.accent || PALETTE.cyan;
  const companyLabel = (opts.companyLabel || '').trim();

  let stars: Star[] = [];
  let bodies: Body[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let t = 0;
  let last = performance.now();
  // The system assembles on load rather than snapping into place: a short
  // ease-in that mirrors the company hero's fly-in without competing with it.
  let intro = 0;

  function layout(): void {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas!.getBoundingClientRect();
    w = Math.max(rect.width, 320);
    h = Math.max(rect.height, 320);
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sparse and large. The company hero runs hundreds of 1px stars; a dozen
    // and a half at 1.5-3.5px is the whole difference between "out there" and
    // "in here".
    const count = Math.round((w * h) / 42000);
    stars = Array.from({ length: Math.max(14, Math.min(count, 46)) }, () => {
      const depth = Math.random();
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1.5 + depth * 2,
        depth,
        alpha: 0.25 + depth * 0.45,
        twinkle: 0.4 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
      };
    });

    bodies = solutions.slice(0, 4).map((s, i) => {
      const o = orbitFor(s.rank, w, h);
      return {
        label: s.label,
        rank: s.rank,
        // Spread the starting angles so nothing overlaps on first paint.
        angle: (i / Math.max(solutions.length, 1)) * Math.PI * 2,
        radiusX: o.rx,
        radiusY: o.ry,
        // Nearer bodies move faster, which reads as depth.
        speed: 0.00013 - s.rank * 0.000018,
        size: o.size,
      };
    });
  }

  function drawStar(s: Star, time: number): void {
    const flicker = Math.sin(time * s.twinkle + s.phase) * 0.18;
    ctx!.globalAlpha = Math.max(0.08, Math.min(1, s.alpha + flicker));
    ctx!.fillStyle = s.depth > 0.7 ? PALETTE.paper : PALETTE.limeSoft;
    ctx!.beginPath();
    ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx!.fill();
  }

  function draw(): void {
    const now = performance.now();
    const dt = Math.min(now - last, 120);
    last = now;
    t += dt;
    if (intro < 1) intro = Math.min(1, intro + dt / 1400);
    const ease = 1 - Math.pow(1 - intro, 3);

    if (!visible) {
      rafId = requestAnimationFrame(draw);
      return;
    }

    ctx!.clearRect(0, 0, w, h);
    const time = t * 0.001;

    for (const s of stars) drawStar(s, time);
    ctx!.globalAlpha = 1;

    const cx = w * 0.5;
    const cy = h * 0.52;

    // ---- orbit rings ----
    for (const b of bodies) {
      ctx!.strokeStyle = PALETTE.lime;
      ctx!.globalAlpha = (0.14 - b.rank * 0.028) * ease;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.ellipse(cx, cy, b.radiusX * ease, b.radiusY * ease, 0, 0, Math.PI * 2);
      ctx!.stroke();
    }

    // ---- the company, as the star ----
    const coreR = 22 * ease;
    const glow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.4);
    glow.addColorStop(0, hexA(accent, 0.42 * ease));
    glow.addColorStop(1, hexA(accent, 0));
    ctx!.globalAlpha = 1;
    ctx!.fillStyle = glow;
    ctx!.beginPath();
    ctx!.arc(cx, cy, coreR * 3.4, 0, Math.PI * 2);
    ctx!.fill();

    ctx!.fillStyle = hexA(accent, 0.9);
    ctx!.beginPath();
    ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx!.fill();

    if (companyLabel) {
      ctx!.globalAlpha = ease;
      ctx!.fillStyle = PALETTE.fir;
      ctx!.font = `700 ${Math.round(coreR * 0.52)}px Figtree, system-ui, sans-serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(companyLabel.slice(0, 3).toUpperCase(), cx, cy + 1);
    }

    // ---- solutions in orbit ----
    // Painter's algorithm: sort by the y of the orbit so nearer bodies overlap
    // the star rather than hiding behind it.
    const placed = bodies
      .map((b) => {
        b.angle += b.speed * dt;
        const x = cx + Math.cos(b.angle) * b.radiusX * ease;
        const y = cy + Math.sin(b.angle) * b.radiusY * ease;
        // Behind the star for the far half of the ellipse.
        const front = Math.sin(b.angle) > 0;
        return { b, x, y, front };
      })
      .sort((a, z) => Number(a.front) - Number(z.front));

    for (const { b, x, y, front } of placed) {
      const r = (b.size / 2) * ease * (front ? 1 : 0.86);
      const a = (front ? 1 : 0.55) * ease;

      ctx!.globalAlpha = a * 0.28;
      ctx!.fillStyle = PALETTE.lime;
      ctx!.beginPath();
      ctx!.arc(x, y, r * 2.1, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.globalAlpha = a;
      ctx!.fillStyle = PALETTE.lime;
      ctx!.beginPath();
      ctx!.arc(x, y, r, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = PALETTE.fir;
      ctx!.font = `600 ${Math.max(8, Math.round(r * 0.62))}px 'Figtree', system-ui, sans-serif`;
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText(b.label.slice(0, 3).toUpperCase(), x, y + 0.5);
    }

    ctx!.globalAlpha = 1;
    rafId = requestAnimationFrame(draw);
  }

  function hexA(hex: string, alpha: number): string {
    const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return `rgba(145,219,218,${alpha})`;
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
  }

  layout();
  // Debounced: layout() reallocates the star field and forces a reflow, so
  // running it per resize event during a drag is wasteful.
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  resizeHandler = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 120);
  };
  window.addEventListener('resize', resizeHandler);

  // Stop drawing once the hero scrolls away — same courtesy the company hero
  // extends, and the reason it can afford a much heavier loop.
  observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0 },
  );
  observer.observe(canvas);

  rafId = requestAnimationFrame(draw);
}

export function cleanupPersonSystem(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  resizeHandler = null;
  observer?.disconnect();
  observer = null;
  visible = true;
}
