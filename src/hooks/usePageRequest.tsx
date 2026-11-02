import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { askAnswerOf, askNote } from '../lib/offer-from-search';
import type { FromSearch } from '../lib/offer-looks';
import type { BuildSummary } from '../lib/page-builds';
import { looksLikeWebsite } from '../lib/search-entries';
import { READ_FAILURE } from '../lib/badge-scan';
import { useBadgeCard } from './useBadgeCard';

/*
 * Asking Mark for a page that does not exist yet, from the search page, held
 * in a hook so the page only draws it. Builds start at /api/page-builds and
 * show up in the page's lists while Mark works (onStarted).
 *
 * An account page is asked for by the company's website. A person page needs
 * the company and the person: a company that has a page already, or the
 * website of one that doesn't, whose page Mark then builds first.
 *
 * Run as an offer that takes pages from search, an offer page is asked for by
 * the company's website too (kind 'offer'): Aldus UI finds the account and
 * writes the offer's page, at once or once the offer's team approves
 * (src/lib/offer-from-search.ts). It isn't a build, so it shows no ring.
 */

const BUILDS_ENDPOINT = '/api/page-builds';
/* How long the "sent" line stays up: long enough to read a sentence. */
const SENT_MS = 6000;

export type RequestKind = 'account' | 'person' | 'offer';

/** The offer an offer page is asked for, and how it takes pages from search. */
export type OfferRef = { id: string; fromSearch: Exclude<FromSearch, 'off'> };
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

