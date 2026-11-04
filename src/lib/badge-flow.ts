import { companyOf, hostOf, requestFromCard, type BadgeCard, type FindCompany } from './badge-card';

/*
 * A badge on the search page, step by step. Pure: useBadgeCard keeps the state,
 * server/badge-read-check.ts checks the steps.
 *
 * Mark reads the badge ('reading'), the panel shows the card ('card'), a tapped
 * line is fixed in the bar ('person' then 'title', or 'company') and comes back
 * to the card. Only the go button on the card sends it: no other step ever
 * does. Cancel while fixing a line puts the card back as it was when the line
 * was tapped.
 */

export type BadgePhase = 'reading' | 'card' | 'person' | 'title' | 'company';

export type BadgeState = {
  phase: BadgePhase;
  /** What the panel shows (null while Mark reads). */
  card: BadgeCard | null;
  /** The line being fixed, as typed in the bar. */
  draft: string;
  /** The card when the line was tapped: Cancel puts it back. */
  saved: BadgeCard | null;
  error: string | null;
};

export type BadgeEvent =
  | { type: 'read'; card: BadgeCard }
  | { type: 'edit'; field: 'person' | 'company' }
  | { type: 'type'; text: string }
  | { type: 'submit' }
  | { type: 'cancel' };

/** The page request the rep sent from the card: the exact /api/page-builds body. */
export type BadgeSend = { body: Record<string, unknown>; companyIsNew: boolean };

/** Where a step leaves the badge (null: put away), and the page request when the rep sent the card. */
export type BadgeStep = { state: BadgeState | null; send?: BadgeSend };

export const READING: BadgeState = { phase: 'reading', card: null, draft: '', saved: null, error: null };

const onCard = (card: BadgeCard): BadgeState => ({ phase: 'card', card, draft: '', saved: null, error: null });

/* Words in a company's name that say nothing about which company it is. */
const GENERIC = new Set(['the', 'and', 'inc', 'corp', 'corporation', 'company', 'group', 'holding', 'holdings', 'ltd', 'limited', 'llc', 'plc', 'gmbh', 'international', 'global']);

/**
 * Whether a name and a domain look like one company: a word of the name (three
 * letters or more) in one of the domain's labels, or the whole name as one
 * ("Acme" and acmecorp.com, "Wolters Kluwer" and wolterskluwer.nl, "HP" and hp.com).
 */
export function sameCompany(name: string, domain: string): boolean {
  const labels = domain.toLowerCase().split('.').slice(0, -1).map((label) => label.replace(/-/g, ''));
  const plain = name.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const words = plain.split(/\s+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
  const whole = plain.replace(/\s+/g, '');
  return labels.some((label) => label === whole || words.some((w) => label.includes(w)));
}

export function badgeStep(state: BadgeState, event: BadgeEvent, findCompany: FindCompany): BadgeStep {
  const { card } = state;
  switch (event.type) {
    case 'read':
      return { state: onCard(event.card) };
    case 'type':
      return { state: { ...state, draft: event.text, error: null } };
    case 'cancel':
      // Fixing a line: back to the card as it was when the line was tapped. On the card, or while Mark reads: put away.
      return { state: card && state.phase !== 'card' ? onCard(state.saved ?? card) : null };
    case 'edit':
      if (!card) return { state };
      return {
        state: {
          phase: event.field,
          card,
          // The company line starts from the domain read: it is what decides which company.
          draft: event.field === 'person' ? card.name : card.domain || card.company,
          saved: state.saved ?? card,
          error: null,
        },
      };
    case 'submit':
      return card ? submit(state, card, findCompany) : { state };
  }
}

function submit(state: BadgeState, card: BadgeCard, findCompany: FindCompany): BadgeStep {
  if (state.phase === 'card') {
    const asked = requestFromCard(card, findCompany);
    // A line the page can't do without: the bar asks for it instead of sending.
    if ('needs' in asked) return badgeStep(state, { type: 'edit', field: asked.needs }, findCompany);
    return { state, send: asked };
  }
  const text = state.draft.trim();
  const ask = (error: string): BadgeStep => ({ state: { ...state, error } });

  if (state.phase === 'person') {
    if (!text) return ask("Enter the person's name");
    // The name is kept; the title comes next, starting from what the badge read.
    const named = { ...card, name: text.slice(0, 120) };
    return { state: { phase: 'title', card: named, draft: named.title, saved: named, error: null } };
  }
  if (state.phase === 'title') return { state: onCard({ ...card, title: text.slice(0, 160) }) };

  if (!text) return ask('Enter the company they work at');
  const known = findCompany(text);
  const host = hostOf(text);
  if (known) return { state: onCard({ ...card, company: known.name, domain: host }) };
  if (host) {
    // The domain typed wins: a name read off the badge that finds another company's page is dropped.
    return { state: onCard({ ...card, domain: host, company: card.company && findCompany(card.company) ? '' : card.company }) };
  }
  const company = text.slice(0, 120);
  // A misread name, fixed: the domain read off the badge stays.
  if (card.domain && sameCompany(company, card.domain)) return { state: onCard({ ...card, company }) };
  // Another company, by a name with no page: its domain comes next (Cancel puts the card back).
  return {
    state: {
      ...state,
      card: { ...card, company, domain: '' },
      error: `No page for ${text} yet, and multiple companies might match that name. Enter its domain, e.g. anaplan.com.`,
    },
  };
}

/** What the bar and the panel say: the bar's line in place of the field, the panel's note, the field's placeholder. */
export function badgeWords(state: BadgeState, findCompany: FindCompany): { status: string | null; hint: string | null; placeholder: string } {
  const { card } = state;
  if (state.phase === 'reading' || !card) return { status: 'Mark is reading the badge…', hint: 'Their name, title and company show up here.', placeholder: '' };
  const company = companyOf(card, findCompany);
  const companyName = company ? ('route' in company ? company.name : card.company || company.website) : card.company;
  if (state.phase === 'person') return { status: null, hint: 'Fix their name, then their title.', placeholder: `Who at ${companyName || 'this company'}?` };
  if (state.phase === 'title') return { status: null, hint: 'Fix their title, or leave it empty.', placeholder: 'Their title (optional)' };
  if (state.phase === 'company')
    return { status: null, hint: 'The company they work at: one that has a page, or its domain.', placeholder: 'Company they work at, or its domain' };

  const asked = requestFromCard(card, findCompany);
  // A line still missing: the bar asks for it, and its row already says to tap it.
  if ('needs' in asked) return { status: asked.needs === 'person' ? `Who at ${companyName || 'this company'}?` : 'Which company?', hint: null, placeholder: '' };
  return {
    status: `Build a page for ${card.name || companyName}?`,
    hint:
      asked.body.kind === 'account'
        ? "Mark builds the company's page in about 15 minutes. Tap a line to fix it."
        : asked.companyIsNew
          ? "Mark builds the company's page first (about 15 minutes), then this person's (about 4 more). Tap a line to fix it."
          : 'Mark builds a page for this person in about 4 minutes. Tap a line to fix it.',
    placeholder: '',
  };
}
