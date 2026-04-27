import { useCallback, useState } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import XrayMode from './XrayMode';
import '../styles/floating-sidebar.css';

interface Props {
  page: CompetitorComparisonPage;
  /** Which default section registry to use when CMS hasn't set overrides. */
  variant: 'abm' | 'dynamic';
}

/**
 * Booth-only floating action column rendered on top of the content page.
 *   • Back-to-search button: returns the visitor to /search.
 *   • X-ray toggle: reveals the per-section data overlay.
 *
 * Mounted by App.tsx ONLY when `?search=1` is present in the URL — the
 * caller owns that gate, so this component always renders both buttons.
 */
function FloatingSidebar({ page, variant }: Props) {
  const [xrayActive, setXrayActive] = useState(false);

  const handleBack = useCallback(() => {
    // Prefer history back when we can (keeps scroll restoration), otherwise
    // navigate explicitly. window.history.length > 1 isn't reliable across
    // browsers, so we fall back to a hard navigate.
    if (document.referrer && document.referrer.includes('/search')) {
      window.history.back();
    } else {
      window.location.href = '/search';
    }
  }, []);

  return (
    <>
      <aside
        className="xray-sidebar"
        aria-label="Page tools"
      >
        <button
          type="button"
          className="xray-sidebar__btn xray-sidebar__btn--back"
          onClick={handleBack}
          aria-label="Back to search"
          title="Back to search"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span className="xray-sidebar__label">Search</span>
        </button>

        <button
          type="button"
          className={
            'xray-sidebar__btn xray-sidebar__btn--xray' +
            (xrayActive ? ' xray-sidebar__btn--active' : '')
          }
          onClick={() => setXrayActive((v) => !v)}
          aria-pressed={xrayActive}
          aria-label={xrayActive ? 'Exit X-ray mode' : 'Enter X-ray mode'}
          title={xrayActive ? 'Exit X-ray' : 'X-ray this page'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18" />
            <path d="M12 3a14 14 0 0 0 0 18" />
          </svg>
          <span className="xray-sidebar__label">X-ray</span>
        </button>
      </aside>

      <XrayMode
        active={xrayActive}
        onClose={() => setXrayActive(false)}
        page={page}
        variant={variant}
      />
    </>
  );
}

export default FloatingSidebar;
