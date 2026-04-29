import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import {
  ABM_XRAY_DEFAULTS,
  DYNAMIC_XRAY_DEFAULTS,
  resolveXraySections,
  type XraySectionInfo,
} from '../lib/xray-defaults';
import { XrayToolIcon } from '../lib/xray-tool-icons';

interface Props {
  active: boolean;
  onClose: () => void;
  page: CompetitorComparisonPage;
  variant: 'abm' | 'dynamic';
}

type CardSide = 'above' | 'below' | 'left' | 'right';

/**
 * Initial snapshot used to render the React tree (one outline + one card
 * per section). After mount, the rAF loop re-measures live and writes
 * positions directly to the DOM via refs, so layout shifts (lazy images,
 * GSAP scroll-trigger animations, anything that nudges page content)
 * stay in sync without React re-renders.
 */
type AnchorInit = {
  section: XraySectionInfo;
  sectionNumber: number;
  cardSide: CardSide;
  // initial geometry — overwritten every frame via refs
  left: number;
  top: number;
  width: number;
  height: number;
  cardLeft: number;
  cardTop: number;
};

type DocSize = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };
type OutlineBox = { left: number; top: number; width: number; height: number };

const SCAN_DURATION_MS = 1600;
/** Visual breathing room added around each component's bounding box. */
const OUTLINE_PADDING = 14;
/** Gap between the card and the component it points at. */
const CARD_GAP = 36;
/** Visual width of an annotation card (matches CSS — keep in sync). */
const CARD_WIDTH = 300;
/** Approximate collapsed card height — used for placement maths. */
const CARD_HEIGHT_COLLAPSED = 76;
/** Document-edge safety margin so cards don't bleed off the viewport. */
const DOC_MARGIN = 16;
/** Length the bob wave covers in seconds. */
const BOB_PERIOD_S = 7;
/** Peak ± displacement of the bob in pixels. */
const BOB_AMPLITUDE = 4;
/** Smoothing factor for hover-pause: how fast the bob value lerps toward 0. */
const HOVER_LERP = 0.06;

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/**
 * Pick the best card placement by trying candidates in priority order
 * and returning the first one that doesn't overlap any other component
 * outline. Falls back to above-right with overlap.
 */
function placeCard(
  outline: OutlineBox,
  others: OutlineBox[],
  doc: DocSize,
): { cardLeft: number; cardTop: number; cardSide: CardSide } {
  const cw = CARD_WIDTH;
  const ch = CARD_HEIGHT_COLLAPSED;
  const m = DOC_MARGIN;

  const rightAlignedX = Math.max(m, Math.min(doc.w - cw - m, outline.left + outline.width - cw));
  const leftAlignedX = Math.max(m, Math.min(doc.w - cw - m, outline.left));

  type Cand = { side: CardSide; x: number; y: number };
  const candidates: Cand[] = [
    { side: 'right', x: outline.left + outline.width + 16, y: outline.top + Math.max(0, (outline.height - ch) / 2) },
    { side: 'left',  x: outline.left - cw - 16,             y: outline.top + Math.max(0, (outline.height - ch) / 2) },
    { side: 'above', x: rightAlignedX,                       y: outline.top - ch - CARD_GAP },
    { side: 'above', x: leftAlignedX,                        y: outline.top - ch - CARD_GAP },
    { side: 'below', x: rightAlignedX,                       y: outline.top + outline.height + CARD_GAP },
    { side: 'below', x: leftAlignedX,                        y: outline.top + outline.height + CARD_GAP },
  ];

  for (const c of candidates) {
    if (c.x < m || c.x + cw > doc.w - m) continue;
    if (c.y < m) continue;
    if (c.y + ch > doc.h - m) continue;
    const cardRect: Rect = { x: c.x, y: c.y, w: cw, h: ch };
    let collides = false;
    for (const o of others) {
      if (rectsOverlap(cardRect, { x: o.left, y: o.top, w: o.width, h: o.height })) {
        collides = true;
        break;
      }
    }
    if (!collides) return { cardLeft: c.x, cardTop: c.y, cardSide: c.side };
  }

  return {
    cardLeft: rightAlignedX,
    cardTop: Math.max(m, outline.top - ch - CARD_GAP),
    cardSide: 'above',
  };
}

/** Position the card relative to a given outline + cached side decision.
 *  `cardH` is the live measured card height — passing it in keeps the
 *  visual gap to the outline a constant CARD_GAP regardless of whether
 *  the card is collapsed or expanded. */
