/**
 * OrderSummaryModal — a paper-card receipt that lists the cart, the
 * shipping context, and a single "Confirm and notify Opal" button.
 * Confirming flips the modal into a wax-seal "Held for you" state and
 * empties the cart.
 *
 * Triggered by the cart drawer's primary button via the custom event
 * "aurelle:open-order-summary".
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OpalStamp from './OpalStamp';
import { useCart, formatPrice, cartTotalCents } from '../../lib/retail-cart';

interface Props {
  customerName: string;
  initials?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  stylistBoutique?: string | null;
}

export default function OrderSummaryModal({
  customerName, initials, city, neighborhood, stylistBoutique,
}: Props) {
  const { cart, removeFromCart, openDrawer, lastAddedAt } = useCart();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  void lastAddedAt; // re-render trigger; no direct read

  useEffect(() => {
    const onOpen = () => { setConfirmed(false); setOpen(true); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('aurelle:open-order-summary', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('aurelle:open-order-summary', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (typeof document === 'undefined') return null;

  const subtotal = cartTotalCents(cart);
  const subtotalLabel =
    subtotal > 0
      ? `$${(subtotal / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
      : 'On request';

  const handleConfirm = () => {
    setConfirmed(true);
    // Empty the cart after a beat so the seal is the focus.
    window.setTimeout(() => {
      cart.forEach((c) => removeFromCart(c.id));
    }, 1100);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="retail-order"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm your order"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="retail-order__card"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <button type="button" className="retail-order__close" onClick={() => setOpen(false)} aria-label="Close">×</button>

            {!confirmed ? (
              <>
                <header className="retail-order__head">
                  <span className="retail-order__eyebrow">Ready for the courier</span>
                  <h2 className="retail-order__title">Your order, summarised</h2>
                  <p className="retail-order__sub">
                    For <strong>{customerName}</strong>{neighborhood ? ` · ${neighborhood}, ${city}` : city ? ` · ${city}` : ''}.
                    {stylistBoutique && (
                      <> Picked from <strong>{stylistBoutique}</strong>.</>
                    )}
                  </p>
                </header>

                <ul className="retail-order__list">
                  {cart.map((item) => (
                    <li key={item.id} className="retail-order__item">
                      <div className="retail-order__thumb"
                           style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                           role="img" aria-label={item.name} />
                      <div className="retail-order__meta">
                        <span className="retail-order__name">{item.name}</span>
                        {item.qualifier && <span className="retail-order__qualifier">{item.qualifier}</span>}
                        <span className="retail-order__qty">× {item.qty}</span>
                      </div>
                      <span className="retail-order__price">{formatPrice(item) || 'On request'}</span>
                    </li>
                  ))}
                </ul>

                <div className="retail-order__line"><span>Subtotal</span><span>{subtotalLabel}</span></div>
                <div className="retail-order__line"><span>Wrapping &amp; courier</span><span>Included</span></div>
                <div className="retail-order__line retail-order__line--total"><span>Total</span><span>{subtotalLabel}</span></div>

                <p className="retail-order__fine">
                  Each piece is wrapped in unbleached linen and travels by appointment courier.
                  No charge until Opal confirms availability — usually within the hour.
                </p>

                <div className="retail-order__actions">
                  <button type="button" className="retail-order__primary" onClick={handleConfirm}>
                    Confirm and notify Opal
                  </button>
                  <button type="button" className="retail-order__quiet" onClick={() => { setOpen(false); openDrawer('cart'); }}>
                    Back to the bag
                  </button>
                </div>
              </>
            ) : (
              <motion.div
                className="retail-order__seal-wrap"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              >
                <OpalStamp size={132} />
                <h3 className="retail-order__seal-title">Held for {customerName.split(' ')[0]}</h3>
                <p className="retail-order__seal-line">
                  Opal will write back within the hour — the pieces are off the floor and on hold.
                </p>
                {initials && <span className="retail-order__seal-initials">{initials}</span>}
                <button
                  type="button"
                  className="retail-order__quiet"
                  onClick={() => setOpen(false)}
                >
                  Continue browsing
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
