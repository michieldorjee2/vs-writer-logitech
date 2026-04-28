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
  /** 1-based number shown in the corner of every outline of this section. */
  sectionNumber: number;
  /** True only for the first match of this section — the one the card pins to. */
  isFirstOfSection: boolean;
  /* Document-relative bounding box. Because the SVG + cards live inside a
   * position:absolute container sized to the full document, the browser
   * does the scroll math natively — no per-frame React updates needed. */
  left: number;
  top: number;
  width: number;
  height: number;
};

type DocSize = { w: number; h: number };

const SCAN_DURATION_MS = 1600;

function measureAnchors(sections: XraySectionInfo[]): AnchorPos[] {
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const out: AnchorPos[] = [];
  let visibleSectionCount = 0;
  for (const s of sections) {
    let nodeList: NodeListOf<Element>;
    try {
      nodeList = document.querySelectorAll(s.selector);
    } catch {
      // Bad selector — skip rather than crash the whole reveal.
      continue;
    }
    if (nodeList.length === 0) continue;

    const matches: Array<{ rect: DOMRect; el: Element }> = [];
    nodeList.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      matches.push({ rect, el });
    });
    if (matches.length === 0) continue;

    // Sort matches top-to-bottom so the first/card-bearing match is the
    // topmost one on screen — feels right when the section is e.g. a row
    // of cards.
    matches.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

    visibleSectionCount += 1;
    matches.forEach((m, idx) => {
      out.push({
        section: s,
        sectionNumber: visibleSectionCount,
        isFirstOfSection: idx === 0,
        left: m.rect.left + scrollX,
        top: m.rect.top + scrollY,
        width: m.rect.width,
        height: m.rect.height,
      });
    });
  }
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
  const len = 14;
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
      setAnchors(measureAnchors(sections));
      setDocSize(getDocSize());
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
            {showCutouts && anchors.map((a, i) => (
              <rect
                key={`${a.section.id}-${i}`}
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                rx={10}
                ry={10}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        {/* Dark veil with the component rects punched out */}
        <rect
          className="xray-trace__veil"
          width={docSize.w}
          height={docSize.h}
          mask="url(#xray-cutout)"
        />

        {/* Trace outlines + corner brackets + component number — one per
         * matched element, all sharing the section's number. */}
        {showCutouts && anchors.map((a, i) => {
          const perimeter = 2 * (a.width + a.height);
          return (
            <g
              key={`${a.section.id}-${i}`}
              className="xray-trace__group"
              style={{ ['--reveal-index']: i } as CSSProperties}
            >
              <rect
                className="xray-trace__rect"
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                rx={10}
                ry={10}
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
      </svg>

      {/* Annotation cards — one per section, anchored to the FIRST match of
       * that section. Other matches share the same number on their outline
       * but don't get a duplicate card. */}
      {showCutouts && anchors.filter((a) => a.isFirstOfSection).map(({ section, sectionNumber, left, top, width }, i) => {
        const isOpen = expanded === section.id;
        // Pin card just inside the top-left of its component, but never
        // past where it would render off the right edge.
        const cardLeft = Math.min(left + 16, Math.max(0, docSize.w - 320 - 16));
        return (
          <div
            key={section.id}
            className={'xray-card' + (isOpen ? ' xray-card--open' : '')}
            style={{
              top: `${top + 36}px`,
              left: `${cardLeft}px`,
              ['--reveal-index' as string]: i,
              ['--anchor-width' as string]: `${width}px`,
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
          {phase === 'revealed' && (() => {
            const sectionCount = anchors.filter((a) => a.isFirstOfSection).length;
            const traceCount = anchors.length;
            return (
              <span className="xray-hud__meta">
                {sectionCount} component{sectionCount === 1 ? '' : 's'}
                {traceCount !== sectionCount ? ` · ${traceCount} traces` : ''} · built by Aldus
              </span>
            );
          })()}
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
