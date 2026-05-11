/**
 * LetterAndPolaroids — magazine spread between hero and editorial lede.
 *
 * Visual arc (driven by GSAP ScrollTrigger):
 *  1. Section enters viewport — polaroids are STACKED center, large,
 *     overlapping each other (like a deck of cards just dropped on the
 *     letter), and the letter is folded closed (3D rotate-x).
 *  2. As the user scrolls, the polaroids fan out into their slot positions
 *     around the letter, and the letter unfolds (3D rotate-x → 0).
 *  3. By the end of the section, everything is settled in its final layout.
 *
 * Click a polaroid → animates from its position into a "Curated look"
 * lightbox panel showing the photo + 3-4 product picks for that moment,
 * each with an Add-to-bag button. Closing animates back. Esc / overlay
 * click closes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Polaroid, LetterContent } from '../../lib/retail-demo-content';
import { pickImage } from '../../lib/retail-image-bank';
import type { RetailRegister } from '../../lib/graph-types';
import { demoToast } from '../../lib/retail-demo-toast';
import OpalStamp from './OpalStamp';

interface CuratedProduct {
  name: string;
  qualifier: string;
  priceLabel: string;
}

interface Props {
  letter: LetterContent;
  polaroids: Polaroid[];
  /** Used by the curated-look lightbox to pick relevant product imagery. */
  register: RetailRegister;
}

/** Paperclip — small chrome SVG used to "attach" polaroids to the letter edge. */
function Paperclip({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className={`retail-paperclip${flip ? ' retail-paperclip--flip' : ''}`}
      viewBox="0 0 48 96"
      aria-hidden="true"
      width="28"
      height="56"
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
        d="M16 6 C 8 6, 4 12, 4 22 L 4 76 C 4 86, 10 92, 18 92 C 26 92, 32 86, 32 76 L 32 28 C 32 20, 26 14, 18 14 C 12 14, 8 18, 8 26 L 8 70"
        fill="none"
        stroke="url(#clip-grad)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A "curated look" — 3-4 products that go with this polaroid moment. */
function curatedForPolaroid(p: Polaroid, register: RetailRegister): CuratedProduct[] {
  const caption = (p.caption || '').toLowerCase();
  // Heuristic mapping — captions reference owned anchors; pick adjacent picks.
  if (caption.includes('anna') || caption.includes('coat')) {
    return [
      { name: 'Anna Coat — relining service', qualifier: 'wool-cashmere, original maker', priceLabel: 'On request' },
      { name: 'Côte Knit', qualifier: 'fine merino, oat', priceLabel: '$890' },
      { name: 'Charcoal Woven Stole', qualifier: 'herringbone cashmere', priceLabel: '$1,200' },
    ];
  }
  if (caption.includes('plis') || caption.includes('earring')) {
    return [
      { name: 'Plis Earrings — Long Drop', qualifier: '18k brushed gold', priceLabel: '$1,800' },
      { name: 'Plis Ring', qualifier: 'matching set, 18k', priceLabel: '$1,150' },
      { name: 'Linen Jewelry Roll', qualifier: 'ecru, hand-stitched', priceLabel: '$240' },
    ];
  }
  if (caption.includes('cashmere') || caption.includes('knit')) {
    return [
      { name: 'Côte Knit', qualifier: 'fine merino, oat', priceLabel: '$890' },
      { name: 'Cashmere Crewneck', qualifier: 'ink', priceLabel: '$1,090' },
      { name: 'Aurelle Hanger Set', qualifier: 'walnut, six', priceLabel: '$180' },
    ];
  }
  if (caption.includes('crosby') || caption.includes('street')) {
    return [
      { name: 'Stylist appointment', qualifier: 'Crosby Street — by reservation', priceLabel: 'Complimentary' },
      { name: 'Send-home pickup', qualifier: '3 pieces, returned Monday', priceLabel: 'Complimentary' },
    ];
  }
  if (caption.includes('notebook') || caption.includes('swatch')) {
    return [
      { name: 'Atelier Notebook', qualifier: 'linen-bound, monogrammed', priceLabel: '$120' },
      { name: 'Fabric swatch service', qualifier: 'samples sent before each season', priceLabel: 'Included' },
    ];
  }
  // Default — pick something palette-appropriate
  return [
    { name: 'Aurelle Card Case', qualifier: 'fawn grained calf', priceLabel: '$480' },
    { name: 'Marais Belt', qualifier: 'sand grained calf', priceLabel: '$640' },
  ];
}

export default function LetterAndPolaroids({ letter, polaroids, register }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) => (i === null ? null : (i + 1) % polaroids.length));
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? null : (i - 1 + polaroids.length) % polaroids.length));
    };
    window.addEventListener('keydown', handler);
    // Lock body scroll while open
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, close, polaroids.length]);

  // Polaroids land in 6 slots; the GSAP animator scrubs from stacked-center
  // to these slots based on scroll position. The slot offsets are written as
  // CSS custom properties so the animator can interpolate.
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
      <div className="retail-letter-section__paper" aria-hidden="true" />

      <h2 className="retail-letter-section__title" id="letter-heading">
        A letter, attached
      </h2>
      <p className="retail-letter-section__deck">
        Hand-written from Opal this week, with a few stills from where these pieces are
        kept. Tap any photo to see what we'd pair it with.
      </p>

      <div className="retail-collage" data-retail-collage>
        {polaroids.slice(0, 6).map((p, i) => (
          <button
            key={i}
            type="button"
            className={`retail-polaroid retail-polaroid--falling ${slotClasses[i] || ''}`}
            style={
              {
                '--rotate': `${p.rotate}deg`,
                '--stack-offset': `${i * 6}px`,
                '--stack-rot': `${(i - 2.5) * 5}deg`,
              } as React.CSSProperties
            }
            onClick={() => setLightboxIndex(i)}
            aria-label={`${p.caption} — see curated picks`}
            data-retail-polaroid={i}
          >
            <Paperclip flip={i % 2 === 1} />
            <div className="retail-polaroid__photo">
              <img src={p.imageUrl} alt={p.caption} loading="lazy" />
            </div>
            <span className="retail-polaroid__caption">{p.caption}</span>
          </button>
        ))}

        <article className="retail-letter" data-retail-letter>
          <div className="retail-letter__stamp-corner" aria-hidden="true">
            <OpalStamp size={96} />
          </div>
          <header className="retail-letter__head">
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

      {/* Curated-look lightbox */}
      {lightboxIndex !== null && (
        <CuratedLookLightbox
          polaroid={polaroids[lightboxIndex]}
          products={curatedForPolaroid(polaroids[lightboxIndex], register)}
          onClose={close}
          onPrev={() => setLightboxIndex((i) => (i === null ? null : (i - 1 + polaroids.length) % polaroids.length))}
          onNext={() => setLightboxIndex((i) => (i === null ? null : (i + 1) % polaroids.length))}
          countLabel={`${lightboxIndex + 1} / ${polaroids.length}`}
          register={register}
        />
      )}
    </section>
  );
}

