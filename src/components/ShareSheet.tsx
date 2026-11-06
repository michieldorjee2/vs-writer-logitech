import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { CompetitorComparisonPage, PersonPage } from '../lib/graph-types';
import { deriveCustomerName } from '../lib/page-identity';
import { copyText } from '../lib/clipboard';
import { lockScroll } from '../lib/scroll-lock';
import { checkShareInput, SHARE_LIMITS, splitDraft, type ShareRecipient } from '../lib/share-links';
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
 *   • Send to me: Mark messages the rep (only them) in Teams the link with what the page has
 *     seen (api/share-send.ts, mark/share-teams/).
 *   • New email: Mark writes the email, from the rep's note when there is one, and the card shows
 *     it being written (streamed through the Agent SDK); the rep edits it here and opens it in
 *     Outlook as a new message.
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
/** The email: Mark's words so far while he writes, then the draft to edit. */
type EmailStep = { s: 'idle' } | { s: 'writing'; text: string } | { s: 'done'; value: Draft } | { s: 'error'; message: string };

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
  const [email, setEmail] = useState<EmailStep>({ s: 'idle' });
  const [draftCopied, setDraftCopied] = useState(false);
  const writing = useRef<AbortController | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const link = personal?.url ?? publicUrl;

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const release = lockScroll('activity-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      release();
      before?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  /** A new link (or none): what was sent or drafted for the old one no longer applies. */
  const switchLink = useCallback((next: Personal | null) => {
    writing.current?.abort();
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

  /** Mark writes the email; his words land on the card as they come (api/share-send.ts streams them). */
  const onEmail = useCallback(async () => {
    writing.current?.abort();
    const ctrl = new AbortController();
    writing.current = ctrl;
    setEmail({ s: 'writing', text: '' });
    setDraftCopied(false);
    try {
      // Without a personal link, a person page's email is still to its person.
      const recipient = !personal && prefill.name ? { name: prefill.name, title: prefill.title } : undefined;
      const res = await fetch('/api/share-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: ctrl.signal,
        body: JSON.stringify({ channel: 'email', route, code: personal?.code ?? null, title: about.title, summary: about.summary, recipient }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Could not write the email');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, i).replace(/^data: ?/, '');
          buf = buf.slice(i + 2);
          const msg = JSON.parse(frame) as { k: 'text'; t: string } | { k: 'done'; draft: Draft };
          if (msg.k === 'text') setEmail((prev) => ({ s: 'writing', text: (prev.s === 'writing' ? prev.text : '') + msg.t }));
          else return setEmail({ s: 'done', value: msg.draft });
        }
      }
      throw new Error('Mark stopped before the email was done');
    } catch (err) {
      if (!ctrl.signal.aborted) setEmail({ s: 'error', message: err instanceof Error ? err.message : 'No draft' });
    }
  }, [route, personal, about, prefill]);

  // Closing the card stops Mark mid-sentence.
  useEffect(() => {
    if (!open) writing.current?.abort();
  }, [open]);
  useEffect(() => () => writing.current?.abort(), []);

  const setDraft = (patch: Partial<Draft>) => setEmail((prev) => (prev.s === 'done' ? { s: 'done', value: { ...prev.value, ...patch } } : prev));
  const copyDraft = (d: Draft) =>
    void copyText(`${d.subject}\n\n${d.body}`).then((ok) => {
      setDraftCopied(ok);
      if (ok) window.setTimeout(() => setDraftCopied(false), 1800);
    });

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
  const teamsLabel = teams.s === 'busy' ? 'Sending…' : teams.s === 'done' ? 'Sent to you' : 'Send to me';
  const emailLabel = email.s === 'writing' ? 'Mark is writing…' : 'New email';
  const live = email.s === 'writing' ? splitDraft(email.text) : null;

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
          <button
            type="button"
            className={'share-action' + (teams.s === 'done' ? ' is-copied' : '')}
            onClick={onTeams}
            disabled={teams.s === 'busy' || teams.s === 'done'}
            title="Mark messages you the link in Teams, with what the page has seen"
          >
            <span className="share-action__icon" aria-hidden="true">
              <img src="/logos/tools/teams.svg" alt="" width="26" height="26" />
            </span>
            <span className="share-action__label">{teamsLabel}</span>
          </button>
          <button type="button" className={'share-action' + (email.s === 'writing' ? ' is-busy' : '')} onClick={onEmail} disabled={email.s === 'writing'}>
            <span className="share-action__icon" aria-hidden="true">
              <img src="/logos/tools/outlook.svg" alt="" width="26" height="26" />
            </span>
            <span className="share-action__label">{emailLabel}</span>
          </button>
        </div>
        <p className="share-status" role="status">
          {teams.s === 'error' ? teams.message : email.s === 'error' ? email.message : teams.s === 'done' ? 'Mark is messaging you the link with what the page has seen.' : ''}
        </p>

        {live && (
          <div className="share-draft is-writing" aria-live="polite" aria-busy="true">
            <div className="share-draft__head">
              <span className="share-draft__writing">Mark is writing</span>
            </div>
            <div className="share-field__input share-draft__subject">{live.subject || <span className="share-draft__caret" />}</div>
            <div className="share-field__input share-draft__body share-draft__body--live">
              {live.body}
              {live.subject && <span className="share-draft__caret" />}
            </div>
          </div>
        )}

        {email.s === 'done' && (
          <div className="share-draft">
            <div className="share-draft__head">
              <span>{email.value.by === 'mark' ? 'Mark’s draft' : 'A draft (Mark was busy)'}</span>
              {email.value.to ? <span className="share-draft__to">To {email.value.to}</span> : null}
            </div>
            <input className="share-field__input share-draft__subject" value={email.value.subject} aria-label="Subject" onChange={(e) => setDraft({ subject: e.target.value })} />
            <textarea className="share-field__input share-draft__body" value={email.value.body} aria-label="Email" onChange={(e) => setDraft({ body: e.target.value })} />
            <div className="share-form__actions">
              <button
                type="button"
                className={'share-icon-btn' + (draftCopied ? ' is-copied' : '')}
                onClick={() => copyDraft(email.value)}
                aria-label={draftCopied ? 'Email copied' : 'Copy the email'}
                title={draftCopied ? 'Copied' : 'Copy the email'}
              >
                {draftCopied ? (
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="7" y="7" width="10" height="10" rx="2" />
                    <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                  </svg>
                )}
              </button>
              <a className="share-btn share-btn--primary" href={outlookHref(email.value)} target="_blank" rel="noopener noreferrer">
                Open in Outlook
              </a>
            </div>
          </div>
        )}

        {/* Person pages have no Report: their links are listed here, once there are any. */}
        {variant === 'person' && links.state === 'ready' && links.links.length > 0 && (
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
