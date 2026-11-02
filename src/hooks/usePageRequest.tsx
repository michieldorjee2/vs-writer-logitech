import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { companyOf, hostOf, requestFromCard, type BadgeCard } from '../lib/badge-card';
import { READ_FAILURE, readBadge } from '../lib/badge-scan';
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
 *
 * Or from a badge (scan, phones): Mark reads it ('reading'), the panel shows
 * the card ('card'), a tapped line is fixed in the bar ('person' then 'title',
 * or 'company') and comes back to the card, and the rep sends it. Never sent
 * without that tap.
 */

const BUILDS_ENDPOINT = '/api/page-builds';
/* How long the "sent" line stays up: long enough to read a sentence. */
const SENT_MS = 6000;

export type RequestKind = 'account' | 'person';
/** Which field the search bar is asking for, or 'sent' once Mark has it ('reading', 'card', 'title': a badge). */
export type RequestPhase = null | 'company' | 'person' | 'sent' | 'reading' | 'card' | 'title';

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

/** The "sent" lines, for a company page and for a person's. */
const accountNote = ({ build }: { build: BuildSummary }) => (
  <>
    Mark is building <b>{build.name}</b>. Follow along at {linkTo(build.route)}.
  </>
);
const personNote = ({ build, company: first }: { build: BuildSummary; company?: BuildSummary }) =>
  first ? (
    <>
      Mark builds <b>{first.name}</b>'s page first, then <b>{build.name}</b>'s at {linkTo(build.route)}.
    </>
  ) : (
    <>
      Mark is building <b>{build.name}</b>'s page. Follow along at {linkTo(build.route)}.
    </>
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
  /* A badge Mark read: what the panel shows and the rep sends. The line being fixed is edited as `draft`. */
  const [card, setCard] = useState<BadgeCard | null>(null);
  const [draft, setDraft] = useState('');
  const reading = useRef<AbortController | null>(null);
  const fixing = !!card && (phase === 'company' || phase === 'person' || phase === 'title');

  useEffect(() => {
    if (phase !== 'sent') return;
    const id = window.setTimeout(() => {
      setPhase(null);
      setError(null);
      setCard(null);
    }, SENT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  /* A read still under way when the page goes stops polling. */
  useEffect(() => () => reading.current?.abort(), []);

  /** Account pages start from the website; a person page from the company, then the name. */
  const start = useCallback((nextKind: RequestKind, query: string) => {
    const q = query.trim();
    setKind(nextKind);
    setAskedFor(q);
    // A name is not a domain: the field starts empty so its placeholder asks for one, and
    // the hint says why (askedName). Pre-filled, the name invited a submit that could only fail.
    setCompany(nextKind === 'account' && looksLikeWebsite(q) ? q : '');
    setPerson(nextKind === 'person' ? q : '');
    setCompanyRef(null);
    setCompanyName('');
    setError(null);
    setSubmitting(false);
    reading.current?.abort();
    setCard(null);
    setPhase('company');
  }, []);

  const cancel = useCallback(() => {
    if (submitting) return;
    setError(null);
    // Fixing a line of the badge: back to the badge, as it was.
    if (fixing) return setPhase('card');
    reading.current?.abort();
    setCard(null);
    setPhase(null);
  }, [submitting, fixing]);

  /** Mark reads the badge in the photo; the panel then shows the card. A failed read asks for the company instead. */
  const scan = useCallback(async (file: File) => {
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setKind('person');
    setAskedFor('');
    setCompany('');
    setPerson('');
    setCompanyRef(null);
    setCompanyName('');
    setCard(null);
    setError(null);
    setSubmitting(false);
    setPhase('reading');
    const read = await readBadge(file, controller.signal);
    if (controller.signal.aborted) return;
    reading.current = null;
    if ('card' in read) {
      setCard(read.card);
      setPhase('card');
      return;
    }
    const { failure } = read;
    setError(failure === 'signed-out' ? sendErrorMessage(new Error('signed-out')) : `${READ_FAILURE[failure]} Type their company instead.`);
    setPhase('company');
  }, []);

  /** Fix one line of the badge in the bar: the name (then the title), or the company. */
  const edit = useCallback(
    (field: 'person' | 'company') => {
      if (!card || submitting) return;
      setError(null);
      setDraft(field === 'person' ? card.name : card.domain || card.company);
      setPhase(field);
    },
    [card, submitting],
  );

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

  /** The badge's phases: send the card, or take the line being fixed back to it. */
  const submitCard = useCallback(
    (current: BadgeCard) => {
      if (phase === 'card') {
        const asked = requestFromCard(current, findCompany);
        if ('needs' in asked) return edit(asked.needs);
        // No name on the badge: the company's page ("New company page" once sent).
        if (asked.body.kind === 'account') setKind('account');
        return send(asked.body, asked.body.kind === 'account' ? accountNote : personNote);
      }
      const text = draft.trim();
      if (phase === 'person') {
        if (!text) return setError("Enter the person's name");
        setCard({ ...current, name: text.slice(0, 120) });
        setDraft(current.title);
        return setPhase('title');
      }
      if (phase === 'title') {
        setCard({ ...current, title: text.slice(0, 160) });
        return setPhase('card');
      }
      if (phase === 'company') {
        if (!text) return setError('Enter the company they work at');
        const known = findCompany(text);
        const host = hostOf(text);
        if (known) setCard({ ...current, company: known.name, domain: host });
        else if (host) setCard({ ...current, domain: host });
        else {
          setCard({ ...current, company: text.slice(0, 120), domain: '' });
          return setError(`No page for ${text} yet, and multiple companies might match that name. Enter its domain, e.g. anaplan.com.`);
        }
        return setPhase('card');
      }
    },
    [phase, draft, findCompany, edit, send],
  );

  const submit = useCallback(async () => {
    if (card) return submitCard(card);
    if (phase === 'company') {
      const text = company.trim();
      if (kind === 'account') {
        if (!text) return setError("Enter the company's domain, e.g. anaplan.com");
        // An account page is found by the company's website, exactly — never by name.
        if (!looksLikeWebsite(text))
          return setError("Multiple companies might match a name. Enter the company's domain, e.g. anaplan.com, so we know we're building the right one.");
        // "+ Add" also sits beside near matches, so the website may be one we have a page for.
        const existing = findCompany(text);
        if (existing) return setError(`${existing.name} already has a page: showcase.optimizely.com/${existing.route}`);
        return send({ kind: 'account', website: text, name: looksLikeWebsite(askedFor) ? undefined : askedFor }, accountNote);
      }
      if (!text) return setError('Enter the company they work at');
      const known = findCompany(text);
      if (known) setCompanyRef(known);
      else if (looksLikeWebsite(text)) setCompanyRef({ website: text, ...(companyName ? { name: companyName } : {}) });
      else {
        setCompanyName(text);
        return setError(`No page for ${text} yet, and multiple companies might match that name. Enter its domain, e.g. anaplan.com.`);
      }
      setError(null);
      setPhase('person');
      return;
    }

    if (phase === 'person' && companyRef) {
      const who = person.trim();
      if (!who) return setError("Enter the person's name");
      return send({ kind: 'person', personName: who, company: companyRef }, personNote);
    }
  }, [card, submitCard, phase, kind, company, person, askedFor, companyRef, companyName, findCompany, send]);

  /** What the bar's field edits in the current phase. */
  const value = fixing ? draft : phase === 'person' ? person : company;
  const setValue = useCallback(
    (v: string) => {
      if (fixing) setDraft(v);
      else if (phase === 'person') setPerson(v);
      else setCompany(v);
      setError(null);
    },
    [phase, fixing],
  );

  /* A badge's company is worked out from the card as it stands (a fixed line changes it). */
  const ref = card ? companyOf(card, findCompany) : companyRef;
  const companyLabel = ref ? ('route' in ref ? ref.name : ref.website) : '';
  const placeholder =
    phase === 'title'
      ? 'Their title (optional)'
      : phase === 'person'
        ? `Who at ${companyLabel || 'this company'}?`
        : kind === 'person'
          ? 'Company they work at, or its domain'
          : 'Company domain, e.g. anaplan.com';

  /* A badge: the bar's line while Mark reads and while the rep checks the card, and the panel's note. */
  const asked = card && phase === 'card' ? requestFromCard(card, findCompany) : null;
  const badgeStatus =
    phase === 'reading' ? 'Mark is reading the badge…' : phase === 'card' && card ? `Build a page for ${card.name || card.company}?` : null;
  const badgeHint =
    phase === 'reading'
      ? 'Their name, title and company show up here.'
      : !card || !phase || phase === 'sent'
        ? null
        : phase === 'person'
          ? 'Fix their name, then their title.'
          : phase === 'title'
            ? 'Fix their title, or leave it empty.'
            : phase === 'company'
              ? 'The company they work at: one that has a page, or its domain.'
              : !asked
                ? null
                : 'needs' in asked
                  ? asked.needs === 'company'
                    ? 'Tap the company to add it.'
                    : 'Tap the name to add it.'
                  : asked.body.kind === 'account'
                    ? "Mark builds the company's page in about 15 minutes. Tap a line to fix it."
                    : asked.companyIsNew
                      ? "Mark builds the company's page first (about 15 minutes), then this person's (about 4 more). Tap a line to fix it."
                      : 'Mark builds a page for this person in about 4 minutes. Tap a line to fix it.';

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
    companyIsNew: !!ref && !('route' in ref),
    /** A badge Mark read, while the rep checks it (and the line being fixed: `phase`). */
    card: phase && phase !== 'sent' ? card : null,
    /** The card's company: one with a page, the website of one without, or null. */
    cardCompany: card ? ref : null,
    /** The bar's line in place of the field while Mark reads the badge and while the card waits for a send. */
    badgeStatus,
    /** The panel's note for a badge (null otherwise). */
    badgeHint,
    /** An account request begun from a company's name, which still needs its domain. */
    askedName: kind === 'account' && askedFor && !looksLikeWebsite(askedFor) ? askedFor : null,
    start,
    scan,
    edit,
    cancel,
    submit,
  };
}
