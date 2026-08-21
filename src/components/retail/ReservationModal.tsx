/**
 * ReservationModal — opens when a customer taps "Reserve" on the
 * Appointment section. Lists the available slots from the CMS as
 * selectable chips, shows the monogram and boutique, confirms into a
 * wax-seal card.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import OpalStamp from './OpalStamp';
import { useCart } from '../../lib/retail-cart';

interface Props {
  customerName: string;
  initials?: string | null;
  boutique?: string | null;
  stylistName?: string | null;
}

export default function ReservationModal({ customerName, initials, boutique, stylistName }: Props) {
  const { reserve } = useCart();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ slots: string[] }>).detail || { slots: [] };
      setSlots(detail.slots || []);
      setPicked(detail.slots?.[0] || null);
      setConfirmed(false);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('aurelle:open-reservation', onOpen as EventListener);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('aurelle:open-reservation', onOpen as EventListener);
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

  const handleConfirm = () => {
    if (!picked) return;
    reserve(picked, customerName, { boutique: boutique || undefined, initials: initials || undefined });
    setConfirmed(true);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="retail-reserve"
          role="dialog" aria-modal="true" aria-label="Reserve a viewing"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="retail-reserve__card"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 18, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <button type="button" className="retail-reserve__close" onClick={() => setOpen(false)} aria-label="Close">×</button>

            {!confirmed ? (
              <>
                <header className="retail-reserve__head">
                  <span className="retail-reserve__eyebrow">A private viewing</span>
                  <h2 className="retail-reserve__title">Reserve with {stylistName || 'Opal'}</h2>
                  <p className="retail-reserve__sub">
                    {customerName} · {boutique || 'Maison Aurelle'}
                  </p>
                </header>

                <div className="retail-reserve__slots" role="radiogroup" aria-label="Available slots">
                  {slots.length === 0 ? (
                    <p className="retail-reserve__nosllots">No published slots — write to Opal and the cabinet will be opened on your time.</p>
                  ) : (
                    slots.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={picked === s}
                        className={`retail-reserve__slot${picked === s ? ' is-active' : ''}`}
                        onClick={() => setPicked(s)}
                      >
                        {s}
                      </button>
                    ))
                  )}
                </div>

                <p className="retail-reserve__fine">
                  No payment is taken. Opal will confirm by email within the hour, and the cabinet is held for you in the meantime.
                </p>

                <div className="retail-reserve__actions">
                  <button
                    type="button"
                    className="retail-reserve__primary"
                    onClick={handleConfirm}
                    disabled={!picked}
                  >
                    Confirm the slot
                  </button>
                  <button type="button" className="retail-reserve__quiet" onClick={() => setOpen(false)}>
                    Not yet
                  </button>
                </div>
              </>
            ) : (
              <motion.div
                className="retail-reserve__seal-wrap"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              >
                <OpalStamp size={132} />
                <h3 className="retail-reserve__seal-title">{picked} — held</h3>
                <p className="retail-reserve__seal-line">
                  The cabinet is set aside; Opal will be ready when you arrive.
                </p>
                {initials && <span className="retail-reserve__seal-initials">{initials}</span>}
                <button
                  type="button"
                  className="retail-reserve__quiet"
                  onClick={() => setOpen(false)}
                >
                  Close
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
