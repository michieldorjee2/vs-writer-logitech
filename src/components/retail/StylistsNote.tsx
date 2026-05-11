/**
 * StylistsNote — italic, hand-written-feeling block.
 * Signed by Opal. The body is a personal message addressed to the customer.
 */

import { demoToast } from '../../lib/retail-demo-toast';

interface Props {
  body: string;
  signedBy: string;
}

export default function StylistsNote({ body, signedBy }: Props) {
  return (
    <section className="retail-stylistnote" aria-labelledby="stylist-note-heading">
      <div className="retail-stylistnote__inner">
        <span className="retail-label-gold" id="stylist-note-heading" data-retail-hairline>
          A note from Opal
        </span>
        <blockquote className="retail-stylistnote__body" data-retail-reveal>
          {body.split(/\n\s*\n/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </blockquote>
        <div className="retail-stylistnote__sign">
          <span className="retail-stylistnote__rule" aria-hidden="true" />
          <span className="retail-stylistnote__signed">{signedBy}</span>
        </div>
        <button
          type="button"
          className="retail-link retail-stylistnote__cta"
          onClick={() => demoToast('Opal has noted your reply.', 'note')}
        >
          Write back →
        </button>
      </div>
    </section>
  );
}
