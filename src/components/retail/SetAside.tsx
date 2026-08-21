/**
 * SetAside — the atelier-locker section. Quiet centered list with hairline
 * dividers. Two actions. No CTA-banner energy — this reads as a personal
 * gesture, not a conversion mechanism.
 */

import type { SetAsideBlock } from '../../lib/graph-types';
import { useCart, originFromEvent, slugifyName } from '../../lib/retail-cart';

interface Props {
  block: SetAsideBlock;
  primaryCity?: string;
}

export default function SetAside({ block, primaryCity }: Props) {
  const { addToCart, openDrawer } = useCart();
  if (!block.items?.length) return null;

  const primary = block.primaryAction || 'Reserve a viewing';
  const secondary = block.secondaryAction || (primaryCity ? `Or, send to ${primaryCity}` : 'Or, send to your address');

  return (
    <section className="retail-setaside">
      <div className="retail-setaside__inner">
        <span className="retail-setaside__label" data-retail-hairline>
          Set aside, on your account
        </span>

        <ul className="retail-setaside__items">
          {block.items.map((item, i) => (
            <li key={i} className="retail-setaside__item" data-retail-reveal data-retail-delay={`${i * 80}`}>
              <span className="retail-setaside__item-name">{item.name}</span>
              {item.descriptor && (
                <span className="retail-setaside__item-desc">{item.descriptor}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="retail-setaside__actions">
          <button
            type="button"
            className="retail-btn"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('aurelle:open-reservation', {
                detail: { slots: ['Reserve a private viewing', 'Open the cabinet on your time'] },
              }));
            }}
          >
            {primary}
          </button>
          <button
            type="button"
            className="retail-btn-quiet"
            onClick={(e) => {
              block.items.forEach((it) => addToCart({
                id: `setaside-${slugifyName(it.name)}`,
                name: it.name,
                qualifier: it.descriptor || null,
                imageUrl: it.imageUrl?.default || null,
                qty: 1,
                source: 'set-aside',
                note: it.privateProvenance || `Sent to ${primaryCity || 'your address'} in linen wrapping.`,
              }, originFromEvent(e, it.imageUrl?.default || null)));
              openDrawer('cart');
            }}
          >
            {secondary}
          </button>
        </div>
      </div>
    </section>
  );
}
