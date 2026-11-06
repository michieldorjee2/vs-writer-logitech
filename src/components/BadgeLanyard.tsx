import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { CompanyRef } from '../lib/badge-card';
import { measure, toGray, WATCH_START, watchStep, type Gray, type Watch } from '../lib/badge-detect';
import { prepareDeviceReader } from '../lib/badge-read-device';
import { useNativeCamera } from '../lib/badge-scan';
import type { Suggestion } from '../lib/badge-suggest';
import { readAutoDetect, writeAutoDetect } from '../lib/scan-prefs';
import { asleep, clip, hold, makeLanyard, rehang, step, STEP, strapPath, wake, type Lanyard } from '../lib/lanyard-physics';
import type { useBadgeCard } from '../hooks/useBadgeCard';
import BadgeIcon from './BadgeIcon';
import OptimizelyWordmark from './OptimizelyWordmark';
import '../styles/badge-lanyard.css';

/*
 * The badge scanner. A badge drops down on a lanyard asking the rep to hold up
 * a badge, in front of the camera's picture, blurred and turned dark green, so
 * it is plain the camera is on and watching. When it sees a badge held up, the
 * badge flashes green and fills in with who it is and where they work; "Open
 * page" opens the page found, a line is fixed on the badge itself, and a person
 * with no page yet can be sent to Mark. "Type manually" fills one in by hand. The
 * badge can be grabbed, dragged and flung (src/lib/lanyard-physics.ts).
 *
 * Inspired by Vercel's 3D event badge, made here of the page's own elements,
 * so its lines are real text the rep can select and fix, and nothing heavy
 * loads: the strap carries our name, the badge our colours.
 */

type Flow = ReturnType<typeof useBadgeCard> & {
  send: () => Promise<boolean>;
  sendError: string | null;
};
type Found = { route: string; name: string } | null;
type Field = 'name' | 'title' | 'company';

type Camera = 'off' | 'starting' | 'live' | 'blocked' | 'none';

const LINKS = 6;
/** How often the hidden camera is looked at, and how wide the grey copy it is judged on is (badge-detect.ts). */
const LOOK_MS = 150;
const LOOK_WIDTH = 96;
/** With no frame on screen, a badge is looked for in the middle of the picture, and photographed with a margin. */
const WATCH_AREA = { x: 0.22, y: 0.08, width: 0.56, height: 0.84 };
const PHOTO_AREA = { x: 0.14, y: 0.02, width: 0.72, height: 0.96 };
const FLASH_MS = 450;
/** Closing: the strap is pulled up and the badge goes with it, off the top of the screen, in this long. */
const LEAVE_MS = 560;
/** How far above the card the clip's ring sits: the strap hangs from the ring, the clip's tongue goes into the card's slot. */
const CLIP_RISE = 30;
const STRAP_WORDS = Array.from({ length: 24 }, () => 'OPTIMIZELY').join('   ·   ');

/* Shorter than this (a phone on its side), the window's buttons move to its corner (badge-lanyard.css) and the badge takes the height. */
const SHORT = 560;

/** The badge's size for this window: a lanyard badge's upright shape, smaller on a phone, and never taller than the window leaves room for. */
function badgeSize(width: number, height: number) {
  const room = height < SHORT ? height - 90 : height - 170;
  const w = Math.round(Math.max(170, Math.min(300, width * 0.76, room / 1.45)));
  return { w, h: Math.round(w * 1.45) };
}

/** Where the strap hangs from (above the screen, in the middle) and how long it is: the badge's middle a little above the screen's, clear of the buttons below. */
function hang(width: number, height: number, badgeH: number) {
  const anchor = { x: width / 2, y: -24 };
  const below = height < SHORT ? 42 : 120;
  const clipY = Math.max(Math.min(110, height * 0.12), Math.min(height * 0.5 - badgeH / 2 - 10, height - badgeH - below));
  return { anchor, length: clipY - anchor.y };
}

/*
 * The camera's picture behind the badge: drawn small, a few times a second, in
 * our dark greens by how bright each pixel is (a gradient map), then blurred and
 * scaled up by the page. Done on a canvas, not an SVG filter, so it looks the
 * same on every phone.
 */
