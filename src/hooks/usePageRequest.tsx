import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { domainOf, type AccountChoice, type AccountMatch } from '../lib/account-match';
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
 * An account page is asked for by the company's name or website: the search
 * page lists the Salesforce accounts that match (/api/page-builds/match) and
 * the rep picks one, so Mark builds exactly that account and the page is named
 * after it, not after what was typed (src/lib/account-match.ts). A person page
 * needs the company and the person: a company that has a page already, or one
 * picked the same way, whose page Mark then builds first.
 *
 * Run as an offer that takes pages from search, an offer page is asked for by
 * the company's website (kind 'offer'): Aldus UI finds the account and
 * writes the offer's page, at once or once the offer's team approves
 * (src/lib/offer-from-search.ts). It isn't a build, so it shows no ring.
 */

const BUILDS_ENDPOINT = '/api/page-builds';
const MATCH_ENDPOINT = '/api/page-builds/match';
/* How long the "sent" line stays up: long enough to read a sentence. */
const SENT_MS = 6000;

export type RequestKind = 'account' | 'person' | 'offer';

/** The offer an offer page is asked for, and how it takes pages from search. */
export type OfferRef = { id: string; fromSearch: Exclude<FromSearch, 'off'> };
/** Which field the search bar is asking for, 'pick' while it lists the accounts, or 'sent' once Mark has it. */
export type RequestPhase = null | 'company' | 'pick' | 'person' | 'sent';

/** The company a person page hangs off: one with a page, one picked from the match list, or a website. */
export type CompanyRef = { route: string; name: string } | { lookup: string; key: string; name: string } | { website: string; name?: string };

