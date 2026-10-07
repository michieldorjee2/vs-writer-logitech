/**
 * CartIcon — a delicate leather satchel SVG with a gold count badge.
 * Sits in the retail topbar; clicking it opens the drawer.
 * The badge pulses whenever the cart count changes.
 */

import { useEffect, useRef, useState } from 'react';
import { useCart } from '../../lib/retail-cart';

export default function CartIcon() {
  const { cart, saved, openDrawer, lastAddedAt, lastSavedAt } = useCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const savedCount = saved.length;
  const ref = useRef<HTMLButtonElement>(null);
  const [pulse, setPulse] = useState(false);

  // Pulse whenever either timestamp moves. The two are keyed together rather
  // than max()'d, so a save older than the last add still pulses. `prevStamp`
  // starts at the both-zero key, so mounting with something already added
  // pulses once, as the old effect did.
  const stamp = `${lastAddedAt}|${lastSavedAt}`;
  const [prevStamp, setPrevStamp] = useState('0|0');
  if (stamp !== prevStamp) {
    setPrevStamp(stamp);
    if (lastAddedAt || lastSavedAt) setPulse(true);
  }

  useEffect(() => {
    if (!pulse) return;
    const t = window.setTimeout(() => setPulse(false), 800);
    return () => window.clearTimeout(t);
  }, [pulse, stamp]);

  return (
    <button
      ref={ref}
      type="button"
      className={`retail-cart-icon${pulse ? ' is-pulse' : ''}${count > 0 ? ' has-items' : ''}`}
      aria-label={`Open your atelier — ${count} in bag, ${savedCount} held`}
      onClick={() => openDrawer('cart')}
      data-retail-cart-icon
    >
      {/* Satchel — minimal line drawing */}
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
        <path
          d="M7 10 H25 V25 Q25 27 23 27 H9 Q7 27 7 25 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M11 10 Q11 6 16 6 Q21 6 21 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M11 14 H21"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.5"
        />
      </svg>
      <span className="retail-cart-icon__label">Atelier</span>
      {(count > 0 || savedCount > 0) && (
        <span className="retail-cart-icon__badge" aria-hidden="true">
          {count > 0 ? count : `·${savedCount}`}
        </span>
      )}
    </button>
  );
}
