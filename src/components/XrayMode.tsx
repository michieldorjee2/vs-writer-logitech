import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  top: number;   // viewport-relative (cards live in a fixed overlay)
  height: number;
};

const SCAN_DURATION_MS = 1600;

function measureAnchors(sections: XraySectionInfo[]): AnchorPos[] {
  const anchors: AnchorPos[] = [];
  for (const s of sections) {
    const el = document.getElementById(s.id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    anchors.push({
      section: s,
      top: rect.top,
      height: rect.height,
    });
  }
  return anchors;
}

function XrayMode({ active, onClose, page, variant }: Props) {
  const defaults = variant === 'abm' ? ABM_XRAY_DEFAULTS : DYNAMIC_XRAY_DEFAULTS;
  const sections = resolveXraySections(defaults, page.xraySections);

  const [phase, setPhase] = useState<'idle' | 'scanning' | 'revealed'>('idle');
  const [anchors, setAnchors] = useState<AnchorPos[]>([]);
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

  /* Measure anchored sections once scan completes and on scroll/resize. */
  useLayoutEffect(() => {
    if (phase !== 'revealed') return;

    const update = () => setAnchors(measureAnchors(sections));
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

  const overlay = (
    <div
      className={'xray-overlay xray-overlay--' + phase}
      role="dialog"
      aria-label="X-ray view"
    >
      {/* Grid texture + vignette */}
      <div className="xray-overlay__grid" aria-hidden="true" />
      <div className="xray-overlay__vignette" aria-hidden="true" />

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

      {/* Reveal phase: annotation cards pinned to each section */}
      {phase === 'revealed' && anchors.map(({ section, top, height }, i) => {
        const isOpen = expanded === section.id;
        return (
          <div
            key={section.id}
            className={'xray-card' + (isOpen ? ' xray-card--open' : '')}
            style={{
              top: `${top + 24}px`,
              ['--reveal-index' as string]: i,
              ['--section-height' as string]: `${height}px`,
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
