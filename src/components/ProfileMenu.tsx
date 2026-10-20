import { useEffect, useId, useRef, useState } from 'react';
import { SIGN_OUT_ACTION, type Identity } from '../lib/auth';
import { gravatarUrl } from '../lib/gravatar';
import { clearOfflineCopies } from '../lib/home-offline';
import type { RunningOffer } from '../lib/offer-looks';

function initialsOf(identity: Identity): string {
  const source = identity.name?.trim() || identity.email.split('@')[0].replace(/[._-]+/g, ' ');
  const words = source.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * The person's Gravatar over their initials. The initials are always drawn, so
 * the corner never sits empty while the photo loads; Gravatar answers 404 for
 * an address with no photo (`d=404`), and the initials are what stays.
 */
function Avatar({ identity, size }: { identity: Identity; size: number }) {
  const [photo, setPhoto] = useState<'loading' | 'shown' | 'none'>('loading');
  return (
    <span className="search-page__avatar-face" aria-hidden="true">
      {photo !== 'shown' && initialsOf(identity)}
      {photo !== 'none' && (
        <img
          className="search-page__avatar-photo"
          src={gravatarUrl(identity.email, size * 2)}
          alt=""
          width={size}
          height={size}
          hidden={photo === 'loading'}
          onLoad={() => setPhoto('shown')}
          onError={() => setPhoto('none')}
        />
      )}
    </span>
  );
}

/** "Michiel" from "Michiel Dorjee", or from michiel.dorjee@… when Opti ID gave no name. */
function firstNameOf(identity: Identity): string {
  const source = identity.name?.trim() || identity.email.split('@')[0].replace(/[._-]+/g, ' ');
  const first = source.split(/\s+/).filter(Boolean)[0] || source;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** "until 5 Nov": when the offer stops running. */
function untilOf(offer: RunningOffer): string {
  const end = new Date(`${offer.windowEnd.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(end.getTime()) ? '' : `until ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}

/**
 * The search page's corner: "Hi, Michiel", which opens who is signed in, the
 * running offers the page can be run as (one at a time), and the way out.
 *
 * Log out is a form POST (a GET that signs you out is a link anyone can make
 * you follow), and it lands on /login — /search would sign the person straight
 * back in while their Okta session is still live.
 */
export default function ProfileMenu({
  identity,
  offers = null,
  chosen = null,
  onChoose,
}: {
  identity: Identity;
  /** Aldus UI's running offers; null until they are read, and none to list when there are none. */
  offers?: RunningOffer[] | null;
  chosen?: string | null;
  onChoose?: (offerId: string | null) => void;
}) {
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
        className="search-page__greeting"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // The name starts with what it shows, so voice control can say it.
        aria-label={`Hi, ${firstNameOf(identity)}: account menu`}
        title={identity.email}
        onClick={() => setOpen((v) => !v)}
      >
        Hi, {firstNameOf(identity)}
        <svg width="7" height="6" viewBox="0 0 7 5.33" aria-hidden="true">
          <path fill="currentColor" d="M.2 1.6C-.29.94.18 0 1 0h5c.82 0 1.29.94.8 1.6L4.3 4.93a1 1 0 0 1-1.6 0z" />
        </svg>
      </button>
      {open && (
        <div className="search-page__profile-menu" id={menuId} role="menu" aria-label="Account">
          <div className="search-page__profile-who">
            <span className="search-page__profile-avatar">
              <Avatar identity={identity} size={36} />
            </span>
            <span className="search-page__profile-id">
              {identity.name && <strong>{identity.name}</strong>}
              <span>{identity.email}</span>
            </span>
          </div>
          {onChoose && offers && offers.length > 0 && (
            <div className="search-page__profile-offers" role="group" aria-labelledby={`${menuId}-offers`}>
              <p className="search-page__profile-heading" id={`${menuId}-offers`}>
                Run this page as
              </p>
              {[null, ...offers].map((offer) => {
                const id = offer?.id ?? null;
                const on = chosen === id;
                return (
                  <button
                    key={id ?? 'none'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    className={'search-page__profile-item search-page__profile-offer' + (on ? ' is-on' : '')}
                    onClick={() => {
                      setOpen(false);
                      if (!on) onChoose(id);
                    }}
                  >
                    <span className="search-page__profile-check" aria-hidden="true">
                      {on && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </span>
                    <span className="search-page__profile-offer-text">
                      <span className="search-page__profile-offer-name">{offer ? offer.title : 'Every account'}</span>
                      <span className="search-page__profile-offer-meta">
                        {offer
                          ? [`${offer.pages.length} ${offer.pages.length === 1 ? 'page' : 'pages'}`, untilOf(offer), offer.look ? null : 'no look yet'].filter(Boolean).join(' · ')
                          : 'The usual search page'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <form
            method="post"
            action={SIGN_OUT_ACTION}
            onSubmit={(e) => {
              // The search page's offline copy holds this person's accounts: it goes before the session does.
              e.preventDefault();
              const form = e.currentTarget;
              void clearOfflineCopies().finally(() => form.submit());
            }}
          >
            <button type="submit" role="menuitem" className="search-page__profile-item" autoFocus={!offers?.length}>
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