function placeCardForSide(
  outline: OutlineBox,
  side: CardSide,
  doc: DocSize,
  cardH: number,
): { cardLeft: number; cardTop: number } {
  const cw = CARD_WIDTH;
  const m = DOC_MARGIN;

  if (side === 'right') {
    return { cardLeft: outline.left + outline.width + 16, cardTop: outline.top + Math.max(0, (outline.height - cardH) / 2) };
  }
  if (side === 'left') {
    return { cardLeft: Math.max(m, outline.left - cw - 16), cardTop: outline.top + Math.max(0, (outline.height - cardH) / 2) };
  }
  // above / below: right-align (with safety clamp) to keep connector short
  let cardLeft = outline.left + outline.width - cw;
  if (cardLeft < m) cardLeft = m;
  if (cardLeft + cw > doc.w - m) cardLeft = doc.w - cw - m;
  const cardTop = side === 'above'
    ? Math.max(m, outline.top - cardH - CARD_GAP)
    : Math.min(doc.h - cardH - m, outline.top + outline.height + CARD_GAP);
  return { cardLeft, cardTop };
}

function getDocSize(): DocSize {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  const doc = document.documentElement;
  return {
    w: Math.max(doc.scrollWidth, doc.clientWidth),
    h: Math.max(doc.scrollHeight, doc.clientHeight),
  };
}

function buildOutlineFromElements(els: Element[]): OutlineBox | null {
  let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  for (const el of els) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    minLeft = Math.min(minLeft, r.left);
    minTop = Math.min(minTop, r.top);
    maxRight = Math.max(maxRight, r.right);
    maxBottom = Math.max(maxBottom, r.bottom);
  }
  if (minLeft === Infinity) return null;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  return {
    left: minLeft + scrollX - OUTLINE_PADDING,
    top: minTop + scrollY - OUTLINE_PADDING,
    width: maxRight - minLeft + 2 * OUTLINE_PADDING,
    height: maxBottom - minTop + 2 * OUTLINE_PADDING,
  };
}

/** Path data for the four corner brackets framing a rectangle. */
function buildCornerPath(o: OutlineBox, corner: 'tl' | 'tr' | 'br' | 'bl'): string {
  const inset = 0;
  const len = 14;
  const x1 = o.left + inset;
  const y1 = o.top + inset;
  const x2 = o.left + o.width - inset;
  const y2 = o.top + o.height - inset;
  switch (corner) {
    case 'tl': return `M${x1},${y1 + len} L${x1},${y1} L${x1 + len},${y1}`;
    case 'tr': return `M${x2 - len},${y1} L${x2},${y1} L${x2},${y1 + len}`;
    case 'br': return `M${x2},${y2 - len} L${x2},${y2} L${x2 - len},${y2}`;
    case 'bl': return `M${x1 + len},${y2} L${x1},${y2} L${x1},${y2 - len}`;
  }
}

/**
 * Loose hanging string from the card's outer edge to the matching CORNER
 * of the (padded) outline. The endpoints are anchored exactly at the
 * outline corners so the line never floats in mid-air. Cubic bezier with
 * two downward control points gives a chain-style sag that scales with
 * the horizontal span of the connection.
 *
 * `cardLag` shifts only the card-side endpoint — the page-side endpoint
 * stays glued to its corner — which is what makes the string look like
 * it stretches/relaxes as the card drags with scroll or bobs.
 */
function buildConnectorPath(
  outline: OutlineBox,
  cardLeft: number,
  cardTop: number,
  cardH: number,
  side: CardSide,
  cardLag: number,
): string {
  const cw = CARD_WIDTH;

  let sx: number, sy: number, ex: number, ey: number;

  if (side === 'above') {
    // card sits above-right; string from card bottom-right area to outline top-right corner
    sx = cardLeft + cw - 22;
    sy = cardTop + cardH + cardLag;
    ex = outline.left + outline.width;
    ey = outline.top;
  } else if (side === 'below') {
    sx = cardLeft + cw - 22;
    sy = cardTop + cardLag;
    ex = outline.left + outline.width;
    ey = outline.top + outline.height;
  } else if (side === 'left') {
    sx = cardLeft + cw;
    sy = cardTop + cardH / 2 + cardLag;
    ex = outline.left;
    ey = outline.top + Math.min(outline.height / 2, 60);
  } else {
    // right: card to the right of the outline
    sx = cardLeft;
    sy = cardTop + cardH / 2 + cardLag;
    ex = outline.left + outline.width;
    ey = outline.top + Math.min(outline.height / 2, 60);
  }

  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.hypot(dx, dy);
  const sag = Math.max(28, dist * 0.5);

  const cx1 = sx + dx * 0.28;
  const cy1 = sy + sag;
  const cx2 = sx + dx * 0.72;
  const cy2 = ey + sag * 0.6;

  return `M${sx},${sy} C${cx1},${cy1} ${cx2},${cy2} ${ex},${ey}`;
}

