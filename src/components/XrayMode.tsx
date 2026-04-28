import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import {
  ABM_XRAY_DEFAULTS,
  DYNAMIC_XRAY_DEFAULTS,
  resolveXraySections,
  type XraySectionInfo,
} from '../lib/xray-defaults';

interface Props {
  active: boolean;
  onClose: () => void;
  page: CompetitorComparisonPage;
  variant: 'abm' | 'dynamic';
}

type CardSide = 'above' | 'below' | 'left' | 'right';

type AnchorPos = {
  section: XraySectionInfo;
  /** 1-based number shown in the corner of the outline. */
  sectionNumber: number;
  /* Padded union bounding box of every match, in document-relative coords. */
  left: number;
  top: number;
  width: number;
  height: number;
  /* Annotation card placement (also document-relative). */
  cardLeft: number;
  cardTop: number;
  cardSide: CardSide;
};

type DocSize = { w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

const SCAN_DURATION_MS = 1600;
/** Visual breathing room added around each component's bounding box. */
const OUTLINE_PADDING = 12;
/** Gap between the card and the component it points at. */
const CARD_GAP = 36;
/** Visual width of an annotation card (matches the CSS — keep in sync). */
const CARD_WIDTH = 300;
/** Approximate collapsed card height — sufficient for placement maths. */
const CARD_HEIGHT_COLLAPSED = 76;
/** Document-edge safety margin so cards don't bleed off the viewport. */
const DOC_MARGIN = 16;

/** AABB intersection test. */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/**
 * Pick the best card placement for an anchor by trying a list of candidate
 * sides in priority order and returning the first one that doesn't overlap
 * any OTHER component's outline. Falls back to "above with overlap" if
 * nothing works (rare on real pages).
 */
function placeCard(
  outline: { left: number; top: number; width: number; height: number },
  others: Array<{ left: number; top: number; width: number; height: number }>,
  doc: DocSize,
): { cardLeft: number; cardTop: number; cardSide: CardSide } {
  const cw = CARD_WIDTH;
  const ch = CARD_HEIGHT_COLLAPSED;
  const m = DOC_MARGIN;

  // Right-aligned X for above/below candidates so the card sits over the
  // component's right edge — keeps the connector short.
  const rightAlignedX = Math.max(m, Math.min(doc.w - cw - m, outline.left + outline.width - cw));
  const leftAlignedX = Math.max(m, Math.min(doc.w - cw - m, outline.left));

  type Cand = { side: CardSide; x: number; y: number };
  const candidates: Cand[] = [
    // Side placements: prefer right (in margin), then left
    { side: 'right', x: outline.left + outline.width + 16, y: outline.top + Math.max(0, (outline.height - ch) / 2) },
    { side: 'left',  x: outline.left - cw - 16,             y: outline.top + Math.max(0, (outline.height - ch) / 2) },
    // Above (right-aligned then left-aligned)
    { side: 'above', x: rightAlignedX,                       y: outline.top - ch - CARD_GAP },
    { side: 'above', x: leftAlignedX,                        y: outline.top - ch - CARD_GAP },
    // Below (right-aligned then left-aligned)
    { side: 'below', x: rightAlignedX,                       y: outline.top + outline.height + CARD_GAP },
    { side: 'below', x: leftAlignedX,                        y: outline.top + outline.height + CARD_GAP },
  ];

  for (const c of candidates) {
    // Off-page rejection
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
    if (!collides) {
      return { cardLeft: c.x, cardTop: c.y, cardSide: c.side };
    }
  }

  // Nothing fit cleanly — accept overlap and place above by default.
  return {
    cardLeft: rightAlignedX,
    cardTop: Math.max(m, outline.top - ch - CARD_GAP),
    cardSide: 'above',
  };
}

function measureAnchors(sections: XraySectionInfo[], doc: DocSize): AnchorPos[] {
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;

  // First pass: compute padded union outlines.
  type Outline = {
    section: XraySectionInfo;
    left: number;
    top: number;
    width: number;
    height: number;
  };
  const outlines: Outline[] = [];

  for (const s of sections) {
    let nodeList: NodeListOf<Element>;
    try {
      nodeList = document.querySelectorAll(s.selector);
    } catch {
      continue; // bad selector — skip
    }
    if (nodeList.length === 0) continue;

    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
    nodeList.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    });
    if (minLeft === Infinity) continue;

    outlines.push({
      section: s,
      left: minLeft + scrollX - OUTLINE_PADDING,
      top: minTop + scrollY - OUTLINE_PADDING,
      width: maxRight - minLeft + 2 * OUTLINE_PADDING,
      height: maxBottom - minTop + 2 * OUTLINE_PADDING,
    });
  }

  // Second pass: place each card, checking collisions against ALL other
  // outlines so a card never lands on top of a different component.
  const out: AnchorPos[] = [];
  outlines.forEach((o, i) => {
    const others = outlines.filter((_, j) => j !== i);
    const placement = placeCard(o, others, doc);
    out.push({
      section: o.section,
      sectionNumber: i + 1,
      left: o.left,
      top: o.top,
      width: o.width,
      height: o.height,
      ...placement,
    });
  });

  return out;
}

