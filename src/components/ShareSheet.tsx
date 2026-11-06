import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CompetitorComparisonPage, PersonPage } from '../lib/graph-types';
import { deriveCustomerName } from '../lib/page-identity';
import { copyText } from '../lib/clipboard';
import { checkShareInput, SHARE_LIMITS, type ShareRecipient } from '../lib/share-links';
import type { ShareLinksLoad } from '../hooks/useShareLinks';
import SharedLinks from './SharedLinks';
import '../styles/activity-mode.css';
import '../styles/share-sheet.css';

/**
 * The rail's Share: a card over the page, as the Report is (FloatingSidebar.tsx).
 *
 *   • The link: the page's public address, or, once the rep adds a personal message, a short link
 *     (/s/<code>, api/share-links.ts) that opens on their note to that person (InviteNote.tsx).
 *     Every way out below then shares the personal link.
 *   • Copy link.
 *   • Send on Teams: Mark messages the rep (only them) the link with what the page has seen
 *     (api/share-send.ts, mark/share-teams/).
 *   • New email: Mark writes the email, from the rep's note when there is one; the rep reads it
 *     here and opens it in Outlook as a new message.
 *
 * On a person page the recipient's name and title are filled in from the page, and the page's
 * links are listed here (person pages have no Report).
 */

interface Props {
  open: boolean;
  onClose: () => void;
  page: CompetitorComparisonPage;
  variant: 'abm' | 'person';
  links: ShareLinksLoad;
  onLinkMade: () => void;
}

interface Personal {
  code: string;
  url: string;
  recipient: ShareRecipient;
  message: string;
}

interface Draft {
  to: string;
  subject: string;
  body: string;
  by: 'mark' | 'template';
}

type Step<T = undefined> = { s: 'idle' } | { s: 'busy' } | { s: 'done'; value: T } | { s: 'error'; message: string };

const stripTags = (html: string | null | undefined): string => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** What the page is called and what it says, for Mark: the account's name, or whose page it is. */
function pageAbout(page: CompetitorComparisonPage, variant: 'abm' | 'person'): { title: string; summary: string } {
  if (variant === 'person') {
    const p = page as unknown as PersonPage;
    return {
      title: [p.personName, p.companyName].filter(Boolean).join(' at ') || 'their page',
      summary: stripTags(p.heroHeadline).slice(0, 400),
    };
  }
  return { title: deriveCustomerName(page), summary: stripTags(page.intelHeadline || page.headline).slice(0, 400) };
}

/** A new message in Outlook on the web, filled in. */
function outlookHref(d: { to: string; subject: string; body: string }): string {
  const q = [
    d.to ? `to=${encodeURIComponent(d.to)}` : '',
    `subject=${encodeURIComponent(d.subject)}`,
    `body=${encodeURIComponent(d.body)}`,
  ].filter(Boolean);
  return `https://outlook.office.com/mail/deeplink/compose?${q.join('&')}`;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; field?: string };
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { field: data.field });
  return data;
}

