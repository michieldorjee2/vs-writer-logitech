/**
 * The search page's scene is a rounded panel with its lower-left cut out; the account
 * lists sit in the cut-out. The cut is the scene's clip-path, so it can rise
 * into the panel (and grow when search opens) rather than appear.
 *
 * Pure geometry: the page measures, this draws.
 */

/** Outer corner radius, and the cut-out's own corner. */
const R = 20;
const RC = 10;

export type CutoutBox = {
  /** The scene panel's size. */
  w: number;
  h: number;
  /** Where the cut-out ends on the right; `w` when it spans the whole panel (narrow screens). */
  right: number;
};

/**
 * The panel's outline, clockwise, with a cut-out `depth` px tall. At 0 (or
 * less) it is the plain rounded rectangle, so the page can start there.
 */
export function cutoutPath({ w, h, right }: CutoutBox, depth: number): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  const top = h - Math.max(0, depth);
  let d = `M${R},0 H${w - R} A${R},${R} 0 0 1 ${w},${R}`;

  if (right >= w - 0.5) {
    // Full width: the cut-out is the panel's new bottom edge.
    d += ` V${f(top - R)} A${R},${R} 0 0 1 ${w - R},${f(top)}`;
  } else {
    // The two right-hand corners grow in as the cut-out clears the bottom edge.
    const span = h - top;
    const rb = Math.min(R, (span * R) / (R + RC));
    const rc = Math.min(RC, (span * RC) / (R + RC));
    d += ` V${h - R} A${R},${R} 0 0 1 ${w - R},${h} H${f(right + rb)}`;
    if (rb > 0.01) d += ` A${f(rb)},${f(rb)} 0 0 1 ${right},${f(h - rb)}`;
    d += ` V${f(top + rc)}`;
    if (rc > 0.01) d += ` A${f(rc)},${f(rc)} 0 0 0 ${f(right - rc)},${f(top)}`;
  }

  d += ` H${R} A${R},${R} 0 0 1 0,${f(top - R)} V${R} A${R},${R} 0 0 1 ${R},0 Z`;
  return d;
}

/** Fast start, long soft landing (expo out, normalised to end exactly at 1). */
const K = 1 - Math.pow(2, -10);
export const easeOut = (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : (1 - Math.pow(2, -10 * p)) / K);