/** What the rep is told when nothing in Salesforce matches. */
export const noAccountMessage = (text: string) =>
  domainOf(text)
    ? `No Salesforce account has the website ${domainOf(text)}. Try the company’s name instead.`
    : `No Salesforce account is called “${text.trim()}”. Check the spelling, or try its website.`;

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
  const [companyRef, setCompanyRef] = useState<CompanyRef | null>(null);
  const [offerRef, setOfferRef] = useState<OfferRef | null>(null);
  /* The accounts Salesforce matched, while the rep picks one, and which row the keyboard is on. */
  const [matches, setMatches] = useState<AccountMatch | null>(null);
  const [activePick, setActivePick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentNote, setSentNote] = useState<ReactNode>(null);
  /* Whether the 'sent' line is about a build Mark started (or a page that already exists). */
  const [sentStarted, setSentStarted] = useState(false);

  useEffect(() => {
    if (phase !== 'sent') return;
    const id = window.setTimeout(() => {
      setPhase(null);
      setError(null);
    }, SENT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  /** The accounts that could be what was typed. None: say so and let the rep retype. */
  const lookUp = useCallback(async (text: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(MATCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      if (r.status === 401) throw new Error('signed-out');
      const answer = (await r.json().catch(() => null)) as (AccountMatch & { error?: string }) | null;
      if (!r.ok || !answer) {
        setError(answer?.error || "Couldn't look that up. Try again.");
        return;
      }
      if (!answer.accounts.length) {
        setError(noAccountMessage(text));
        return;
      }
      setMatches(answer);
      setActivePick(0);
      setPhase('pick');
    } catch (err) {
      setError(sendErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, []);

  /** Account and offer pages start from the company; a person page from the company, then the name. */
  const start = useCallback(
    (nextKind: RequestKind, query: string, offer?: OfferRef) => {
      const q = query.trim();
      setKind(nextKind);
      // An offer page for a company the index knows starts with its domain.
      const known = nextKind === 'offer' && !looksLikeWebsite(q) ? (findCompany(q)?.domain ?? '') : '';
      setCompany(nextKind === 'account' ? q : nextKind === 'offer' ? (looksLikeWebsite(q) ? q : known) : '');
      setPerson(nextKind === 'person' ? q : '');
      setOfferRef(nextKind === 'offer' ? (offer ?? null) : null);
      setCompanyRef(null);
      setMatches(null);
      setError(null);
      setSubmitting(false);
      setPhase('company');
      // What was typed in search is the company: look it up straight away.
      if (nextKind === 'account' && q) void lookUp(q);
    },
    [findCompany, lookUp],
  );

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
    setMatches(null);
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
        // The list is half an hour old (or the page was reloaded): look the company up again.
        if (r.status === 410) {
          const answer = (await r.json().catch(() => null)) as { message?: string } | null;
          setMatches(null);
          setPhase('company');
          setError(answer?.message || 'That list is out of date. Search for the company again.');
          return false;
        }
        // Asked for minutes ago and still being built, or it has a page: say so instead of starting a second build.
        if (r.status === 409) {
          const answer = (await r.json().catch(() => null)) as { message?: string; route?: string } | null;
          setSentNote(
            answer?.route ? <>{answer.message?.replace(/:.*$/, '')}: {linkTo(answer.route)}</> : answer?.message || 'This page was asked for a few minutes ago and is still being built.',
          );
          setSentStarted(!answer?.route);
          setKind(sentKind);
          setPhase('sent');
          return true;
        }
        if (!r.ok) throw new Error(`${r.status}`);
        const started = (await r.json()) as { build: BuildSummary; company?: BuildSummary };
        onStarted([started.company, started.build].filter((b): b is BuildSummary => !!b));
        setSentNote(note(started));
        setSentStarted(true);
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

  /** The rep picked an account from the list. */
  const choose = useCallback(
    (index: number) => {
      const account: AccountChoice | undefined = matches?.accounts[index];
      if (!matches || !account || submitting) return;
      if (kind === 'person') {
        setCompanyRef(account.page ? { route: account.page.route, name: account.name } : { lookup: matches.lookup, key: account.key, name: account.name });
        setMatches(null);
        setError(null);
        setPhase('person');
        return;
      }
      if (account.page) {
        setSentNote(
          <>
            {account.name} already has a page: {linkTo(account.page.route)}
          </>,
        );
        setSentStarted(false);
        setMatches(null);
        setPhase('sent');
        return;
      }
      void send({ kind: 'account', lookup: matches.lookup, key: account.key }, accountNote);
    },
    [matches, kind, submitting, send],
  );

  const movePick = useCallback(
    (delta: number) => setActivePick((i) => Math.max(0, Math.min((matches?.accounts.length ?? 1) - 1, i + delta))),
    [matches],
  );

  const submit = useCallback(async () => {
    if (phase === 'pick') return choose(activePick);

    if (phase === 'company') {
      const text = company.trim();
      if (kind === 'offer' && offerRef) {
        if (!text) return setError("Enter the company's domain, e.g. anaplan.com");
        if (!looksLikeWebsite(text))
          return setError("Multiple companies might match a name. Enter the company's domain, e.g. anaplan.com, so we know we're asking for the right one.");
        return askOffer(offerRef, text);
      }
      if (kind === 'account') {
        if (!text) return setError('Type the company’s name or its website, e.g. Lenovo');
        return lookUp(text);
      }
      if (!text) return setError('Enter the company they work at');
      // A page the index has under exactly this name or website. A page whose address merely
      // reads like the name is not enough: /lenovo was built for Atlassian on 3 Nov.
      const hit = findCompany(text);
      const t = text.toLowerCase();
      const known = hit && (hit.name.toLowerCase() === t || (!!hit.domain && hit.domain.toLowerCase() === domainOf(text))) ? hit : null;
      // Its route and name only: the person page's request is as it was before findCompany also gave the domain.
      if (known) setCompanyRef({ route: known.route, name: known.name });
      else return lookUp(text);
      setError(null);
      setPhase('person');
      return;
    }

    if (phase === 'person' && companyRef) {
      const who = person.trim();
      if (!who) return setError("Enter the person's name");
      return send({ kind: 'person', personName: who, company: companyRef }, personNote);
    }
  }, [phase, kind, company, person, companyRef, findCompany, send, offerRef, askOffer, lookUp, choose, activePick]);

  /** What the bar's field edits in the current phase. */
  const value = phase === 'person' ? person : company;
  const setValue = useCallback(
    (v: string) => {
      if (phase === 'person') setPerson(v);
      else {
        setCompany(v);
        // Typing again means the list no longer answers what is in the field.
        if (phase === 'pick') {
          setMatches(null);
          setPhase('company');
        }
      }
      setError(null);
    },
    [phase],
  );

  const companyLabel = companyRef ? ('website' in companyRef ? companyRef.website : companyRef.name) : '';
  const placeholder =
    phase === 'person'
      ? `Who at ${companyLabel || 'this company'}?`
      : kind === 'person'
        ? 'Company they work at, e.g. Lenovo'
        : kind === 'offer'
          ? 'Company domain, e.g. anaplan.com'
          : 'Company name or website, e.g. Lenovo';

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
    /** A badge Mark read, while the rep checks it (the line being fixed: `phase`), and its company. */
    card: shown?.card ?? null,
    cardCompany: shown?.cardCompany ?? null,
    /** The bar's line in place of the field while Mark reads the badge and while the card waits for a send. */
    badgeStatus: shown?.status ?? null,
    /** The panel's note for a badge (null otherwise). */
    badgeHint: shown?.hint ?? null,
    scan: badge.scan,
    edit: editCard,
    sentStarted,
    /** While the rep picks: the accounts Salesforce matched, and the row the keyboard is on. */
    matches,
    activePick,
    setActivePick,
    movePick,
    choose,
    /** Person requests: the company will need its page built first. */
    companyIsNew: !!companyRef && !('route' in companyRef),
    /** An offer page request: how the offer takes pages from search. */
    offerMode: kind === 'offer' ? (offerRef?.fromSearch ?? null) : null,
    start,
    cancel,
    submit: shown ? sendCard : submit,
  };
}
