import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizeVuid } from '../lib/page-activity';
import { SHARE_PARAM, SHARE_SESSION_KEY, firstNameOf, type ShareNote } from '../lib/share-links';
import { isStaffBrowser } from '../lib/staff-marker';
import { lockScroll } from '../lib/scroll-lock';
import { Button } from '../vendor/www/components/_ui/button';
import '../styles/invite-note.css';

/**
 * The recipient's side of a personal link (src/lib/share-links.ts): /s/<code> lands on the page
 * with ?p=<code>, and the rep's note floats down over the page before it is read. "Open your page"
 * (the page's own primary CTA) puts the note away and takes the code out of the address, so a
 * reload is just the page.
 *
 * Shown, it tells the site the note was opened (api/share-note.ts), which counts it on the link
 * and sends ODP `personal_link_open`; never for a signed-in Optimizely person, who can look at
 * their own note without counting as the reader. The code stays for the tab (sessionStorage), so
 * a CTA click later says which link the visitor came by (src/lib/cta-ping.ts).
 *
 * A code that isn't this page's, or a note that doesn't load, is no note: the page as it is.
 */

interface Props {
  code: string;
}

/** The ODP visitor id, once the SDK has one (up to five seconds), or null. */
function waitForVuid(): Promise<string | null> {
  return new Promise((resolve) => {
    let tries = 0;
    const look = () => {
      const vuid = normalizeVuid((window as unknown as { zaius?: { VUID?: string } }).zaius?.VUID);
      if (vuid || ++tries >= 10) return resolve(vuid);
      window.setTimeout(look, 500);
    };
    look();
  });
}

/** The address without ?p=, the rest kept. */
function withoutCode(): string {
  const u = new URL(window.location.href);
  u.searchParams.delete(SHARE_PARAM);
  return u.pathname + (u.searchParams.toString() ? `?${u.searchParams.toString()}` : '') + u.hash;
}

export default function InviteNote({ code }: Props) {
  const [note, setNote] = useState<ShareNote | null>(null);
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');
  const button = useRef<HTMLButtonElement>(null);
  const ids = useId();

  useEffect(() => {
    const ctrl = new AbortController();
    const page = window.location.pathname;
    fetch(`/api/share-note?code=${encodeURIComponent(code)}&page=${encodeURIComponent(page)}`, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<ShareNote>) : Promise.reject(new Error(String(res.status)))))
      .then((n) => {
        if (!n?.message) return;
        setNote(n);
        try {
          sessionStorage.setItem(SHARE_SESSION_KEY, code);
        } catch {
          /* private window: the CTA just doesn't name the link */
        }
        if (isStaffBrowser()) return;
        void waitForVuid().then((vuid) =>
          fetch('/api/share-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            keepalive: true,
            body: JSON.stringify({ code, page, ...(vuid ? { vuid } : {}) }),
          }).catch(() => {}),
        );
      })
      .catch(() => {
        /* no note: the page as it is */
      });
    return () => ctrl.abort();
  }, [code]);

  const shown = note !== null && phase !== 'gone';

  // The page waits under the note: no scrolling it, and the note has the focus.
  useEffect(() => {
    if (!shown) return;
    const release = lockScroll('invite-open');
    const id = window.setTimeout(() => button.current?.focus({ preventScroll: true }), 900);
    return () => {
      window.clearTimeout(id);
      release();
    };
  }, [shown]);

  const openPage = useCallback(() => {
    setPhase('out');
    window.history.replaceState(window.history.state, '', withoutCode());
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => setPhase('gone'), reduced ? 0 : 560);
  }, []);

  useEffect(() => {
    if (!shown || phase !== 'in') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openPage();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, phase, openPage]);

  if (!shown || typeof document === 'undefined') return null;
  const first = firstNameOf(note.to.name);

  return createPortal(
    <div className={'invite-view is-' + phase} role="dialog" aria-modal="true" aria-labelledby={`${ids}-from`} aria-describedby={`${ids}-msg`}>
      <article className="invite-note">
        <span className="invite-note__tape" aria-hidden="true" />
        <header className="invite-note__head">
          <img className="invite-note__logo" src="/optimizely-logo.svg" alt="Optimizely" width="131" height="32" />
        </header>
        <p id={`${ids}-msg`} className="invite-note__msg">
          {note.message}
        </p>
        <footer className="invite-note__foot">
          <span id={`${ids}-from`} className="invite-note__from">
            <span className="invite-note__sr">A note from </span>
            {note.from.name}
          </span>
          <Button ref={button} variant="primary" className="www-btn invite-note__open" onClick={openPage}>
            {first ? `Open your page, ${first}` : 'Open your page'}
          </Button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
