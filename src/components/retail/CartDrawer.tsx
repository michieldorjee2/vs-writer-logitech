/**
 * CartDrawer — slide-out from the right showing three tabs of personal
 * state: the active cart, items held for next visit, and confirmed
 * reservations. Designed to read like a courier's docket rather than a
 * generic e-commerce sidebar — cream paper, ink rules, brushed-gold
 * details, italic display heads.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useCart, formatPrice, cartTotalCents, type DrawerTab } from '../../lib/retail-cart';

interface Props {
  customerName: string;
  initials?: string | null;
  city?: string | null;
  boutique?: string | null;
}

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'cart', label: 'In your bag' },
  { id: 'saved', label: 'Held for you' },
  { id: 'reservations', label: 'Appointments' },
];

export default function CartDrawer({ customerName, initials, city, boutique }: Props) {
  const {
    cart, saved, reservations,
    drawerOpen, drawerTab, setDrawerTab, closeDrawer,
    removeFromCart, setQty, unsave, cancelReservation,
  } = useCart();

  // ESC to close, body scroll-lock while open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, closeDrawer]);

  if (typeof document === 'undefined') return null;

  const subtotal = cartTotalCents(cart);
  const subtotalLabel =
    subtotal > 0
      ? `$${(subtotal / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
      : 'On request';

  return createPortal(
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            className="retail-drawer__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={closeDrawer}
          />

          <motion.aside
            className="retail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your atelier — held items, bag, and appointments"
            initial={{ x: '105%' }}
            animate={{ x: 0 }}
            exit={{ x: '105%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          >
            <header className="retail-drawer__head">
              <div className="retail-drawer__monogram">
                <span className="retail-drawer__monogram-eyebrow">For</span>
                <span className="retail-drawer__monogram-initials">{initials || customerName.split(' ').map(n => n[0]).join('.').toUpperCase()}</span>
                {(city || boutique) && (
                  <span className="retail-drawer__monogram-where">
                    {boutique || ''}{boutique && city ? ' · ' : ''}{city || ''}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="retail-drawer__close"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                ×
              </button>
            </header>

            <nav className="retail-drawer__tabs" aria-label="Drawer sections">
              {TABS.map((t) => {
                const count =
                  t.id === 'cart' ? cart.reduce((s, i) => s + i.qty, 0)
                  : t.id === 'saved' ? saved.length
                  : reservations.length;
                return (
                  <button
                    type="button"
                    key={t.id}
                    className={`retail-drawer__tab${drawerTab === t.id ? ' is-active' : ''}`}
                    onClick={() => setDrawerTab(t.id)}
                  >
                    <span className="retail-drawer__tab-label">{t.label}</span>
                    <span className="retail-drawer__tab-count">{count}</span>
                  </button>
                );
              })}
            </nav>

            <div className="retail-drawer__body">
              {drawerTab === 'cart' && (
                cart.length === 0 ? (
                  <div className="retail-drawer__empty">
                    <p className="retail-drawer__empty-title">Your bag is set down for now.</p>
                    <p className="retail-drawer__empty-line">Tap “Add to bag” on any piece and it will arrive here, ready for the courier.</p>
                  </div>
                ) : (
                  <ul className="retail-drawer__list">
                    {cart.map((item) => (
                      <li key={item.id} className="retail-drawer__item">
                        <div className="retail-drawer__thumb"
                             style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                             role="img" aria-label={item.name} />
                        <div className="retail-drawer__meta">
                          <span className="retail-drawer__name">{item.name}</span>
                          {item.qualifier && <span className="retail-drawer__qualifier">{item.qualifier}</span>}
                          {item.note && <span className="retail-drawer__note">{item.note}</span>}
                          <span className="retail-drawer__price">{formatPrice(item) || 'On request'}</span>
                          <div className="retail-drawer__qty">
                            <button type="button" className="retail-drawer__qty-btn" aria-label="One fewer" onClick={() => setQty(item.id, item.qty - 1)}>−</button>
                            <span className="retail-drawer__qty-num">{item.qty}</span>
                            <button type="button" className="retail-drawer__qty-btn" aria-label="One more" onClick={() => setQty(item.id, item.qty + 1)}>+</button>
                            <button type="button" className="retail-drawer__remove" aria-label="Remove from bag" onClick={() => removeFromCart(item.id)}>Remove</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {drawerTab === 'saved' && (
                saved.length === 0 ? (
                  <div className="retail-drawer__empty">
                    <p className="retail-drawer__empty-title">Nothing held for next visit yet.</p>
                    <p className="retail-drawer__empty-line">The “Save” button next to any piece puts it here, against your account, no obligation.</p>
                  </div>
                ) : (
                  <ul className="retail-drawer__list">
                    {saved.map((s) => (
                      <li key={s.id} className="retail-drawer__item">
                        <div className="retail-drawer__thumb"
                             style={s.imageUrl ? { backgroundImage: `url(${s.imageUrl})` } : undefined}
                             role="img" aria-label={s.name} />
                        <div className="retail-drawer__meta">
                          <span className="retail-drawer__name">{s.name}</span>
                          {s.qualifier && <span className="retail-drawer__qualifier">{s.qualifier}</span>}
                          {s.note && <span className="retail-drawer__note">{s.note}</span>}
                          {s.priceLabel && <span className="retail-drawer__price">{s.priceLabel}</span>}
                          <button type="button" className="retail-drawer__remove" onClick={() => unsave(s.id)}>Release</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {drawerTab === 'reservations' && (
                reservations.length === 0 ? (
                  <div className="retail-drawer__empty">
                    <p className="retail-drawer__empty-title">No appointments yet.</p>
                    <p className="retail-drawer__empty-line">Reserve a viewing in the Appointments section below — Opal confirms within the hour.</p>
                  </div>
                ) : (
                  <ul className="retail-drawer__list retail-drawer__list--reservations">
                    {reservations.map((r) => (
                      <li key={r.id} className="retail-drawer__reservation">
                        <div className="retail-drawer__seal" aria-hidden="true">
                          <span className="retail-drawer__seal-initials">{r.initials || initials || 'M·A'}</span>
                          <span className="retail-drawer__seal-stamp">Held</span>
                        </div>
                        <div>
                          <span className="retail-drawer__name">{r.slot}</span>
                          {r.boutique && <span className="retail-drawer__qualifier">{r.boutique}</span>}
                          <span className="retail-drawer__note">Confirmed {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <button type="button" className="retail-drawer__remove" onClick={() => cancelReservation(r.id)}>Cancel</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>

            {drawerTab === 'cart' && cart.length > 0 && (
              <footer className="retail-drawer__foot">
                <div className="retail-drawer__totals">
                  <span className="retail-drawer__totals-label">Subtotal</span>
                  <span className="retail-drawer__totals-value">{subtotalLabel}</span>
                </div>
                <p className="retail-drawer__totals-fine">
                  Each piece is wrapped in unbleached linen and delivered by appointment.
                </p>
                <button
                  type="button"
                  className="retail-drawer__primary"
                  onClick={() => {
                    const ev = new CustomEvent('aurelle:open-order-summary');
                    window.dispatchEvent(ev);
                    closeDrawer();
                  }}
                >
                  Send to Opal for confirmation
                </button>
                <button
                  type="button"
                  className="retail-drawer__quiet"
                  onClick={closeDrawer}
                >
                  Continue browsing
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
