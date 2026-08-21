/**
 * FinServFooter — Brightstream footer: wordmark + tagline, trust badges, legal.
 */

import type { FinServFooterBlock } from '../../lib/graph-types';

interface Props {
  brand: string;
  tagline?: string | null;
  block?: FinServFooterBlock | null;
}

export default function FinServFooter({ brand, tagline, block }: Props) {
  return (
    <footer className="finserv-footer">
      <div className="finserv-footer__inner">
        <div className="finserv-footer__top">
          <div className="finserv-footer__brand">
            <span className="finserv-footer__mark">{brand}</span>
            {tagline && <p className="finserv-footer__tag">{tagline}</p>}
          </div>
          {block?.badges && block.badges.length > 0 && (
            <ul className="finserv-footer__badges" aria-label="Certifications">
              {block.badges.map((b) => (
                <li key={b} className="finserv-badge">
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        {block?.legal && <p className="finserv-footer__legal">{block.legal}</p>}
      </div>
    </footer>
  );
}
