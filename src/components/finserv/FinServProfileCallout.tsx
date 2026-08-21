/**
 * FinServProfileCallout — full-width navy pull-quote with a gold quote mark.
 * For B2B it profiles the prospect; for B2C it reads as a saver testimonial.
 */

import type { FinServProfileBlock } from '../../lib/graph-types';

interface Props {
  block: FinServProfileBlock;
}

export default function FinServProfileCallout({ block }: Props) {
  const attributionLine = [block.role, block.company].filter(Boolean).join(' · ');
  return (
    <section className="finserv-callout" data-finserv-reveal>
      <div className="finserv-callout__inner">
        <span className="finserv-callout__mark finserv-display" aria-hidden="true">&ldquo;</span>
        <blockquote className="finserv-callout__quote">{block.quote}</blockquote>
        {(block.attribution || attributionLine) && (
          <figcaption className="finserv-callout__attr">
            {block.initials && (
              <span className="finserv-callout__avatar" aria-hidden="true">
                {block.initials}
              </span>
            )}
            <span className="finserv-callout__who">
              {block.attribution && <span className="finserv-callout__name">{block.attribution}</span>}
              {attributionLine && <span className="finserv-callout__role">{attributionLine}</span>}
            </span>
          </figcaption>
        )}
      </div>
    </section>
  );
}