function getDocSize(): DocSize {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  const doc = document.documentElement;
  return {
    w: Math.max(doc.scrollWidth, doc.clientWidth),
    h: Math.max(doc.scrollHeight, doc.clientHeight),
  };
}

/** Four little angle brackets at each corner of the (padded) outline. */
function CornerBrackets({ a }: { a: AnchorPos }) {
  const inset = 4;
  const len = 16;
  const x1 = a.left + inset;
  const y1 = a.top + inset;
  const x2 = a.left + a.width - inset;
  const y2 = a.top + a.height - inset;
  return (
    <g className="xray-trace__corners">
      <path d={`M${x1},${y1 + len} L${x1},${y1} L${x1 + len},${y1}`} />
      <path d={`M${x2 - len},${y1} L${x2},${y1} L${x2},${y1 + len}`} />
      <path d={`M${x2},${y2 - len} L${x2},${y2} L${x2 - len},${y2}`} />
      <path d={`M${x1 + len},${y2} L${x1},${y2} L${x1},${y2 - len}`} />
    </g>
  );
}

/**
 * Loose hanging string from the card's outer edge to the OUTLINE's
 * (padded) corner, with a cubic bezier sag pulled down by gravity.
 *
 * `cardLag` shifts only the card-side endpoint of the string, so as the
 * card "drags" with scroll the string stretches/relaxes naturally while
 * the component-side endpoint stays glued to its corner.
 */
function buildConnectorPath(a: AnchorPos, cardLag = 0): string {
  const cw = CARD_WIDTH;
  const ch = CARD_HEIGHT_COLLAPSED;

  let sx: number, sy: number, ex: number, ey: number;

  if (a.cardSide === 'above') {
    // string from card-bottom to outline top-right corner
    sx = a.cardLeft + cw - 28;
    sy = a.cardTop + ch + cardLag;
    ex = a.left + a.width - 6;
    ey = a.top + 6;
  } else if (a.cardSide === 'below') {
    // string from card-top to outline bottom-right corner
    sx = a.cardLeft + cw - 28;
    sy = a.cardTop + cardLag;
    ex = a.left + a.width - 6;
    ey = a.top + a.height - 6;
  } else if (a.cardSide === 'left') {
    // card sits to the LEFT of the outline → string from card right edge
    // to outline left edge (mid-height)
    sx = a.cardLeft + cw;
    sy = a.cardTop + ch / 2 + cardLag;
    ex = a.left + 6;
    ey = a.top + Math.min(a.height / 2, 60);
  } else {
    // right: card to the right of the outline
    sx = a.cardLeft;
    sy = a.cardTop + ch / 2 + cardLag;
    ex = a.left + a.width - 6;
    ey = a.top + Math.min(a.height / 2, 60);
  }

  // Cubic bezier with two control points pulled DOWN — gravity sag.
  // Sag depth scales with horizontal distance so short strings barely
  // droop while long ones hang in a real catenary curve.
  const dx = ex - sx;
  const dy = ey - sy;
  const dist = Math.hypot(dx, dy);
  const sag = Math.max(28, dist * 0.5);

  const cx1 = sx + dx * 0.28;
  const cy1 = sy + sag;
  const cx2 = sx + dx * 0.72;
  const cy2 = ey + sag * 0.55;

  return `M${sx},${sy} C${cx1},${cy1} ${cx2},${cy2} ${ex},${ey}`;
}

