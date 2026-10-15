import { useEffect, useId, useRef, useState } from 'react';
import { SIGN_OUT_ACTION, type Identity } from '../lib/auth';

function initialsOf(identity: Identity): string {
  const source = identity.name?.trim() || identity.email.split('@')[0].replace(/[._-]+/g, ' ');
  const words = source.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * The search page's corner: who is signed in, and the way out.
 *
 * Log out is a form POST (a GET that signs you out is a link anyone can make
 * you follow), and it lands on /login — /search would sign the person straight
 * back in while their Okta session is still live.
 */
export default function ProfileMenu({ identity }: { identity: Identity }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Ours to handle: the page's own Escape handling exits add mode.
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div className="search-page__profile" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="search-page__avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Signed in as ${identity.name || identity.email}`}
        title={identity.email}
        onClick={() => setOpen((v) => !v)}
      >
        {initialsOf(identity)}
      </button>
      {open && (
        <div className="search-page__profile-menu" id={menuId} role="menu" aria-label="Account">
          <div className="search-page__profile-who">
            {identity.name && <strong>{identity.name}</strong>}
            <span>{identity.email}</span>
          </div>
          <form method="post" action={SIGN_OUT_ACTION}>
            <button type="submit" role="menuitem" className="search-page__profile-item" autoFocus>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
