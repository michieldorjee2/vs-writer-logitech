/**
 * LetterAndPolaroids — magazine spread between hero and editorial lede.
 *
 * Composition:
 *  - A single hand-written letter laid flat at the centre of the spread.
 *  - Six polaroids scattered into slots around the letter.
 *  - Polaroids start STACKED (paperclipped together onto the first one)
 *    and fan out into their slots as the section scrolls into view.
 *  - The paperclip is anchored to the first polaroid, so it stays with
 *    that photo after the fan-out instead of floating in space.
 *
 * Interaction:
 *  - Tap any polaroid → opens a lightbox via Framer Motion shared-element
 *    transition (layoutId). The lightbox is portalled to <body> so it sits
 *    above the page chrome and stays correctly positioned regardless of
 *    scroll/ancestor stacking contexts.
 *  - A small handwritten "click me!" hint near the stack flags the
 *    polaroids as interactive on first view.
 */

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { pickImage } from '../../lib/retail-image-bank';
import { resolveUrl, type RetailRegister, type RetailLetterBlock, type RetailPolaroid } from '../../lib/graph-types';
import { useCart, originFromEvent, slugifyName } from '../../lib/retail-cart';
import OpalStamp from './OpalStamp';

interface CuratedProduct {
  name: string;
  qualifier: string;
  priceLabel: string;
}

interface Props {
  letter: RetailLetterBlock;
  polaroids: RetailPolaroid[];
  register: RetailRegister;
}

