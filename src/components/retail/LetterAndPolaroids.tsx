/**
 * LetterAndPolaroids — magazine spread between hero and editorial lede.
 *
 * Visual: a centered letter (typewriter-on-paper feel) with 4-6 polaroids
 * scattered around it via CSS grid. Each polaroid is attached to the
 * letter edge with an SVG paperclip. Scroll-triggered entrance staggers
 * the polaroids in with rotation. Hover lifts them; click opens a
 * lightweight lightbox.
 *
 * Why: the user asked for "a crafted interactive story… as though you're
 * seeing a letter written to the customer on the page, with photos
 * attached with a paperclip." This section lives BEFORE the product
 * listings so the page reads as a story first, a shop second.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Polaroid, LetterContent } from '../../lib/retail-demo-content';

interface Props {
  letter: LetterContent;
  polaroids: Polaroid[];
}

/** Paperclip SVG — silver, slightly tilted. Anchored to a polaroid corner. */
function Paperclip({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className={`retail-paperclip${flip ? ' retail-paperclip--flip' : ''}`}
      viewBox="0 0 48 96"
      aria-hidden="true"
      width="32"
      height="64"
    >
      <defs>
        <linearGradient id="clip-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#cdd1d4" />
          <stop offset="45%" stopColor="#f3f5f7" />
          <stop offset="55%" stopColor="#a9adb1" />
          <stop offset="100%" stopColor="#7d8083" />
        </linearGradient>
      </defs>
      <path
        d="M16 6
           C 8 6, 4 12, 4 22
           L 4 76
           C 4 86, 10 92, 18 92
           C 26 92, 32 86, 32 76
           L 32 28
           C 32 20, 26 14, 18 14
           C 12 14, 8 18, 8 26
           L 8 70"
        fill="none"
        stroke="url(#clip-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LetterAndPolaroids({ letter, polaroids }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);

  // Esc closes the lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : (i + 1) % polaroids.length));
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => (i === null ? null : (i - 1 + polaroids.length) % polaroids.length));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, close, polaroids.length]);

  // Polaroids are placed into 6 grid slots around the letter.
  // Order in the array maps to slot index; if there are fewer than 6, the
  // empty slots collapse via grid-auto behavior.
  const slotClasses = [
    'retail-polaroid--slot-tl',
    'retail-polaroid--slot-tr',
    'retail-polaroid--slot-ml',
    'retail-polaroid--slot-mr',
    'retail-polaroid--slot-bl',
    'retail-polaroid--slot-br',
  ];

  return (
    <section className="retail-letter-section" ref={sectionRef} aria-labelledby="letter-heading">
      {/* Faint paper texture background sits behind everything */}
      <div className="retail-letter-section__paper" aria-hidden="true" />

      <h2 className="retail-letter-section__title" id="letter-heading">
        A letter, attached
      </h2>
      <p className="retail-letter-section__deck">
        Hand-written from the atelier this week, with a few stills from where these pieces are
        kept. Click any photo to see it close.
      </p>

      <div className="retail-collage">
        {polaroids.slice(0, 6).map((p, i) => (
          <button
            key={i}
            type="button"
            className={`retail-polaroid ${slotClasses[i] || ''}`}
            style={{ '--rotate': `${p.rotate}deg` } as React.CSSProperties}
            onClick={() => setLightboxIndex(i)}
            aria-label={`${p.caption} — view full size`}
            data-retail-polaroid={i}
          >
            <Paperclip flip={i % 2 === 1} />
            <div className="retail-polaroid__photo">
              <img src={p.imageUrl} alt={p.caption} loading="lazy" />
            </div>
            <span className="retail-polaroid__caption">{p.caption}</span>
          </button>
        ))}

        <article className="retail-letter">
          <header className="retail-letter__head">
            <span className="retail-letter__stamp" aria-hidden="true">
              <span className="retail-letter__stamp-line">MAISON AURELLE</span>
              <span className="retail-letter__stamp-sub">par retour de courrier</span>
            </span>
            <span className="retail-letter__date">May, MMXXVI</span>
          </header>
          <p className="retail-letter__greeting">{letter.greeting}</p>
          <div className="retail-letter__body">
            {letter.paragraphs.map((para, i) => (
              <p
                key={i}
                className="retail-letter__paragraph"
                data-retail-letter-line={i}
              >
                {para}
              </p>
            ))}
          </div>
          <p className="retail-letter__signoff">{letter.signoff}</p>
        </article>
      </div>

      {/* Lightbox — pure CSS modal, no portal needed */}
      {lightboxIndex !== null && (
        <div
          className="retail-lightbox"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Photo preview"
        >
          <button
            type="button"
            className="retail-lightbox__close"
            onClick={close}
            aria-label="Close preview"
          >
            ×
          </button>
          <div
            className="retail-lightbox__inner"
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `rotate(${polaroids[lightboxIndex].rotate / 3}deg)`,
            }}
          >
            <div className="retail-lightbox__photo">
              <img
                src={polaroids[lightboxIndex].imageUrl}
                alt={polaroids[lightboxIndex].caption}
              />
            </div>
            <p className="retail-lightbox__caption">
              {polaroids[lightboxIndex].caption}
            </p>
          </div>
          <button
            type="button"
            className="retail-lightbox__nav retail-lightbox__nav--prev"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i === null ? null : (i - 1 + polaroids.length) % polaroids.length));
            }}
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            type="button"
            className="retail-lightbox__nav retail-lightbox__nav--next"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i === null ? null : (i + 1) % polaroids.length));
            }}
            aria-label="Next photo"
          >
            ›
          </button>
        </div>
      )}
    </section>
  );
}
