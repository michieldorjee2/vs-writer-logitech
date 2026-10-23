import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { BuildSummary } from '../lib/page-builds';
import { looksLikeWebsite } from '../lib/search-entries';

/*
 * Asking Mark for a page that does not exist yet, from the search page, held
 * in a hook so the page only draws it. Builds start at /api/page-builds and
 * show up in the page's lists while Mark works (onStarted).
 *
 * An account page is asked for by the company's website. A person page needs
 * the company and the person: a company that has a page already, or the
 * website of one that doesn't, whose page Mark then builds first.
 */

const BUILDS_ENDPOINT = '/api/page-builds';
/* How long the "sent" line stays up: long enough to read a sentence. */
const SENT_MS = 6000;

export type RequestKind = 'account' | 'person';
/** Which field the search bar is asking for, or 'sent' once Mark has it. */
export type RequestPhase = null | 'company' | 'person' | 'sent';

/** The company a person page hangs off: one with a page, or the website of one without. */
export type CompanyRef = { route: string; name: string } | { website: string; name?: string };

/** A send that failed because the session ended reads differently from one Mark didn't answer. */
function sendErrorMessage(err: unknown): string {
  return err instanceof Error && err.message === 'signed-out'
    ? 'Your Optimizely sign-in has ended. Reload the page to sign in again.'
    : "Couldn't reach Mark. Try again.";
}

const linkTo = (route: string) => (
  <a href={`/${route}`} target="_blank" rel="noopener noreferrer">
    showcase.optimizely.com/{route}
  </a>
);

export function usePageRequest({
  findCompany,
  onStarted,
}: {
  /** A company the index has a page for, by name or website. */
  findCompany: (text: string) => { route: string; name: string } | null;
  onStarted: (builds: BuildSummary[]) => void;
}) {
  const [phase, setPhase] = useState<RequestPhase>(null);
  const [kind, setKind] = useState<RequestKind>('account');
  const [company, setCompany] = useState('');
  const [person, setPerson] = useState('');
  /* What was typed in search when the request began: a name, the page's address. */
  const [askedFor, setAskedFor] = useState('');
  const [companyRef, setCompanyRef] = useState<CompanyRef | null>(null);
  /* A company typed by name that has no page: the website comes next, the name names the page. */
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentNote, setSentNote] = useState<ReactNode>(null);

  useEffect(() => {
    if (phase !== 'sent') return;
    const id = window.setTimeout(() => {
      setPhase(null);
      setError(null);
    }, SENT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  /** Account pages start from the website; a person page from the company, then the name. */
  const start = useCallback((nextKind: RequestKind, query: string) => {
    const q = query.trim();
    setKind(nextKind);
    setAskedFor(q);
    setCompany(nextKind === 'account' ? q : '');
    setPerson(nextKind === 'person' ? q : '');
    setCompanyRef(null);
    setCompanyName('');
    setError(null);
    setSubmitting(false);
    setPhase('company');
  }, []);

  const cancel = useCallback(() => {
    if (submitting) return;
    setPhase(null);
    setError(null);
  }, [submitting]);

  const send = useCallback(
    async (body: Record<string, unknown>, note: (builds: { build: BuildSummary; company?: BuildSummary }) => ReactNode) => {
      setSubmitting(true);
      setError(null);
      try {
        const r = await fetch(BUILDS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (r.status === 401) throw new Error('signed-out');
        // Asked for minutes ago and still being built: say so instead of starting a second build.
        if (r.status === 409) {
          const answer = (await r.json().catch(() => null)) as { message?: string } | null;
          setSentNote(answer?.message || 'This page was asked for a few minutes ago and is still being built.');
          setPhase('sent');
          return;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        const started = (await r.json()) as { build: BuildSummary; company?: BuildSummary };
        onStarted([started.company, started.build].filter((b): b is BuildSummary => !!b));
        setSentNote(note(started));
        setPhase('sent');
      } catch (err) {
        setError(sendErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    },
    [onStarted],
  );

  const submit = useCallback(async () => {
    if (phase === 'company') {
      const text = company.trim();
      if (kind === 'account') {
        if (!text) return setError('Enter the company website');
        // An account page is found by the company's website, exactly — never by name.
        if (!looksLikeWebsite(text)) return setError("Enter the company's website, e.g. anaplan.com");
        // "+ Add" also sits beside near matches, so the website may be one we have a page for.
        const existing = findCompany(text);
        if (existing) return setError(`${existing.name} already has a page: showcase.optimizely.com/${existing.route}`);
        return send({ kind: 'account', website: text, name: looksLikeWebsite(askedFor) ? undefined : askedFor }, ({ build }) => (
          <>
            Mark is building <b>{build.name}</b>. Follow along at {linkTo(build.route)}.
          </>
        ));
      }
      if (!text) return setError('Enter the company they work at');
      const known = findCompany(text);
      if (known) setCompanyRef(known);
      else if (looksLikeWebsite(text)) setCompanyRef({ website: text, ...(companyName ? { name: companyName } : {}) });
      else {
        setCompanyName(text);
        return setError(`No page for ${text} yet: enter its website, e.g. anaplan.com`);
      }
      setError(null);
      setPhase('person');
      return;
    }

    if (phase === 'person' && companyRef) {
      const who = person.trim();
      if (!who) return setError("Enter the person's name");
      return send({ kind: 'person', personName: who, company: companyRef }, ({ build, company: first }) =>
        first ? (
          <>
            Mark builds <b>{first.name}</b>'s page first, then <b>{build.name}</b>'s at {linkTo(build.route)}.
          </>
        ) : (
          <>
            Mark is building <b>{build.name}</b>'s page. Follow along at {linkTo(build.route)}.
          </>
        ),
      );
    }
  }, [phase, kind, company, person, askedFor, companyRef, companyName, findCompany, send]);

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

  const companyLabel = companyRef ? ('route' in companyRef ? companyRef.name : companyRef.website) : '';
  const placeholder =
    phase === 'person'
      ? `Who at ${companyLabel || 'this company'}?`
      : kind === 'person'
        ? 'Company they work at, or its website'
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
    /** Person requests: the company will need its page built first. */
    companyIsNew: !!companyRef && !('route' in companyRef),
    start,
    cancel,
    submit,
  };
}
