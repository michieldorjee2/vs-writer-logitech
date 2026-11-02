import { useCallback, useEffect, useRef, useState } from 'react';
import { companyOf, type FindCompany } from '../lib/badge-card';
import { badgeStep, badgeWords, READING, type BadgeEvent, type BadgeSend, type BadgeState } from '../lib/badge-flow';
import { readBadge, type ReadFailure } from '../lib/badge-scan';

/*
 * A badge the rep scanned on the search page (phones, behind MARK_BADGE_AGENT_ID),
 * mounted by usePageRequest: Mark reads it, the panel shows the card, a tapped
 * line is fixed in the bar, and the go button on the card hands usePageRequest
 * the page request to send. The steps are src/lib/badge-flow.ts.
 */
export function useBadgeCard({ findCompany, onFailed }: { findCompany: FindCompany; onFailed: (failure: ReadFailure) => void }) {
  const [state, setState] = useState<BadgeState | null>(null);
  const reading = useRef<AbortController | null>(null);

  /* A read still under way when the page goes stops polling. */
  useEffect(() => () => reading.current?.abort(), []);

  /** Puts the badge away (sent, or the request started over), and stops a read under way. */
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

  /** Mark reads the badge in the photo; the panel then shows the card. A failed read hands back to the company step. */
  const scan = useCallback(
    async (file: File) => {
      reading.current?.abort();
      const controller = new AbortController();
      reading.current = controller;
      setState(READING);
      const read = await readBadge(file, controller.signal);
      if (controller.signal.aborted) return;
      reading.current = null;
      if ('card' in read) return setState(badgeStep(READING, { type: 'read', card: read.card }, findCompany).state);
      setState(null);
      onFailed(read.failure);
    },
    [findCompany, onFailed],
  );

  const words = state ? badgeWords(state, findCompany) : null;
  return {
    /** A badge is up: reading, the card, or a line being fixed. */
    active: !!state,
    phase: state?.phase ?? null,
    card: state?.card ?? null,
    /** The card's company: one with a page, the website of one without, or null. */
    cardCompany: state?.card ? companyOf(state.card, findCompany) : null,
    value: state?.draft ?? '',
    setValue: (text: string) => void step({ type: 'type', text }),
    placeholder: words?.placeholder ?? '',
    error: state?.error ?? null,
    /** The bar's line in place of the field while Mark reads and while the card waits for the tap. */
    status: words?.status ?? null,
    /** The panel's note. */
    hint: words?.hint ?? null,
    scan,
    edit: (field: 'person' | 'company') => void step({ type: 'edit', field }),
    cancel: () => void step({ type: 'cancel' }),
    /** The go button: the line being fixed goes back to the card, or the card's page request comes back to send. */
    submit: () => step({ type: 'submit' }),
    stop,
  };
}
