/**
 * SetAside — the atelier-locker section. Quiet centered list with hairline
 * dividers. Two actions. No CTA-banner energy — this reads as a personal
 * gesture, not a conversion mechanism.
 */

import type { SetAsideBlock } from '../../lib/graph-types';

interface Props {
  block: SetAsideBlock;
  primaryCity?: string;
}

export default function SetAside({ block, primaryCity }: Props) {
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
              <span className="retail-setaside__item-desc">{item.descriptor}</span>
            </li>
          ))}
        </ul>

        <div className="retail-setaside__actions">
          <button className="retail-btn">{primary}</button>
          <button className="retail-btn-quiet">{secondary}</button>
        </div>
      </div>
    </section>
  );
}
