/**
 * Appointment — paper-card moment.
 * Three variants: named_appointment, intro_appointment, walk_in.
 * Italic boutique name, slot lines as a hairlined list, two actions.
 * Card has gold L-corners for a tipped-in-paper feel.
 */

import type { AppointmentBlock } from '../../lib/graph-types';

const VARIANT_LABEL = {
  named_appointment: 'Your atelier, when you would like',
  intro_appointment: 'An introduction',
  walk_in:           'Or simply arrive',
} as const;

interface Props {
  block: AppointmentBlock;
}

export default function Appointment({ block }: Props) {
  const label = VARIANT_LABEL[block.variant] || 'By appointment';
  const primary = block.primaryAction || (block.variant === 'walk_in' ? 'Plan a visit' : 'Reserve');
  const secondary = block.secondaryAction;

  return (
    <section className="retail-appointment">
      <article className="retail-appointment__card" data-retail-reveal>
        <span className="retail-appointment__label">{label}</span>

        {block.boutique && (
          <h2 className="retail-appointment__boutique">{block.boutique}</h2>
        )}

        {block.variant === 'named_appointment' && block.slotPhrase && (
          <p className="retail-appointment__phrase">{block.slotPhrase}</p>
        )}

        {block.variant === 'intro_appointment' && (
          <p className="retail-appointment__phrase">
            The first session is a conversation, not a sale.
          </p>
        )}

        {block.variant === 'walk_in' && (
          <p className="retail-appointment__phrase">
            By appointment, or without one — given the distance.
          </p>
        )}

        {block.slots && block.slots.length > 0 && (
          <ul className="retail-appointment__slots">
            {block.slots.slice(0, 2).map((s, i) => (
              <li key={i} className="retail-appointment__slot">{s}</li>
            ))}
          </ul>
        )}

        <div className="retail-appointment__actions">
          <button
            type="button"
            className="retail-btn"
            onClick={() => {
              const slots = (block.slots && block.slots.length > 0) ? block.slots : ['By appointment'];
              window.dispatchEvent(new CustomEvent('aurelle:open-reservation', { detail: { slots } }));
            }}
          >
            {primary}
          </button>
          {secondary && (
            <button
              type="button"
              className="retail-btn-quiet"
              onClick={() => {
                // Open reservation with the other slots emphasized
                const slots = (block.slots && block.slots.length > 0) ? block.slots : ['Write to Opal for an alternative time'];
                window.dispatchEvent(new CustomEvent('aurelle:open-reservation', { detail: { slots } }));
              }}
            >
              {secondary}
            </button>
          )}
        </div>
      </article>
    </section>
  );
}
