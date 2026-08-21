/**
 * FinServModal — the sleek interaction layer, mirroring the live Brightstream
 * site's SavingsApplicationModal (and a parallel "book a meeting" flow for B2B).
 *
 * Client-only (stateful) — imported solely by FinServPage.tsx, never the SSR
 * renderer. Closes on Escape / backdrop click; locks body scroll while open.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import type { FinServSavingsConfig, FinServMeetingConfig, FinServSavingsProduct } from '../../lib/graph-types';

type Kind = 'savings' | 'meeting';

interface Props {
  kind: Kind;
  brand: string;
  targetName?: string | null;
  savings?: FinServSavingsConfig | null;
  meeting?: FinServMeetingConfig | null;
  onClose: () => void;
}

function StepDots({ count, current }: { count: number; current: number }) {
  return (
    <div className="finserv-stepdots" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`finserv-stepdot ${i === current ? 'is-active' : i < current ? 'is-done' : ''}`}
        />
      ))}
    </div>
  );
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function FinServModal({ kind, brand, targetName, savings, meeting, onClose }: Props) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="finserv-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="finserv-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="finserv-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {kind === 'savings' ? (
          <SavingsFlow brand={brand} targetName={targetName} savings={savings} titleId={titleId} onClose={onClose} />
        ) : (
          <MeetingFlow brand={brand} meeting={meeting} titleId={titleId} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/* ---------------- B2C: savings application ------------------------------- */