/** Paperclip that rides on a single polaroid. Stays attached after fan-out. */
function PolaroidPaperclip() {
  return (
    <svg
      className="retail-polaroid__clip"
      viewBox="0 0 60 120"
      aria-hidden="true"
      width="36"
      height="72"
    >
      <defs>
        <linearGradient id="pc-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#bcc1c5" />
          <stop offset="40%" stopColor="#f1f3f5" />
          <stop offset="55%" stopColor="#9aa0a4" />
          <stop offset="100%" stopColor="#6c7074" />
        </linearGradient>
      </defs>
      <path
        d="M20 6 C 10 6, 4 14, 4 26 L 4 96 C 4 108, 12 116, 22 116 C 32 116, 40 108, 40 96 L 40 32 C 40 22, 32 16, 22 16 C 14 16, 10 22, 10 32 L 10 88"
        fill="none"
        stroke="url(#pc-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function curatedForPolaroid(p: RetailPolaroid, _register: RetailRegister): CuratedProduct[] {
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
  const [hintHidden, setHintHidden] = useState(false);
  const close = useCallback(() => setActiveIndex(null), []);

  const openAt = useCallback(
    (i: number) => {
      setActiveIndex(i);
      setHintHidden(true);
    },
    [],
  );

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
          {polaroids.slice(0, 6).map((p, i) => (
            <motion.button
              key={i}
              type="button"
              layoutId={`polaroid-${i}`}
              className={`retail-polaroid retail-polaroid--falling ${slotClasses[i] || ''} ${
                i === 0 ? 'retail-polaroid--clipped' : ''
              }`}
              style={
                {
                  '--rotate': `${p.rotate ?? 0}deg`,
                } as React.CSSProperties
              }
              onClick={() => openAt(i)}
              aria-label={`${p.caption} — see Opal's curated picks`}
              data-retail-polaroid={i}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            >
              {/* The paperclip rides on the first polaroid. When the stack is
                  fanned in, all polaroids overlap at the same point and this
                  clip visually fastens the bundle. After fan-out it stays on
                  this one photo. */}
              {i === 0 && (
                <span className="retail-polaroid__clip-wrap" aria-hidden="true">
                  <PolaroidPaperclip />
                </span>
              )}
              <motion.div className="retail-polaroid__photo" layoutId={`polaroid-photo-${i}`}>
                <img src={resolveUrl(p.imageUrl) ?? ''} alt={p.caption} loading="lazy" />
              </motion.div>
              <motion.span className="retail-polaroid__caption" layoutId={`polaroid-caption-${i}`}>
                {p.caption}
              </motion.span>
            </motion.button>
          ))}

          {/* Handwritten "click me" hint, anchored near the stack. Fades after
              the user opens the first polaroid. */}
          {!hintHidden && (
            <div className="retail-collage__hint" aria-hidden="true">
              <svg
                className="retail-collage__hint-arrow"
                viewBox="0 0 120 90"
                width="120"
                height="90"
              >
                <path
                  d="M8 78 C 20 60, 38 40, 70 32 C 86 28, 98 30, 108 28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M100 22 L 108 28 L 102 36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="retail-collage__hint-text">click any photo</span>
            </div>
          )}

          {/* The letter — single laid-flat block. */}
          <article className="retail-letter" data-retail-letter>
            <div className="retail-letter__stamp-corner" aria-hidden="true">
              <OpalStamp size={120} />
            </div>
            <header className="retail-letter__head">
              <span className="retail-letter__date">{letter.dateLine || 'May · MMXXVI'}</span>
            </header>
            <p className="retail-letter__greeting">{letter.greeting}</p>
            <div className="retail-letter__body">
              {letter.paragraphs.map((para, i) => (
                <p key={i} className="retail-letter__paragraph">
                  {para}
                </p>
              ))}
            </div>
            {letter.signoff && <p className="retail-letter__signoff">{letter.signoff}</p>}
          </article>
        </div>

        {/* Lightbox — portalled to <body> so it covers the viewport regardless
            of ancestor stacking / scroll position. layoutId still threads through
            the portal because React context propagates. */}
        {typeof document !== 'undefined' &&
          createPortal(
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
            </AnimatePresence>,
            document.body,
          )}
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
  polaroid: RetailPolaroid;
  products: CuratedProduct[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  countLabel: string;
  register: RetailRegister;
}) {
  const { addToCart, saveForLater, openDrawer } = useCart();
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
        <motion.figure className="retail-look__photo" layoutId={`polaroid-${index}`}>
          <motion.div className="retail-look__photo-inner" layoutId={`polaroid-photo-${index}`}>
            <img src={resolveUrl(polaroid.imageUrl) ?? ''} alt={polaroid.caption} />
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
                      onClick={(e) => addToCart({
                        id: `look-${slugifyName(prod.name)}`,
                        name: prod.name,
                        qualifier: prod.qualifier,
                        imageUrl: img.url,
                        priceLabel: prod.priceLabel,
                        qty: 1,
                        source: 'lookbook',
                        note: `Paired with “${polaroid.caption}”.`,
                      }, originFromEvent(e, img.url))}
                    >
                      Add to bag
                    </button>
                    <button
                      type="button"
                      className="retail-look__btn retail-look__btn--quiet"
                      onClick={() => saveForLater({
                        id: `look-${slugifyName(prod.name)}`,
                        name: prod.name,
                        qualifier: prod.qualifier,
                        imageUrl: img.url,
                        priceLabel: prod.priceLabel,
                        note: 'Held for your next visit.',
                      })}
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
              onClick={(e) => {
                // Add every product in this look to the cart, then open the order summary.
                products.forEach((prod) => {
                  const img = pickImage(prod.name, prod.qualifier, register);
                  addToCart({
                    id: `look-${slugifyName(prod.name)}`,
                    name: prod.name,
                    qualifier: prod.qualifier,
                    imageUrl: img.url,
                    priceLabel: prod.priceLabel,
                    qty: 1,
                    source: 'lookbook',
                    note: `Paired with “${polaroid.caption}”.`,
                  }, originFromEvent(e, img.url));
                });
                onClose();
                window.setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('aurelle:open-order-summary'));
                }, 250);
              }}
            >
              View order summary
            </button>
            <button
              type="button"
              className="retail-look__btn retail-look__btn--quiet retail-look__btn--block"
              onClick={() => {
                products.forEach((prod) => {
                  const img = pickImage(prod.name, prod.qualifier, register);
                  saveForLater({
                    id: `look-${slugifyName(prod.name)}`,
                    name: prod.name,
                    qualifier: prod.qualifier,
                    imageUrl: img.url,
                    priceLabel: prod.priceLabel,
                    note: `From the look around “${polaroid.caption}”.`,
                  });
                });
                onClose();
                window.setTimeout(() => openDrawer('saved'), 250);
              }}
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
