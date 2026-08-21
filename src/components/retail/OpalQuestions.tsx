/**
 * OpalQuestions — interactive Q&A module (not a chatbot).
 *
 * Pre-canned questions sit as floating chips around a centered Opal mark.
 * Clicking a chip animates the answer into a card below. Closing collapses
 * back to the chip view. Each answer is a hand-written-feeling reply from
 * Opal — the kind of question a customer would actually ask their stylist
 * over text.
 *
 * Per-customer Q&A bank is keyed by slug in retail-demo-content; falls
 * back to a small generic set when missing.
 */

import { useState } from 'react';
import OpalStamp from './OpalStamp';
import type { OpalQuestion } from '../../lib/graph-types';

interface Props {
  /** Heading line above the chip cloud, e.g. "Ask Opal". */
  heading?: string;
  /** Subhead positioning the section. */
  deck?: string;
  questions: OpalQuestion[];
}

export default function OpalQuestions({
  heading = 'Ask Opal',
  deck = 'A handful of things our clients have asked this week. Tap one to read what Opal had to say.',
  questions,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!questions?.length) return null;

  return (
    <section className="retail-questions" aria-labelledby="opal-questions-heading">
      <div className="retail-questions__inner">
        <div className="retail-questions__head">
          <OpalStamp size={64} className="retail-questions__stamp" />
          <h2 id="opal-questions-heading" className="retail-questions__heading">
            {heading}
          </h2>
          <p className="retail-questions__deck">{deck}</p>
        </div>

        <ul className="retail-questions__cloud" role="list">
          {questions.map((qa, i) => (
            <li key={i} className="retail-questions__chip-wrap">
              <button
                type="button"
                className={`retail-questions__chip${activeIndex === i ? ' is-active' : ''}`}
                onClick={() => setActiveIndex((curr) => (curr === i ? null : i))}
                aria-expanded={activeIndex === i}
                aria-controls={`opal-answer-${i}`}
              >
                <span className="retail-questions__chip-q">{qa.question}</span>
                <span className="retail-questions__chip-arrow" aria-hidden="true">
                  {activeIndex === i ? '−' : '+'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Answer card */}
        <div
          className={`retail-questions__panel${activeIndex !== null ? ' is-open' : ''}`}
          id={activeIndex !== null ? `opal-answer-${activeIndex}` : undefined}
          aria-live="polite"
        >
          {activeIndex !== null && (
            <>
              <p className="retail-questions__panel-q">{questions[activeIndex].question}</p>
              <p className="retail-questions__panel-a">{questions[activeIndex].answer}</p>
              <span className="retail-questions__panel-signed">— Opal</span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
