/**
 * FinServHeader — Brightstream sticky glass nav: wordmark + nav links + login
 * + primary CTA. The CTA stays an <a href> in both SSR and client renders (no
 * hydration mismatch); when `onPrimary` is supplied (client) it intercepts the
 * click to open the modal instead of navigating.
 */

import type { FinServCTA } from '../../lib/graph-types';

interface Props {
  brand: string;
  navLinks?: string[] | null;
  cta?: FinServCTA | null;
  onPrimary?: () => void;
  onLogin?: () => void;
}

export default function FinServHeader({ brand, navLinks, cta, onPrimary, onLogin }: Props) {
  return (
    <header className="finserv-topbar">
      <div className="finserv-topbar__inner">
        <a className="finserv-wordmark" href="#main-content" aria-label={brand}>
          <span className="finserv-wordmark__spark" aria-hidden="true" />
          {brand}
        </a>
        {navLinks && navLinks.length > 0 && (
          <nav className="finserv-nav" aria-label="Primary">
            {navLinks.map((l) => (
              <a key={l} className="finserv-nav__link" href="#main-content">
                {l}
              </a>
            ))}
          </nav>
        )}
        <div className="finserv-topbar__right">
          <button
            type="button"
            className="finserv-topbar__login"
            onClick={onLogin}
          >
            Log in
          </button>
          {cta && (
            <a
              className="finserv-btn finserv-btn--primary finserv-btn--sm"
              href={cta.href}
              onClick={
                onPrimary
                  ? (e) => {
                      e.preventDefault();
                      onPrimary();
                    }
                  : undefined
              }
            >
              {cta.label}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
