/**
 * StylistsNote — italic, hand-written-feeling block.
 * Signed; the body is a personal message from the stylist to the customer.
 * The single named human attribution on the page lives here in v3.
 */

interface Props {
  body: string;
  signedBy: string;
  contactHref?: string;
}

export default function StylistsNote({ body, signedBy, contactHref }: Props) {
  return (
    <section className="retail-stylistnote" aria-labelledby="stylist-note-heading">
      <div className="retail-stylistnote__inner">
        <span className="retail-label-gold" id="stylist-note-heading" data-retail-hairline>
          A note from your atelier
        </span>
        <blockquote className="retail-stylistnote__body" data-retail-reveal>
          {body.split(/\n\s*\n/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </blockquote>
        <div className="retail-stylistnote__sign">
          <span className="retail-stylistnote__rule" aria-hidden="true" />
          <span className="retail-stylistnote__signed">— {signedBy}</span>
        </div>
        {contactHref && (
          <a className="retail-link retail-stylistnote__cta" href={contactHref}>
            Write back →
          </a>
        )}
      </div>
    </section>
  );
}
