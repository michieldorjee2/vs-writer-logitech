import { useRef } from 'react';
import '../styles/badge-scan.css';

/**
 * The search bar's camera (phones): opens the back camera, and hands the photo
 * of a badge to Mark to read (usePageRequest's scan). A quiet icon, so the
 * green go button stays the one thing to press. SearchHome draws it only when
 * the badge reader is set up (useBadgeReady).
 */
export default function BadgeScanButton({ onPhoto, disabled }: { onPhoto: (file: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        className="sh-search__scan"
        aria-label="Scan a badge"
        title="Scan a badge"
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => input.current?.click()}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </button>
      <input
        ref={input}
        className="sh-search__scan-input"
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared, so the same photo can be picked again after a cancel.
          e.target.value = '';
          if (file) onPhoto(file);
        }}
      />
    </>
  );
}
