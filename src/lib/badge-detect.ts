/*
 * Whether a badge is being held up to the camera, so the camera can take the
 * photo by itself (BadgeScanButton's CameraSheet). No model and no library: a
 * few numbers about a small grey copy of what is inside the on-screen frame,
 * a few times a second, and nothing leaves the page.
 *
 * A badge held up reads as: something moved into the frame (it arrived), then
 * the picture inside the frame stopped moving (one look still is enough: the
 * looks are 150 ms apart), it is full of sharp edges (printed words), and those
 * edges stopped getting sharper (the camera has focused). The photo is taken on
 * that look, as the frame flashes green. An empty room, a face or a hand passing
 * by fail one of those, so they are not taken; "Take photo" is always there.
 */

/** A small grey picture: one byte a pixel, rows top to bottom. */
export type Gray = { data: Uint8Array; width: number; height: number };

/** What one look at the frame measured. */
export type FrameMeasure = {
  /** Share of pixels on a sharp edge, 0–1: printed words make many. */
  edges: number;
  /** Mean change per pixel since the last look, 0–255: 0 is perfectly still. */
  motion: number;
  /** Mean brightness, 0–255. */
  light: number;
};

/** A pixel is on an edge when it and its right and lower neighbours differ by this much in all (0–255). */
const EDGE_STEP = 48;
/** Above this the picture is moving: something is being lifted into, or out of, the frame. */
const MOVING = 9;
/** Below this it is held still (a hand is never perfectly still; a camera's noise is about 1–2). */
const STILL = 4.5;
/** Fewer edges than this is not a badge: a wall, a face, a blurred card. */
const EDGE_FLOOR = 0.035;
/** The first looks only learn the scene: the camera is still setting its exposure. */
const WARM_UP_LOOKS = 3;
/** Edges still growing by more than this share mean the camera is still focusing. */
const FOCUSING = 0.2;

/** RGBA pixels (a canvas's getImageData) as grey. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
  }
  return { data, width, height };
}

/** Edges, motion against the look before (`prev`, the same size) and light. */
export function measure(frame: Gray, prev: Gray | null): FrameMeasure {
  const { data, width: w, height: h } = frame;
  let edges = 0;
  let light = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = data[i];
      light += v;
      if (x + 1 < w && y + 1 < h && Math.abs(v - data[i + 1]) + Math.abs(v - data[i + w]) >= EDGE_STEP) edges++;
    }
  }
  const inner = Math.max(1, (w - 1) * (h - 1));
  let motion = 0;
  if (prev && prev.data.length === data.length) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += Math.abs(data[i] - prev.data[i]);
    motion = sum / data.length;
  }
  return { edges: edges / inner, motion, light: light / Math.max(1, data.length) };
}

export type Watch = {
  /** Looks so far. */
  looks: number;
  /** Something moved into the frame after the warm-up. */
  arrived: boolean;
  /** The last look's edges, to see the focus settle. */
  lastEdges: number;
};

export const WATCH_START: Watch = { looks: 0, arrived: false, lastEdges: 0 };

export type Verdict = 'looking' | 'take';

/** One look: whether a badge is held up in the frame now (take the photo), or not yet. */
export function watchStep(watch: Watch, m: FrameMeasure): { watch: Watch; verdict: Verdict } {
  const looks = watch.looks + 1;
  const next: Watch = { looks, arrived: watch.arrived, lastEdges: m.edges };
  // The first look has nothing to compare with: its motion says nothing.
  if (looks <= WARM_UP_LOOKS) return { watch: next, verdict: 'looking' };
  if (m.motion > MOVING) {
    next.arrived = true;
    return { watch: next, verdict: 'looking' };
  }
  const lit = m.light > 30 && m.light < 240;
  const sharp = m.edges >= EDGE_FLOOR;
  const focused = m.edges <= watch.lastEdges * (1 + FOCUSING) + 0.005;
  const take = next.arrived && lit && sharp && focused && m.motion < STILL;
  return { watch: next, verdict: take ? 'take' : 'looking' };
}