/* ---- Lightbox component ---- */

function CuratedLookLightbox({
  polaroid,
  products,
  onClose,
  onPrev,
  onNext,
  countLabel,
  register,
}: {
  polaroid: Polaroid;
  products: CuratedProduct[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  countLabel: string;
  register: RetailRegister;
}) {
  return (
    <div className="retail-look" onClick={onClose} role="dialog" aria-modal="true" aria-label="Curated look">
      <button type="button" className="retail-look__close" onClick={onClose} aria-label="Close">×</button>

      <div className="retail-look__pane" onClick={(e) => e.stopPropagation()}>
        {/* Photo column — feels like the polaroid grown */}
        <figure className="retail-look__photo">
          <img src={polaroid.imageUrl} alt={polaroid.caption} />
          <figcaption className="retail-look__caption">
            <OpalStamp size={48} className="retail-look__caption-stamp" />
            <span>{polaroid.caption}</span>
          </figcaption>
        </figure>

        {/* Curated picks column */}
        <section className="retail-look__picks" aria-label="Curated picks">
          <header className="retail-look__picks-head">
            <span className="retail-label-gold">Curated for this moment</span>
            <h3 className="retail-look__picks-title">Opal's picks</h3>
            <p className="retail-look__picks-deck">
              What goes with the moment in the photograph. Each pick is held in your size,
              same week.
            </p>
          </header>

          <ul className="retail-look__list">
            {products.map((prod, i) => {
              const img = pickImage(prod.name, prod.qualifier, register);
              return (
                <li key={i} className="retail-look__item">
                  <div
                    className="retail-look__thumb"
                    role="img"
                    aria-label={prod.name}
                    style={{ backgroundImage: `url(${img.url})` }}
                  />
                  <div className="retail-look__meta">
                    <span className="retail-look__name">{prod.name}</span>
                    <span className="retail-look__qualifier">{prod.qualifier}</span>
                    <span className="retail-look__price">{prod.priceLabel}</span>
                  </div>
                  <div className="retail-look__item-actions">
                    <button
                      type="button"
                      className="retail-look__btn"
                      onClick={() => demoToast(`${prod.name} added to your bag.`, 'success')}
                    >
                      Add to bag
                    </button>
                    <button
                      type="button"
                      className="retail-look__btn retail-look__btn--quiet"
                      onClick={() => demoToast(`${prod.name} saved for next visit.`, 'note')}
                    >
                      Save
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <footer className="retail-look__footer">
            <button
              type="button"
              className="retail-look__btn retail-look__btn--block"
              onClick={() => demoToast('Order placed. Opal will write back with shipping notes.', 'success')}
            >
              View order summary
            </button>
            <button
              type="button"
              className="retail-look__btn retail-look__btn--quiet retail-look__btn--block"
              onClick={() => demoToast('Saved to your next visit at Crosby Street.', 'note')}
            >
              Save the look
            </button>
          </footer>
        </section>
      </div>

      {/* Nav + count */}
      <button type="button" className="retail-look__nav retail-look__nav--prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous photo">‹</button>
      <button type="button" className="retail-look__nav retail-look__nav--next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next photo">›</button>
      <span className="retail-look__count">{countLabel}</span>
    </div>
  );
}
