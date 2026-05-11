/**
 * HeldForYou — horizontal lookbook (3 frames, image-led).
 * Each frame is its own slate with caption beneath. Stagger reveal on scroll.
 * Frames hover-zoom subtly; price reveals on hover.
 */

import SlatePlate from './SlatePlate';
import type { HeldForYouBlock, RetailRegister } from '../../lib/graph-types';

function formatPrice(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

interface Props {
  block: HeldForYouBlock;
  register: RetailRegister;
}

export default function HeldForYou({ block, register }: Props) {
  return (
    <section className="retail-heldforyou">
      <div className="retail-heldforyou__head">
        <h2 className="retail-heldforyou__title" data-retail-reveal>
          Held for you
        </h2>
        {block.header && (
          <span className="retail-heldforyou__by" data-retail-reveal data-retail-delay="120">
            {block.header}
          </span>
        )}
      </div>

      <div className="retail-heldforyou__lookbook">
        {block.items.slice(0, 3).map((item, i) => (
          <article
            key={i}
            className="retail-heldforyou__frame"
            data-cursor-label="view"
          >
            <div className="retail-heldforyou__slate" data-retail-mask>
              <SlatePlate
                imageUrl={item.imageUrl?.default}
                imageDirection={item.imageDirection || undefined}
                register={register}
                marker={String(i + 1).padStart(2, '0')}
              />
            </div>
            <div className="retail-heldforyou__caption">
              <span className="retail-heldforyou__no">N° {String(i + 1).padStart(2, '0')}</span>
              <h3 className="retail-heldforyou__name">{item.name}</h3>
              <p className="retail-heldforyou__desc">{item.descriptor}</p>
              {item.priceCents != null && item.priceVisibility !== 'hidden' && (
                <span className="retail-heldforyou__price">
                  {formatPrice(item.priceCents)}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
