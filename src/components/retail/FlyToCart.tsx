/**
 * FlyToCart — when a product is added to bag, the product image flies
 * along a quick arc from the click position to the cart icon in the
 * topbar, scaling down and fading at arrival.
 *
 * Listens on the cart context's `flyKey` to retrigger; finds the cart
 * icon at fire-time via a data attribute. No-op if either point is
 * missing.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../lib/retail-cart';

interface Flight {
  key: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  size: number;
  imageUrl: string | null;
}

export default function FlyToCart() {
  const { flyKey, flyOrigin, flyImage, clearFly } = useCart();
  const [flight, setFlight] = useState<Flight | null>(null);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (!flyOrigin || !flyImage || flyKey === 0) return;
    const cartIcon = document.querySelector<HTMLElement>('[data-retail-cart-icon]');
    if (!cartIcon) {
      clearFly();
      return;
    }
    const r = cartIcon.getBoundingClientRect();
    setFlight({
      key: flyKey,
      fromX: flyOrigin.x,
      fromY: flyOrigin.y,
      toX: r.left + r.width / 2,
      toY: r.top + r.height / 2,
      size: Math.min(flyOrigin.size || 96, 140),
      imageUrl: flyImage,
    });
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setFlight(null);
      clearFly();
    }, 850);
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [flyKey, flyOrigin, flyImage, clearFly]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {flight && (
        <motion.div
          key={flight.key}
          className="retail-fly"
          initial={{
            top: flight.fromY,
            left: flight.fromX,
            width: flight.size,
            height: flight.size,
            opacity: 0.95,
            scale: 1,
            x: -flight.size / 2,
            y: -flight.size / 2,
            rotate: 0,
          }}
          animate={{
            top: flight.toY,
            left: flight.toX,
            width: 22,
            height: 22,
            opacity: 0,
            scale: 0.35,
            x: -11,
            y: -11,
            rotate: 35,
          }}
          transition={{ duration: 0.8, ease: [0.55, 0.05, 0.6, 1] }}
          style={{
            position: 'fixed',
            zIndex: 2000,
            pointerEvents: 'none',
            borderRadius: 4,
            backgroundImage: flight.imageUrl ? `url(${flight.imageUrl})` : 'linear-gradient(135deg,#cabfa5,#b89968)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            boxShadow: '0 14px 30px rgba(60,40,20,0.25)',
          }}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