/** All DOM nodes belonging to one section. Filled in via callback refs. */
type AnchorDom = {
  maskRect: SVGRectElement | null;
  outlineRect: SVGRectElement | null;
  cornerPaths: (SVGPathElement | null)[]; // 4: tl, tr, br, bl
  numText: SVGTextElement | null;
  card: HTMLDivElement | null;
  wirePath: SVGPathElement | null;
  pulsePath: SVGPathElement | null;
};
const emptyDom = (): AnchorDom => ({
  maskRect: null,
  outlineRect: null,
  cornerPaths: [null, null, null, null],
  numText: null,
  card: null,
  wirePath: null,
  pulsePath: null,
});

function XrayMode({ active, onClose, page, variant }: Props) {
  const defaults = variant === 'abm' ? ABM_XRAY_DEFAULTS : DYNAMIC_XRAY_DEFAULTS;
  const sections = resolveXraySections(defaults, page.xraySections);

  const [phase, setPhase] = useState<'idle' | 'scanning' | 'revealed'>('idle');
  const [anchorsInit, setAnchorsInit] = useState<AnchorInit[]>([]);
  const [docSize, setDocSize] = useState<DocSize>(getDocSize);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const scanStartRef = useRef(0);

  // Refs the rAF loop reads + writes
  const elementsRef = useRef<Array<{ section: XraySectionInfo; els: Element[]; cardSide: CardSide; sectionNumber: number }>>([]);
  const domRefs = useRef<Map<string, AnchorDom>>(new Map());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const docSizeRef = useRef<DocSize>(docSize);
  const hoveredRef = useRef<string | null>(null);
  // Per-card current bob offset (lerps toward 0 on hover)
  const bobValuesRef = useRef<Map<string, number>>(new Map());

  /* Lifecycle: toggle activation. */
  useEffect(() => {
    if (!active) {
      setPhase('idle');
      setExpanded(null);
      setHoveredId(null);
      document.body.classList.remove('xray-active');
      return;
    }

    document.body.classList.add('xray-active');
    setPhase('scanning');
    scanStartRef.current = performance.now();

    const t = window.setTimeout(() => setPhase('revealed'), SCAN_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  useEffect(() => {
    hoveredRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    docSizeRef.current = docSize;
  }, [docSize]);

  /* On `revealed`: cache the matched DOM elements per section and compute
   * the initial anchors that drive the React render. The rAF loop will
   * re-measure these elements every frame after that. */
  useLayoutEffect(() => {
    if (phase !== 'revealed') return;

    // Cache elements
    let n = 0;
    const elements: typeof elementsRef.current = [];
    const outlines: OutlineBox[] = [];
    const initial: AnchorInit[] = [];

    for (const s of sections) {
      let nodes: NodeListOf<Element>;
      try { nodes = document.querySelectorAll(s.selector); } catch { continue; }
      if (nodes.length === 0) continue;

      const o = buildOutlineFromElements(Array.from(nodes));
      if (!o) continue;

      n++;
      elements.push({ section: s, els: Array.from(nodes), cardSide: 'above', sectionNumber: n });
      outlines.push(o);
    }

    // Compute placements (collision avoidance) using the initial outlines.
    const ds = getDocSize();
    setDocSize(ds);
    docSizeRef.current = ds;

    elements.forEach((e, i) => {
      const others = outlines.filter((_, j) => j !== i);
      const placement = placeCard(outlines[i], others, ds);
      e.cardSide = placement.cardSide;
      initial.push({
        section: e.section,
        sectionNumber: e.sectionNumber,
        cardSide: placement.cardSide,
        ...outlines[i],
        cardLeft: placement.cardLeft,
        cardTop: placement.cardTop,
      });
    });

    elementsRef.current = elements;
    setAnchorsInit(initial);

    // Re-cache on resize / layout change so newly-loaded images don't
    // throw the placement off after-the-fact. Doc size and placements
    // recompute, but the cached element list stays.
    const onResize = () => {
      const ds2 = getDocSize();
      setDocSize(ds2);
      docSizeRef.current = ds2;
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [phase, sections]);

  /* Per-frame rAF loop:
   *  1. Re-measure every cached element so outlines / cards / connectors
   *     stay glued even when GSAP / lazy-loading shifts page content
   *  2. Compute scroll-drag lag (the balloon-on-a-string effect)
   *  3. Compute per-card sinusoidal bob, lerping to zero on hover
   *  4. Write all coordinates directly to the DOM via refs (no React)
   */
  useEffect(() => {
    if (phase !== 'revealed') return;
    if (elementsRef.current.length === 0) return;

    let lastScroll = window.scrollY;
    let lag = 0;
    let raf = 0;
    let running = true;

    /* Last-frame state per anchor — lets us skip writes when nothing
     * about the outline or placement changed. The bob/lag is changing
     * every frame, so card position + connector path always update,
     * but on a stable page the rect / mask / corners / number text
     * skip ~80% of their setAttribute calls. */
    type LastState = {
      oLeft: number; oTop: number; oWidth: number; oHeight: number;
      cardLeft: number; cardTop: number; cardH: number;
      lastTotal: number;
    };
    const lastStates = new Map<string, LastState>();

    const tick = () => {
      if (!running) return;

      // 1. Scroll-drag accumulator
      const cur = window.scrollY;
      const delta = cur - lastScroll;
      lastScroll = cur;
      lag = lag * 0.86 + delta * 0.18;
      if (Math.abs(lag) < 0.05) lag = 0;

      const overlay = overlayRef.current;
      if (overlay) overlay.style.setProperty('--xray-scroll-lag', `${lag.toFixed(2)}px`);

      const t = performance.now();
      const ds = docSizeRef.current;
      const elems = elementsRef.current;

      for (let i = 0; i < elems.length; i++) {
        const ae = elems[i];
        const dom = domRefs.current.get(ae.section.id);
        if (!dom) continue;

        const o = buildOutlineFromElements(ae.els);
        if (!o) continue;

        const cardH = dom.card?.offsetHeight || CARD_HEIGHT_COLLAPSED;
        const placement = placeCardForSide(o, ae.cardSide, ds, cardH);
        const cardLeft = placement.cardLeft;
        const cardTop = placement.cardTop;

        // Bob — sin wave per card with per-card phase offset, lerped to
        // zero on hover.
        const isHovered = hoveredRef.current === ae.section.id;
        const delayMs = ((i * 0.31) % 2.5) * 1000;
        const phaseAng = ((t + delayMs) / (BOB_PERIOD_S * 1000)) * 2 * Math.PI;
        const wave = Math.sin(phaseAng);
        const targetBob = isHovered ? 0 : (ae.cardSide === 'below' ? wave * BOB_AMPLITUDE : -wave * BOB_AMPLITUDE);
        const prevBob = bobValuesRef.current.get(ae.section.id) ?? 0;
        const bobY = prevBob + (targetBob - prevBob) * HOVER_LERP;
        bobValuesRef.current.set(ae.section.id, bobY);

        const totalLag = lag + bobY;

        const last = lastStates.get(ae.section.id);
        const outlineChanged = !last
          || last.oLeft !== o.left || last.oTop !== o.top
          || last.oWidth !== o.width || last.oHeight !== o.height;
        const placementChanged = !last
          || last.cardLeft !== cardLeft || last.cardTop !== cardTop || last.cardH !== cardH;
        const lagChanged = !last || last.lastTotal !== totalLag;

        // Outline writes — only when geometry actually shifted (page is
        // stable most of the time; this skips ~70% of setAttribute calls).
        if (outlineChanged) {
          if (dom.outlineRect) {
            dom.outlineRect.setAttribute('x', String(o.left));
            dom.outlineRect.setAttribute('y', String(o.top));
            dom.outlineRect.setAttribute('width', String(o.width));
            dom.outlineRect.setAttribute('height', String(o.height));
          }
          if (dom.maskRect) {
            dom.maskRect.setAttribute('x', String(o.left));
            dom.maskRect.setAttribute('y', String(o.top));
            dom.maskRect.setAttribute('width', String(o.width));
            dom.maskRect.setAttribute('height', String(o.height));
          }
          if (dom.cornerPaths[0]) dom.cornerPaths[0].setAttribute('d', buildCornerPath(o, 'tl'));
          if (dom.cornerPaths[1]) dom.cornerPaths[1].setAttribute('d', buildCornerPath(o, 'tr'));
          if (dom.cornerPaths[2]) dom.cornerPaths[2].setAttribute('d', buildCornerPath(o, 'br'));
          if (dom.cornerPaths[3]) dom.cornerPaths[3].setAttribute('d', buildCornerPath(o, 'bl'));
          if (dom.numText) {
            dom.numText.setAttribute('x', String(o.left + 12));
            dom.numText.setAttribute('y', String(o.top + 22));
          }
        }

        // Card position writes — only when the placement coords moved.
        // The transform (lag + bob) updates more often, handled below.
        if (placementChanged && dom.card) {
          dom.card.style.top = `${cardTop}px`;
          dom.card.style.left = `${cardLeft}px`;
        }
        if (lagChanged && dom.card) {
          dom.card.style.transform = `translateY(${totalLag.toFixed(2)}px)`;
        }

        // Connector path — depends on outline corner + card edge + lag.
        // Always recompute when lag changes (every frame), or when
        // outline/placement shifted.
        if (outlineChanged || placementChanged || lagChanged) {
          const dPath = buildConnectorPath(o, cardLeft, cardTop, cardH, ae.cardSide, totalLag);
          if (dom.wirePath) dom.wirePath.setAttribute('d', dPath);
          if (dom.pulsePath) dom.pulsePath.setAttribute('d', dPath);
        }

        if (!last) {
          lastStates.set(ae.section.id, {
            oLeft: o.left, oTop: o.top, oWidth: o.width, oHeight: o.height,
            cardLeft, cardTop, cardH,
            lastTotal: totalLag,
          });
        } else {
          last.oLeft = o.left; last.oTop = o.top; last.oWidth = o.width; last.oHeight = o.height;
          last.cardLeft = cardLeft; last.cardTop = cardTop; last.cardH = cardH;
          last.lastTotal = totalLag;
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      const overlay = overlayRef.current;
      if (overlay) overlay.style.setProperty('--xray-scroll-lag', '0px');
    };
  }, [phase, anchorsInit]);

  /* Close on Escape. */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);

  if (!active) return null;

  const showCutouts = phase === 'revealed';

  // Helper to register/unregister a DOM ref for a given section.
  const setDomRef = (id: string, key: keyof AnchorDom, idx?: number) =>
    (el: any) => {
      let dom = domRefs.current.get(id);
      if (!dom) {
        dom = emptyDom();
        domRefs.current.set(id, dom);
      }
      if (key === 'cornerPaths' && typeof idx === 'number') {
        dom.cornerPaths[idx] = el;
      } else {
        (dom as any)[key] = el;
      }
    };

  /* Document-sized layer. */
  const docLayer = (
    <div
      ref={overlayRef}
      className={'xray-overlay xray-overlay--' + phase}
      style={{ width: docSize.w, height: docSize.h }}
      role="dialog"
      aria-label="X-ray view"
    >
      <svg
        className="xray-overlay__trace"
        width={docSize.w}
        height={docSize.h}
        viewBox={`0 0 ${docSize.w} ${docSize.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id="xray-cutout" maskUnits="userSpaceOnUse">
            <rect x="0" y="0" width={docSize.w} height={docSize.h} fill="white" />
            {showCutouts && anchorsInit.map((a) => (
              <rect
                key={a.section.id}
                ref={setDomRef(a.section.id, 'maskRect')}
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        <rect
          className="xray-trace__veil"
          width={docSize.w}
          height={docSize.h}
          mask="url(#xray-cutout)"
        />

        {showCutouts && anchorsInit.map((a, i) => (
          <g
            key={a.section.id}
            className="xray-trace__group"
            style={{ ['--reveal-index']: i } as CSSProperties}
          >
            <rect
              ref={setDomRef(a.section.id, 'outlineRect')}
              className="xray-trace__rect"
              x={a.left}
              y={a.top}
              width={a.width}
              height={a.height}
            />
            <g className="xray-trace__corners">
              <path ref={setDomRef(a.section.id, 'cornerPaths', 0)} d={buildCornerPath(a, 'tl')} />
              <path ref={setDomRef(a.section.id, 'cornerPaths', 1)} d={buildCornerPath(a, 'tr')} />
              <path ref={setDomRef(a.section.id, 'cornerPaths', 2)} d={buildCornerPath(a, 'br')} />
              <path ref={setDomRef(a.section.id, 'cornerPaths', 3)} d={buildCornerPath(a, 'bl')} />
            </g>
            <text
              ref={setDomRef(a.section.id, 'numText')}
              className="xray-trace__num"
              x={a.left + 12}
              y={a.top + 22}
            >
              {String(a.sectionNumber).padStart(2, '0')}
            </text>
          </g>
        ))}

        {/* Connector wire (steady) + pulse (animated dash sliding through) */}
        {showCutouts && anchorsInit.map((a, i) => {
          const initialD = buildConnectorPath(
            { left: a.left, top: a.top, width: a.width, height: a.height },
            a.cardLeft,
            a.cardTop,
            CARD_HEIGHT_COLLAPSED,
            a.cardSide,
            0,
          );
          return (
            <g key={`connector-${a.section.id}`} style={{ ['--reveal-index']: i } as CSSProperties}>
              <path
                ref={setDomRef(a.section.id, 'wirePath')}
                className="xray-trace__connector-wire"
                d={initialD}
              />
              <path
                ref={setDomRef(a.section.id, 'pulsePath')}
                className="xray-trace__connector-pulse"
                d={initialD}
                pathLength={100}
              />
            </g>
          );
        })}
      </svg>

      {/* Annotation cards. Their position + transform is written by rAF
       * via refs — React just renders the shape of the tree. */}
      {showCutouts && anchorsInit.map((a, i) => {
        const isOpen = expanded === a.section.id;
        return (
          <div
            key={a.section.id}
            ref={setDomRef(a.section.id, 'card')}
            className={'xray-card xray-card--' + a.cardSide + (isOpen ? ' xray-card--open' : '')}
            style={{
              top: `${a.cardTop}px`,
              left: `${a.cardLeft}px`,
              ['--reveal-index' as string]: i,
            }}
            onMouseEnter={() => setHoveredId(a.section.id)}
            onMouseLeave={() => setHoveredId((h) => h === a.section.id ? null : h)}
            onFocus={() => setHoveredId(a.section.id)}
            onBlur={() => setHoveredId((h) => h === a.section.id ? null : h)}
          >
            <div className="xray-card__inner">
              <button
                type="button"
                className="xray-card__header"
                onClick={() => setExpanded(isOpen ? null : a.section.id)}
                aria-expanded={isOpen}
              >
                <div className="xray-card__badge">
                  <span className="xray-card__badge-num">{String(a.sectionNumber).padStart(2, '0')}</span>
                </div>
                <div className="xray-card__heading">
                  <div className="xray-card__eyebrow">COMPONENT</div>
                  <div className="xray-card__title">{a.section.title}</div>
                </div>
                <svg
                  className={'xray-card__chev' + (isOpen ? ' xray-card__chev--open' : '')}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div className="xray-card__body">
                <div className="xray-card__body-inner">
                  <div className="xray-card__group">
                    <div className="xray-card__group-label">Tools</div>
                    <div className="xray-card__chips">
                      {a.section.tools.map((t) => (
                        <span key={t} className="xray-card__chip xray-card__chip--tool">
                          <XrayToolIcon name={t} />
                          <span>{t}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="xray-card__group">
                    <div className="xray-card__group-label">Data</div>
                    <ul className="xray-card__list">
                      {a.section.sources.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  {a.section.notes && (
                    <p className="xray-card__notes">{a.section.notes}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* Viewport-fixed layer. */
  const viewportLayer = (
    <div className={'xray-fixed-layer xray-fixed-layer--' + phase} aria-hidden={false}>
      <div className="xray-overlay__grid" aria-hidden="true" />
      <div className="xray-overlay__vignette" aria-hidden="true" />

      {phase === 'scanning' && (
        <>
          <div className="xray-overlay__scanline" aria-hidden="true" />
          <div className="xray-overlay__scanline-glow" aria-hidden="true" />
          <div className="xray-overlay__scan-label" aria-hidden="true">
            <span className="xray-overlay__scan-dot" />
            ANALYSING PAGE STRUCTURE…
          </div>
        </>
      )}

      <div className="xray-hud">
        <div className="xray-hud__left">
          <span className="xray-hud__dot" />
          <span className="xray-hud__title">X-RAY MODE</span>
          {phase === 'revealed' && (
            <span className="xray-hud__meta">
              {anchorsInit.length} component{anchorsInit.length === 1 ? '' : 's'} traced
            </span>
          )}
        </div>
        <button type="button" className="xray-hud__close" onClick={onClose} aria-label="Exit X-ray mode">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span>Exit</span>
        </button>
      </div>
    </div>
  );

  return createPortal(<>{docLayer}{viewportLayer}</>, document.body);
}

export default XrayMode;
