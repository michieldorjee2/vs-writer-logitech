/**
 * RetailHero — full-bleed cinematic hero.
 * Slate plate (image OR designed placeholder) behind, parallax-scrolled.
 * Title splits into words, each word reveals from a clipped band on first paint.
 * Subtitle and meta fade in with stagger after the title lands.
 */

import SlatePlate from './SlatePlate';
import type { RetailHeroBlock, RetailRegister } from '../../lib/graph-types';

interface Props {
  block: RetailHeroBlock;
  monthStamp?: string | null;
  register: RetailRegister;
}

export default function RetailHero({ block, monthStamp, register }: Props) {
  // Split line1 into words; each word wraps in <span> for clipped-band reveal.
  const words = (block.line1 || '').split(/\s+/);

  return (
    <section className="retail-hero">
      <div className="retail-hero__slate">
        <SlatePlate
          imageUrl={block.imageUrl?.default}
          imageDirection={block.imageDirection || undefined}
          itemName={block.line1}
          register={register}
        />
      </div>

      <div className="retail-hero__veil" />

      <div className="retail-hero__content">
        <div className="retail-hero__meta">
          <span className="retail-hero__monogram">Maison Aurelle</span>
          <span className="retail-hero__monogram-rule" />
          {monthStamp && (
            <span className="retail-hero__monogram-stamp">{monthStamp}</span>
          )}
        </div>

        <h1 className="retail-hero__title" aria-label={block.line1}>
          {words.map((word, i) => (
            <span
              key={i}
              className="word"
              style={{ '--word-delay': `${250 + i * 90}ms` } as React.CSSProperties}
            >
              <span>{word}</span>
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>

        {block.line2 && (
          <p className="retail-hero__line2">{block.line2}</p>
        )}
      </div>

      <div className="retail-hero__scrollhint" aria-hidden="true">
        <span>scroll</span>
      </div>
    </section>
  );
}