/** The "sent" lines, for a company page and for a person's (asked for here or from a badge). */
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
  /** A company the index has a page for, by name or website (and its domain, when the index has one). */
  findCompany: (text: string) => { route: string; name: string; domain?: string } | null;
  onStarted: (builds: BuildSummary[]) => void;
}) {
  const [phase, setPhase] = useState<RequestPhase>(null);
  const [kind, setKind] = useState<RequestKind>('account');
  const [company, setCompany] = useState('');
  const [person, setPerson] = useState('');
  /* What was typed in search when the request began: a name, the page's address. */
  const [askedFor, setAskedFor] = useState('');
  const [companyRef, setCompanyRef] = useState<CompanyRef | null>(null);
  const [offerRef, setOfferRef] = useState<OfferRef | null>(null);
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

  /** Account and offer pages start from the website; a person page from the company, then the name. */
  const start = useCallback((nextKind: RequestKind, query: string, offer?: OfferRef) => {
    const q = query.trim();
    setKind(nextKind);
    setAskedFor(q);
    // A name is not a domain: the field starts empty so its placeholder asks for one, and
    // the hint says why (askedName). Pre-filled, the name invited a submit that could only fail.
    // An offer page for a company the index knows starts with its domain.
    const known = nextKind === 'offer' && !looksLikeWebsite(q) ? (findCompany(q)?.domain ?? '') : '';
    setCompany(nextKind !== 'person' && looksLikeWebsite(q) ? q : known);
    setPerson(nextKind === 'person' ? q : '');
    setOfferRef(nextKind === 'offer' ? (offer ?? null) : null);
    setCompanyRef(null);
    setCompanyName('');
    setError(null);
    setSubmitting(false);
    setPhase('company');
  }, [findCompany]);

  /* A badge the rep scanned (phones, useBadgeCard): it has the bar and the panel until it is sent or put away. */
  const badge = useBadgeCard({
    findCompany,
    // A read that failed: the rep types the company instead, as for any person page.
    onFailed: (failure) => {
      start('person', '');
      setError(failure === 'signed-out' ? sendErrorMessage(new Error('signed-out')) : `${READ_FAILURE[failure]} Type their company instead.`);
    },
  });
  const { active: badgeUp, cancel: cancelBadge, edit: editBadge, submit: submitBadge, stop: stopBadge } = badge;

  const cancel = useCallback(() => {
    if (submitting) return;
    if (!phase && badgeUp) cancelBadge();
    setPhase(null);
    setError(null);
  }, [submitting, phase, badgeUp, cancelBadge]);

  /** Sends a page request; true once Mark has it (or already had it). */
  const send = useCallback(
    async (body: Record<string, unknown>, note: (builds: { build: BuildSummary; company?: BuildSummary }) => ReactNode): Promise<boolean> => {
      /* Set only once it is sent: the panel's heading then names what was asked for (a badge asks for either). */
      const sentKind: RequestKind = body.kind === 'account' ? 'account' : 'person';
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
          setKind(sentKind);
          setPhase('sent');
          return true;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        const started = (await r.json()) as { build: BuildSummary; company?: BuildSummary };
        onStarted([started.company, started.build].filter((b): b is BuildSummary => !!b));
        setSentNote(note(started));
        setKind(sentKind);
        setPhase('sent');
        return true;
      } catch (err) {
        setError(sendErrorMessage(err));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [onStarted],
  );

  /** An offer page: Aldus UI answers whether Mark writes it now, it waits for approval, or why not. */
  const askOffer = useCallback(
    async (offer: OfferRef, website: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const r = await fetch(`/api/offers/${encodeURIComponent(offer.id)}/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ website }),
        });
        const note = askNote(r.status, askAnswerOf(await r.json().catch(() => null)), website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]);
        if (note.kind === 'error') return setError(note.text);
        setSentNote(note.text);
        setPhase('sent');
      } catch {
        setError("Couldn't reach Mark. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const submit = useCallback(async () => {
    if (phase === 'company') {
      const text = company.trim();
      if (kind === 'offer' && offerRef) {
        if (!text) return setError("Enter the company's domain, e.g. anaplan.com");
        if (!looksLikeWebsite(text))
          return setError("Multiple companies might match a name. Enter the company's domain, e.g. anaplan.com, so we know we're asking for the right one.");
        return askOffer(offerRef, text);
      }
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
      // Its route and name only: the person page's request is as it was before findCompany also gave the domain.
      if (known) setCompanyRef({ route: known.route, name: known.name });
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
  }, [phase, kind, company, person, askedFor, companyRef, companyName, findCompany, send, offerRef, askOffer]);

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
        ? 'Company they work at, or its domain'
        : 'Company domain, e.g. anaplan.com';

  /** The go button on a badge: the line being fixed goes back to the card, or the card goes to Mark. */
  const sendCard = useCallback(async () => {
    setError(null);
    const asked = submitBadge();
    if (!asked) return;
    if (await send(asked.body, asked.body.kind === 'account' ? accountNote : personNote)) stopBadge();
  }, [submitBadge, send, stopBadge]);

  const editCard = useCallback(
    (field: 'person' | 'company') => {
      if (submitting) return;
      setError(null);
      editBadge(field);
    },
    [submitting, editBadge],
  );

  /* While a badge is up (and no request of this hook's own), the bar and the panel are the badge's. */
  const shown = !phase && badgeUp ? badge : null;
  return {
    phase: shown ? shown.phase : phase,
    kind,
    value: shown ? shown.value : value,
    setValue: shown ? shown.setValue : setValue,
    placeholder: shown ? shown.placeholder : placeholder,
    error: shown?.error ?? error,
    submitting,
    sentNote,
    /** Person requests: the company will need its page built first. */
    companyIsNew: !!companyRef && !('route' in companyRef),
    /** A badge Mark read, while the rep checks it (the line being fixed: `phase`), and its company. */
    card: shown?.card ?? null,
    cardCompany: shown?.cardCompany ?? null,
    /** The bar's line in place of the field while Mark reads the badge and while the card waits for a send. */
    badgeStatus: shown?.status ?? null,
    /** The panel's note for a badge (null otherwise). */
    badgeHint: shown?.hint ?? null,
    scan: badge.scan,
    edit: editCard,
    /** An account request begun from a company's name, which still needs its domain. */
    askedName: kind === 'account' && askedFor && !looksLikeWebsite(askedFor) ? askedFor : null,
    /** An offer page request: how the offer takes pages from search. */
    offerMode: kind === 'offer' ? (offerRef?.fromSearch ?? null) : null,
    start,
    cancel,
    submit: shown ? sendCard : submit,
  };
}
