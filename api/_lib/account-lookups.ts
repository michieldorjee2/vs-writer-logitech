/**
 * The accounts a rep was offered on the search page, kept server-side so the
 * browser only ever holds a lookup id and a key per account ('a1' …), never a
 * Salesforce id. A pick is honoured only for the rep the lookup was made for,
 * and only for half an hour.
 *
 *   pb:match:<id>          the lookup (MatchRecord)
 *   pb:match-count:<email> the rep's lookups in the last ten minutes
 *
 * Same Upstash store as the page builds (page-builds-store.ts).
 */
import { randomBytes } from 'node:crypto';
import { choiceOf, domainLabel, domainOf, rankAccounts, rowDomain, rowId, type AccountChoice, type SalesforceAccountRow } from '../../src/lib/account-match.js';
import { slugify } from '../../src/lib/page-builds.js';
import { salesforceIds } from '../../src/lib/parent-account.js';
import type { BuildStore } from './page-builds-store.js';

const KEEP_SECONDS = 30 * 60;
/* Listed for the rep. Ranked first, so the one they mean is almost always here. */
export const MAX_CHOICES = 8;
/* A rep looks up a handful of companies at a time; this only stops a runaway loop. */
export const MATCHES_PER_WINDOW = 40;
const WINDOW_SECONDS = 10 * 60;

/** One offered account, as the server keeps it. */
export type HeldAccount = { key: string; crmAccountId: string; name: string; domain: string | null; page: { route: string } | null };
type MatchRecord = { email: string; query: string; at: number; accounts: HeldAccount[] };

const matchKey = (id: string) => `pb:match:${id}`;
const countKey = (email: string) => `pb:match-count:${email.trim().toLowerCase()}`;

/** False once the rep has looked up MATCHES_PER_WINDOW companies in ten minutes. */
export async function underMatchLimit(store: Pick<BuildStore, 'set' | 'incr'>, email: string): Promise<boolean> {
  const key = countKey(email);
  // NX + EX starts the window once; INCR then counts within it.
  await store.set(key, 0, { nx: true, ex: WINDOW_SECONDS });
  return (await store.incr(key)) <= MATCHES_PER_WINDOW;
}

export async function saveMatch(store: BuildStore, email: string, query: string, accounts: HeldAccount[]): Promise<string> {
  const id = randomBytes(9).toString('base64url');
  const record: MatchRecord = { email: email.trim().toLowerCase(), query, at: Date.now(), accounts };
  await store.set(matchKey(id), record, { ex: KEEP_SECONDS });
  return id;
}

/** The account the rep picked, or null: unknown or expired lookup, another rep's, or no such key. */
export async function pickedAccount(store: BuildStore, lookup: unknown, key: unknown, email: string): Promise<HeldAccount | null> {
  if (typeof lookup !== 'string' || !/^[A-Za-z0-9_-]{8,32}$/.test(lookup)) return null;
  if (typeof key !== 'string' || !/^a\d{1,2}$/.test(key)) return null;
  const record = await store.get<MatchRecord>(matchKey(lookup));
  if (!record || record.email !== email.trim().toLowerCase()) return null;
  return record.accounts.find((a) => a.key === key) ?? null;
}

/* ---------- Pages the accounts already have ---------- */

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

export const ACCOUNT_PAGES_QUERY = `
query AccountPages($sf: [String], $urls: [String]) {
  CompetitorComparisonPage(
    locale: en
    limit: 50
    where: { _or: [{ salesforceAccountID: { in: $sf } }, { _metadata: { url: { hierarchical: { in: $urls } } } }] }
  ) {
    items { _metadata { url { hierarchical } } salesforceAccountID brandDomain }
  }
}
`;

type PageItem = { _metadata?: { url?: { hierarchical?: string | null } | null } | null; salesforceAccountID?: string | null; brandDomain?: string | null };

/** The addresses an account's page would have: its name's, and its website's (heineken.com → /heineken/). */
export function candidateRoutes(row: SalesforceAccountRow): string[] {
  const d = rowDomain(row);
  return [...new Set([slugify(row.Name ?? ''), d ? slugify(domainLabel(d)) : ''].filter(Boolean))];
}

/**
 * Each account's existing page: by its Salesforce id; else a page at one of its addresses
 * whose website is the account's. The website must agree: /lenovo was built for Atlassian
 * on 3 Nov, and an address alone would have given Lenovo that page. At the website's own
 * address (not the name's), only when no other listed account has that website. Most
 * pages carry a placeholder id, hence the addresses.
 */
export function pagesFor(rows: SalesforceAccountRow[], items: PageItem[]): Map<string, { route: string }> {
  const routeOf = (i: PageItem) => (i._metadata?.url?.hierarchical ?? '').replace(/^\/+|\/+$/g, '');
  const pages = items
    .map((i) => ({ route: routeOf(i), sf: salesforceIds(i.salesforceAccountID).map((x) => x.slice(0, 15)), domain: domainOf(i.brandDomain) }))
    // Person pages and offer pages live deeper or elsewhere.
    .filter((p) => p.route && !p.route.includes('/'));
  const domainCount = new Map<string, number>();
  for (const row of rows) {
    const d = rowDomain(row);
    if (d) domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
  }
  const out = new Map<string, { route: string }>();
  for (const row of rows) {
    const id = rowId(row).slice(0, 15);
    const d = rowDomain(row);
    const byId = pages.find((p) => id && p.sf.includes(id));
    const byName = d ? pages.find((p) => p.domain === d && p.route === slugify(row.Name ?? '')) : undefined;
    const byWebsite = d && domainCount.get(d) === 1 ? pages.find((p) => p.domain === d && candidateRoutes(row).includes(p.route)) : undefined;
    const hit = byId ?? byName ?? byWebsite;
    if (hit) out.set(rowId(row), { route: hit.route });
  }
  return out;
}

async function existingPages(rows: SalesforceAccountRow[]): Promise<Map<string, { route: string }>> {
  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey || !rows.length) return new Map();
  const sf = rows.flatMap((r) => salesforceIds(rowId(r)));
  const urls = [...new Set(rows.flatMap(candidateRoutes))].map((r) => `/${r}/`);
  try {
    const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ACCOUNT_PAGES_QUERY, variables: { sf, urls } }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await r.json()) as { data?: { CompetitorComparisonPage?: { items?: PageItem[] } }; errors?: unknown };
    if (!r.ok || body.errors) throw new Error(`Graph answered ${r.status}`);
    return pagesFor(rows, body.data?.CompetitorComparisonPage?.items ?? []);
  } catch (err) {
    console.warn('[account-lookups] existing pages not read:', err instanceof Error ? err.message : err);
    return new Map();
  }
}

/** Ranks what Salesforce found, notes the pages already built, and keeps the lookup for the rep. */
export async function offerAccounts(
  store: BuildStore,
  email: string,
  query: string,
  rows: SalesforceAccountRow[],
): Promise<{ lookup: string; accounts: AccountChoice[]; more: boolean }> {
  const ranked = rankAccounts(rows, query);
  const shown = ranked.slice(0, MAX_CHOICES);
  const pages = await existingPages(shown);
  const held: HeldAccount[] = shown.map((r, i) => {
    const c = choiceOf(r, `a${i + 1}`, pages.get(rowId(r)) ?? null);
    return { key: c.key, crmAccountId: rowId(r), name: c.name, domain: c.domain, page: c.page };
  });
  const lookup = await saveMatch(store, email, query, held);
  return { lookup, accounts: shown.map((r, i) => choiceOf(r, `a${i + 1}`, held[i].page)), more: ranked.length > MAX_CHOICES };
}
