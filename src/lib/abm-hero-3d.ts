// ===== HERO CANVAS -- Orbiting extruded logos =====
//
// PERSONALIZATION: To swap logos, edit the ORBIT_ITEMS array below.
// Each item needs: svgMarkup (inline SVG string), color, glowColor.
// The SVG should be white-filled; it gets tinted by the extrusion color.
// Set svgMarkup to null for a fallback cube.
//
// Converted from aldus-hyper hero-3d.js to TypeScript module

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ---- Module-level state for cleanup ----
let rafId: number | null = null;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
let resizeHandler: (() => void) | null = null;
let scrollHandler: (() => void) | null = null;
let starEl: HTMLCanvasElement | null = null;

export function initHero3D(customerLogoUrl?: string | null): void {
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // -- Fixed star-field canvas -- lives on <body>, stays in viewport while scrolling --
  starEl = document.createElement('canvas');
  starEl.id = 'star-field';
  Object.assign(starEl.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '0',
  });
  document.body.insertBefore(starEl, document.body.firstChild);
  const sCtx = starEl.getContext('2d');
  if (!sCtx) return;

  // ---- PERSONALIZATION CONFIG ----
  interface OrbitItem {
    label: string;
    color: string;
    glowColor: string;
    svgMarkup: string | null;
    imageEl: HTMLImageElement | null; // loaded brand logo (PNG/SVG as image)
  }

  const ORBIT_ITEMS: OrbitItem[] = [
    {
      label: 'Optimizely',
      color: '#194bff',
      glowColor: 'rgba(25,75,255,0.5)',
      imageEl: null,
      svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 139" fill="white">
        <path d="M48.4 76V92.7c12.7 0 24.9-4.9 33.9-13.6 9-8.7 14.1-20.6 14.1-32.9H79.2c0 7.9-3.3 15.5-9 21.1-5.8 5.5-13.6 8.7-21.8 8.7z"/>
        <path d="M48.4 122c-8.1 0-15.9-3.1-21.6-8.7-5.7-5.6-9-13.1-9-21s3.2-15.4 9-21c5.7-5.6 13.5-8.7 21.6-8.7V46c-6.3 0-12.5 1.2-18.2 3.5-5.8 2.3-11 5.7-15.5 10s-8 8.9-10.4 14.5C1.9 80.1.7 86.1.6 92.2c0 6.1 1.2 12.1 3.6 17.7s6.5 10.6 10.9 14.9c4.4 4.3 9.7 7.7 15.5 10 5.8 2.3 12 3.5 18.2 3.5h.1V122h.5z"/>
        <path d="M48.4 122v16.6c12.6 0 24.8-4.9 33.7-13.5 8.9-8.6 14-20.4 14-32.8H79c0 7.9-3.2 15.4-9 21-5.7 5.4-13.5 8.6-21.6 8.7z"/>
        <path d="M48.4 29.6V46.2c12.6 0 24.8-4.9 33.7-13.5 8.9-8.7 14-20.4 14-32.7H79c0 7.9-3.2 15.4-9 21-5.7 5.4-13.5 8.6-21.6 8.6z"/>
        <path d="M96.3 29.6V46.2c12.6 0 24.8-4.9 33.7-13.5 8.9-8.7 14-20.4 14-32.7h-17.1c0 7.9-3.2 15.4-9 21-5.7 5.4-13.4 8.6-21.6 8.6z"/>
      </svg>`,
    },
    {
      // -- CUSTOMER LOGO -- replaced dynamically from CMS --
      label: 'Customer',
      color: '#00ccff',
      glowColor: 'rgba(0,204,255,0.5)',
      imageEl: null,
      svgMarkup: null, // will be loaded below if customerLogoUrl is provided
    },
  ];

  // Load customer logo as an Image for canvas rendering
  if (customerLogoUrl) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { ORBIT_ITEMS[1].imageEl = img; };
    img.src = customerLogoUrl;
  }

  // -- State --
  let angle = -Math.PI / 2;
  let logoRotation = 0;
  let introLerp = 0;
  let introComplete = false;
  let isVisible = true;
  let starDriftOffset = 0;

  let trail1: Array<{ x: number; y: number }> = [];
  let trail2: Array<{ x: number; y: number }> = [];
  const MAX_TRAIL = 120;

  // -- Shooting stars --
  const SHOOT_VX = 12;
  const SHOOT_VY = 4;
  let shootingStars: Array<{ x: number; y: number; life: number }> = [];

  // -- Stars (pre-rendered to a static offscreen canvas, then blitted each frame) --
  const STAR_COUNT = 600;
  const starData = Array.from({ length: STAR_COUNT }, () => {
    const depth = Math.random();
    return {
      x: Math.random(),
      y: Math.random(),
      size: Math.max(1, Math.round(0.5 + Math.pow(depth, 3) * 2)),
      bright: depth > 0.75,
      colorIdx: Math.random() > 0.85 ? (Math.random() > 0.5 ? 1 : 2) : 0,
      depth: 0.3 + depth * 0.7,
    };
  });
  let starBitmap: HTMLCanvasElement | null = null;
  const starColors = ['#aaaacc', '#6687ff', '#00ccff'];

  // Twinkle subset
  const TWINKLE_COUNT = 50;
  const twinkleStars: any[] = [];
  for (
    let i = 0;
    i < starData.length && twinkleStars.length < TWINKLE_COUNT;
    i++
  ) {
    if (starData[i].bright && starData[i].size >= 2) {
      twinkleStars.push({
        ...starData[i],
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

  function buildStarField(w: number, h: number): void {
    starBitmap = document.createElement('canvas');
    starBitmap.width = w;
    starBitmap.height = h;
    const bctx = starBitmap.getContext('2d')!;
    bctx.clearRect(0, 0, w, h);
    starData.forEach((s) => {
      bctx.fillStyle = starColors[s.colorIdx];
      bctx.globalAlpha = 0.5 + (s.bright ? 0.3 : 0);
      const r = s.size * 0.5;
      bctx.beginPath();
      bctx.arc(
        Math.round(s.x * w) + r,
        Math.round(s.y * h) + r,
        Math.max(r, 0.5),
        0,
        Math.PI * 2
      );
      bctx.fill();
    });
  }

  // -- Parse SVG paths for 3D logo rendering --
  interface LogoGeometry {
    pathDs: string[];
    vbW: number;
    vbH: number;
    ready: boolean;
  }

  const logoGeometry: (LogoGeometry | null)[] = [];

  function buildLogoGeometry(item: OrbitItem): LogoGeometry | null {
    if (!item.svgMarkup) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(item.svgMarkup, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) return null;

    const vb = svg.getAttribute('viewBox');
    const parts = vb ? vb.split(/\s+/).map(Number) : [0, 0, 24, 24];
    const vbW = parts[2];
    const vbH = parts[3];

    const pathDs: string[] = [];
    doc.querySelectorAll('path').forEach((p) => {
      const d = p.getAttribute('d');
      if (d) pathDs.push(d);
    });

    return { pathDs, vbW, vbH, ready: pathDs.length > 0 };
  }

  // Build geometry on init
  ORBIT_ITEMS.forEach((item, i) => {
    logoGeometry[i] = buildLogoGeometry(item);
  });

  // -- Pre-rendered glow sprite --
  const GLOW_SIZE = 200;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = GLOW_SIZE;
  glowCanvas.height = GLOW_SIZE;
  const gc = glowCanvas.getContext('2d')!;
  const gg = gc.createRadialGradient(
    GLOW_SIZE / 2,
    GLOW_SIZE / 2,
    0,
    GLOW_SIZE / 2,
    GLOW_SIZE / 2,
    GLOW_SIZE / 2
  );
  gg.addColorStop(0, 'rgba(25,75,255,0.35)');
  gg.addColorStop(0.5, 'rgba(25,50,180,0.1)');
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  gc.fillStyle = gg;
  gc.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);

  // -- Resize --
  let stableStarH = window.innerHeight;

  function setRes(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas!.width = w;
    canvas!.height = h;

    stableStarH = Math.max(stableStarH, h);
    starEl!.width = w;
    starEl!.height = stableStarH;
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

  // -- 3D math: rotate point and project with perspective --
  const FOV = 600;

  function transform3D(
    x: number,
    y: number,
    z: number,
    ry: number,
    rx: number
  ): { x: number; y: number; z: number; d: number } {
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const y1 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;
    const d = FOV / (FOV + z2);
    return { x: x1 * d, y: y1 * d, z: z2, d };
  }

  // -- Draw true 3D extruded SVG logo --
  function drawExtrudedLogo(
    cx: number,
    cy: number,
    size: number,
    rotation: number,
    geo: LogoGeometry,
    color: string,
    alpha: number
  ): void {
    if (!geo || !geo.ready) return;

    const cr = parseInt(color.slice(1, 3), 16);
    const cg = parseInt(color.slice(3, 5), 16);
    const cb = parseInt(color.slice(5, 7), 16);

    const vbMax = Math.max(geo.vbW, geo.vbH);
    const S = size / vbMax;
    const halfW = geo.vbW / 2;
    const halfH = geo.vbH / 2;
    const halfD = (size * 0.15) / S;

    const ry = Math.sin(rotation * 1.2) * 0.4;
    const rx = Math.sin(rotation * 0.7) * 0.18;

    const combinedPath = new Path2D();
    geo.pathDs.forEach((d) => combinedPath.addPath(new Path2D(d)));

    function getFaceTransform(zDepth: number): number[] {
      const z2 = zDepth * Math.cos(ry) * Math.cos(rx);
      const k = (FOV / (FOV + z2)) * S;
      return [
        Math.cos(ry) * k,
        Math.sin(ry) * Math.sin(rx) * k,
        0,
        Math.cos(rx) * k,
        (zDepth * Math.sin(ry) - halfW * Math.cos(ry)) * k,
        (-halfH * Math.cos(rx) -
          halfW * Math.sin(ry) * Math.sin(rx) -
          zDepth * Math.cos(ry) * Math.sin(rx)) *
          k,
      ];
    }

    ctx!.save();
    ctx!.translate(cx, cy);

    // -- Far face (behind) --
    const tfFar = getFaceTransform(halfD);
    ctx!.save();
    ctx!.transform(tfFar[0], tfFar[1], tfFar[2], tfFar[3], tfFar[4], tfFar[5]);
    ctx!.globalAlpha = alpha * 0.65;
    ctx!.fillStyle = `rgb(${Math.min(255, Math.round(cr * 0.5 + 30))},${Math.min(255, Math.round(cg * 0.5 + 20))},${Math.min(255, Math.round(cb * 0.5 + 45))})`;
    ctx!.fill(combinedPath, 'evenodd');
    ctx!.restore();

    // -- Depth/thickness layers --
    const NUM_DEPTH = 7;
    for (let i = 1; i < NUM_DEPTH; i++) {
      const t = i / NUM_DEPTH;
      const zDepth = halfD - t * 2 * halfD;
      const tf = getFaceTransform(zDepth);
      const bri = 0.13 + (1 - t) * 0.05;
      ctx!.save();
      ctx!.transform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
      ctx!.globalAlpha = alpha * 0.55;
      ctx!.fillStyle = `rgb(${Math.min(255, Math.round(cr * bri))},${Math.min(255, Math.round(cg * bri))},${Math.min(255, Math.round(cb * bri))})`;
      ctx!.fill(combinedPath, 'evenodd');
      ctx!.restore();
    }

    // -- Near face (front) --
    const tfNear = getFaceTransform(-halfD);
    const screenScale = tfNear[0];
    ctx!.save();
    ctx!.transform(tfNear[0], tfNear[1], tfNear[2], tfNear[3], tfNear[4], tfNear[5]);

    ctx!.globalAlpha = alpha;
    ctx!.fillStyle = `rgb(${Math.min(255, Math.round(cr * 0.28 + 15))},${Math.min(255, Math.round(cg * 0.28 + 10))},${Math.min(255, Math.round(cb * 0.28 + 20))})`;
    ctx!.fill(combinedPath, 'evenodd');

    ctx!.globalAlpha = alpha * 0.06;
    ctx!.fillStyle = 'rgb(255,255,255)';
    ctx!.fill(combinedPath, 'evenodd');

    ctx!.globalAlpha = alpha * 0.85;
    ctx!.strokeStyle = `rgba(${Math.min(255, cr + 140)},${Math.min(255, cg + 130)},${Math.min(255, cb + 160)},1)`;
    ctx!.lineWidth = 2.5 / screenScale;
    ctx!.stroke(combinedPath);

    ctx!.globalAlpha = alpha * 0.4;
    ctx!.strokeStyle = `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 60)},${Math.min(255, cb + 100)},0.5)`;
    ctx!.lineWidth = 5.5 / screenScale;
    ctx!.stroke(combinedPath);

    ctx!.restore();

    // -- Backlight glow bloom --
    const glowR = size * 1.0;
    const grad = ctx!.createRadialGradient(0, 0, size * 0.15, 0, 0, glowR);
    grad.addColorStop(
      0,
      `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 60)},${Math.min(255, cb + 100)},${alpha * 0.4})`
    );
    grad.addColorStop(
      0.4,
      `rgba(${cr},${cg},${cb},${alpha * 0.15})`
    );
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx!.globalAlpha = 1;
    ctx!.fillStyle = grad;
    ctx!.beginPath();
    ctx!.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx!.fill();

    ctx!.restore();
    ctx!.globalAlpha = 1;
  }

  // -- Draw fallback cube (for items without SVG) --
  function drawCube(
    cx: number,
    cy: number,
    size: number,
    rx: number,
    ry: number,
    rz: number,
    color: string,
    alpha: number
  ): void {
    const sc = color || '#194bff';
    const cr = parseInt(sc.slice(1, 3), 16);
    const cg = parseInt(sc.slice(3, 5), 16);
    const cb = parseInt(sc.slice(5, 7), 16);

    const verts = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ].map((v) => {
      let x = v[0];
      let y = v[1];
      let z = v[2];
      let c: number;
      let s: number;
      let t: number;
      c = Math.cos(rx);
      s = Math.sin(rx);
      t = y * c - z * s;
      z = y * s + z * c;
      y = t;
      c = Math.cos(ry);
      s = Math.sin(ry);
      t = x * c + z * s;
      z = -x * s + z * c;
      x = t;
      c = Math.cos(rz);
      s = Math.sin(rz);
      t = x * c - y * s;
      y = x * s + y * c;
      x = t;
      return [x * size, y * size, z * size];
    });
    const faces = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [2, 3, 7, 6],
      [0, 3, 7, 4],
      [1, 2, 6, 5],
    ];
    faces.sort(
      (a, b) =>
        a.reduce((s, i) => s + verts[i][2], 0) -
        b.reduce((s, i) => s + verts[i][2], 0)
    );

    ctx!.globalAlpha = alpha;
    const blx = 0.0;
    const bly = -0.4;
    const blz = -0.9;
    const blLen = Math.sqrt(blx * blx + bly * bly + blz * blz);

    faces.forEach((f) => {
      ctx!.beginPath();
      ctx!.moveTo(cx + verts[f[0]][0], cy + verts[f[0]][1]);
      ctx!.lineTo(cx + verts[f[1]][0], cy + verts[f[1]][1]);
      ctx!.lineTo(cx + verts[f[2]][0], cy + verts[f[2]][1]);
      ctx!.lineTo(cx + verts[f[3]][0], cy + verts[f[3]][1]);
      ctx!.closePath();

      const e1x = verts[f[1]][0] - verts[f[0]][0];
      const e1y = verts[f[1]][1] - verts[f[0]][1];
      const e1z = verts[f[1]][2] - verts[f[0]][2];
      const e2x = verts[f[3]][0] - verts[f[0]][0];
      const e2y = verts[f[3]][1] - verts[f[0]][1];
      const e2z = verts[f[3]][2] - verts[f[0]][2];
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const dot = Math.max(0, (nx * blx + ny * bly + nz * blz) / (nLen * blLen));
      const ambient = 0.2;
      const rim = Math.pow(dot, 3) * 1.0;
      const bri = ambient + dot * 0.5;

      ctx!.fillStyle = `rgb(${Math.min(255, Math.round(cr * bri + rim * 180))},${Math.min(255, Math.round(cg * bri + rim * 150))},${Math.min(255, Math.round(cb * bri + rim * 220))})`;
      ctx!.fill();
      ctx!.strokeStyle = `rgba(${Math.min(255, cr + 100)},${Math.min(255, cg + 80)},${Math.min(255, cb + 130)},${alpha * (0.15 + rim * 0.5)})`;
      ctx!.lineWidth = 0.8;
      ctx!.stroke();
    });
  }

  // -- Comet trail --
  function drawTrail(trail: Array<{ x: number; y: number }>, color: string): void {
    if (trail.length < 3) return;
    const len = trail.length;

    ctx!.save();
    ctx!.lineCap = 'round';
    ctx!.lineJoin = 'round';

    // Pass 1: Wide outer glow
    for (let i = 1; i < len; i++) {
      const t = i / len;
      ctx!.beginPath();
      ctx!.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx!.lineTo(trail[i].x, trail[i].y);
      ctx!.strokeStyle = color;
      ctx!.lineWidth = t * 18;
      ctx!.globalAlpha = t * t * 0.08;
      ctx!.stroke();
    }

    // Pass 2: Medium core trail
    for (let i = 1; i < len; i++) {
      const t = i / len;
      ctx!.beginPath();
      ctx!.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx!.lineTo(trail[i].x, trail[i].y);
      ctx!.strokeStyle = color;
      ctx!.lineWidth = t * 6;
      ctx!.globalAlpha = t * t * 0.3;
      ctx!.stroke();
    }

    // Pass 3: White-hot inner core (front half only)
    for (let i = Math.floor(len * 0.5); i < len; i++) {
      const t = i / len;
      const headT = (i - len * 0.5) / (len * 0.5);
      ctx!.beginPath();
      ctx!.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx!.lineTo(trail[i].x, trail[i].y);
      ctx!.strokeStyle = `rgba(255,255,255,${headT * headT * 0.6})`;
      ctx!.lineWidth = headT * 3;
      ctx!.globalAlpha = 1;
      ctx!.stroke();
    }

    // Head bloom
    if (len > 1) {
      const head = trail[len - 1];
      const grad = ctx!.createRadialGradient(head.x, head.y, 0, head.x, head.y, 20);
      grad.addColorStop(0, 'rgba(255,255,255,0.6)');
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.arc(head.x, head.y, 20, 0, Math.PI * 2);
      ctx!.fill();
    }

    ctx!.restore();
    ctx!.globalAlpha = 1;
  }

  // -- Text reveal --
  function revealText(): void {
    gsap
      .timeline()
      .to('.hero__light-sweep', { opacity: 1, duration: 1 }, 0)
      .to(
        '.hero__badge--hidden',
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' },
        0.1
      )
      .to(
        '.hero__title-line',
        { opacity: 1, y: 0, duration: 0.9, stagger: 0.15, ease: 'power4.out' },
        0.2
      )
      .to(
        '.hero__subtitle--hidden',
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
        0.85
      )
      .to(
        '.hero__scroll-indicator--hidden',
        { opacity: 1, y: 0, duration: 0.5 },
        1.3
      );

    // Make the scroll indicator more prominent if user hasn't scrolled after 4s
    const indicator = document.querySelector('.hero__scroll-indicator');
    if (indicator) {
      let hasScrolled = false;
      const onScroll = () => {
        hasScrolled = true;
        window.removeEventListener('scroll', onScroll);
      };
      window.addEventListener('scroll', onScroll, { passive: true });

      setTimeout(() => {
        if (hasScrolled) return;
        gsap.to(indicator, {
          scale: 1.2,
          color: '#ffffff',
          duration: 0.6,
          ease: 'power2.out',
          transformOrigin: 'center bottom',
        });
      }, 4000);
    }
  }

  // -- Main draw loop (delta-time based) --
  let lastTime = performance.now();
  const INTRO_DURATION = 5000;

  function draw(): void {
    const now = performance.now();
    const dt = Math.min(now - lastTime, 200);
    lastTime = now;

    // -- Star field --
    starDriftOffset += 0.000018 * dt;
    const sw = starEl!.width;
    const sh = starEl!.height;
    sCtx!.clearRect(0, 0, sw, sh);
    const driftPx = (starDriftOffset * sh * 0.5) % sh;
    if (starBitmap) {
      sCtx!.globalAlpha = 1;
      sCtx!.drawImage(starBitmap, 0, -driftPx);
      if (driftPx > 0) sCtx!.drawImage(starBitmap, 0, sh - driftPx);
    }

    // Twinkle overlay
    const tSec = now * 0.001;
    for (let i = 0; i < twinkleStars.length; i++) {
      const t = twinkleStars[i];
      const px = Math.round(t.x * sw);
      const py = (Math.round(t.y * sh) - driftPx + sh) % sh;
      const flicker =
        Math.sin(tSec * t.speed1 + t.phase1) * 0.15 +
        Math.sin(tSec * t.speed2 + t.phase2) * 0.12 +
        Math.sin(tSec * t.speed3 + t.phase3) * 0.08;
      const flashWave = Math.sin(tSec * t.flashSpeed + t.flashPhase);
      const flash = flashWave > 0.92 ? (flashWave - 0.92) * 6.0 : 0;
      const alphaVal = t.baseAlpha + flicker + flash;
      const clamped = Math.max(0.05, Math.min(1, alphaVal));
      sCtx!.globalAlpha = clamped;
      sCtx!.fillStyle = starColors[t.colorIdx];
      const r = t.size * 0.5 + (flash > 0 ? 1.5 : 0.5);
      sCtx!.beginPath();
      sCtx!.arc(px, py, Math.max(r, 0.5), 0, Math.PI * 2);
      sCtx!.fill();
    }

    // Shooting stars (on the persistent star canvas)
    if (Math.random() < 0.004) {
      shootingStars.push({
        x: Math.random() * sw * 0.6,
        y: Math.random() * sh * 0.4,
        life: 1,
      });
    }
    if (shootingStars.length > 0) {
      sCtx!.strokeStyle = '#99afff';
      sCtx!.lineWidth = 1.5;
      shootingStars = shootingStars.filter((s) => {
        sCtx!.globalAlpha = s.life * 0.5;
        sCtx!.beginPath();
        sCtx!.moveTo(s.x, s.y);
        sCtx!.lineTo(s.x - SHOOT_VX * 4, s.y - SHOOT_VY * 4);
        sCtx!.stroke();
        s.x += SHOOT_VX;
        s.y += SHOOT_VY;
        s.life -= 0.012;
        return s.life > 0;
      });
    }
    sCtx!.globalAlpha = 1;

    // -- Orbit animation -- only when hero is in view --
    if (!isVisible) {
      rafId = requestAnimationFrame(draw);
      return;
    }

    const w = canvas!.width;
    const h = canvas!.height;
    ctx!.clearRect(0, 0, w, h);

    // Orbit layout
    const centerX = w / 2;
    const centerY = h * 0.62;
    const radiusX = Math.min(380, w * 0.28);
    const radiusY = Math.min(120, h * 0.1);

    if (introLerp < 1) {
      introLerp += dt / INTRO_DURATION;
      if (introLerp >= 0.8) {
        if (!introComplete) {
          introComplete = true;
          revealText();
        }
      }
      if (introLerp >= 1) {
        introLerp = 1;
      }
    }

    angle += 0.0005 * dt;
    logoRotation += 0.0007 * dt;
    const ei = 1 - Math.pow(1 - introLerp, 3);

    function getPos(
      t: number,
      offset: number
    ): {
      x: number;
      y: number;
      depth: number;
      scale: number;
      banking: number;
    } {
      const tx = centerX + Math.cos(t + offset) * radiusX;
      const ty = centerY + Math.sin(t + offset) * radiusY;
      const sx = offset === 0 ? -w * 0.8 : w * 1.8;
      const sy = -h * 0.4;
      return {
        x: sx + (tx - sx) * ei,
        y: sy + (ty - sy) * ei,
        depth: Math.sin(t + offset),
        scale: Math.max(
          0.1,
          (0.8 + Math.sin(t + offset) * 0.2) * (1 + Math.pow(1 - ei, 2) * 45)
        ),
        banking: (1 - ei) * (offset === 0 ? 0.5 : -0.5),
      };
    }

    const p1 = getPos(angle, 0);
    const p2 = getPos(angle, Math.PI);

    if (introLerp > 0.1) {
      trail1.push({ x: p1.x, y: p1.y });
      trail2.push({ x: p2.x, y: p2.y });
      if (trail1.length > MAX_TRAIL) trail1.shift();
      if (trail2.length > MAX_TRAIL) trail2.shift();
    }

    // Sort by depth for correct overlap
    const items = [
      { p: p1, idx: 0, trail: trail1, orbitAngle: angle },
      { p: p2, idx: 1, trail: trail2, orbitAngle: angle + Math.PI },
    ].sort((a, b) => a.p.depth - b.p.depth);

    items.forEach((item) => {
      const cfg = ORBIT_ITEMS[item.idx];
      drawTrail(item.trail, cfg.color);

      // Glow behind the object
      const gs = 180 * item.p.scale;
      ctx!.globalAlpha = Math.max(0, Math.min(0.5, (introLerp - 0.05) * 3));
      ctx!.drawImage(glowCanvas, item.p.x - gs / 2, item.p.y - gs / 2, gs, gs);
      ctx!.globalAlpha = 1;

      const fadeIn = Math.max(0, Math.min(1, (introLerp - 0.05) * 5));

      if (logoGeometry[item.idx] && logoGeometry[item.idx]!.ready) {
        drawExtrudedLogo(
          item.p.x,
          item.p.y,
          140 * item.p.scale,
          item.orbitAngle,
          logoGeometry[item.idx]!,
          cfg.color,
          fadeIn
        );
      } else if (cfg.imageEl) {
        // Draw loaded brand image (PNG/SVG) as a flat sprite
        const imgSize = 100 * item.p.scale;
        ctx!.save();
        ctx!.globalAlpha = fadeIn * 0.9;
        ctx!.filter = 'brightness(2)';
        ctx!.drawImage(
          cfg.imageEl,
          item.p.x - imgSize / 2,
          item.p.y - imgSize / 2,
          imgSize,
          imgSize
        );
        ctx!.filter = 'none';
        ctx!.restore();
      } else {
        drawCube(
          item.p.x,
          item.p.y,
          45 * item.p.scale,
          logoRotation,
          logoRotation * 0.4,
          item.p.banking,
          cfg.color,
          fadeIn
        );
      }
    });

    ctx!.globalAlpha = 1;
    rafId = requestAnimationFrame(draw);
  }

  // -- Scroll handling --
  let lastOpacity = 1;

  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    onLeave: () => {
      isVisible = false;
      canvas!.style.opacity = '0';
    },
    onEnterBack: () => {
      isVisible = true;
      canvas!.style.opacity = '1';
    },
  });

  let ticking = false;
  scrollHandler = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const rect = canvas!.getBoundingClientRect();
      const ratio = Math.max(0, rect.bottom) / rect.height;
      if (ratio < 0.15) {
        isVisible = false;
        if (lastOpacity !== 0) {
          canvas!.style.opacity = '0';
          lastOpacity = 0;
        }
      } else {
        isVisible = true;
        const op = Math.min(1, ratio);
        if (Math.abs(op - lastOpacity) > 0.05) {
          canvas!.style.opacity = String(op);
          lastOpacity = op;
        }
      }
      ticking = false;
    });
  };
  window.addEventListener('scroll', scrollHandler, { passive: true });

  // Start the draw loop
  rafId = requestAnimationFrame(draw);
}

export function cleanupHero3D(): void {
  // Cancel RAF loop
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Clear resize timer
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }

  // Remove event listeners
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }

  // Remove the star-field canvas from the DOM
  if (starEl && starEl.parentNode) {
    starEl.parentNode.removeChild(starEl);
    starEl = null;
  }

  // Kill all ScrollTrigger instances
  ScrollTrigger.getAll().forEach((st) => st.kill());
}
