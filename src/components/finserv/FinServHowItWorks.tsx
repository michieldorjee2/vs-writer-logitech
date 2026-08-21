/**
 * FinServHowItWorks — numbered 3-step sequence. The `anchorId` lets the
 * B2C "Open an account" CTA scroll here.
 */

import type { FinServHowItWorksBlock } from '../../lib/graph-types';

interface Props {
  block: FinServHowItWorksBlock;
  anchorId?: string;
}

export default function FinServHowItWorks({ block, anchorId }: Props) {
  return (
    <section className="finserv-howitworks" id={anchorId} data-finserv-reveal>
      <div className="finserv-howitworks__inner">
        {(block.label || block.heading) && (
          <div className="finserv-section-head">
            {block.label && <p className="finserv-eyebrow">{block.label}</p>}
            {block.heading && <h2 className="finserv-section-head__title">{block.heading}</h2>}
          </div>
        )}
        <ol className="finserv-steps">
          {block.steps.map((step, i) => (
            <li key={i} className="finserv-step">
              <span className="finserv-step__num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="finserv-step__body">
                <h3 className="finserv-step__title">{step.title}</h3>
                <p className="finserv-step__desc">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
