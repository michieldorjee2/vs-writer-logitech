/**
 * HeldForYou — horizontal lookbook (3 frames, image-led).
 * Each frame is its own slate with caption beneath. Stagger reveal on scroll.
 * Frames hover-zoom subtly; price reveals on hover.
 */

import SlatePlate from './SlatePlate';
import type { HeldForYouBlock, RetailRegister } from '../../lib/graph-types';

import { demoToast } from '../../lib/retail-demo-toast';

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
        {block.items.slice(0, 3).map((item, i) => {
          const anchor = `held-${i + 1}`;
          return (
            <article
              key={i}
              className="retail-heldforyou__frame"
              id={anchor}
              aria-labelledby={`${anchor}-name`}
            >
              <div className="retail-heldforyou__slate" data-retail-mask>
                <SlatePlate
                  imageUrl={item.imageUrl?.default}
                  imageDirection={item.imageDirection || undefined}
                  itemName={`${item.name} ${item.descriptor || ''}`}
                  register={register}
                />
              </div>
              <div className="retail-heldforyou__caption">
                <span className="retail-heldforyou__no">N° {String(i + 1).padStart(2, '0')}</span>
                <h3 id={`${anchor}-name`} className="retail-heldforyou__name">{item.name}</h3>
                {item.descriptor && (
                  <p className="retail-heldforyou__desc">{item.descriptor}</p>
                )}
                {item.priceCents != null && item.priceVisibility !== 'hidden' && (
                  <span className="retail-heldforyou__price">
                    {formatPrice(item.priceCents)}
                  </span>
                )}
                <div className="retail-heldforyou__actions">
                  <button
                    type="button"
                    className="retail-heldforyou__btn"
                    onClick={() => demoToast(`${item.name} added to your bag.`, 'success')}
                  >
                    Add to bag
                  </button>
                  <button
                    type="button"
                    className="retail-heldforyou__btn retail-heldforyou__btn--quiet"
                    onClick={() => demoToast(`${item.name} saved to your list.`, 'note')}
                    aria-label={`Save ${item.name}`}
                  >
                    ♡ Save
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