const FEED_WIDTH = 160;
const FEED_MS = 66;
/* Black, the middle grey and white, as #030d09, our #0d3a29 and a muted #2f6b45. */
const FEED_STOPS: Array<[number, number, number]> = [
  [3, 13, 9],
  [13, 58, 41],
  [47, 107, 69],
];
const FEED_MAP = (() => {
  const map = new Uint8ClampedArray(256 * 3);
  for (let v = 0; v < 256; v++) {
    const t = v / 255;
    const [a, b, k] = t < 0.5 ? [FEED_STOPS[0], FEED_STOPS[1], t * 2] : [FEED_STOPS[1], FEED_STOPS[2], (t - 0.5) * 2];
    for (let c = 0; c < 3; c++) map[v * 3 + c] = a[c] + (b[c] - a[c]) * k;
  }
  return map;
})();

export default function BadgeLanyard({
  flow,
  submitting,
  findPerson,
  logoFor,
  suggest,
  onOpenPage,
  onAddCompany,
  onClose,
}: {
  flow: Flow;
  submitting: boolean;
  /** A person page in the index, by name, under the company with this route (null: any company). */
  findPerson: (name: string, companyRoute: string | null) => Found;
  /** The logo the index has for the company page at this route. */
  logoFor: (route: string) => string | null;
  /** The people or companies in the index whose name matches what is typed on the badge. */
  suggest: (kind: 'person' | 'company', typed: string) => Suggestion[];
  /** "+ Company": the search bar's own Add company, started for this company (a name or a domain). */
  onAddCompany: (text: string) => void;
  onOpenPage: (route: string) => void;
  onClose: () => void;
}) {
  const strapId = useId().replace(/:/g, '');
  const dialog = useRef<HTMLDialogElement | null>(null);
  const badge = useRef<HTMLDivElement | null>(null);
  const strap = useRef<SVGPathElement | null>(null);
  const shadow = useRef<HTMLDivElement | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const native = useNativeCamera();
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const feed = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? badgeSize(1200, 900) : badgeSize(window.innerWidth, window.innerHeight)));
  const [camera, setCamera] = useState<Camera>('off');
  const [flash, setFlash] = useState(false);
  /* The picture behind the badge is mirrored for a camera facing the rep (a laptop's), as a mirror would be. */
  const [mirrored, setMirrored] = useState(true);
  /* "Detect badges automatically": on, a badge held up is taken by itself; off, only when Scan is pressed. */
  const [auto, setAuto] = useState(readAutoDetect);
  const toggleAuto = () => {
    setAuto((on) => {
      writeAutoDetect(!on);
      return !on;
    });
  };
  /* The camera watches while the badge waits for one, and again after one couldn't be read. */
  const looking = !flow.active || flow.phase === 'failed';

  /* ---------- The lanyard ---------- */

  const lanyard = useRef<Lanyard | null>(null);
  const frame = useRef<number | null>(null);
  const draw = useCallback(() => {
    const l = lanyard.current;
    if (!l) return;
    const c = clip(l);
    const el = badge.current;
    const yaw = (l.spin * Math.PI) / 180;
    if (el) {
      el.style.transform = `translate3d(${c.x}px, ${c.y + CLIP_RISE}px, 0) rotate(${l.tilt}rad) rotateY(${l.spin}deg)`;
      // The light its coat reflects: one soft sheen from up and to the left, kept at its angle on screen as
      // the badge tilts, sliding across as it turns or swings; seen edge-on it catches more light.
      const swing = c.x - l.points[0].x;
      el.style.setProperty('--light-x', `${((Math.sin(2 * yaw) * 0.9 + swing / 300) * 45).toFixed(1)}%`);
      el.style.setProperty('--light-angle', `${(115 - (l.tilt * 180) / Math.PI).toFixed(1)}deg`);
      el.style.setProperty('--edge-light', Math.abs(Math.sin(yaw)).toFixed(3));
    }
    // Its shadow, from a light up and to the left: it follows the badge and tilts with it, never turns with
    // it, and narrows as the badge turns edge-on.
    const sh = shadow.current;
    if (sh) sh.style.transform = `translate3d(${c.x + 16}px, ${c.y + CLIP_RISE + 26}px, 0) rotate(${l.tilt}rad) scaleX(${Math.max(0.06, Math.abs(Math.cos(yaw))).toFixed(3)})`;
    strap.current?.setAttribute('d', strapPath(l.points));
  }, []);

  const run = useCallback(() => {
    if (frame.current !== null) return;
    let last = performance.now();
    let spare = 0;
    const tick = (now: number) => {
      const l = lanyard.current;
      if (!l) {
        frame.current = null;
        return;
      }
      spare = Math.min(spare + (now - last) / 1000, 0.1);
      last = now;
      while (spare >= STEP) {
        step(l);
        spare -= STEP;
      }
      draw();
      // Asleep: nothing is drawn until it is touched, resized or filled in again.
      frame.current = asleep(l) ? null : requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw]);

  useLayoutEffect(() => {
    const { anchor, length } = hang(window.innerWidth, window.innerHeight, size.h);
    lanyard.current = makeLanyard(anchor, length, LINKS, !reduced.current);
    draw();
    if (!reduced.current) run();
    const onResize = () => {
      const next = badgeSize(window.innerWidth, window.innerHeight);
      setSize((s) => (s.w === next.w ? s : next));
      const l = lanyard.current;
      if (!l) return;
      const h = hang(window.innerWidth, window.innerHeight, next.h);
      rehang(l, h.anchor, h.length);
      if (reduced.current) {
        lanyard.current = makeLanyard(h.anchor, h.length, LINKS, false);
        draw();
      } else run();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      lanyard.current = null;
    };
    // The badge's size only sets where it first hangs; a resize rehangs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, run]);

  /** A little hop (pixels a step, at 120 steps a second): the badge was filled in, or flashed. */
  const bump = useCallback(
    (up: number, side: number) => {
      const l = lanyard.current;
      if (!l || reduced.current) return;
      const last = l.points.length - 1;
      l.prev[last] = { x: l.points[last].x - side, y: l.points[last].y + up };
      wake(l);
      run();
    },
    [run],
  );
  const filled = !!flow.card;
  useEffect(() => {
    if (filled) bump(2.5, 0.6);
  }, [filled, bump]);

  /* Grab and fling: the badge goes where it is held, and keeps the speed it was let go at. */
  const grab = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const l = lanyard.current;
    if (!l || reduced.current || (e.target as HTMLElement).closest('button, input, a, label')) return;
    const c = clip(l);
    grab.current = {
      id: e.pointerId,
      dx: e.clientX - c.x,
      dy: e.clientY - c.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    hold(l, c);
    run();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const l = lanyard.current;
    if (!l || grab.current?.id !== e.pointerId) return;
    hold(l, { x: e.clientX - grab.current.dx, y: e.clientY - grab.current.dy });
    run();
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const l = lanyard.current;
    if (!l || grab.current?.id !== e.pointerId) return;
    grab.current = null;
    hold(l, null);
    run();
  };

  /* ---------- The dialog ---------- */

  useEffect(() => {
    dialog.current?.showModal();
    // The window itself has the focus, not its first button: nothing is singled out as it opens.
    dialog.current?.focus();
    // The reader loads while the badge drops, so a badge held up is read at once.
    prepareDeviceReader();
  }, []);

  /* ---------- The camera, out of sight ---------- */

  const taking = useRef(false);
  const takePhoto = useCallback(() => {
    const el = video.current;
    if (!el || !el.videoWidth || taking.current) return;
    taking.current = true;
    const vw = el.videoWidth;
    const vh = el.videoHeight;
    const area = {
      x: Math.round(vw * PHOTO_AREA.x),
      y: Math.round(vh * PHOTO_AREA.y),
      width: Math.round(vw * PHOTO_AREA.width),
      height: Math.round(vh * PHOTO_AREA.height),
    };
    const canvas = document.createElement('canvas');
    canvas.width = area.width;
    canvas.height = area.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      taking.current = false;
      return;
    }
    ctx.drawImage(el, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
    setFlash(true);
    bump(3.5, 0);
    window.setTimeout(() => setFlash(false), FLASH_MS);
    canvas.toBlob(
      (blob) => {
        taking.current = false;
        if (blob) void flow.scan(new File([blob], 'badge.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92,
    );
  }, [flow, bump]);

  // The camera runs only while the badge waits for one: not while it is read, nor once it is filled in.
  useEffect(() => {
    if (!looking || native) return;
    const el = video.current;
    let stream: MediaStream | null = null;
    let closed = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the camera's status follows the effect that starts the camera
    setCamera('starting');
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then(async (s) => {
        if (closed) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        setMirrored(s.getVideoTracks()[0]?.getSettings().facingMode !== 'environment');
        if (!el) return;
        el.srcObject = s;
        await el.play().catch(() => undefined);
        if (!closed) setCamera('live');
      })
      .catch((err: unknown) => {
        if (closed) return;
        const name = err instanceof DOMException ? err.name : '';
        setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'none');
      });
    return () => {
      closed = true;
      stream?.getTracks().forEach((t) => t.stop());
      if (el) el.srcObject = null;
      setCamera('off');
    };
  }, [looking, native]);

  // A few looks a second at the middle of the picture; a badge lifted into it and held still is taken.
  // Not with automatic detection off: then only Scan takes it.
  useEffect(() => {
    if (camera !== 'live' || !looking || !auto) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    let watch: Watch = WATCH_START;
    let prev: Gray | null = null;
    const id = window.setInterval(() => {
      const el = video.current;
      if (!el || !el.videoWidth || document.hidden || taking.current) return;
      const vw = el.videoWidth;
      const vh = el.videoHeight;
      const w = LOOK_WIDTH;
      const h = Math.max(1, Math.round((w * vh * WATCH_AREA.height) / (vw * WATCH_AREA.width)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        prev = null;
      }
      ctx.drawImage(el, vw * WATCH_AREA.x, vh * WATCH_AREA.y, vw * WATCH_AREA.width, vh * WATCH_AREA.height, 0, 0, w, h);
      const gray = toGray(ctx.getImageData(0, 0, w, h).data, w, h);
      const result = watchStep(watch, measure(gray, prev));
      watch = result.watch;
      prev = gray;
      if (result.verdict === 'take') takePhoto();
    }, LOOK_MS);
    return () => window.clearInterval(id);
  }, [camera, looking, auto, takePhoto]);

  // The picture behind the badge, in our greens, while the camera watches.
  useEffect(() => {
    if (camera !== 'live' || !looking) return;
    const canvas = feed.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const id = window.setInterval(() => {
      const el = video.current;
      if (!el || !el.videoWidth || document.hidden) return;
      const w = FEED_WIDTH;
      const h = Math.max(1, Math.round((w * el.videoHeight) / el.videoWidth));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(el, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      const d = pixels.data;
      for (let p = 0; p < d.length; p += 4) {
        const v = ((d[p] * 77 + d[p + 1] * 150 + d[p + 2] * 29) >> 8) * 3;
        d[p] = FEED_MAP[v];
        d[p + 1] = FEED_MAP[v + 1];
        d[p + 2] = FEED_MAP[v + 2];
      }
      ctx.putImageData(pixels, 0, 0);
    }, FEED_MS);
    return () => window.clearInterval(id);
  }, [camera, looking]);

  /* ---------- What the badge says ---------- */

  const card = flow.card;
  const company: CompanyRef | null = flow.company;
  const companyRoute = company && 'route' in company ? company.route : null;
  // A person page hangs off its company's page: under the company found, or any company when the badge names none.
  // A company named without a page has no person pages, so someone of that name elsewhere is someone else.
  const namesCompany = !!card && (!!card.company || !!card.domain);
  const person = card?.name && (companyRoute || !namesCompany) ? findPerson(card.name, companyRoute) : null;
  /* The point of a scan: open the page found. Two buttons, Company and Person: dark green to open a page
     the index has, a ghost to have one made (and see it made in the search page, as any other). */
  const firstName = card?.name.split(' ')[0] ?? '';
  const companyName = company && 'route' in company ? company.name : card?.company || (company && 'website' in company ? nameOfSite(company.website) : '');
  /* Typed in by hand (not read): its title line shows even while empty, to be filled in. */
  const [typed, setTyped] = useState(false);
  /* The line being fixed on the badge, if any: one at a time, opened by selecting it or by a button that needs it. */
  const [editing, setEditing] = useState<Field | null>(null);
  const typeIn = () => {
    setTyped(true);
    setEditing('name');
    flow.blank();
  };
  const scanNew = () => {
    setTyped(false);
    setEditing(null);
    flow.stop();
  };

  /* Closing, every way it closes: the strap is pulled up out of the screen and takes the badge with it, the
     camera's picture and the buttons fade, then the scanner is gone. What closing does (open a page, hand
     the company to the search bar) happens at once, on the click: a new tab waits for no animation. */
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const leave = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    const l = lanyard.current;
    if (!l || reduced.current) return onClose();
    setLeaving(true);
    setEditing(null);
    const from = { ...l.points[0] };
    const length = l.link * (l.points.length - 1);
    const rise = window.innerHeight + length + 200;
    const started = performance.now();
    const reel = (now: number) => {
      const t = Math.min(1, (now - started) / LEAVE_MS);
      // Slow to start, then gone: a strap pulled up hard.
      const e = t * t * t;
      const current = lanyard.current;
      if (!current) return;
      rehang(current, { x: from.x, y: from.y - rise * e }, length * (1 - 0.45 * e));
      run();
      if (t < 1) requestAnimationFrame(reel);
      else onClose();
    };
    requestAnimationFrame(reel);
  }, [onClose, run]);

  const [sending, setSending] = useState(false);
  const openPage = (route: string) => {
    onOpenPage(route);
    leave();
  };
  /* "+ Company": the company's name or domain to the search bar's Add company (its account picker and all). */
  const addCompany = () => {
    const text = card?.domain || companyName;
    if (!text) return setEditing('company');
    onAddCompany(text);
    leave();
  };
  /* "+ Person": Mark builds their page (their company's first, when it has none); the search page shows it being made. */
  const addPerson = async () => {
    if (!card?.name) return setEditing('name');
    if (flow.needs === 'company') return setEditing('company');
    setSending(true);
    const sent = await flow.send();
    setSending(false);
    if (sent) leave();
  };
  /* A page picked from the suggestions: a person brings their company (and title, when the badge had none). */
  const pick = (s: Suggestion) => {
    setEditing(null);
    if (s.kind === 'company') return flow.fix('company', s.route);
    flow.fix('name', s.name);
    flow.fix('company', s.route.split('/')[0]);
    if (!card?.title && s.title) flow.fix('title', s.title);
  };

  /* Said under the camera only when there is something to say: the camera isn't on, or a badge couldn't be read. */
  const waitingWords =
    flow.phase === 'failed'
      ? `${flow.error ?? "Couldn't read that badge."} Hold it a little closer.`
      : camera === 'blocked'
        ? "The camera isn't allowed here. Allow it from the address bar, or type it manually."
        : camera === 'none' || native
          ? 'No camera to use here. Type it manually instead.'
          : camera === 'live'
            ? auto
              ? null
              : 'Hold up a badge, then press Scan.'
            : 'Starting the camera…';

  return (
    <dialog
      ref={dialog}
      className={'lanyard' + (leaving ? ' is-leaving' : '')}
      tabIndex={-1}
      aria-label="Scan a conference badge"
      onCancel={(e) => {
        e.preventDefault();
        leave();
      }}
    >
      {/* The camera's picture, blurred and in our dark greens: the rep sees it is on, not what it sees. */}
      <div className={'lanyard__feed' + (camera === 'live' && looking ? ' is-live' : '') + (mirrored ? ' is-mirrored' : '')} aria-hidden="true">
        <canvas ref={feed} className="lanyard__feed-picture" />
        <video ref={video} className="lanyard__video" playsInline muted />
      </div>

      <svg className="lanyard__strap" aria-hidden="true">
        <defs>
          <path id={strapId} ref={strap} />
        </defs>
        <use href={`#${strapId}`} className="lanyard__strap-band" />
        {/* The band's weave catches the light down its middle: a strap, not a line. */}
        <use href={`#${strapId}`} className="lanyard__strap-sheen" />
        <text className="lanyard__strap-words" dy="3.4">
          <textPath href={`#${strapId}`} startOffset="12">
            {STRAP_WORDS}
          </textPath>
        </text>
      </svg>

      <div
        ref={shadow}
        className="lanyard__shadow"
        style={{ width: size.w, height: size.h, marginLeft: -size.w / 2, transformOrigin: `50% -${CLIP_RISE}px` }}
        aria-hidden="true"
      />

      <div
        ref={badge}
        className={'lanyard__badge' + (flash ? ' is-flash' : '') + (card ? ' is-filled' : '')}
        style={{
          width: size.w,
          height: size.h,
          marginLeft: -size.w / 2,
          transformOrigin: `50% -${CLIP_RISE}px`,
          ['--badge-w' as string]: `${size.w}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >

        <div className="lanyard__card">
          {/* Its thickness: four edges between the faces, seen as it turns. */}
          <span className="lanyard__edge lanyard__edge--left" aria-hidden="true" />
          <span className="lanyard__edge lanyard__edge--right" aria-hidden="true" />
          <span className="lanyard__edge lanyard__edge--top" aria-hidden="true" />
          <span className="lanyard__edge lanyard__edge--bottom" aria-hidden="true" />
          <div className="lanyard__face lanyard__face--front">
            <div className="lanyard__top">
              <span className="lanyard__slot" aria-hidden="true" />
              <OptimizelyWordmark className="lanyard__logo" />
            </div>

            <div className="lanyard__body" aria-live="polite">
              {card ? (
                <CardLines
                  flow={flow}
                  companyName={companyName}
                  typed={typed}
                  logo={companyRoute ? logoFor(companyRoute) : null}
                  editing={editing}
                  setEditing={setEditing}
                  suggest={suggest}
                  onPick={pick}
                />
              ) : flow.phase === 'reading' ? (
                <div className="lanyard__reading">
                  <span className="lanyard__bar lanyard__bar--name" />
                  <span className="lanyard__bar lanyard__bar--title" />
                  <span className="lanyard__bar lanyard__bar--company" />
                  <p className="lanyard__words">{flow.reader === 'mark' ? 'Mark is reading the badge…' : 'Reading the badge…'}</p>
                </div>
              ) : (
                <div className="lanyard__waiting">
                  <svg className={'lanyard__cam' + (camera === 'live' ? ' is-live' : '')} viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M8 16.5A3.5 3.5 0 0 1 11.5 13h4.4l2.6-4h11l2.6 4h4.4a3.5 3.5 0 0 1 3.5 3.5v19a3.5 3.5 0 0 1-3.5 3.5h-25A3.5 3.5 0 0 1 8 35.5z" />
                    <circle cx="24" cy="25.5" r="7" />
                  </svg>
                  {waitingWords && <p className={'lanyard__words' + (flow.phase === 'failed' ? ' is-error' : '')}>{waitingWords}</p>}
                </div>
              )}
            </div>

            <div className="lanyard__ribbon">
              {card ? (
                <div className="lanyard__pair">
                  <PageButton
                    label="Company"
                    found={!!companyRoute}
                    title={companyRoute ? `Open ${companyName}’s page` : companyName ? `Have Mark make ${companyName}’s page` : 'Add their company'}
                    disabled={sending || submitting}
                    onClick={() => (companyRoute ? openPage(companyRoute) : addCompany())}
                  />
                  <PageButton
                    label={sending ? 'Sending…' : 'Person'}
                    found={!!person}
                    title={person ? `Open ${person.name}’s page` : card.name ? `Have Mark make ${firstName}’s page` : 'Add their name'}
                    disabled={sending || submitting}
                    onClick={() => (person ? openPage(person.route) : void addPerson())}
                  />
                </div>
              ) : flow.phase === 'reading' || auto ? (
                <span className="lanyard__role">{flow.phase === 'reading' ? 'Reading…' : 'Hold up your badge'}</span>
              ) : (
                // Automatic detection off: the photo is taken only here.
                <button type="button" className="lanyard__scan" onClick={takePhoto} disabled={camera !== 'live'}>
                  Scan
                </button>
              )}
            </div>
            <Gloss />
          </div>
          <div className="lanyard__face lanyard__face--back" aria-hidden="true">
            <OptimizelyWordmark className="lanyard__back-logo" />
            <Gloss />
          </div>
        </div>

        {/* The clip, drawn after the card so it is always over it: its ring on the strap, its tongue down into the card's slot. */}
        <svg className="lanyard__clip" width="34" height="52" viewBox="0 0 34 52" aria-hidden="true">
          <defs>
            <linearGradient id={`${strapId}-metal`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#8a938a" />
              <stop offset="0.38" stopColor="#f1f4ef" />
              <stop offset="0.62" stopColor="#c3cac2" />
              <stop offset="1" stopColor="#868f86" />
            </linearGradient>
            <linearGradient id={`${strapId}-into`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#7d867d" />
              <stop offset="1" stopColor="#2b322d" />
            </linearGradient>
          </defs>
          <rect x="10" y="1.5" width="14" height="11" rx="5.5" fill="none" stroke={`url(#${strapId}-metal)`} strokeWidth="3" />
          <rect x="2" y="9" width="30" height="20" rx="5" fill={`url(#${strapId}-metal)`} />
          {/* The tongue goes into the slot (16–26px down the card): solid metal, darker as it enters the hole. */}
          <rect x="9" y="25" width="16" height="26" rx="3" fill={`url(#${strapId}-metal)`} />
          <rect x="9" y="45" width="16" height="6" rx="1.5" fill={`url(#${strapId}-into)`} />
        </svg>
      </div>

      {/* The window's own buttons, under the badge: quieter than anything on it. */}
      <div className="lanyard__foot">
        {card && flow.sendError && (
          <p className="lanyard__note is-error" role="status">
            {flow.sendError}
          </p>
        )}
        {card ? (
          <button type="button" className="lanyard__type" onClick={scanNew} disabled={sending}>
            <BadgeIcon size={16} />
            Scan new badge
          </button>
        ) : (
          flow.phase !== 'reading' && (
            <button type="button" className="lanyard__type" onClick={typeIn}>
              Type manually
            </button>
          )
        )}
      </div>

      <button type="button" className="lanyard__auto" role="switch" aria-checked={auto} onClick={toggleAuto}>
        <span className="lanyard__switch" aria-hidden="true" />
        Detect badges automatically
      </button>

      <button type="button" className="lanyard__close" aria-label="Close" onClick={leave}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M4 4l10 10M14 4 4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </dialog>
  );
}

/**
 * The light the badge's glossy coat reflects (as Vercel's badge reflects its scene's lights): one soft
 * sheen across the whole face, so nothing of it is ever cut off. BadgeLanyard sets its angle on screen
 * (--light-angle), where it falls (--light-x) and how much more a badge seen edge-on catches (--edge-light).
 */
function Gloss() {
  return <span className="lanyard__gloss" aria-hidden="true" />;
}

/** One of the badge's two buttons: dark green to open the page found, a ghost (+) to have it made. */
function PageButton({ label, found, title, disabled, onClick }: { label: string; found: boolean; title: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'lanyard__page' + (found ? ' is-found' : '')} title={title} aria-label={title} disabled={disabled} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {found ? (
          <path d="M4.5 9.5l5-5M5 4.5h4.5V9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M7 2.5v9M2.5 7h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      {label}
    </button>
  );
}

/**
 * The badge filled in: the name, the title when one was read (or the badge is
 * typed in), and the company's name, with its logo when it has a page. Each
 * line is fixed on the badge by selecting it; the name and the company suggest
 * the index's people and companies as they are typed.
 */
function CardLines({
  flow,
  companyName,
  typed,
  logo,
  editing,
  setEditing,
  suggest,
  onPick,
}: {
  flow: Flow;
  companyName: string;
  typed: boolean;
  logo: string | null;
  editing: Field | null;
  setEditing: (field: Field | null) => void;
  suggest: (kind: 'person' | 'company', typed: string) => Suggestion[];
  onPick: (s: Suggestion) => void;
}) {
  const card = flow.card;
  const [logoFailed, setLogoFailed] = useState(false);
  if (!card) return null;
  const line = (field: Field) => ({
    editing: editing === field,
    onEdit: () => setEditing(field),
    onDone: () => setEditing(null),
    onCommit: (text: string) => flow.fix(field, text),
  });
  return (
    <div className="lanyard__lines">
      <Line
        className="lanyard__name"
        value={card.name}
        empty="Add their name"
        label="Name"
        missing={flow.needs === 'person'}
        suggestions={(text) => suggest('person', text)}
        onPick={onPick}
        {...line('name')}
      />
      {(card.title || typed) && <Line className="lanyard__title" value={card.title} empty="Add their title" label="Title" {...line('title')} />}
      <div className="lanyard__company">
        <Line
          lead={logo && !logoFailed ? <img className="lanyard__company-logo" src={logo} alt="" onError={() => setLogoFailed(true)} /> : null}
          className="lanyard__company-name"
          value={companyName}
          empty="Add their company"
          label="Company, or its domain"
          missing={flow.needs === 'company'}
          suggestions={(text) => suggest('company', text)}
          onPick={onPick}
          {...line('company')}
        />
      </div>
      {flow.error &&
        (/^No page for /.test(flow.error) ? (
          // A company with no page isn't a mistake: "+ Company" has one made. Said quietly.
          <p className="lanyard__hint">No page for {companyName} yet.</p>
        ) : (
          <p className="lanyard__error" role="alert">
            {flow.error}
          </p>
        ))}
    </div>
  );
}

/** "acme-robotics.com" → "Acme Robotics": a company known only by its website, named without showing the address. */
function nameOfSite(site: string): string {
  const label = site.split('.')[0] ?? '';
  return label
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * One line on the badge: its text, or a field to fix it in once selected, with
 * the index's matches under it as it is typed. Enter (or leaving the field)
 * keeps what was typed, or the match chosen with the arrow keys; a match is
 * also picked by selecting it; Escape leaves the line as it was.
 */
function Line({
  value,
  empty,
  label,
  className,
  missing = false,
  editing,
  onEdit,
  onDone,
  onCommit,
  suggestions,
  onPick,
  lead,
}: {
  value: string;
  empty: string;
  label: string;
  className: string;
  missing?: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onCommit: (text: string) => void;
  suggestions?: (typed: string) => Suggestion[];
  onPick?: (s: Suggestion) => void;
  /** Drawn at the start of the line, and part of what is selected (the company's logo). */
  lead?: ReactNode;
}) {
  if (editing)
    return <LineField value={value} label={label} className={className} onDone={onDone} onCommit={onCommit} suggestions={suggestions} onPick={onPick} />;
  return (
    <button
      type="button"
      className={`lanyard__line ${className}` + (value ? '' : ' is-empty') + (missing ? ' is-missing' : '')}
      aria-label={`Edit the ${noun(label)}: ${value || 'not filled in'}`}
      onClick={onEdit}
    >
      {lead}
      <span className="lanyard__line-text">{value || empty}</span>
      <svg className="lanyard__pencil" width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M9.5 2.5l2 2L5 11l-2.6.6L3 9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {/* What this line is, shown on hover: so a rep knows what they are about to change. */}
      <span className="lanyard__tip" aria-hidden="true">
        Edit {noun(label)}
      </span>
    </button>
  );
}

/** "Company, or its domain" → "company": a line's label as the thing being edited. */
function noun(label: string): string {
  return label.split(',')[0].toLowerCase();
}

/** A line being fixed: its field, starting from the line's text each time it opens, and the matches under it. */
function LineField({
  value,
  label,
  className,
  onDone,
  onCommit,
  suggestions,
  onPick,
}: {
  value: string;
  label: string;
  className: string;
  onDone: () => void;
  onCommit: (text: string) => void;
  suggestions?: (typed: string) => Suggestion[];
  onPick?: (s: Suggestion) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [active, setActive] = useState(-1);
  // Matches only once something is typed: opening a line shows the line, not a list.
  const matches = suggestions && draft.trim() !== value.trim() ? suggestions(draft) : [];
  const done = (keep: boolean) => {
    onDone();
    if (keep && draft.trim() !== value.trim()) onCommit(draft);
  };
  const choose = (s: Suggestion) => {
    onDone();
    onPick?.(s);
  };
  return (
    <span className="lanyard__edit">
      {/* Which line is being fixed, for as long as it is. */}
      <span className="lanyard__tip is-on" aria-hidden="true">
        {label}
      </span>
      <input
        className={`lanyard__field ${className}`}
        aria-label={label}
        placeholder={label}
        value={draft}
        role={suggestions ? 'combobox' : undefined}
        aria-expanded={suggestions ? matches.length > 0 : undefined}
        aria-autocomplete={suggestions ? 'list' : undefined}
        // Not a form to fill in: no browser or password manager suggestions over the badge.
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore=""
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(-1);
        }}
        onBlur={() => done(true)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'ArrowDown' && matches.length) {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp' && matches.length) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active >= 0 && matches[active]) choose(matches[active]);
            else done(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            done(false);
          }
        }}
      />
      {matches.length > 0 && (
        <span className="lanyard__suggest" role="listbox" aria-label={`${label}: pages found`}>
          {matches.map((s, i) => (
            <button
              key={`${s.kind}:${s.route}`}
              type="button"
              role="option"
              aria-selected={i === active}
              className={'lanyard__match' + (i === active ? ' is-active' : '')}
              // Keeps the field focused: a pick is not a blur that keeps the half-typed text.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
            >
              {s.logo ? <img src={s.logo} alt="" /> : <span className="lanyard__match-blank" aria-hidden="true" />}
              <span className="lanyard__match-text">
                <span className="lanyard__match-name">{s.name}</span>
                {s.meta && <span className="lanyard__match-meta">{s.meta}</span>}
              </span>
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
