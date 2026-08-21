/**
 * FinServProblems — three-column problem grid. Each column: optional stat,
 * title, description.
 */

import type { FinServProblemsBlock } from '../../lib/graph-types';

interface Props {
  block: FinServProblemsBlock;
}

export default function FinServProblems({ block }: Props) {
  return (
    <section className="finserv-problems" data-finserv-reveal>
      <div className="finserv-problems__inner">
        {(block.label || block.heading) && (
          <div className="finserv-section-head">
            {block.label && <p className="finserv-eyebrow">{block.label}</p>}
            {block.heading && <h2 className="finserv-section-head__title">{block.heading}</h2>}
          </div>
        )}
        <ul className="finserv-problems__grid">
          {block.items.map((item, i) => (
            <li key={i} className="finserv-problem">
              {item.stat && <span className="finserv-problem__stat">{item.stat}</span>}
              <h3 className="finserv-problem__title">{item.title}</h3>
              <p className="finserv-problem__desc">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
