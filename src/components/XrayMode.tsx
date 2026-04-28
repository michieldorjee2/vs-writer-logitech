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
  /* Viewport-relative box of the section. The dark veil is rendered as an
   * SVG with these rectangles cut out, so the section content shows through. */
  left: number;
  top: number;
  width: number;
  height: number;
};

type Viewport = { w: number; h: number };

const SCAN_DURATION_MS = 1600;

function measureAnchors(sections: XraySectionInfo[]): AnchorPos[] {
  const anchors: AnchorPos[] = [];
  for (const s of sections) {
    const el = document.getElementById(s.id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    anchors.push({
      section: s,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }
  return anchors;
}

function getViewport(): Viewport {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * Four little angle brackets at each corner of the section's bounding box —
 * gives the trace a measuring-tool / technical-scan feel rather than a
 * plain rounded rectangle.
 */
function CornerBrackets({ a }: { a: AnchorPos }) {
  const inset = 6;
  const len = 18;
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
  const [viewport, setViewport] = useState<Viewport>(getViewport);
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

  /* Re-measure section rects + viewport on scroll/resize so the SVG mask,
   * outlines, and floating cards stay glued to their components. */
  useLayoutEffect(() => {
    if (phase !== 'revealed') return;

    const update = () => {
      setAnchors(measureAnchors(sections));
      setViewport(getViewport());
    };
    update();

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
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

  const overlay = (
    <div
      className={'xray-overlay xray-overlay--' + phase}
      role="dialog"
      aria-label="X-ray view"
    >
      {/* Grid texture sits behind the veil for the scan-grid feel. */}
      <div className="xray-overlay__grid" aria-hidden="true" />
      <div className="xray-overlay__vignette" aria-hidden="true" />

      {/*
       * The dark veil + section cutouts + traced outlines all live in this
       * single SVG. The mask makes each section's rect transparent so the
       * actual page content shows through; a second pass strokes a
       * turquoise outline around the same rects with corner brackets.
       */}
      <svg
        className="xray-overlay__trace"
        width={viewport.w}
        height={viewport.h}
        viewBox={`0 0 ${viewport.w} ${viewport.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <mask id="xray-cutout" maskUnits="userSpaceOnUse">
            {/* White = visible (veil shows). Black = cutout (veil hides). */}
            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
            {showCutouts && anchors.map((a) => (
              <rect
                key={a.section.id}
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                rx={14}
                ry={14}
                fill="black"
              />
            ))}
          </mask>
        </defs>

        {/* Dark veil with the section rects punched out */}
        <rect
          className="xray-trace__veil"
          width={viewport.w}
          height={viewport.h}
          mask="url(#xray-cutout)"
        />

        {/* Trace outlines + corner brackets + section number */}
        {showCutouts && anchors.map((a, i) => {
          const perimeter = 2 * (a.width + a.height);
          return (
            <g
              key={a.section.id}
              className="xray-trace__group"
              style={{ ['--reveal-index']: i, ['--perimeter']: `${perimeter}px` } as CSSProperties}
            >
              <rect
                className="xray-trace__rect"
                x={a.left}
                y={a.top}
                width={a.width}
                height={a.height}
                rx={14}
                ry={14}
                strokeDasharray={perimeter}
                strokeDashoffset={perimeter}
              />
              <CornerBrackets a={a} />
              <text
                className="xray-trace__num"
                x={a.left + 24}
                y={a.top + 36}
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Scanline — sweeps top → bottom during `scanning` */}
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

      {/* Annotation cards float beside their section outlines */}
      {phase === 'revealed' && anchors.map(({ section, top }, i) => {
        const isOpen = expanded === section.id;
        return (
          <div
            key={section.id}
            className={'xray-card' + (isOpen ? ' xray-card--open' : '')}
            style={{
              top: `${top + 56}px`,   // sits below the corner number badge
              ['--reveal-index' as string]: i,
            }}
          >
            <div className="xray-card__header" onClick={() => setExpanded(isOpen ? null : section.id)}>
              <div className="xray-card__badge">
                <span className="xray-card__badge-num">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="xray-card__heading">
                <div className="xray-card__eyebrow">SECTION</div>
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
            </div>

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

      {/* Header HUD */}
      <div className="xray-hud">
        <div className="xray-hud__left">
          <span className="xray-hud__dot" />
          <span className="xray-hud__title">X-RAY MODE</span>
          {phase === 'revealed' && (
            <span className="xray-hud__meta">
              {anchors.length} section{anchors.length === 1 ? '' : 's'} · built by Aldus
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

  return createPortal(overlay, document.body);
}

export default XrayMode;
