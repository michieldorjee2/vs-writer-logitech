/*
 * The badge scanner's lanyard (BadgeLanyard): a strap of a few links hanging
 * from a point above the screen, the badge on its end. It falls in, swings,
 * can be grabbed and flung, and turns back to face the rep. Pure and small (no
 * engine): Verlet points with rope links that only pull, a heavy last point
 * for the badge, and two springs for how the badge turns: its tilt follows the
 * strap, and a spin from moving sideways settles back to the front.
 * server/badge-read-check.ts drops it, flings it and pulls on it.
 */

export type Point = { x: number; y: number };

export type Lanyard = {
  /** points[0] is where the strap hangs from; the last point is the badge's clip. */
  points: Point[];
  prev: Point[];
  /** One link's length. */
  link: number;
  /** The badge's tilt in the screen's plane (radians, clockwise) and how fast it changes. */
  tilt: number;
  tiltV: number;
  /** The badge's spin about its upright axis (degrees; 0 faces the rep, 180 shows its back). */
  spin: number;
  spinV: number;
  /** Where the clip is held (dragged), or null. */
  held: Point | null;
  /** Steps in a row with almost nothing moving: asleep once it is SLEEP_STEPS. */
  still: number;
};

/** Pixels per second squared: a strap with a card on it drops fast and lands with a swing. */
const GRAVITY = 2400;
/** How much of its speed a point keeps each step: air, and the strap's own stiffness. */
const DAMPING = 0.988;
/** The badge is this many times heavier than a link: the strap gives way to it. */
const BADGE_WEIGHT = 8;
const ITERATIONS = 10;
/** The tilt follows the strap's last link on this spring (stiffness, damping), never past MAX_TILT. */
const MAX_TILT = 0.9;
const TILT_K = 180;
const TILT_C = 16;
/** A sideways move spins the badge; this spring turns it back to the front. */
const SPIN_FROM_MOVE = 3.2;
const SPIN_K = 16;
const SPIN_C = 6.5;
/** Faster than this the spin stops growing: a hard fling turns it round, not into a blur. */
const MAX_SPIN_V = 1400;
const SLEEP_SPEED = 6;
export const SLEEP_STEPS = 45;
export const STEP = 1 / 120;

/** A lanyard of `links` links hanging from `anchor`, its badge `length` below it. `drop`: it starts above, to fall in. */
export function makeLanyard(anchor: Point, length: number, links: number, drop: boolean): Lanyard {
  const link = length / links;
  const points: Point[] = [];
  for (let i = 0; i <= links; i++) {
    // Dropped: bunched up above the anchor, the badge a little to one side, so it lands swinging.
    points.push(drop ? { x: anchor.x + (i / links) * length * 0.18, y: anchor.y - i * link * 0.25 - 40 } : { x: anchor.x, y: anchor.y + i * link });
  }
  points[0] = { ...anchor };
  return { points, prev: points.map((p) => ({ ...p })), link, tilt: 0, tiltV: 0, spin: 0, spinV: 0, held: null, still: 0 };
}

/** Moves where the strap hangs from and how long it is (the window was resized), keeping the shape it has. */
export function rehang(l: Lanyard, anchor: Point, length: number): void {
  const dx = anchor.x - l.points[0].x;
  const dy = anchor.y - l.points[0].y;
  for (let i = 0; i < l.points.length; i++) {
    l.points[i].x += dx;
    l.points[i].y += dy;
    l.prev[i].x += dx;
    l.prev[i].y += dy;
  }
  l.link = length / (l.points.length - 1);
  l.still = 0;
}

export const clip = (l: Lanyard): Point => l.points[l.points.length - 1];
export const asleep = (l: Lanyard) => l.still >= SLEEP_STEPS && !l.held;
export const wake = (l: Lanyard) => void (l.still = 0);

/** Holds the badge's clip at `at` (dragging); null lets go, and it keeps the speed it was moved at. */
export function hold(l: Lanyard, at: Point | null): void {
  l.held = at ? { ...at } : null;
  l.still = 0;
}

/** One step of STEP seconds. */
export function step(l: Lanyard, dt = STEP): void {
  const { points, prev } = l;
  const last = points.length - 1;
  const before = { ...points[last] };

  // Move: each point keeps its speed (less a little), and falls.
  for (let i = 1; i <= last; i++) {
    const p = points[i];
    const vx = (p.x - prev[i].x) * DAMPING;
    const vy = (p.y - prev[i].y) * DAMPING;
    prev[i] = { ...p };
    p.x += vx;
    p.y += vy + GRAVITY * dt * dt;
  }
  // Held: the clip goes where the pointer is, no further than the strap reaches.
  if (l.held) {
    const a = points[0];
    const reach = l.link * last;
    const dx = l.held.x - a.x;
    const dy = l.held.y - a.y;
    const d = Math.hypot(dx, dy);
    const k = d > reach ? reach / d : 1;
    points[last].x = a.x + dx * k;
    points[last].y = a.y + dy * k;
  }

  // The links: a strap pulls but never pushes (it folds when the badge is pushed up).
  for (let n = 0; n < ITERATIONS; n++) {
    for (let i = 0; i < last; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      if (d <= l.link) continue;
      // How the correction is shared: the anchor and a held clip don't move; the badge moves less.
      const wa = i === 0 ? 0 : 1;
      const wb = i + 1 === last ? (l.held ? 0 : 1 / BADGE_WEIGHT) : 1;
      if (!wa && !wb) continue;
      const push = (d - l.link) / d / (wa + wb);
      a.x += dx * push * wa;
      a.y += dy * push * wa;
      b.x -= dx * push * wb;
      b.y -= dy * push * wb;
    }
  }

  // The badge's tilt follows its strap; a sideways move spins it, and it turns back to the front.
  const end = points[last];
  const from = points[last - 1];
  const target = Math.max(-MAX_TILT, Math.min(MAX_TILT, -Math.atan2(end.x - from.x, end.y - from.y)));
  l.tiltV += (TILT_K * (target - l.tilt) - TILT_C * l.tiltV) * dt;
  l.tilt += l.tiltV * dt;
  const vx = (end.x - before.x) / dt;
  const front = Math.round(l.spin / 360) * 360;
  l.spinV += (vx * SPIN_FROM_MOVE - SPIN_K * (l.spin - front) - SPIN_C * l.spinV) * dt;
  l.spinV = Math.max(-MAX_SPIN_V, Math.min(MAX_SPIN_V, l.spinV));
  l.spin += l.spinV * dt;

  // Asleep once nothing moves: the page stops drawing it until it is touched again.
  const speed = Math.hypot(end.x - before.x, end.y - before.y) / dt;
  const settled = speed < SLEEP_SPEED && Math.abs(l.tiltV) < 0.05 && Math.abs(l.spinV) < 3 && Math.abs(l.spin - front) < 1;
  l.still = settled && !l.held ? l.still + 1 : 0;
}

/**
 * The strap as an SVG path through its points: each link a curve, so the
 * strap bends instead of kinking at its joints (Catmull-Rom, as cubic Béziers).
 */
export function strapPath(points: Point[]): string {
  if (points.length < 2) return '';
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)},${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)},${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}
