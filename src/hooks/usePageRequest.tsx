import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { looksLikeWebsite } from '../lib/search-entries';

/*
 * Asking Mark for a page that does not exist yet, from the search page: the
 * two endpoints, their rules and the one-a-minute throttle, held in a hook so
 * the page only draws it.
 *
 * An account page is asked for by the company's website. A person page needs
 * the company and the person; the workflow behind it builds the account page
 * first when the company has none.
 */

const CREATE_PAGE_ENDPOINT = '/api/opal-create-page';
const CREATE_PERSON_PAGE_ENDPOINT = '/api/opal-create-person-page';
const MAX_COMPANY_NAME_LEN = 120;

/* Shared with /search, so the one-a-minute limit holds across both pages. */
const COOLDOWN_MS = 60 * 1000;
const COOLDOWN_KEY = 'opti.add-new.last-sent.v1';
/* How long the "sent" line stays up: long enough to read a sentence. */
const SENT_MS = 6000;

export type RequestKind = 'account' | 'person';
/** Which field the search bar is asking for, or 'sent' once Mark has it. */
export type RequestPhase = null | 'company' | 'person' | 'sent';

function readLastSent(): number {
  try {
    return Number(window.localStorage.getItem(COOLDOWN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSent(t: number): void {
  try {
    window.localStorage.setItem(COOLDOWN_KEY, String(t));
  } catch {
    /* ignore */
  }
}

/** A send that failed because the session ended reads differently from one Mark didn't answer. */
function sendErrorMessage(err: unknown): string {
  return err instanceof Error && err.message === 'signed-out'
    ? 'Your Optimizely sign-in has ended. Reload the page to sign in again.'
    : "Couldn't reach Mark. Try again.";
}

export function usePageRequest() {
  const [phase, setPhase] = useState<RequestPhase>(null);
  const [kind, setKind] = useState<RequestKind>('account');
  const [company, setCompany] = useState('');
  const [person, setPerson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentNote, setSentNote] = useState<ReactNode>(null);
  const [lastSent, setLastSent] = useState(readLastSent);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const cooldownRemaining = Math.max(0, Math.ceil((lastSent + COOLDOWN_MS - nowMs) / 1000));
  const inCooldown = cooldownRemaining > 0;

  useEffect(() => {
    if (!inCooldown) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [inCooldown]);

  useEffect(() => {
    if (phase !== 'sent') return;
    const id = window.setTimeout(() => {
      setPhase(null);
      setError(null);
    }, SENT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  /** Account pages start from the website; a person page from the company, then the name. */
  const start = useCallback(
    (nextKind: RequestKind, query: string) => {
      if (inCooldown) return;
      const q = query.trim();
      setKind(nextKind);
      setCompany(nextKind === 'account' ? q : '');
      setPerson(nextKind === 'person' ? q : '');
      setError(null);
      setSubmitting(false);
      setPhase('company');
    },
    [inCooldown],
  );

  const cancel = useCallback(() => {
    if (submitting) return;
    setPhase(null);
    setError(null);
  }, [submitting]);

  const markSent = (note: ReactNode) => {
    const t = Date.now();
    setLastSent(t);
    setNowMs(t);
    writeLastSent(t);
    setSentNote(note);
    setPhase('sent');
  };

  const submit = useCallback(async () => {
    if (phase === 'company') {
      const name = company.trim();
      if (!name) return setError(kind === 'person' ? 'Enter the company they work at' : 'Enter a company website');
      if (name.length > MAX_COMPANY_NAME_LEN) return setError(`Keep it under ${MAX_COMPANY_NAME_LEN} characters`);
      // An account page is found by the company's website, exactly — never by name.
      if (kind === 'account' && !looksLikeWebsite(name)) {
        return setError("Enter the company's website, e.g. anaplan.com");
      }
      if (kind === 'person') {
        setError(null);
        setPhase('person');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const r = await fetch(CREATE_PAGE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_name: name }),
        });
        if (r.status === 401) throw new Error('signed-out');
        // Asked for minutes ago and still being built: say so instead of starting a second build.
        if (r.status === 409) {
          const body = (await r.json().catch(() => null)) as { message?: string } | null;
          setSentNote(body?.message || 'This page was asked for a few minutes ago and is still being built.');
          setPhase('sent');
          return;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        markSent(<>Sent to Mark. <b>{name}</b> takes about 15 minutes; we'll ping you on Teams when it's live.</>);
      } catch (err) {
        setError(sendErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (phase === 'person') {
      const who = person.trim();
      if (!who) return setError("Enter the person's name");
      setSubmitting(true);
      setError(null);
      try {
        const r = await fetch(CREATE_PERSON_PAGE_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_name: company.trim(), person_name: who }),
        });
        if (r.status === 401) throw new Error('signed-out');
        if (!r.ok) throw new Error(`${r.status}`);
        markSent(<>Sent to Mark. We'll ping you on Teams when <b>{who}</b>'s page is ready.</>);
      } catch (err) {
        setError(sendErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    }
  }, [phase, kind, company, person]);

  /** What the bar's field edits in the current phase. */
  const value = phase === 'person' ? person : company;
  const setValue = useCallback(
    (v: string) => {
      if (phase === 'person') setPerson(v);
      else setCompany(v);
      setError(null);
    },
    [phase],
  );

  const placeholder =
    phase === 'person'
      ? `Who at ${company.trim() || 'this company'}?`
      : kind === 'person'
        ? 'Company they work at'
        : 'Company website, e.g. anaplan.com';

  return {
    phase,
    kind,
    value,
    setValue,
    placeholder,
    error,
    submitting,
    sentNote,
    inCooldown,
    cooldownRemaining,
    start,
    cancel,
    submit,
  };
}
