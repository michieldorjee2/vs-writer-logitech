/**
 * Asking for an offer's page from the search page (Notion: "Allow for one-off
 * campaign pages from search"). Run as an offer whose team allows it (Aldus
 * UI's Pages from search: On or Approve first), the Companies column offers
 * "Add offer page" for a company the offer has no page for, and Mark writes
 * it, at once or once the offer's team approves. Aldus UI finds the account
 * by its domain, queues the page and refuses what it can't do.
 *
 * Pure: the search page, its API route and scripts/check-offer-from-search.ts
 * share it.
 */
import type { FromSearch, OfferPageAsk, RunningOffer } from './offer-looks.js';

export const isFromSearch = (v: unknown): v is FromSearch => v === 'off' || v === 'on' || v === 'approval';

/** Whether the search page offers "Add offer page": run as an offer that takes pages from search, a query, and none of its pages named exactly that. */
export function offerAddShown(running: Pick<RunningOffer, 'fromSearch' | 'pages'> | null, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!running || !q || (running.fromSearch !== 'on' && running.fromSearch !== 'approval')) return false;
  return !running.pages.some((p) => p.companyName.trim().toLowerCase() === q);
}

/** The words of the request, by setting. */
export const OFFER_ASK_WORDS = {
  row: 'Add offer page',
  meta: { on: 'Mark writes this offer’s page for “{q}”', approval: 'Ask for this offer’s page for “{q}”' },
  go: { on: 'Send to Mark', approval: 'Ask for approval' },
  heading: 'New offer page',
  hint: {
    on: 'Mark finds the account by its domain and writes this offer’s page.',
    approval: 'The offer’s team approves it first, then Mark writes the page.',
  },
} as const;

/** What a rep reads when the offer refuses for a reason of its own (Aldus UI's samples, cap, page setup or workflow). */
export const OFFER_CANT_TAKE_MORE = 'This offer can’t take more pages right now.';

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');

/** What the search bar says after an ask: a note once it's sent, or the error line. */
export function askNote(status: number, answer: OfferPageAsk, domain: string): { kind: 'sent' | 'error'; text: string } {
  const account = answer.account?.name ?? domain;
  if (status === 200 && answer.outcome === 'started') return { kind: 'sent', text: `Mark is writing ${account}’s page. It shows up in this offer’s list when it’s live.` };
  if (status === 200 && answer.outcome === 'waiting') return { kind: 'sent', text: `${account}’s page is in the queue. It shows up in this offer’s list when it’s live.` };
  if (status === 200 && answer.outcome === 'asked') {
    if (answer.again) return { kind: 'sent', text: 'Already asked. It’s waiting for approval.' };
    if ((answer.choices ?? 1) > 1) return { kind: 'sent', text: `Sent for approval. Several accounts match ${domain}, so the offer’s team picks one.` };
    return { kind: 'sent', text: 'Sent for approval. Mark writes the page once the offer’s team approves it.' };
  }
  switch (answer.code) {
    case 'none':
      return { kind: 'error', text: `No account matches ${domain}. Check the domain.` };
    case 'has-page':
      return { kind: 'error', text: `${account} has this offer’s page already.` };
    case 'writing':
      return { kind: 'error', text: `Mark is already writing ${account}’s page for this offer.` };
    case 'waiting':
      return { kind: 'error', text: `${account}’s page is already in the queue for this offer.` };
    case 'unsure':
      return { kind: 'error', text: 'Still reading the account list. Try again in a minute.' };
    case 'off':
    case 'not-running':
      return { kind: 'error', text: 'This offer doesn’t take pages from search.' };
    case 'website':
      return { kind: 'error', text: "Enter the company's domain, e.g. anaplan.com" };
  }
  if (status === 401) return { kind: 'error', text: 'Your Optimizely sign-in has ended. Reload the page to sign in again.' };
  // The offer can't take this page now (its page setup, its samples, the draft cap, this deployment's
  // workflow): one plain line a rep can read. Aldus UI's own words are for its team and its logs.
  if ((status >= 400 && status < 500) || answer.code === 'not-configured') return { kind: 'error', text: OFFER_CANT_TAKE_MORE };
  return { kind: 'error', text: "Couldn't reach Mark. Try again." };
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : undefined);

/** Aldus UI's answer, cut to the fields the search page reads: nothing else reaches the browser. */
export function askAnswerOf(raw: unknown): OfferPageAsk {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: OfferPageAsk = {};
  if (b.outcome === 'started' || b.outcome === 'waiting' || b.outcome === 'asked') out.outcome = b.outcome;
  const name = b.account && typeof b.account === 'object' ? text((b.account as Record<string, unknown>).name, 200) : undefined;
  if (name) out.account = { name };
  if (typeof b.choices === 'number' && Number.isFinite(b.choices)) out.choices = b.choices;
  if (b.again === true) out.again = true;
  const code = text(b.code, 40);
  if (code) out.code = code;
  const error = text(b.error, 300);
  if (error) out.error = error;
  const domain = text(b.domain, 200);
  if (domain) out.domain = domain;
  const pageUrl = text(b.pageUrl, 2000);
  if (pageUrl && /^https:\/\//.test(pageUrl)) out.pageUrl = pageUrl;
  return out;
}

export { fill as fillOfferWords };
