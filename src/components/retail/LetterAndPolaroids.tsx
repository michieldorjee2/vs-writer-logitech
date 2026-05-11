/**
 * LetterAndPolaroids — magazine spread between hero and editorial lede.
 *
 * Visual arc (v6):
 *  1. Section enters: polaroids are STACKED center as a single bundle,
 *     held together by ONE paperclip at the top. Letter is hidden,
 *     folded tightly into thirds underneath.
 *  2. Scroll: paperclip lifts off and the polaroids fall apart, drifting
 *     out to their slot positions. The letter unfolds in 3D: top third
 *     rotates down from behind, bottom third rotates up from in front.
 *     Visible creases mark the folds.
 *  3. Settled: letter laid flat, polaroids fanned around it, stamp
 *     cropped at the letter's top-right corner.
 *
 * Click a polaroid → it grows and moves smoothly into the curated-look
 * lightbox (Framer Motion layoutId shared-element transition).
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
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
  register: RetailRegister;
}

/** Single paperclip that clips the whole stack initially. */
function StackPaperclip() {
  return (
    <svg
      className="retail-stack-paperclip"
      viewBox="0 0 60 120"
      aria-hidden="true"
      width="48"
      height="96"
    >
      <defs>
        <linearGradient id="stack-clip-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#bcc1c5" />
          <stop offset="40%" stopColor="#f1f3f5" />
          <stop offset="55%" stopColor="#9aa0a4" />
          <stop offset="100%" stopColor="#6c7074" />
        </linearGradient>
      </defs>
      <path
        d="M20 6 C 10 6, 4 14, 4 26 L 4 96 C 4 108, 12 116, 22 116 C 32 116, 40 108, 40 96 L 40 32 C 40 22, 32 16, 22 16 C 14 16, 10 22, 10 32 L 10 88"
        fill="none"
        stroke="url(#stack-clip-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function curatedForPolaroid(p: Polaroid, _register: RetailRegister): CuratedProduct[] {
  const caption = (p.caption || '').toLowerCase();
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
  return [
    { name: 'Aurelle Card Case', qualifier: 'fawn grained calf', priceLabel: '$480' },
    { name: 'Marais Belt', qualifier: 'sand grained calf', priceLabel: '$640' },
  ];
}

export default function LetterAndPolaroids({ letter, polaroids, register }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const close = useCallback(() => setActiveIndex(null), []);

  useEffect(() => {
    if (activeIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setActiveIndex((i) => (i === null ? null : (i + 1) % polaroids.length));
      if (e.key === 'ArrowLeft') setActiveIndex((i) => (i === null ? null : (i - 1 + polaroids.length) % polaroids.length));
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [activeIndex, close, polaroids.length]);

  const slotClasses = [
    'retail-polaroid--slot-tl',
    'retail-polaroid--slot-tr',
    'retail-polaroid--slot-ml',
    'retail-polaroid--slot-mr',
    'retail-polaroid--slot-bl',
    'retail-polaroid--slot-br',
  ];

  return (
    <LayoutGroup>
      <section className="retail-letter-section" aria-labelledby="letter-heading">
        <div className="retail-letter-section__paper" aria-hidden="true" />

        <h2 className="retail-letter-section__title" id="letter-heading">
          A letter, attached
        </h2>
        <p className="retail-letter-section__deck">
          Hand-written from Opal this week, with a few stills from where these pieces are kept.
          Tap any photo to see what Opal would pair with that moment.
        </p>

        <div className="retail-collage" data-retail-collage>
          {/* The stack paperclip — visible at the start, animates off as polaroids fall apart */}
          <div className="retail-stack-paperclip-wrap" data-retail-stack-clip aria-hidden="true">
            <StackPaperclip />
          </div>

          {polaroids.slice(0, 6).map((p, i) => (
            <motion.button
              key={i}
              type="button"
              layoutId={`polaroid-${i}`}
              className={`retail-polaroid retail-polaroid--falling ${slotClasses[i] || ''}`}
              style={
                {
                  '--rotate': `${p.rotate}deg`,
                } as React.CSSProperties
              }
              onClick={() => setActiveIndex(i)}
              aria-label={`${p.caption} — see Opal's curated picks`}
              data-retail-polaroid={i}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
              <motion.div className="retail-polaroid__photo" layoutId={`polaroid-photo-${i}`}>
                <img src={p.imageUrl} alt={p.caption} loading="lazy" />
              </motion.div>
              <motion.span className="retail-polaroid__caption" layoutId={`polaroid-caption-${i}`}>
                {p.caption}
              </motion.span>
            </motion.button>
          ))}

          {/* The letter — tri-fold paper that unfolds in 3D */}
          <article className="retail-letter" data-retail-letter>
            {/* Three folded panels — only one visible until unfold */}
            <div className="retail-letter__panel retail-letter__panel--top" data-retail-panel="top">
              {/* Panel content is visible on the back during fold */}
              <div className="retail-letter__panel-inner">
                {/* top third of the letter mirrors top content */}
              </div>
            </div>
            <div className="retail-letter__panel retail-letter__panel--mid" data-retail-panel="mid">
              <div className="retail-letter__stamp-corner" aria-hidden="true">
                <OpalStamp size={108} />
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
              {/* Crease lines — visible after unfold */}
              <div className="retail-letter__crease retail-letter__crease--top" aria-hidden="true" />
              <div className="retail-letter__crease retail-letter__crease--bottom" aria-hidden="true" />
            </div>
            <div className="retail-letter__panel retail-letter__panel--bottom" data-retail-panel="bottom">
              <div className="retail-letter__panel-inner" />
            </div>
          </article>
        </div>

        {/* Lightbox — uses Framer Motion shared layout for smooth polaroid → modal */}
        <AnimatePresence>
          {activeIndex !== null && (
            <CuratedLookLightbox
              key={`look-${activeIndex}`}
              index={activeIndex}
              polaroid={polaroids[activeIndex]}
              products={curatedForPolaroid(polaroids[activeIndex], register)}
              onClose={close}
              onPrev={() => setActiveIndex((i) => (i === null ? null : (i - 1 + polaroids.length) % polaroids.length))}
              onNext={() => setActiveIndex((i) => (i === null ? null : (i + 1) % polaroids.length))}
              countLabel={`${activeIndex + 1} / ${polaroids.length}`}
              register={register}
            />
          )}
        </AnimatePresence>
      </section>
    </LayoutGroup>
  );
}

/* ---- Lightbox ---- */

function CuratedLookLightbox({
  index,
  polaroid,
  products,
  onClose,
  onPrev,
  onNext,
  countLabel,
  register,
}: {
  index: number;
  polaroid: Polaroid;
  products: CuratedProduct[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  countLabel: string;
  register: RetailRegister;
}) {
  return (
    <motion.div
      className="retail-look"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Curated look"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
    >
      <button type="button" className="retail-look__close" onClick={onClose} aria-label="Close">×</button>

      <motion.div
        className="retail-look__pane"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Photo column — shares layoutId with the source polaroid so it
            morphs from the original position. */}
        <motion.figure className="retail-look__photo" layoutId={`polaroid-${index}`}>
          <motion.div className="retail-look__photo-inner" layoutId={`polaroid-photo-${index}`}>
            <img src={polaroid.imageUrl} alt={polaroid.caption} />
          </motion.div>
          <motion.figcaption className="retail-look__caption" layoutId={`polaroid-caption-${index}`}>
            <OpalStamp size={56} className="retail-look__caption-stamp" />
            <span>{polaroid.caption}</span>
          </motion.figcaption>
        </motion.figure>

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
              onClick={() => demoToast('Saved to your next visit at the atelier.', 'note')}
            >
              Save the look
            </button>
          </footer>
        </section>
      </motion.div>

      <button type="button" className="retail-look__nav retail-look__nav--prev" onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous photo">‹</button>
      <button type="button" className="retail-look__nav retail-look__nav--next" onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next photo">›</button>
      <span className="retail-look__count">{countLabel}</span>
    </motion.div>
  );
}
