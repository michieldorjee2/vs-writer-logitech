import { useEffect, useState } from 'react';
import { doneWithHint, takeHint } from '../lib/seen-hints';
import BadgeIcon from './BadgeIcon';
import '../styles/badge-scan.css';

/**
 * The search bar's badge scanner, on every device: a quiet badge icon beside
 * the green go button. It opens the lanyard (BadgeLanyard), where a badge
 * drops down and the camera watches for one, out of sight. SearchHome draws it
 * for anyone signed in.
 *
 * On a rep's first visits it says what it is: "New: Scan a conference badge"
 * hangs off it for a few seconds as it flashes green (seen-hints.ts).
 */
export default function BadgeScanButton({ onOpen, disabled }: { onOpen: () => void; disabled?: boolean }) {
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!takeHint(HINT)) return;
    const show = window.setTimeout(() => setHint(true), HINT_DELAY_MS);
    const hide = window.setTimeout(() => setHint(false), HINT_DELAY_MS + HINT_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);
  return (
    <button
      type="button"
      className={'sh-search__scan' + (hint ? ' is-new' : '')}
      aria-label="Scan a conference badge"
      title="Scan a conference badge"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setHint(false);
        doneWithHint(HINT);
        onOpen();
      }}
    >
      <BadgeIcon />
      {/* On the icon itself, its tail pointing at it, so it is clear what the label is for. */}
      {hint && (
        <span className="sh-search__scan-hint" aria-hidden="true">
          <span className="sh-search__scan-hint-body">
            <b>New:</b> Scan a conference badge
          </span>
        </span>
      )}
    </button>
  );
}

/* The hint's name in seen-hints.ts; when it shows after the page opens, and for how long (badge-scan.css times its wipe, shine and fade to this). */
const HINT = 'badge-scan';
const HINT_DELAY_MS = 700;
const HINT_MS = 5000;