function SavingsFlow({
  brand,
  targetName,
  savings,
  titleId,
  onClose,
}: {
  brand: string;
  targetName?: string | null;
  savings?: FinServSavingsConfig | null;
  titleId: string;
  onClose: () => void;
}) {
  const products: FinServSavingsProduct[] = savings?.products?.length
    ? savings.products
    : [{ id: 'hysa', name: 'High-Yield Savings', apy: '4.50%', benefit: 'No minimums, no monthly fees.' }];

  const [first, last] = (targetName || '').split(' ');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(products[0].id || products[0].name);
  const [deposit, setDeposit] = useState(savings?.defaultDeposit || '');
  const [form, setForm] = useState({ first: first || '', last: last || '', street: '', city: '', state: '' });
  const [agreed, setAgreed] = useState(false);

  const product = products.find((p) => (p.id || p.name) === selected) || products[0];
  const apyNum = useMemo(() => parseFloat(product.apy.replace(/[^0-9.]/g, '')) / 100 || 0, [product]);
  const depositNum = parseFloat(deposit.replace(/[^0-9.]/g, '')) || 0;
  const projected = depositNum * apyNum;

  const titles = ['Choose your account', 'How much to start?', 'A few details', 'Review & open'];
  const subs = [
    'Hand-picked for you — switch anytime.',
    'Move money in or out whenever you like.',
    `Just the basics to verify it's really you${first ? `, ${first}` : ''}.`,
    'One look, then you’re earning.',
  ];

  if (step === 4) {
    return (
      <div className="finserv-modal__success">
        <div className="finserv-modal__check">✓</div>
        <h2 className="finserv-modal__title" id={titleId}>You’re all set{first ? `, ${first}` : ''}.</h2>
        <p className="finserv-modal__subtitle">
          Your {product.name} account is open and earning {product.apy} APY as of today. We’ve emailed your
          confirmation — no phone call required.
        </p>
        <button type="button" className="finserv-btn finserv-btn--primary" style={{ width: '100%' }} onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  return (
    <>
      <StepDots count={4} current={step} />
      <h2 className="finserv-modal__title" id={titleId}>{titles[step]}</h2>
      <p className="finserv-modal__subtitle">{subs[step]}</p>

      {step === 0 && (
        <div>
          {products.map((p) => {
            const key = p.id || p.name;
            return (
              <button
                key={key}
                type="button"
                className={`finserv-accountcard ${selected === key ? 'is-selected' : ''}`}
                onClick={() => setSelected(key)}
              >
                <div className="finserv-accountcard__row">
                  <span className="finserv-accountcard__name finserv-display">{p.name}</span>
                  <span className="finserv-accountcard__rate finserv-display">
                    {p.apy} <small>APY</small>
                  </span>
                </div>
                <p className="finserv-accountcard__benefit">{p.benefit}</p>
              </button>
            );
          })}
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="finserv-field finserv-deposit">
            <label htmlFor="sa-deposit">Opening deposit</label>
            <span className="finserv-deposit__prefix">$</span>
            <input
              id="sa-deposit"
              inputMode="numeric"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="15,000"
              autoFocus
            />
          </div>
          {depositNum > 0 && (
            <div className="finserv-summary" style={{ marginBottom: 0 }}>
              <div className="finserv-summary__row">
                <span className="finserv-summary__label">Earnings in year one at {product.apy} APY</span>
                <span className="finserv-summary__value finserv-summary__value--accent">
                  +{fmtMoney(projected)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="finserv-field-row">
            <div className="finserv-field">
              <label htmlFor="sa-first">First name</label>
              <input id="sa-first" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
            </div>
            <div className="finserv-field">
              <label htmlFor="sa-last">Last name</label>
              <input id="sa-last" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
            </div>
          </div>
          <div className="finserv-field">
            <label htmlFor="sa-street">Street address</label>
            <input id="sa-street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="123 Main St" />
          </div>
          <div className="finserv-field-row">
            <div className="finserv-field">
              <label htmlFor="sa-city">City</label>
              <input id="sa-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="finserv-field">
              <label htmlFor="sa-state">State</label>
              <input id="sa-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="TX" />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="finserv-summary">
            <div className="finserv-summary__row">
              <span className="finserv-summary__label">Account</span>
              <span className="finserv-summary__value">{product.name}</span>
            </div>
            <div className="finserv-summary__row">
              <span className="finserv-summary__label">Rate</span>
              <span className="finserv-summary__value finserv-summary__value--accent">{product.apy} APY</span>
            </div>
            <div className="finserv-summary__row">
              <span className="finserv-summary__label">Opening deposit</span>
              <span className="finserv-summary__value">{depositNum > 0 ? fmtMoney(depositNum) : '—'}</span>
            </div>
            <div className="finserv-summary__row">
              <span className="finserv-summary__label">Projected year-one interest</span>
              <span className="finserv-summary__value">+{fmtMoney(projected)}</span>
            </div>
          </div>
          <label className="finserv-terms">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I agree to {brand}’s deposit account terms and electronic disclosures, and confirm the information
              above is accurate.
            </span>
          </label>
          <p className="finserv-disclosure">
            {brand} Bank, N.A. Member FDIC. Deposits insured to the maximum allowed by law. APY accurate as of today
            and may change after opening. No monthly fees; no minimum balance.
          </p>
        </div>
      )}

      <div className="finserv-modal__actions">
        {step > 0 && (
          <button type="button" className="finserv-modal__back" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        )}
        <button
          type="button"
          className="finserv-btn finserv-btn--primary"
          disabled={(step === 1 && depositNum <= 0) || (step === 3 && !agreed)}
          onClick={() => setStep(step + 1)}
        >
          {step === 3 ? 'Open my account' : 'Continue'}
        </button>
      </div>
    </>
  );
}

/* ---------------- B2B: book a meeting ------------------------------------ */

function MeetingFlow({
  brand,
  meeting,
  titleId,
  onClose,
}: {
  brand: string;
  meeting?: FinServMeetingConfig | null;
  titleId: string;
  onClose: () => void;
}) {
  const slots = meeting?.slots?.length ? meeting.slots : ['Tue 10:00', 'Wed 14:30', 'Thu 09:00', 'Fri 11:00'];
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ name: meeting?.contactName || '', email: '', company: meeting?.company || '' });
  const [slot, setSlot] = useState(slots[0]);

  if (done) {
    return (
      <div className="finserv-modal__success">
        <div className="finserv-modal__check">✓</div>
        <h2 className="finserv-modal__title" id={titleId}>Your working session is booked.</h2>
        <p className="finserv-modal__subtitle">
          {slot} — a {brand} platform specialist will send a calendar invite with your {form.company || 'institution'}
          {' '}numbers already pulled. No prep needed on your end.
        </p>
        <button type="button" className="finserv-btn finserv-btn--primary" style={{ width: '100%' }} onClick={onClose}>
          Done
        </button>
      </div>
    );
  }

  const ready = form.name.trim() && /.+@.+/.test(form.email);

  return (
    <>
      <h2 className="finserv-modal__title" id={titleId}>Book a working session</h2>
      <p className="finserv-modal__subtitle">
        Thirty focused minutes with a {brand} platform specialist — no slide deck.
      </p>
      <div className="finserv-field">
        <label htmlFor="bk-name">Your name</label>
        <input id="bk-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus />
      </div>
      <div className="finserv-field">
        <label htmlFor="bk-email">Work email</label>
        <input id="bk-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@meridianbank.com" />
      </div>
      <div className="finserv-field">
        <label htmlFor="bk-company">Institution</label>
        <input id="bk-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
      </div>
      <div className="finserv-field">
        <label>Pick a time</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              className={`finserv-accountcard ${slot === s ? 'is-selected' : ''}`}
              style={{ width: 'auto', margin: 0, padding: '0.55rem 1rem' }}
              onClick={() => setSlot(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="finserv-modal__actions">
        <button type="button" className="finserv-btn finserv-btn--primary" disabled={!ready} onClick={() => setDone(true)}>
          Confirm {slot}
        </button>
      </div>
    </>
  );
}
