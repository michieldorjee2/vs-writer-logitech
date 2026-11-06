import { useCallback, useEffect, useRef, useState } from 'react';
import { companyOf, requestFromCard, type FindCompany } from '../lib/badge-card';
import { badgeStep, badgeWords, MARK_READING, READING, type BadgeEvent, type BadgeSend, type BadgeState } from '../lib/badge-flow';
import { readBadgeOnDevice } from '../lib/badge-read-device';
import { READ_FAILURE, readBadge } from '../lib/badge-scan';

/*
 * A badge the rep scanned on the search page, mounted by usePageRequest and
 * shown on the lanyard's badge (BadgeLanyard): the browser reads it
 * (badge-read-device.ts), Mark only when the browser couldn't and Mark's reader
 * is set up (`markReads`). The badge shows the card, a line is fixed on the
 * badge, and the card's send hands usePageRequest the page request. The steps
 * are src/lib/badge-flow.ts.
 */

const SIGNED_OUT = 'Your Optimizely sign-in has ended. Reload the page to sign in again.';

export function useBadgeCard({ findCompany, markReads = false }: { findCompany: FindCompany; markReads?: boolean }) {
  const [state, setState] = useState<BadgeState | null>(null);
  const reading = useRef<AbortController | null>(null);

  /* A read still under way when the page goes stops polling. */
  useEffect(() => () => reading.current?.abort(), []);

  /** Puts the badge away (sent, closed, or scanning another), and stops a read under way. */
  const stop = useCallback(() => {
    reading.current?.abort();
    reading.current = null;
    setState(null);
  }, []);

  /** One step of the flow; returns the page request when the rep sent the card. */
  const step = useCallback(
    (event: BadgeEvent): BadgeSend | null => {
      if (!state) return null;
      const next = badgeStep(state, event, findCompany);
      if (!next.state) stop();
      else setState(next.state);
      return next.send ?? null;
    },
    [state, findCompany, stop],
  );

  /** The badge in the photo is read, here and failing that by Mark; the badge then shows the card, or says why it couldn't. */
  const scan = useCallback(
    async (file: File) => {
      reading.current?.abort();
      const controller = new AbortController();
      reading.current = controller;
      setState(READING);
      const failed = (error: string) => setState(badgeStep(READING, { type: 'failed', error }, findCompany).state);
      const here = await readBadgeOnDevice(file, controller.signal);
      if (controller.signal.aborted) return;
      if (here) {
        reading.current = null;
        return setState(badgeStep(READING, { type: 'read', card: here }, findCompany).state);
      }
      if (!markReads) {
        reading.current = null;
        return failed(READ_FAILURE.failed);
      }
      setState(MARK_READING);
      const read = await readBadge(file, controller.signal);
      if (controller.signal.aborted) return;
      reading.current = null;
      if ('card' in read) return setState(badgeStep(MARK_READING, { type: 'read', card: read.card }, findCompany).state);
      failed(read.failure === 'signed-out' ? SIGNED_OUT : READ_FAILURE[read.failure]);
    },
    [findCompany, markReads],
  );

  /** A badge typed in by hand: a blank card, its lines filled in on the badge. */
  const blank = useCallback(() => {
    reading.current?.abort();
    reading.current = null;
    setState(badgeStep(READING, { type: 'blank' }, findCompany).state);
  }, [findCompany]);

  const card = state?.card ?? null;
  const asked = card ? requestFromCard(card, findCompany) : null;
  const words = state ? badgeWords(state, findCompany) : null;
  return {
    /** A badge is up: reading, failed, or the card. */
    active: !!state,
    phase: state?.phase ?? null,
    /** Who is reading it: 'device' (the browser) or 'mark'. */
    reader: state?.reader ?? null,
    card,
    /** The card's company: one with a page, the website of one without, or null. */
    company: card ? companyOf(card, findCompany) : null,
    /** The line a page can't do without, still missing on the card (null: ready to send). */
    needs: asked && 'needs' in asked ? asked.needs : null,
    /** What a send asks Mark for, in words ("Mark builds a page for this person in about 4 minutes…"). */
    note: card && !(asked && 'needs' in asked) ? (words?.hint ?? null) : null,
    error: state?.error ?? null,
    scan,
    blank,
    /** A line fixed on the badge. Several in a row each build on the last (a person picked fixes the name, then the company). */
    fix: (field: 'name' | 'title' | 'company', text: string) =>
      setState((prev) => (prev ? (badgeStep(prev, { type: 'fix', field, text }, findCompany).state ?? prev) : prev)),
    /** The card's page request, to send (null while a line it needs is missing). */
    submit: () => step({ type: 'submit' }),
    stop,
  };
}
