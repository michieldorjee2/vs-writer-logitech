/**
 * StylistsNote — italic, hand-written-feeling block.
 * Signed by Opal. The body is a personal message addressed to the customer.
 */

import { useState } from 'react';

interface Props {
  body: string;
  signedBy: string;
}

export default function StylistsNote({ body, signedBy }: Props) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [sent, setSent] = useState(false);
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
        {!replying && !sent && (
          <button
            type="button"
            className="retail-link retail-stylistnote__cta"
            onClick={() => setReplying(true)}
          >
            Write back →
          </button>
        )}
        {replying && !sent && (
          <form
            className="retail-stylistnote__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reply.trim()) return;
              setSent(true);
              setReplying(false);
            }}
          >
            <label htmlFor="reply" className="retail-label">A reply to {signedBy}</label>
            <textarea
              id="reply"
              className="retail-stylistnote__textarea"
              rows={4}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="A line or two — Opal reads everything before noon."
              autoFocus
            />
            <div className="retail-stylistnote__form-actions">
              <button type="submit" className="retail-btn" disabled={!reply.trim()}>Send to Opal</button>
              <button type="button" className="retail-btn-quiet" onClick={() => setReplying(false)}>Not now</button>
            </div>
          </form>
        )}
        {sent && (
          <div className="retail-stylistnote__sent" role="status">
            <span className="retail-label-gold">Sent</span>
            <p>Opal has the note. A reply is on its way before the end of the day.</p>
          </div>
        )}
      </div>
    </section>
  );
}
