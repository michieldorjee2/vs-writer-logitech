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

type AnchorPos = {
  section: XraySectionInfo;
  /** 1-based number shown in the corner of the outline. */
  sectionNumber: number;
  /* Padded union bounding box of every match for this section, in
   * document-relative coordinates. The SVG + cards live inside a
   * position:absolute container sized to the full document, so the
   * browser does the scroll math natively. */
  left: number;
  top: number;
  width: number;
  height: number;
  /* Annotation card placement (also document-relative). */
  cardLeft: number;
  cardTop: number;
  cardSide: 'above' | 'below';
};

type DocSize = { w: number; h: number };

const SCAN_DURATION_MS = 1600;
/** Visual breathing room added around each component's bounding box. */
const OUTLINE_PADDING = 12;
/** Gap between the card and the component it points at. */
const CARD_GAP = 32;
/** Visual width of an annotation card (matches the CSS). Used for placement. */
const CARD_WIDTH = 300;
/** Approximate collapsed card height — sufficient for placement maths. */
const CARD_HEIGHT_COLLAPSED = 76;

function measureAnchors(sections: XraySectionInfo[], docW: number): AnchorPos[] {
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;

  // First pass: union bounding boxes per section.
  const groups: Array<{
    section: XraySectionInfo;
    minLeft: number;
    minTop: number;
    maxRight: number;
    maxBottom: number;
  }> = [];

  for (const s of sections) {
    let nodeList: NodeListOf<Element>;
    try {
      nodeList = document.querySelectorAll(s.selector);
    } catch {
      // Bad selector — skip rather than crash the whole reveal.
      continue;
    }
    if (nodeList.length === 0) continue;

    let minLeft = Infinity;
    let minTop = Infinity;
    let maxRight = -Infinity;
    let maxBottom = -Infinity;

    nodeList.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      minLeft = Math.min(minLeft, rect.left);
      minTop = Math.min(minTop, rect.top);
      maxRight = Math.max(maxRight, rect.right);
      maxBottom = Math.max(maxBottom, rect.bottom);
    });

    if (minLeft === Infinity) continue;

    groups.push({ section: s, minLeft, minTop, maxRight, maxBottom });
  }

  // Second pass: turn into AnchorPos with padding + card placement.
  const out: AnchorPos[] = [];
  groups.forEach((g, i) => {
    const left = g.minLeft + scrollX - OUTLINE_PADDING;
    const top = g.minTop + scrollY - OUTLINE_PADDING;
    const width = (g.maxRight - g.minLeft) + 2 * OUTLINE_PADDING;
    const height = (g.maxBottom - g.minTop) + 2 * OUTLINE_PADDING;

    // Card placement: above the component by default, right-aligned to it.
    // Falls back to below if the component is too close to the page top.
    const margin = 16;
    let cardLeft = left + width - CARD_WIDTH;
    if (cardLeft < margin) cardLeft = margin;
    if (cardLeft + CARD_WIDTH > docW - margin) {
      cardLeft = docW - CARD_WIDTH - margin;
    }

    let cardTop = top - CARD_HEIGHT_COLLAPSED - CARD_GAP;
    let cardSide: 'above' | 'below' = 'above';
    if (cardTop < margin) {
      cardTop = top + height + CARD_GAP;
      cardSide = 'below';
    }

    out.push({
      section: g.section,
      sectionNumber: i + 1,
      left,
      top,
      width,
      height,
      cardLeft,
      cardTop,
      cardSide,
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

/** Four little angle brackets at each corner of the component's bounding box. */
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
 * Loose curved string from the card down to the corner of its component.
 * Quadratic bezier with a slight droop control point — looks like a
 * helium-balloon string instead of a taut leader line.
 */
function buildConnectorPath(a: AnchorPos): string {
  const cardW = CARD_WIDTH;
  const cardH = CARD_HEIGHT_COLLAPSED;

  if (a.cardSide === 'above') {
    // String hangs from card's bottom-right area down/across to the
    // top-right of the component.
    const sx = a.cardLeft + cardW - 28;
    const sy = a.cardTop + cardH;
    const ex = Math.min(a.cardLeft + cardW + 30, a.left + a.width - 18);
    const ey = a.top + 14;
    const cx = (sx + ex) / 2;
    const cy = sy + Math.max(20, (ey - sy) * 0.45); // droop downward
    return `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
  }
  // below: string goes from card's top down to component's bottom-right
  const sx = a.cardLeft + cardW - 28;
  const sy = a.cardTop;
  const ex = Math.min(a.cardLeft + cardW + 30, a.left + a.width - 18);
  const ey = a.top + a.height - 14;
  const cx = (sx + ex) / 2;
  const cy = sy - Math.max(20, (sy - ey) * 0.45);
  return `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`;
}

function XrayMode({ active, onClose, page, variant }: Props) {
  const defaults = variant === 'abm' ? ABM_XRAY_DEFAULTS : DYNAMIC_XRAY_DEFAULTS;
  const sections = resolveXraySections(defaults, page.xraySections);

  const [phase, setPhase] = useState<'idle' | 'scanning' | 'revealed'>('idle');
  const [anchors, setAnchors] = useState<AnchorPos[]>([]);
  const [docSize, setDocSize] = useState<DocSize>(getDocSize);
  const [expanded, setExpanded] = useState<string | null>(null);
  const scanStartRef = useRef(0);

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

  /* Measure once we hit `revealed`. With document-relative coords the
   * positions don't change as the user scrolls — the browser composites
   * the absolute-positioned overlay natively, no scroll listener needed.
   * We only need to re-measure when the document layout itself changes
   * (resize, fonts loading, lazy images filling in). */
  useLayoutEffect(() => {
    if (phase !== 'revealed') return;

    const update = () => {
      const ds = getDocSize();
      setDocSize(ds);
      setAnchors(measureAnchors(sections, ds.w));
    };
    update();

    window.addEventListener('resize', update);

    // Watch the document for height changes (images loading, animations,
    // expanding accordions). Cheap: ResizeObserver fires only on actual
    // size changes, not every scroll frame.
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [phase, sections]);

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

        {/* Connector strings — drawn behind the cards but on top of the veil
         * so they read as a thin glowing line from card to component. */}
        {showCutouts && anchors.map((a, i) => (
          <path
            key={`connector-${a.section.id}`}
            className="xray-trace__connector"
            d={buildConnectorPath(a)}
            style={{ ['--reveal-index']: i } as CSSProperties}
          />
        ))}
      </svg>

      {/* Annotation cards — float OUTSIDE the component (above by default,
       * below if there's no room) connected by the curved string above. */}
      {showCutouts && anchors.map((a, i) => {
        const { section, sectionNumber, cardLeft, cardTop } = a;
        const isOpen = expanded === section.id;
        return (
          <div
            key={section.id}
            className={
              'xray-card xray-card--' + a.cardSide +
              (isOpen ? ' xray-card--open' : '')
            }
            style={{
              top: `${cardTop}px`,
              left: `${cardLeft}px`,
              ['--reveal-index' as string]: i,
              ['--float-delay' as string]: `${(i * 0.31) % 2.5}s`,
            }}
          >
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
        );
      })}
    </div>
  );

  /* Viewport-fixed layer: HUD + scanline + decorative grid/vignette.
   * These should always be in viewport regardless of scroll. */
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
