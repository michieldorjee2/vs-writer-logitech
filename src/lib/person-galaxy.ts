/**
 * The hero galaxy — the person page's centrepiece, in real 3D.
 *
 * The company page's hero (abm-hero-3d.ts) is a 2D canvas painting two logos
 * orbiting in open space. This is the same idea one level in and one dimension
 * up: WebGL, real lights, real materials, and at the middle of it the customer's
 * own website — the same screenshot the company page argues against in its
 * challenge section — floating as a lit slab with the Optimizely products that
 * matter to this seat in orbit around it.
 *
 * The composition is the argument. Their site is the subject and it is at the
 * centre; what orbits it is not a product catalogue but the two or three
 * products drawn from this person's scorecard, in scorecard order, labelled with
 * the full product name rather than an acronym nobody outside the building
 * reads. Nothing here invents a claim the page does not already make.
 *
 * Three things worth knowing before editing:
 *
 *   - The canvas is FIXED to the viewport and spans the whole page, and the
 *     scene is split in two. The galaxy lives in world space and stays with the
 *     reader, walking a set of scroll waypoints. The slab and the products live
 *     on a `stage` whose position and scale are computed by projecting the
 *     hero's reserved column (`#person-stage`) into the scene every frame — so
 *     they stay locked to that column and scroll away with the document, while
 *     the sky behind them does not.
 *
 *   - The screenshot is loaded `crossOrigin="anonymous"` straight off the CMP
 *     DAM CDN, which serves `access-control-allow-origin: *`. That matters:
 *     WebGL refuses to upload a texture from an image fetched without CORS. It
 *     is also why the screenshot has to live in the DAM rather than wherever a
 *     capture tool happened to drop it — an Opal `/v1/file/<id>` URL needs a
 *     bearer token, so it fails here AND renders broken on the company page.
 *
 *   - The browser chrome around the screenshot is painted into the texture
 *     rather than modelled. A slab plus a baked chrome bar reads exactly like
 *     the company page's mock and costs two triangles.
 *
 * Everything here is decorative. If WebGL is missing, the texture fails, or the
 * user asked for reduced motion, the page is complete without it.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface GalaxyProduct {
  /** Full product name — "Content Management", never "CMS". */
  label: string;
  /** 0 = first on the person's scorecard: biggest, brightest, nearest. */
  rank: number;
}

export interface GalaxyOptions {
  /** The customer's brand colour, used for the rim light and the site's glow. */
  accent?: string | null;
  /** Proxied screenshot of the customer's current site. */
  screenshotUrl?: string | null;
  /** Shown in the baked browser chrome, e.g. "apple.com". */
  domain?: string | null;
}

const LIME = 0x9fe855;
const PAPER = 0xeff6e9;
const FIR = 0x08251a;
const MIDFIR = 0x0d3a29;

/** The slab's resting pose, and the rock it plays around it — the same
 *  numbers as the company page's `screenshot-rock` keyframes. */
const REST_ROT_Y = THREE.MathUtils.degToRad(-17);
const REST_ROT_X = THREE.MathUtils.degToRad(7);

interface Orbiting {
  group: THREE.Group;
  crystal: THREE.Mesh;
  label: THREE.Sprite;
  labelOpacity: number;
  /** How far the name sits from its crystal, and which side it is on. */
  labelOffset: number;
  labelSide: 1 | -1;
  angle: number;
  speed: number;
  rx: number;
  rz: number;
  tilt: number;
  bob: number;
}

let renderer: THREE.WebGLRenderer | null = null;
let composer: EffectComposer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let rafId = 0;
let resizeHandler: (() => void) | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let disposables: Array<{ dispose: () => void }> = [];
let onScreen = true;
/** Set in the reduced-motion path, where nothing re-renders on its own. */
let renderOnce: (() => void) | null = null;
let scrollHandler: (() => void) | null = null;
let hoverOn: ((e: Event) => void) | null = null;
let hoverOff: ((e: Event) => void) | null = null;

function track<T extends { dispose: () => void }>(obj: T): T {
  disposables.push(obj);
  return obj;
}

/** #0071e3 -> 0x0071e3, with a lime fallback for anything unparseable. */
function toHex(css: string | null | undefined, fallback: number): number {
  if (!css) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(css.trim());
  return m ? parseInt(m[1], 16) : fallback;
}

/**
 * A rounded rectangle as real geometry, so the slab has edges that catch the
 * key light. A plane would read as a sticker.
 */
function roundedSlab(w: number, h: number, r: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 12,
  });
  geo.center();
  return geo;
}

/** A soft radial blob, used for every glow in the scene. */
function radialTexture(inner: string, outer: string, stops: Array<[number, string]> = []): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  for (const [at, col] of stops) g.addColorStop(at, col);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Break a product name across at most two lines at a word boundary.
 *
 * "Content Management" set on one line is about two world-units wide, which at
 * the outer orbit puts its far end outside the frustum — the name clipped
 * mid-word every time the crystal swung wide. Two lines halve the width and
 * read better besides.
 */
function wrapLabel(text: string, maxChars = 11): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2 || text.length <= maxChars) return [text];
  // Greedy first line, remainder on the second — every product name we ship is
  // one or two words, so this never needs a third.
  const lines: string[] = [];
  let line = words[0];
  for (const w of words.slice(1)) {
    if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  lines.push(line);
  return lines.slice(0, 2);
}

/**
 * The product label, drawn at 3x and billboarded. Canvas text rather than
 * geometry: full product names are long, and a sprite stays crisp and readable
 * at any orbit depth where extruded glyphs would turn to mush.
 */
