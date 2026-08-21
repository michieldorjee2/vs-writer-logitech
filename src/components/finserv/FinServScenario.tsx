/**
 * FinServScenario — the "Meridian pattern" narrative. Label + title +
 * paragraphs, with an optional pulled-out emphasis line.
 */

import type { FinServScenarioBlock } from '../../lib/graph-types';

interface Props {
  block: FinServScenarioBlock;
}

export default function FinServScenario({ block }: Props) {
  return (
    <section className="finserv-scenario" data-finserv-reveal>
      <div className="finserv-scenario__inner">
        {block.label && <p className="finserv-eyebrow">{block.label}</p>}
        <h2 className="finserv-scenario__title">{block.title}</h2>
        <div className="finserv-scenario__body">
          {block.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {block.pullLine && (
          <p className="finserv-scenario__pull">{block.pullLine}</p>
        )}
      </div>
    </section>
  );
}
