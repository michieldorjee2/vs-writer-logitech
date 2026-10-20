/**
 * What /home lists: every account page (as /search has it), every person page,
 * and which account pages name the signed-in person on their team.
 *
 * One module for both servers — api/home-index.ts and the Vite dev proxy — so
 * the queries cannot drift between them (see the note at the top of
 * vite.config.ts), and `npm run check:graph` covers them here.
 *
 * Pure: the caller hands in how to run a Graph query.
 */
import type { GraphResponse } from './graph-envelope.js';

/** Graph caps `limit` at 100 per page; the cap matches api/search-index.ts. */
const PAGE_SIZE = 100;
const MAX_ITEMS = 5000;

/* The search index's fields, plus the team's addresses for "My accounts".
   Graph only filters `teamMembers` as a string, so the match is made here. */
export const HOME_COMPANIES_QUERY = `
query HomeCompanies($limit: Int!, $skip: Int!) {
  CompetitorComparisonPage(
    locale: en
    limit: $limit
    skip: $skip
    orderBy: { _metadata: { published: DESC } }
  ) {
    total
    items {
      _metadata { url { default hierarchical } published }
      headline
      eyebrow
      competitorName
      brandDomain
      brandAccentColor
      customerLogo
      intelHeadline
      teamMembers { Email }
    }
  }
}
`;

export const HOME_PEOPLE_QUERY = `
query HomePeople($limit: Int!, $skip: Int!) {
  PersonPage(
    locale: en
    limit: $limit
    skip: $skip
    orderBy: { _metadata: { published: DESC } }
  ) {
    total
    items {
      _metadata { url { default hierarchical } published }
      personName
      personTitle
      personInitials
      companyName
      companyLogo { default }
      brandAccentColor
    }
  }
}
`;

/** An account page as the search index lists it (search-entries.ts reads it in the browser). */
export type CompanyItem = {
  _metadata: { url: { default: string; hierarchical: string }; published: string | null };
  headline: string | null;
  eyebrow: string | null;
  competitorName: string | null;
  brandDomain: string | null;
  brandAccentColor: string | null;
  customerLogo: string | null;
  intelHeadline: string | null;
};

export type PersonItem = {
  _metadata: { url: { default: string; hierarchical: string }; published: string | null };
  personName: string | null;
  personTitle: string | null;
  personInitials: string | null;
  companyName: string | null;
  companyLogo: { default: string | null } | null;
  brandAccentColor: string | null;
};

type CompanyRow = CompanyItem & { teamMembers?: Array<{ Email: string | null } | null> | null };

/** Everything Graph returned, before it is cut down for one person. */
export type HomeIndexSource = { companies: CompanyRow[]; total: number; people: PersonItem[] };

export type HomeIndexBody = {
  companies: CompanyItem[];
  /** Account pages on the site (before the browser folds one company's pages together). */
  total: number;
  people: PersonItem[];
  /** `_metadata.url.hierarchical` of the account pages that list this person on the team. */
  mine: string[];
  /** Whose answer this is (lowercased email). A copy kept for offline is only shown to them. */
  viewer: string;
};

export type RunGraph = (query: string, variables: Record<string, unknown>) => Promise<GraphResponse>;

async function drain<T>(run: RunGraph, query: string, root: string): Promise<{ items: T[]; total: number }> {
  const first = await run(query, { limit: PAGE_SIZE, skip: 0 });
  const total = first?.data?.[root]?.total ?? 0;
  const items = [...((first?.data?.[root]?.items ?? []) as T[])];
  const rest: Promise<GraphResponse>[] = [];
  for (let skip = PAGE_SIZE; skip < Math.min(total, MAX_ITEMS); skip += PAGE_SIZE) {
    rest.push(run(query, { limit: PAGE_SIZE, skip }));
  }
  for (const chunk of await Promise.all(rest)) items.push(...((chunk?.data?.[root]?.items ?? []) as T[]));
  return { items, total };
}

export async function loadHomeIndex(run: RunGraph): Promise<HomeIndexSource> {
  const [companies, people] = await Promise.all([
    drain<CompanyRow>(run, HOME_COMPANIES_QUERY, 'CompetitorComparisonPage'),
    drain<PersonItem>(run, HOME_PEOPLE_QUERY, 'PersonPage'),
  ]);
  return { companies: companies.items, total: companies.total, people: people.items };
}

/** The answer for one signed-in person: no one else's team addresses leave the server. */
export function homeIndexFor(source: HomeIndexSource, email: string): HomeIndexBody {
  const me = email.trim().toLowerCase();
  const mine: string[] = [];
  const companies = source.companies.map(({ teamMembers, ...item }) => {
    if (me && teamMembers?.some((m) => m?.Email?.trim().toLowerCase() === me)) {
      mine.push(item._metadata?.url?.hierarchical ?? '');
    }
    return item;
  });
  return { companies, total: source.total, people: source.people, mine: mine.filter(Boolean), viewer: me };
}