function labelSprite(text: string, color: string, dim: boolean): THREE.Sprite {
  const pad = 20;
  const fontSize = 46;
  const leading = Math.round(fontSize * 1.18);
  const lines = wrapLabel(text.toUpperCase());

  const measure = document.createElement('canvas').getContext('2d')!;
  measure.font = `600 ${fontSize}px "Roboto Mono", ui-monospace, monospace`;
  const textW = Math.max(...lines.map((l) => measure.measureText(l).width));

  const c = document.createElement('canvas');
  c.width = Math.ceil(textW + pad * 2);
  c.height = leading * lines.length + pad * 2;
  const ctx = c.getContext('2d')!;

  /* A soft fir plate behind the text. Without it a name is legible over open
     space and illegible the moment its orbit carries it across the bright
     screenshot — and it crosses on every lap. */
  ctx.fillStyle = 'rgba(8, 37, 26, 0.55)';
  ctx.beginPath();
  ctx.roundRect(4, 4, c.width - 8, c.height - 8, 14);
  ctx.fill();

  ctx.font = `600 ${fontSize}px "Roboto Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '3px';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.globalAlpha = dim ? 0.72 : 1;
  lines.forEach((l, i) => {
    ctx.fillText(l, c.width / 2, pad + leading * (i + 0.5));
  });

  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  /* depthTest off so a name is never half-eaten by the slab it passes over.
     The trade — a label for a crystal hiding behind the screenshot would show
     through — is paid off in the animation loop, which fades each label out as
     its crystal goes round the back. */
  const mat = track(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  const sprite = new THREE.Sprite(mat);
  // World-units per texel — constant, so every label keeps the same cap height
  // whatever the product is called.
  sprite.scale.set(c.width * 0.0034, c.height * 0.0034, 1);
  return sprite;
}

/**
 * Bake the company page's browser mock — dots, url pill, hairline — onto the
 * top of the screenshot, then hand the whole thing over as one texture.
 *
 * Site screenshots are full-page captures and run very tall (apple.com's is
 * 1440x6285). Drawing only the top 16:10 of it is the same crop the company
 * page gets from `object-fit: cover; object-position: top`.
 */
function composeSiteTexture(img: HTMLImageElement, domain: string | null | undefined): THREE.CanvasTexture {
  const W = 1200;
  const CHROME = 62;
  const BODY = Math.round(W / 1.6);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = CHROME + BODY;
  const ctx = c.getContext('2d')!;

  // chrome bar
  ctx.fillStyle = '#114a35';
  ctx.fillRect(0, 0, W, CHROME);
  ctx.fillStyle = '#197050';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(34 + i * 30, CHROME / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (domain) {
    const pillX = 148;
    const pillW = Math.min(460, W - pillX - 40);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.roundRect(pillX, CHROME / 2 - 15, pillW, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#a1ac8d';
    ctx.font = '400 20px "Roboto Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(domain, pillX + 14, CHROME / 2 + 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, CHROME - 1, W, 1);

  // the screenshot, cover-cropped to the top
  const scale = W / img.naturalWidth;
  const drawH = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, CHROME, W, BODY);
  ctx.clip();
  ctx.drawImage(img, 0, CHROME, W, drawH);
  ctx.restore();

  // Knock it back just enough that the slab reads as an object in the scene
  // rather than a bright window punched through it — but not so far that the
  // customer cannot recognise their own homepage, which is the entire point of
  // putting it here. A fir-tinted gradient, heavier at the bottom, keeps the
  // top of the page legible while the slab still sits in the dark.
  const wash = ctx.createLinearGradient(0, CHROME, 0, CHROME + BODY);
  wash.addColorStop(0, 'rgba(8,37,26,0.06)');
  wash.addColorStop(1, 'rgba(8,37,26,0.38)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, CHROME, W, BODY);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Placeholder face for when there is no screenshot to show. */
function fallbackSiteTexture(domain: string | null | undefined): THREE.CanvasTexture {
  const img = document.createElement('canvas');
  img.width = 1200;
  img.height = 750;
  const ctx = img.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 1200, 750);
  g.addColorStop(0, '#0d3a29');
  g.addColorStop(1, '#08251a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 750);
  const c = document.createElement('canvas');
  c.width = 1200;
  c.height = 812;
  const cctx = c.getContext('2d')!;
  cctx.drawImage(img, 0, 62);
  cctx.fillStyle = '#114a35';
  cctx.fillRect(0, 0, 1200, 62);
  if (domain) {
    cctx.fillStyle = '#a1ac8d';
    cctx.font = '400 20px "Roboto Mono", ui-monospace, monospace';
    cctx.textBaseline = 'middle';
    cctx.fillText(domain, 148, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ─────────────────────────── scroll waypoints ───────────────────────────
 *
 * The galaxy is fixed to the viewport and the page scrolls past it, so it needs
 * somewhere to go. These are poses keyed to progress down the whole document,
 * lerped with a smoothstep between them: it swings from up-right at the hero,
 * across to the left as the reader gets into the provenance, tips almost
 * edge-on through the middle of the argument, comes back tilted and close under
 * the one number, then drifts up and away at the ask.
 *
 * Opacity is part of the pose on purpose. The sections with the densest reading
 * get the dimmest sky — that is what keeps this a mood rather than a
 * distraction behind body copy.
 */
/* Waypoints are authored in the terms you actually think in — WHERE ON SCREEN,
   how big, how fast — not in world units.

   `x` / `y` are viewport fractions (0.5, 0.5 is dead centre), resolved against
   the camera at that waypoint's own depth. That has a useful property:
   changing `depth` does NOT move the galaxy on screen. Depth only changes
   perspective and parallax; the screen position stays exactly where you put
   it, at any viewport size. */
export interface Waypoint {
  /** Scroll progress down the whole document: 0 at the top, 1 at the bottom. */
  at: number;
  /** Screen position as viewport fractions. 0.5 / 0.5 is dead centre. */
  x: number;
  y: number;
  /** World z. Further back = more perspective, same screen position. */
  depth: number;
  /** Apparent size. 1 is the authored default. */
  scale: number;
  /** Disc tilt, radians. 0 is edge-on; about -1.4 is face-on. */
  tilt: number;
  /** Roll about the view axis, radians. */
  roll: number;
  opacity: number;
  /** Rotation-speed multiplier. 1 is the base drift. */
  spin: number;
}

export type Pose = Omit<Waypoint, 'at'>;

let WAYPOINTS: Waypoint[] = [
  { at: 0.000, x: 0.785, y: 0.865, depth: -3.20, scale: 2.70, tilt: -0.630, roll: -0.340, opacity: 0.66, spin: 0.75 },
  { at: 0.160, x: 0.500, y: 0.185, depth: -6.80, scale: 1.00, tilt: -0.660, roll: 0.080, opacity: 1.60, spin: 1.00 },
  { at: 0.380, x: 0.540, y: 0.410, depth: -1.50, scale: 2.58, tilt: -0.700, roll: -0.060, opacity: 0.68, spin: 3.95 },
  { at: 0.600, x: 0.895, y: 0.595, depth: -1.50, scale: 1.24, tilt: -0.050, roll: -0.140, opacity: 1.60, spin: 1.00 },
  { at: 0.780, x: 0.510, y: 0.440, depth: -1.50, scale: 3.50, tilt: -0.880, roll: -0.200, opacity: 0.26, spin: 0.00 },
  { at: 1.000, x: 0.500, y: 0.745, depth: -1.50, scale: 1.02, tilt: -1.450, roll: -1.000, opacity: 0.30, spin: 1.15 },
];

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* The opening. The galaxy unfurls dead centre and large, holds a beat, then
   sweeps out to wherever waypoint 0 puts it — and the page's own content comes
   in behind it, partway through that sweep. HERO_INTRO_SECONDS is what the copy
   waits for; it is exported so person-animations.ts delays the hero timeline by
   exactly the same amount instead of the two guessing at each other. */
const INTRO_POSE: Pose = {
  x: 0.5, y: 0.48, depth: -4.6, scale: 1, tilt: -0.78, roll: 0.05, opacity: 1, spin: 1,
};
const INTRO_HOLD = 1.5;
const INTRO_TRAVEL = 1.4;
export const HERO_INTRO_SECONDS = INTRO_HOLD + 0.3;

function poseAt(p: number, out: Pose) {
  let i = 0;
  while (i < WAYPOINTS.length - 2 && p > WAYPOINTS[i + 1].at) i++;
  const a = WAYPOINTS[i];
  const b = WAYPOINTS[i + 1] ?? a;
  const span = Math.max(1e-4, b.at - a.at);
  const t = smoothstep(THREE.MathUtils.clamp((p - a.at) / span, 0, 1));
  const L = (k: keyof Pose) => THREE.MathUtils.lerp(a[k], b[k], t);
  out.x = L('x'); out.y = L('y'); out.depth = L('depth'); out.scale = L('scale');
  out.tilt = L('tilt'); out.roll = L('roll');
  out.opacity = L('opacity'); out.spin = L('spin');
}

/* ── Live-editing hooks, for the temporary control panel ────────────────────
   Delete these, person-galaxy-controls.ts and the one gated import in
   PersonPage.tsx, and nothing else has to change. */
let override: Pose | null = null;
let readProgress: (() => number) | null = null;

export function getWaypoints(): Waypoint[] {
  return WAYPOINTS.map((w) => ({ ...w }));
}
export function setWaypoints(next: Waypoint[]): void {
  if (next.length >= 2) WAYPOINTS = next.map((w) => ({ ...w })).sort((m, n) => m.at - n.at);
}
export function setOverride(p: Pose | null): void {
  override = p ? { ...p } : null;
}
export function getScrollProgress(): number {
  return readProgress ? readProgress() : 0;
}

/* ─────────────────────────── the spiral disc ───────────────────────────
 *
 * A branched logarithmic spiral of additive points — the shape a galaxy
 * generator makes: pick a radius, drop the particle on one of N arms, twist it
 * by an angle proportional to that radius, then scatter it off the arm by a
 * cubed random so most points hug the arm and a few drift into the halo.
 *
 * All of it happens in the vertex shader off three attributes, which is what
 * makes the load-in free: `uProgress` scales the radius, and because the twist
 * is `radius * spin`, growing the radius *also* winds the arms. So the whole
 * galaxy unfurls out of a single bright point at the core rather than fading
 * up — one uniform, no per-frame CPU work over 14k particles.
 *
 * Colour runs hot-white at the core to the customer's own accent at the rim,
 * so the brand colour is in the light rather than painted over it.
 */
const DISC_VERT = `
  attribute float aRadius;
  attribute float aBranch;
  attribute vec3  aScatter;
  attribute float aSize;
  attribute float aSeed;

  uniform float uProgress;
  uniform float uTime;
  uniform float uSpinTime;
  uniform float uSpin;
  uniform float uSize;
  uniform float uRadius;
  uniform float uPixelRatio;

  varying vec3  vColor;
  varying float vFade;

  uniform vec3 uCoreColor;
  uniform vec3 uMidColor;
  uniform vec3 uRimColor;

  void main() {
    /* aRadius is normalised 0..1 so it can drive the colour ramp; the world
       radius comes from uRadius. Keeping these separate matters — scaling the
       scatter in world units while leaving the spiral normalised makes the
       scatter five times bigger than the arms, and the whole thing collapses
       into a formless cloud with no spiral in it at all. */
    float r = aRadius * uRadius * uProgress;

    // The twist is proportional to radius, so growing r during the reveal also
    // winds the arms — the galaxy unfurls rather than simply scaling up.
    // uSpinTime is its own accumulator, not the scene clock, so the galaxy's
    // rotation can be sped up without also fast-forwarding the reveal.
    float angle = aBranch + r * uSpin + uSpinTime * 0.05;

    vec3 pos = vec3(cos(angle) * r, 0.0, sin(angle) * r) + aScatter * uProgress;

    // A little vertical breathing so the disc never reads as a flat decal.
    pos.y += sin(uSpinTime * 0.5 + aSeed * 6.28318) * 0.04 * (1.0 - aRadius * 0.6);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    // Clamped: without a ceiling a particle that drifts near the camera plane
    // blows up into a huge quad, and some drivers stop giving it a usable
    // gl_PointCoord — which renders as a stray white square.
    gl_PointSize = clamp(uSize * aSize * uPixelRatio / -mv.z, 1.0, 24.0);

    // Hot white core, lime through the arms, the customer's accent at the rim.
    vColor = aRadius < 0.22
      ? mix(uCoreColor, uMidColor, smoothstep(0.0, 0.22, aRadius))
      : mix(uMidColor, uRimColor, smoothstep(0.22, 0.85, aRadius));

    // Particles still on their way out are dimmer, so the reveal reads as
    // light thrown outward rather than the whole disc brightening at once.
    vFade = smoothstep(0.0, 0.3, uProgress) * (0.30 + 0.70 * smoothstep(1.0, 0.15, aRadius));
  }
`;

const DISC_FRAG = `
  uniform float uOpacity;
  varying vec3  vColor;
  varying float vFade;

  void main() {
    // Round, soft-edged point. Without this every particle is a hard square.
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.06, d);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha * vFade * uOpacity);
  }