export default function ShareSheet({ open, onClose, page, variant, links, onLinkMade }: Props) {
  const card = useRef<HTMLElement>(null);
  const ids = useId();
  const route = useMemo(() => (typeof window === 'undefined' ? '/' : window.location.pathname), []);
  const publicUrl = useMemo(() => (typeof window === 'undefined' ? '' : window.location.origin + route), [route]);
  const about = useMemo(() => pageAbout(page, variant), [page, variant]);
  const prefill = useMemo<ShareRecipient>(() => {
    if (variant !== 'person') return { name: '', title: '', email: '' };
    const p = page as unknown as PersonPage;
    return { name: p.personName ?? '', title: p.personTitle ?? '', email: '' };
  }, [page, variant]);

  const [personal, setPersonal] = useState<Personal | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [fields, setFields] = useState({ ...prefill, message: '' });
  const [fieldError, setFieldError] = useState<{ field: string; error: string } | null>(null);
  const [making, setMaking] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [teams, setTeams] = useState<Step>({ s: 'idle' });
  const [email, setEmail] = useState<Step<Draft>>({ s: 'idle' });
  const copyTimer = useRef<number | undefined>(undefined);

  const link = personal?.url ?? publicUrl;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('activity-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('activity-open');
      before?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  /** A new link (or none): what was sent or drafted for the old one no longer applies. */
  const switchLink = useCallback((next: Personal | null) => {
    setPersonal(next);
    setTeams({ s: 'idle' });
    setEmail({ s: 'idle' });
    setCopied('idle');
  }, []);

  const onCopy = useCallback(() => {
    void copyText(link).then((ok) => {
      setCopied(ok ? 'copied' : 'failed');
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied('idle'), 1800);
    });
  }, [link]);

  const onMake = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const input = { route, recipient: { name: fields.name, title: fields.title, email: fields.email }, message: fields.message };
      const checked = checkShareInput(input);
      // 'error' in: the app's tsconfig isn't strict, so `ok` alone doesn't narrow the union.
      if ('error' in checked) return setFieldError({ field: checked.field, error: checked.error });
      setFieldError(null);
      setMaking(true);
      try {
        const made = await postJson<{ code: string; url: string }>('/api/share-links', input);
        switchLink({ code: made.code, url: made.url, recipient: checked.value.recipient, message: checked.value.message });
        setFormOpen(false);
        onLinkMade();
      } catch (err) {
        const field = (err as { field?: string }).field;
        setFieldError({ field: field || 'form', error: err instanceof Error ? err.message : 'Could not make the link' });
      } finally {
        setMaking(false);
      }
    },
    [fields, route, switchLink, onLinkMade],
  );

  const onTeams = useCallback(async () => {
    setTeams({ s: 'busy' });
    try {
      await postJson('/api/share-send', { channel: 'teams', route, code: personal?.code ?? null, title: about.title, summary: about.summary });
      setTeams({ s: 'done', value: undefined });
    } catch (err) {
      setTeams({ s: 'error', message: err instanceof Error ? err.message : 'Not sent' });
    }
  }, [route, personal, about]);

  const onEmail = useCallback(async () => {
    setEmail({ s: 'busy' });
    try {
      const draft = await postJson<Draft>('/api/share-send', { channel: 'email', route, code: personal?.code ?? null, title: about.title, summary: about.summary });
      setEmail({ s: 'done', value: draft });
    } catch (err) {
      setEmail({ s: 'error', message: err instanceof Error ? err.message : 'No draft' });
    }
  }, [route, personal, about]);

  const setDraft = (patch: Partial<Draft>) => setEmail((prev) => (prev.s === 'done' ? { s: 'done', value: { ...prev.value, ...patch } } : prev));

  const field = (name: 'name' | 'title' | 'email', label: string, opts: { type?: string; required?: boolean; max: number; auto?: string }) => (
    <label className={'share-field' + (fieldError?.field === name ? ' is-invalid' : '')}>
      <span className="share-field__label">
        {label}
        {!opts.required && <span className="share-field__opt"> (optional)</span>}
      </span>
      <input
        className="share-field__input"
        type={opts.type ?? 'text'}
        value={fields[name]}
        maxLength={opts.max}
        autoComplete={opts.auto ?? 'off'}
        aria-invalid={fieldError?.field === name || undefined}
        onChange={(e) => {
          setFields((f) => ({ ...f, [name]: e.target.value }));
          if (fieldError?.field === name) setFieldError(null);
        }}
      />
    </label>
  );

  if (typeof document === 'undefined') return null;
  const teamsLabel = teams.s === 'busy' ? 'Sending…' : teams.s === 'done' ? 'Sent to your Teams' : 'Send on Teams';
  const emailLabel = email.s === 'busy' ? 'Mark is writing…' : 'New email';

  return createPortal(
    <div
      className={'activity-view share-view' + (open ? ' is-open' : '')}
      inert={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section ref={card} className="share-card" role="dialog" aria-modal="true" aria-labelledby={`${ids}-title`} tabIndex={-1}>
        <header className="share-card__head">
          <h2 id={`${ids}-title`} className="share-card__title">
            Share
          </h2>
          <button type="button" className="share-card__close" onClick={onClose} aria-label="Close share">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" aria-hidden="true">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </header>

        <div className={'share-link' + (personal ? ' is-personal' : '')}>
          <span className="share-link__kind">{personal ? `Personal link for ${personal.recipient.name}` : 'Public link'}</span>
          <input className="share-link__url" value={link} readOnly aria-label="The link" onFocus={(e) => e.currentTarget.select()} />
        </div>

        {formOpen ? (
          <form className="share-form" onSubmit={onMake} noValidate>
            <div className="share-form__row">
              {field('name', 'Name', { required: true, max: SHARE_LIMITS.name, auto: 'off' })}
              {field('title', 'Title', { max: SHARE_LIMITS.title })}
            </div>
            {field('email', 'Email', { type: 'email', max: SHARE_LIMITS.email })}
            <label className={'share-field' + (fieldError?.field === 'message' ? ' is-invalid' : '')}>
              <span className="share-field__label">Your note</span>
              <textarea
                className="share-field__input share-field__input--note"
                value={fields.message}
                maxLength={SHARE_LIMITS.message}
                rows={4}
                placeholder={`Hi ${fields.name.split(' ')[0] || 'there'}, here’s the page we put together for you…`}
                aria-invalid={fieldError?.field === 'message' || undefined}
                onChange={(e) => {
                  setFields((f) => ({ ...f, message: e.target.value }));
                  if (fieldError?.field === 'message') setFieldError(null);
                }}
              />
            </label>
            {fieldError && (
              <p className="share-form__error" role="alert">
                {fieldError.error}
              </p>
            )}
            <div className="share-form__actions">
              <button type="button" className="share-btn share-btn--ghost" onClick={() => {
                  setFormOpen(false);
                  setFieldError(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="share-btn share-btn--primary" disabled={making}>
                {making ? 'Making the link…' : 'Create link'}
              </button>
            </div>
          </form>
        ) : personal ? (
          <div className="share-personal">
            <p className="share-personal__note">{personal.message}</p>
            <div className="share-personal__actions">
              <button
                type="button"
                className="share-btn share-btn--ghost"
                onClick={() => {
                  setFields({ ...personal.recipient, message: personal.message });
                  setFormOpen(true);
                }}
              >
                Edit
              </button>
              <button type="button" className="share-btn share-btn--ghost" onClick={() => switchLink(null)}>
                Use the public link
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="share-add"
            onClick={() => {
              setFields((f) => ({ ...prefill, ...(f.name ? f : {}), message: f.message }));
              setFormOpen(true);
            }}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" aria-hidden="true">
              <path d="M10 4.5v11M4.5 10h11" />
            </svg>
            Add a personal message
            <span className="share-add__hint">They read it before the page, and you see when they do</span>
          </button>
        )}

        <div className="share-actions">
          <button type="button" className={'share-action' + (copied !== 'idle' ? ` is-${copied}` : '')} onClick={onCopy}>
            <span className="share-action__icon" aria-hidden="true">
              {copied === 'copied' ? (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
                  <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
                </svg>
              )}
            </span>
            <span className="share-action__label">{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Couldn’t copy' : 'Copy link'}</span>
          </button>
          <button type="button" className={'share-action' + (teams.s === 'done' ? ' is-copied' : '')} onClick={onTeams} disabled={teams.s === 'busy' || teams.s === 'done'}>
            <span className="share-action__icon" aria-hidden="true">
              <img src="/logos/tools/teams.svg" alt="" width="26" height="26" />
            </span>
            <span className="share-action__label">{teamsLabel}</span>
          </button>
          <button type="button" className={'share-action' + (email.s === 'busy' ? ' is-busy' : '')} onClick={onEmail} disabled={email.s === 'busy'}>
            <span className="share-action__icon" aria-hidden="true">
              <img src="/logos/tools/outlook.svg" alt="" width="26" height="26" />
            </span>
            <span className="share-action__label">{emailLabel}</span>
          </button>
        </div>
        <p className="share-status" role="status">
          {teams.s === 'error' ? teams.message : email.s === 'error' ? email.message : teams.s === 'done' ? 'Mark is messaging you the link with what the page has seen.' : ''}
        </p>

        {email.s === 'done' && (
          <div className="share-draft">
            <div className="share-draft__head">
              <span>{email.value.by === 'mark' ? 'Mark’s draft' : 'A draft (Mark was busy)'}</span>
              {email.value.to ? <span className="share-draft__to">To {email.value.to}</span> : null}
            </div>
            <input className="share-field__input share-draft__subject" value={email.value.subject} aria-label="Subject" onChange={(e) => setDraft({ subject: e.target.value })} />
            <textarea className="share-field__input share-draft__body" value={email.value.body} aria-label="Email" rows={8} onChange={(e) => setDraft({ body: e.target.value })} />
            <div className="share-form__actions">
              <button type="button" className="share-btn share-btn--ghost" onClick={() => void copyText(`${email.value.subject}\n\n${email.value.body}`)}>
                Copy text
              </button>
              <a className="share-btn share-btn--primary" href={outlookHref(email.value)} target="_blank" rel="noopener noreferrer">
                Open in Outlook
              </a>
            </div>
          </div>
        )}

        {variant === 'person' && (
          <section className="share-history" aria-label="Links from this page">
            <h3 className="share-history__h">Sent from this page</h3>
            <SharedLinks load={links} compact />
          </section>
        )}
      </section>
    </div>,
    document.body,
  );
}