function XrayMode({ active, onClose, page, variant }: Props) {
  const defaults = variant === 'abm' ? ABM_XRAY_DEFAULTS : DYNAMIC_XRAY_DEFAULTS;
  const sections = resolveXraySections(defaults, page.xraySections);

  const [phase, setPhase] = useState<'idle' | 'scanning' | 'revealed'>('idle');
  const [anchors, setAnchors] = useState<AnchorPos[]>([]);
  const [docSize, setDocSize] = useState<DocSize>(getDocSize);
  const [expanded, setExpanded] = useState<string | null>(null);
  const scanStartRef = useRef(0);

  // Persistent refs used by the rAF scroll-drag loop. Anchors are cached
  // in a ref (instead of pulled from state every frame) and the connector
  // <path> elements get keyed in by section.id so we can rewrite their d
  // attribute directly without going through React.
  const anchorsRef = useRef<AnchorPos[]>([]);
  const connectorRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const overlayRef = useRef<HTMLDivElement | null>(null);

  /* Lifecycle: toggle activation. */
  useEffect(() => {
    if (!active) {
      setPhase('idle');
      setExpanded(null);
      document.body.classList.remove('xray-active');
      return;
    }

    document.body.classList.add('xray-active');
    setPhase('scanning');
    scanStartRef.current = performance.now();

    const t = window.setTimeout(() => setPhase('revealed'), SCAN_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  /* Measure once we hit `revealed`. With document-relative coords positions
   * don't change as the user scrolls — the absolute-positioned overlay is
   * composited natively. We re-measure only on resize / layout changes. */
  useLayoutEffect(() => {
    if (phase !== 'revealed') return;

    const update = () => {
      const ds = getDocSize();
      setDocSize(ds);
      const next = measureAnchors(sections, ds);
      setAnchors(next);
      anchorsRef.current = next;
    };
    update();

    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [phase, sections]);

  /* Scroll-drag loop — runs only while the X-ray is revealed.
   *
   * Each frame:
   *  1. read window.scrollY, compute delta vs last frame
   *  2. accumulate `lag` with a drag coefficient and bleed it off via friction
   *  3. write `lag` to a CSS variable on the overlay so the cards follow it
   *     (transform translateY → balloon-drag effect)
   *  4. rebuild each connector path with the lagged card endpoint so the
   *     "string" stretches between the dragged card and the still-pinned
   *     component corner
   *
   * Steady state at zero scroll velocity: lag → 0, everything snaps back.
   */
  useEffect(() => {
    if (phase !== 'revealed') return;

    let lastScroll = window.scrollY;
    let lag = 0;
    let raf = 0;
    let running = true;

    const tick = () => {
      if (!running) return;
      const cur = window.scrollY;
      const delta = cur - lastScroll;
      lastScroll = cur;

      // Drag: scroll downward (delta > 0) pulls cards downward (positive lag),
      // so transform: translateY(+lag) makes the card visually trail behind
      // the page motion — like a balloon on a string.
      lag = lag * 0.86 + delta * 0.18;
      // Snap tiny residuals to zero so we stop firing path rewrites.
      if (Math.abs(lag) < 0.05) lag = 0;

      const overlay = overlayRef.current;
      if (overlay) overlay.style.setProperty('--xray-scroll-lag', `${lag.toFixed(2)}px`);

      // Re-issue connector path data with the lagged card endpoint.
      // setAttribute is cheaper than re-rendering through React, and we
      // skip the rebuild when lag has fully settled.
      if (lag !== 0 || delta !== 0) {
        for (const a of anchorsRef.current) {
          const path = connectorRefs.current.get(a.section.id);
          if (!path) continue;
          path.setAttribute('d', buildConnectorPath(a, lag));
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
  }, [phase]);

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

  /* Document-sized layer: dark veil + cutouts + traced outlines + cards.
   * `position: absolute` on .xray-overlay (set in CSS) means the browser
   * scrolls this layer with the document at compositor speed. */
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
            {showCutouts && anchors.map((a) => (
              <rect
                key={a.section.id}
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                rx={12}
                ry={12}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        {/* Dark veil with the (padded, unioned) component rects punched out */}
        <rect
          className="xray-trace__veil"
          width={docSize.w}
          height={docSize.h}
          mask="url(#xray-cutout)"
        />

        {/* Trace outline + corner brackets + section number — one per section. */}
        {showCutouts && anchors.map((a, i) => {
          const perimeter = 2 * (a.width + a.height);
          return (
            <g
              key={a.section.id}
              className="xray-trace__group"
              style={{ ['--reveal-index']: i } as CSSProperties}
            >
              <rect
                className="xray-trace__rect"
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                rx={12}
                ry={12}
                strokeDasharray={perimeter}
                strokeDashoffset={perimeter}
              />
              <CornerBrackets a={a} />
              <text
                className="xray-trace__num"
                x={a.left + 16}
                y={a.top + 24}
              >
                {String(a.sectionNumber).padStart(2, '0')}
              </text>
            </g>
          );
        })}

        {/* Connector strings — kept in the SVG so they sit above the veil
         * but below the cards. We attach a ref so the rAF loop can rewrite
         * the d attribute directly when the cards lag with scroll. */}
        {showCutouts && anchors.map((a, i) => (
          <path
            key={`connector-${a.section.id}`}
            ref={(el) => {
              if (el) connectorRefs.current.set(a.section.id, el);
              else connectorRefs.current.delete(a.section.id);
            }}
            className="xray-trace__connector"
            d={buildConnectorPath(a, 0)}
            style={{ ['--reveal-index']: i } as CSSProperties}
          />
        ))}
      </svg>

      {/* Annotation cards. The outer .xray-card is position-only and applies
       * the scroll-drag transform via --xray-scroll-lag. The inner element
       * runs the bob animation independently so the two transforms compose
       * cleanly without fighting each other. */}
      {showCutouts && anchors.map((a, i) => {
        const { section, sectionNumber, cardLeft, cardTop, cardSide } = a;
        const isOpen = expanded === section.id;
        return (
          <div
            key={section.id}
            className={'xray-card xray-card--' + cardSide + (isOpen ? ' xray-card--open' : '')}
            style={{
              top: `${cardTop}px`,
              left: `${cardLeft}px`,
              ['--reveal-index' as string]: i,
              ['--float-delay' as string]: `${(i * 0.31) % 2.5}s`,
            }}
          >
            <div className="xray-card__inner">
              <button
                type="button"
                className="xray-card__header"
                onClick={() => setExpanded(isOpen ? null : section.id)}
                aria-expanded={isOpen}
              >
                <div className="xray-card__badge">
                  <span className="xray-card__badge-num">{String(sectionNumber).padStart(2, '0')}</span>
                </div>
                <div className="xray-card__heading">
                  <div className="xray-card__eyebrow">COMPONENT</div>
                  <div className="xray-card__title">{section.title}</div>
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
                      {section.tools.map((t) => (
                        <span key={t} className="xray-card__chip xray-card__chip--tool">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="xray-card__group">
                    <div className="xray-card__group-label">Data</div>
                    <ul className="xray-card__list">
                      {section.sources.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  {section.notes && (
                    <p className="xray-card__notes">{section.notes}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  /* Viewport-fixed layer: HUD + scanline + decorative grid/vignette. */
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
              {anchors.length} component{anchors.length === 1 ? '' : 's'} · built by Aldus
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