`;

interface Disc {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
}

function buildDisc(accentHex: number, pixelRatio: number): Disc {
  const COUNT = 30000;
  const BRANCHES = 3;
  // Full-viewport rather than a 600px column, and it is meant to run off the
  // edges rather than sit politely inside them.
  const MAX_RADIUS = 9.6;
  const SPIN = 1.95;
  const SCATTER = 0.17;

  const radii = new Float32Array(COUNT);
  const branch = new Float32Array(COUNT);
  const scatter = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const seeds = new Float32Array(COUNT);
  // Positions are computed in the shader, but three still needs the attribute
  // to know how many vertices there are and to build a bounding sphere.
  const positions = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    // Pow > 1 crowds particles toward the middle, which is what gives the core
    // its blaze without needing a separate mesh for it.
    const t = Math.pow(Math.random(), 1.6);
    const r = t * MAX_RADIUS;
    radii[i] = t;
    branch[i] = ((i % BRANCHES) / BRANCHES) * Math.PI * 2;

    // Cubed scatter: most points sit tight on the arm, a few stray into the halo.
    const spread = (v: number) => Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * v;
    scatter[i * 3] = spread(SCATTER * r);
    scatter[i * 3 + 1] = spread(SCATTER * r * 0.28);
    scatter[i * 3 + 2] = spread(SCATTER * r);

    sizes[i] = 0.5 + Math.random() * 0.75 + (t < 0.1 ? 0.2 : 0);
    seeds[i] = Math.random();
  }

  const geo = track(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
  geo.setAttribute('aBranch', new THREE.BufferAttribute(branch, 1));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  // The shader moves vertices, so the auto-computed sphere is wrong and the
  // disc would get frustum-culled at some camera angles.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), MAX_RADIUS * 2);

  const material = track(
    new THREE.ShaderMaterial({
      vertexShader: DISC_VERT,
      fragmentShader: DISC_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uSpinTime: { value: 0 },
        uSpin: { value: SPIN },
        uSize: { value: 17 },
        uOpacity: { value: 0.5 },
        uRadius: { value: MAX_RADIUS },
        uPixelRatio: { value: pixelRatio },
        uCoreColor: { value: new THREE.Color(0xfbffef) },
        uMidColor: { value: new THREE.Color(0xabff44) },
        uRimColor: { value: new THREE.Color(accentHex) },
      },
    }),
  );

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  // The tilt is the waypoints' job now — this stays neutral so the poses are
  // absolute rather than relative to some baked-in starting angle.
  return { points, material };
}

export function initPersonGalaxy(
  canvasId: string,
  products: GalaxyProduct[],
  opts: GalaxyOptions = {},
): void {
  cleanupPersonGalaxy();
  if (typeof document === 'undefined') return;

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;
  /* The canvas is a fixed page-wide layer, so it is no longer its own host.
     `host` is the box the hero reserves for the slab and its products — the
     rect that gets projected into the scene each frame. */
  const host = document.getElementById('person-stage');
  if (!host) return;

  const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const accentHex = toHex(opts.accent, LIME);

  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch {
    return; // no WebGL — the page reads fine without a hero picture
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  /* Dead-on down -Z with no lookAt drift. The stage's position is computed by
     projecting a DOM rect into world space, and that arithmetic only holds if
     the camera is axis-aligned — any lean and the slab stops matching the
     column it is supposed to sit in. Pointer parallax moved to the galaxy. */
  camera.position.set(0, 0, 13);
  camera.lookAt(0, 0, 0);

  /* Real bloom rather than a stack of additive sprites pretending to be it.
     The threshold is set above the slab's own brightness so the screenshot
     stays sharp and only the emissive crystals, the halo and the nebula bleed —
     which is the difference between a lit scene and a glowing one.

     The alpha handling is the fiddly part: the render target has to carry alpha
     and the pass chain has to preserve it, or the bloom composite writes an
     opaque black rectangle over the page's own starfield. */
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
  });
  composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.3, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- lights ----------------------------------------------------------
  // Ambient is fir rather than grey so unlit faces sit in the page's own dark
  // instead of going muddy.
  scene.add(new THREE.AmbientLight(MIDFIR, 1.6));
  const key = new THREE.DirectionalLight(PAPER, 2.1);
  key.position.set(5, 6, 7);
  scene.add(key);
  const rim = new THREE.PointLight(accentHex, 70, 26, 2);
  rim.position.set(-5, 2, 3.5);
  scene.add(rim);
  const fill = new THREE.PointLight(LIME, 22, 24, 2);
  fill.position.set(4.5, -2.5, 2.5);
  scene.add(fill);

  /* Two groups, and the split is the whole point of this layout:
       `stage`  — the slab, the crystals and their names. Pinned to the hero's
                  reserved column by projecting that element's rect into world
                  space every frame, so it scrolls away with the document like
                  any other page element.
       `discGroup` — the galaxy. Fixed in world space, posed by the waypoints.
                  The canvas is fixed to the viewport, so this stays put and
                  orbits with the reader the whole way down the page. */
  const stage = new THREE.Group();
  scene.add(stage);

  const root = stage;

  const SLAB_W = 3.3;
  /* Everything on the stage, so it can be brought in as one after the galaxy's
     opening sweep. Fading a group in three.js means fading its materials —
     there is no group-level alpha — so they are collected as they are built
     and their authored opacity is kept to multiply against. */
  const stageMats: Array<{ m: THREE.Material; base: number }> = [];
  const fadeable = <T extends THREE.Material>(m: T): T => {
    m.transparent = true;
    stageMats.push({ m, base: m.opacity });
    return m;
  };
  const accentCss = '#' + accentHex.toString(16).padStart(6, '0');

  // ---- the galaxy itself -------------------------------------------------
  // A branched spiral of 14k additive points, in place of the three blurred
  // sprites that used to stand in for one. It unfurls out of the core on load
  // and carries the customer's accent in its rim.
  const disc = buildDisc(accentHex, Math.min(window.devicePixelRatio || 1, 2));
  const discGroup = new THREE.Group();
  discGroup.add(disc.points);
  scene.add(discGroup);

  /* The two soft sprites that used to fog in a "nebula" are gone. The disc's
     own core plus the bloom pass is the light now, and stacking a 6-unit
     additive blob on top of it turned the whole column into green haze. */

  // ---- depth stars -----------------------------------------------------
  // The page already has a fixed 2D starfield behind everything. These are a
  // near field in front of it: they parallax against it as the scene turns,
  // which is what sells the depth.
  const STARS = 700;
  const positions = new Float32Array(STARS * 3);
  const colors = new Float32Array(STARS * 3);
  const paper = new THREE.Color(0xc3ceaf);
  const lime = new THREE.Color(0x7ddd3d);
  const accentCol = new THREE.Color(accentHex);
  for (let i = 0; i < STARS; i++) {
    // A shell rather than a box — a box puts a visible corner in frame.
    const r = 13 + Math.random() * 22;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
    positions[i * 3 + 2] = r * Math.cos(phi) - 6;
    const roll = Math.random();
    const c = roll > 0.93 ? accentCol : roll > 0.82 ? lime : paper;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      size: 0.1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      /* A PointsMaterial with no map draws every point as a hard SQUARE. At
         the old size they were sub-pixel and it never showed; on a full-screen
         canvas they turned into little white tiles scattered over the page. */
      map: track(radialTexture('#ffffff', 'rgba(0,0,0,0)', [[0.35, '#ffffff']])),
    }),
  );
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // ---- the site slab ---------------------------------------------------
  const SLAB_H = SLAB_W / 1.52;
  const slabGroup = new THREE.Group();
  root.add(slabGroup);

  const frameGeo = track(roundedSlab(SLAB_W + 0.16, SLAB_H + 0.16, 0.16, 0.16));
  // Midfir rather than fir: at this exposure a #08251a bezel renders as a
  // black rectangle and the bevel does nothing.
  const frameMat = fadeable(track(
    new THREE.MeshStandardMaterial({ color: MIDFIR, roughness: 0.38, metalness: 0.35 }),
  ));
  const frame = new THREE.Mesh(frameGeo, frameMat);
  slabGroup.add(frame);

  const faceGeo = track(new THREE.PlaneGeometry(SLAB_W, SLAB_H));
  const faceMat = fadeable(track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.12,
      emissive: new THREE.Color(accentHex),
      emissiveIntensity: 0.05,
    }),
  ));
  const face = new THREE.Mesh(faceGeo, faceMat);
  /* The frame is extruded 0.16 deep with a 0.02 bevel and then centred, so its
     front surface sits at z = +0.10. Anything at or under that is swallowed by
     the bezel — the first pass put the face at 0.095 and the slab rendered as a
     black rectangle with the screenshot hidden inside it. */
  face.position.z = 0.14;
  slabGroup.add(face);

  // A slab this dark needs a bloom behind it or it reads as a hole.
  const haloTex = track(radialTexture(accentCss, 'rgba(0,0,0,0)', [[0.28, accentCss]]));
  const haloMat = fadeable(track(
    new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  ));
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(SLAB_W * 1.75, SLAB_H * 1.9, 1);
  halo.position.z = -0.5;
  slabGroup.add(halo);

  slabGroup.rotation.set(REST_ROT_X, REST_ROT_Y, 0);

  const shotSrc = opts.screenshotUrl;
  if (shotSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // The init may have been torn down while the image was in flight.
      if (!renderer) return;
      const tex = track(composeSiteTexture(img, opts.domain));
      faceMat.map = tex;
      faceMat.needsUpdate = true;
      /* Under reduced motion there is no animation loop to pick this up, and
         the one frame we drew was painted before the screenshot arrived — the
         slab rendered as a blank lit panel. Draw again now that it is here. */
      renderOnce?.();
    };
    img.onerror = () => {
      if (!renderer) return;
      const tex = track(fallbackSiteTexture(opts.domain));
      faceMat.map = tex;
      faceMat.needsUpdate = true;
      renderOnce?.();
    };
    img.src = shotSrc;
  } else {
    const tex = track(fallbackSiteTexture(opts.domain));
    faceMat.map = tex;
    faceMat.needsUpdate = true;
  }

  // ---- products in orbit -----------------------------------------------
  const orbits: Orbiting[] = [];
  const ordered = [...products].sort((a, b) => a.rank - b.rank).slice(0, 5);

  ordered.forEach((p, i) => {
    const near = i === 0;
    const size = 0.34 - i * 0.032;
    // At fov 42 and z 8.6 the frame is about 8 units across, so the outermost
    // orbit plus half a label has to stay inside x = +/-4. The steep tilt is
    // what carries each crystal up over the slab and back down behind it,
    // rather than dragging it straight across the screenshot.
    const rx = 2.05 + i * 0.4;
    const rz = 1.2 + i * 0.26;
    const tilt = THREE.MathUtils.degToRad(-30 - i * 9);

    const group = new THREE.Group();

    // Flat-shaded icosahedra rather than smooth spheres: the facets pick up
    // the key and rim lights separately, which is what makes them read as lit
    // solids instead of coloured dots.
    const geo = track(new THREE.IcosahedronGeometry(size, 1));
    const mat = fadeable(track(
      new THREE.MeshStandardMaterial({
        color: near ? LIME : 0x6fbf46,
        emissive: new THREE.Color(near ? LIME : 0x3f8f30),
        emissiveIntensity: near ? 0.42 : 0.26,
        roughness: 0.28,
        metalness: 0.45,
        flatShading: true,
      }),
    ));
    const crystal = new THREE.Mesh(geo, mat);
    group.add(crystal);

    const glowTex = track(radialTexture('#abff44', 'rgba(0,0,0,0)', [[0.3, '#abff44']]));
    const glowMat = fadeable(track(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: near ? 0.32 : 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ));
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(size * 3.4);
    group.add(glow);

    const label = labelSprite(p.label, near ? '#dfffb0' : '#c8ff8f', !near);
    label.position.set(0, -size - 0.42, 0);
    group.add(label);

    root.add(group);
    orbits.push({
      group,
      crystal,
      label,
      labelOpacity: near ? 1 : 0.85,
      labelOffset: size + 0.34,
      labelSide: -1,
      angle: (i / Math.max(1, ordered.length)) * Math.PI * 2 + 0.6,
      speed: 0.115 - i * 0.017,
      rx,
      rz,
      tilt,
      bob: i * 1.7,
    });

    // No drawn orbit line any more — the spiral arms behind them read as the
    // paths, and a hairline ellipse over 14k points is just noise.
  });

  /* ---- sizing ----------------------------------------------------------
     The canvas covers the viewport now, so it sizes to the window rather than
     to any element. Pixel ratio is capped harder than before: this went from a
     600x520 box to a full screen, roughly four times the pixels through a
     bloom pass. */
  const resize = () => {
    if (!renderer || !camera) return;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    // The bloom chain is resolution-bound, and this is a full screen now.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(dpr);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (renderOnce) queueMicrotask(renderOnce);
  };
  resize();
  /* A ResizeObserver on <body> also fires on content reflow — the sticky bar
     appearing, a font settling — and each one re-made the render targets
     mid-scroll. For a viewport-sized canvas the window is the only thing worth
     listening to. */
  resizeHandler = () => resize();
  window.addEventListener('resize', resizeHandler, { passive: true });

  /* Project the hero's reserved column into world space and put the stage
     there, matched for size as well as position. Reading the live rect rather
     than using tuned constants means the slab tracks the column through every
     breakpoint — and it scrolls away for free, because the rect moves up as
     the document scrolls. */
  const STAGE_Z = 0;
  const stagePose = () => {
    if (!camera) return;
    const r = host.getBoundingClientRect();
    const dist = camera.position.z - STAGE_Z;
    const visH = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    const cx0 = r.left + r.width / 2;
    const cy0 = r.top + r.height / 2;
    stage.position.set(
      (cx0 / window.innerWidth - 0.5) * visW,
      -(cy0 / window.innerHeight - 0.5) * visH,
      STAGE_Z,
    );
    // Scale so the slab spans the reserved column at any viewport width.
    /* Divisor is the CLUSTER's width, not the slab's: the crystals orbit well
       outside the slab and their names sit outside them again, so scaling to
       the slab alone throws the outer labels across the introduction. */
    const wantWidth = (r.width / window.innerWidth) * visW;
    stage.scale.setScalar(THREE.MathUtils.clamp(wantWidth / (SLAB_W * 2.05), 0.25, 3));
  };
  stagePose();

  /* Progress down the WHOLE document, 0 at the top and 1 at the bottom — the
     galaxy is fixed to the viewport for the entire page now, so its waypoints
     are keyed to the whole read, not to the hero leaving. Read straight off
     the scroll position rather than wired to the page's ScrollTrigger, so the
     galaxy works whether or not GSAP booted and the module stays
     self-contained. */
  let scrollP = 0;
  let scrollTarget = 0;
  const readScroll = () => {
    const doc = document.documentElement;
    const max = Math.max(1, (doc.scrollHeight || 0) - window.innerHeight);
    scrollTarget = THREE.MathUtils.clamp((window.scrollY || doc.scrollTop || 0) / max, 0, 1);
  };
  readScroll();
  scrollHandler = () => {
    readScroll();
    // Under reduced motion nothing else redraws, so drive a frame from here.
    if (renderOnce) renderOnce();
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });

  /* Hovering the warp CTA winds the galaxy up — anticipation before the click.
     Delegated on the document rather than bound to the buttons, because there
     are two of them (the closing ask and the sticky bar's compact one) and the
     sticky one mounts later; one pair of listeners covers both. Focus counts as
     hover, so a keyboard user gets the same cue. */
  let hovering = false;
  const isCta = (e: Event) => e.target instanceof Element && !!e.target.closest('.warp-btn');
  hoverOn = (e) => { if (isCta(e)) hovering = true; };
  hoverOff = (e) => { if (isCta(e)) hovering = false; };
  document.addEventListener('pointerover', hoverOn, { passive: true });
  document.addEventListener('pointerout', hoverOff, { passive: true });
  document.addEventListener('focusin', hoverOn, { passive: true });
  document.addEventListener('focusout', hoverOff, { passive: true });

  // Off-screen the loop stops entirely — this hero is a viewport tall and the
  // reader spends most of the page below it.
  // The galaxy is on screen for the entire page now, so there is nothing to
  // gate on — but keep the hook so a hidden tab still parks the loop.
  onScreen = true;

  /* Exponential smoothing, so the rate is per-SECOND rather than per-frame.
     `Math.min(1, dt * rate)` moves further on a long frame than on a short one
     — which is exactly the stutter you feel when frames are uneven. */
  const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

  const BASE_OPACITY = 0.5;
  const pose: Pose = { ...INTRO_POSE };
  const worldPos = new THREE.Vector3();

  /* Resolve a pose's screen fraction into world space at its OWN depth. Because
     the conversion uses that depth, moving the galaxy nearer or further never
     shifts where it sits on screen — which is what makes these authorable by
     eye, and what keeps them correct at any viewport size. */
  const resolve = (ps: Pose, out: THREE.Vector3) => {
    const dist = camera!.position.z - ps.depth;
    const visH = 2 * dist * Math.tan((camera!.fov * Math.PI) / 360);
    const visW = visH * camera!.aspect;
    out.set((ps.x - 0.5) * visW, -(ps.y - 0.5) * visH, ps.depth);
  };
  readProgress = () => scrollTarget;
  let introDone = reduced;
  /* The galaxy's own rotation clock, and how fast it is running. Eased rather
     than switched, so both the wind-up and the settle are felt. */
  let spinTime = 0;
  let timeScale = 1;
  // 0 until the galaxy starts moving off, then the stage arrives behind it.
  let stageAlpha = reduced ? 1 : 0;
  const applyStageAlpha = () => {
    for (const { m, base } of stageMats) m.opacity = base * stageAlpha;
    stage.visible = stageAlpha > 0.002;
  };
  applyStageAlpha();
  // Placed before the first frame, or the disc visibly slides in from origin.
  resolve(INTRO_POSE, worldPos);
  discGroup.position.copy(worldPos);
  discGroup.rotation.set(INTRO_POSE.tilt, 0, INTRO_POSE.roll);
  discGroup.scale.setScalar(INTRO_POSE.scale);
  const clock = new THREE.Clock();

  const render = () => {
    if (composer) composer.render();
    else renderer!.render(scene!, camera!);
  };

  if (reduced) {
    // One lit frame, no loop: the composition is the point, the motion isn't.
    orbits.forEach((o) => {
      const z = Math.sin(o.angle) * o.rz * Math.cos(o.tilt);
      o.group.position.set(Math.cos(o.angle) * o.rx, Math.sin(o.angle) * o.rz * Math.sin(o.tilt), z);
      o.label.material.opacity = (z > 0 ? 1 : 0.42) * o.labelOpacity * stageAlpha;
      o.label.position.y = (o.group.position.y > 0 ? 1 : -1) * o.labelOffset;
    });
    // The reveal is motion; its end state is the composition. Show that.
    disc.material.uniforms.uProgress.value = 1;
    readScroll();
    poseAt(scrollTarget, pose);
    if (camera.aspect < 1) {
      pose.depth -= 3.4;
      pose.opacity *= 0.68;
    }
    resolve(pose, worldPos);
    discGroup.position.copy(worldPos);
    discGroup.rotation.set(pose.tilt, 0, pose.roll);
    discGroup.scale.setScalar(pose.scale);
    disc.material.uniforms.uOpacity.value = BASE_OPACITY * pose.opacity;
    stagePose();
    applyStageAlpha();
    render();
    // Resizing the column has to redraw too, for the same reason.
    renderOnce = render;
    return;
  }

  const animate = () => {
    rafId = requestAnimationFrame(animate);
    if (!onScreen || !renderer || !scene || !camera) return;

    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    /* The unfurl. Radius and twist are the same uniform, so easing it from 0
       to 1 sweeps the arms open out of the core. expo-out, but a gentle one:
       at -9 the galaxy was 88% open within a second, which is over before the
       reader has looked at it. -5 over 4s keeps the sweep visible. */
    const REVEAL = 2.2;
    const rp = Math.min(1, t / REVEAL);
    disc.material.uniforms.uProgress.value = 1 - Math.pow(2, -5 * rp);
    disc.material.uniforms.uTime.value = t;

    timeScale += ((pose.spin || 1) * (hovering ? 3.4 : 1) - timeScale) * damp(3.5, dt);
    spinTime += dt * timeScale;
    disc.material.uniforms.uSpinTime.value = spinTime;

    /* The galaxy walks its waypoints. Damped rather than snapped to the raw
       scroll value, so a flicked scrollbar glides the sky across instead of
       teleporting it. */
    scrollP += (scrollTarget - scrollP) * damp(3.2, dt);

    /* Until the opening has played out, the pose is the intro's, not the
       scroll's — unless the reader scrolls, which cancels it immediately.
       Someone who has started reading should not have the sky swim back to
       where it would have been. */
    const scripted = !introDone;
    if (!scripted) {
      poseAt(scrollP, pose);
    } else {
      const raw = THREE.MathUtils.clamp((t - INTRO_HOLD) / INTRO_TRAVEL, 0, 1);
      const e = easeInOut(raw);
      const w0 = WAYPOINTS[0];
      const K: Array<keyof Pose> = ['x', 'y', 'depth', 'scale', 'tilt', 'roll', 'opacity', 'spin'];
      for (const key of K) pose[key] = THREE.MathUtils.lerp(INTRO_POSE[key], w0[key], e);
      /* Flip only once the FINAL pose has actually been applied. Testing the
         clock instead meant that on a machine dropping frames the flag could
         turn over before any frame sampled the end of the curve, stranding the
         disc mid-sweep for the damping to chase after. */
      if (raw >= 1 || scrollTarget > 0.01) introDone = true;
    }

    // With the panel open the pose is pinned, so the sliders read directly.
    if (override) { Object.assign(pose, override); introDone = true; }
    /* Portrait: the copy runs the full width, so the core ends up directly
       behind the name. Push the whole galaxy back and take the brightness
       down — it should still be there, just further away. */
    if (camera.aspect < 1) {
      pose.depth -= 3.4;
      pose.opacity *= 0.68;
    }
    /* The opening is a scripted move, so it is applied DIRECTLY — its own
       easing is the choreography. Running it through the damping as well
       smeared a 1.4s sweep out over five seconds: the target arrived on time
       and the disc was still crawling after it. Damping is for scroll, where
       the input is the reader's and needs smoothing; not for a cue. */
    /* The opening is a scripted move, applied DIRECTLY — its own easing is the
       choreography. Running it through the damping as well smears a 1.4s sweep
       across several seconds. Damping is for scroll, where the input is the
       reader's and wants smoothing; not for a cue. */
    const k = scripted || override ? 1 : damp(3.0, dt);
    resolve(pose, worldPos);
    discGroup.position.lerp(worldPos, k);
    discGroup.rotation.set(
      THREE.MathUtils.lerp(discGroup.rotation.x, pose.tilt, k),
      // A slow constant turn on top of the pose — the galaxy is always
      // rotating, the waypoints only decide where it is and how it is tipped.
      discGroup.rotation.y + dt * 0.035 * timeScale,
      THREE.MathUtils.lerp(discGroup.rotation.z, pose.roll, k),
    );
    discGroup.scale.setScalar(THREE.MathUtils.lerp(discGroup.scale.x, pose.scale, k));
    // A touch brighter while the CTA is hovered, so the wind-up is felt as well
    // as seen. Scaled off the same eased value, so it never pops.
    const excite = 1 + (timeScale - 1) * 0.09;
    disc.material.uniforms.uOpacity.value +=
      (BASE_OPACITY * pose.opacity * excite - disc.material.uniforms.uOpacity.value) * k;

    /* The stage arrives once the galaxy has begun its sweep — the page's
       objects settle in behind it rather than being there from frame one. */
    if (stageAlpha < 1) {
      const sa = THREE.MathUtils.clamp((t - (INTRO_HOLD + 0.15)) / 0.9, 0, 1);
      stageAlpha = smoothstep(sa);
      applyStageAlpha();
    }

    // The stage is bound to the hero's column, so it travels with the page.
    stagePose();

    for (const o of orbits) {
      o.angle += o.speed * dt;
      const x = Math.cos(o.angle) * o.rx;
      const z = Math.sin(o.angle) * o.rz;
      o.group.position.set(
        x,
        z * Math.sin(o.tilt) + Math.sin(t * 0.7 + o.bob) * 0.12,
        z * Math.cos(o.tilt),
      );
      o.crystal.rotation.y += dt * 0.5;
      o.crystal.rotation.x += dt * 0.22;

      // Recede the name over the quarter-turn where its crystal goes behind the
      // slab — but never to nothing. The point of the galaxy is that a reader
      // can see which products are in orbit, and a name that blinks out for
      // half the cycle fails at that. 0.42 reads as "further away".
      const front = THREE.MathUtils.clamp((z + 0.35) / 0.7, 0, 1);
      o.label.material.opacity = (0.42 + front * 0.58) * o.labelOpacity * stageAlpha;

      /* Put the name on the far side of its crystal from the slab: above when
         the crystal is riding high, below when it is low. Fixed below, a name
         spent half of every lap sitting on top of the screenshot. The dead zone
         is hysteresis — without it the label flickers side to side each time
         the orbit crosses the horizon. */
      const y = o.group.position.y;
      if (y > 0.12) o.labelSide = 1;
      else if (y < -0.12) o.labelSide = -1;
      o.label.position.y = o.labelSide * o.labelOffset;
    }

    // The slab's rock, matching the company page's 8s screenshot-rock cycle.
    const rock = t * (Math.PI * 2) / 8;
    slabGroup.rotation.y = REST_ROT_Y + Math.sin(rock) * 0.055;
    slabGroup.rotation.x = REST_ROT_X + Math.sin(rock * 0.7 + 1.1) * 0.035;
    slabGroup.position.y = Math.sin(rock * 0.85) * 0.11;

    root.rotation.y = Math.sin(t * 0.06) * 0.09;
    starField.rotation.y = t * 0.01;

    render();
  };
  animate();
}

export function cleanupPersonGalaxy(): void {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }
  if (hoverOn && hoverOff) {
    document.removeEventListener('pointerover', hoverOn);
    document.removeEventListener('pointerout', hoverOff);
    document.removeEventListener('focusin', hoverOn);
    document.removeEventListener('focusout', hoverOff);
    hoverOn = null;
    hoverOff = null;
  }

  for (const d of disposables) {
    try { d.dispose(); } catch { /* already gone */ }
  }
  disposables = [];

  if (composer) {
    composer.dispose();
    composer = null;
  }
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer = null;
  }
  scene = null;
  camera = null;
  onScreen = true;
  renderOnce = null;
}
