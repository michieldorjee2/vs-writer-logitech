/**
 * `withParentAccount` wraps every experience the site serves (api/content.ts,
 * server/ssr-handler.tsx, the dev proxy in vite.config.ts), like `withOfferSignup`: an offer page
 * without a logo of its own shows its parent account page's logo, and takes its domain when it
 * has none. How the parent is found: src/lib/parent-account.ts.
 *
 * Read-only against Graph, one small query per company, held per instance (an answer 10 minutes,
 * a failure 30 seconds). Slow or failing, it never fails a page: after 1.5 s the page is served
 * as it is, with its initials.
 */
import { hasOwnLogo, parentAccountUrls, pickParentAccount, salesforceIds, type ParentAccount } from '../../src/lib/parent-account.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';
const HOLD_MS = 10 * 60_000;
const FAILED_HOLD_MS = 30_000;
const TIMEOUT_MS = 1_500;

export const PARENT_ACCOUNT_QUERY = `
query ParentAccount($urls: [String], $sf: [String]) {
  CompetitorComparisonPage(
    locale: en
    limit: 10
    where: { _or: [{ _metadata: { url: { hierarchical: { in: $urls } } } }, { salesforceAccountID: { in: $sf } }] }
  ) {
    items { _metadata { url { hierarchical } } salesforceAccountID customerLogo brandDomain }
  }
}
`;

type Item = {
  _metadata?: { url?: { hierarchical?: string | null } | null } | null;
  salesforceAccountID?: string | null;
  customerLogo?: string | null;
  brandDomain?: string | null;
};

/** Per instance, by company name and Salesforce account. */
const held = new Map<string, { at: number; parent: ParentAccount | null; failed: boolean }>();

async function parentOf(companyName: string, salesforceAccountID: string | null): Promise<ParentAccount | null> {
  const key = parentKey(companyName, salesforceAccountID);
  const hit = held.get(key);
  if (hit && Date.now() - hit.at < (hit.failed ? FAILED_HOLD_MS : HOLD_MS)) return hit.parent;
  const urls = parentAccountUrls(companyName);
  const sf = salesforceIds(salesforceAccountID);
  const authKey = process.env.GRAPH_AUTH_KEY;
  if ((!urls.length && !sf.length) || !authKey) return null;
  let parent: ParentAccount | null = null;
  let failed = false;
  try {
    const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PARENT_ACCOUNT_QUERY, variables: { urls, sf } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await r.json()) as { data?: { CompetitorComparisonPage?: { items?: Item[] } }; errors?: unknown };
    if (!r.ok || body.errors) throw new Error(`Graph answered ${r.status}`);
    const found = (body.data?.CompetitorComparisonPage?.items ?? []).map((i) => ({
      url: i._metadata?.url?.hierarchical ?? '',
      logo: i.customerLogo || null,
      domain: i.brandDomain || null,
      salesforceAccountID: i.salesforceAccountID || null,
    }));
    parent = pickParentAccount(urls, found, sf);
  } catch (err) {
    failed = true;
    console.warn('[parent-account] not read, the page keeps its initials:', err instanceof Error ? err.message : err);
  }
  held.set(key, { at: Date.now(), parent, failed });
  return parent;
}

type Experience = {
  __typename?: unknown;
  companyName?: unknown;
  salesforceAccountID?: string | null;
  customerLogo?: { default?: string | null } | null;
  brandDomain?: string | null;
};

/** The offer page with its parent account's logo (and domain) where it has none; otherwise as given. Never throws. */
export async function withParentAccount<T>(item: T): Promise<T> {
  try {
    const page = item as Experience | null;
    if (!page || page.__typename !== 'ABMExperience' || typeof page.companyName !== 'string') return item;
    if (hasOwnLogo(page.customerLogo?.default) && page.brandDomain) return item;
    const parent = await parentOf(page.companyName, page.salesforceAccountID ?? null);
    if (!parent) return item;
    const logo = hasOwnLogo(page.customerLogo?.default) ? page.customerLogo!.default! : parent.logo;
    return { ...item, customerLogo: { ...(page.customerLogo ?? {}), default: logo }, brandDomain: page.brandDomain || parent.domain, parentAccountUrl: parent.url };
  } catch (err) {
    console.warn('[parent-account] left the page as it is:', err instanceof Error ? err.message : err);
    return item;
  }
}

/** For the check: forget what was held. */
export function forgetParentAccounts(): void {
  held.clear();
}

/** Lookups (URLs and IDs) per batched query; each finds at most one account page per URL, well under Graph's 100. */
const BATCH_URLS = 90;
/** Batched queries at a time: Graph slows a burst of parallel queries down for all of them. */
const BATCH_PARALLEL = 3;
const BATCH_TIMEOUT_MS = 5_000;

/**
 * The parent account of many companies at once, for lists (the search page's offer pages, via
 * api/_lib/offer-pages.ts and offers.ts): their candidate URLs and Salesforce IDs asked in a few
 * batched queries instead of one per company, then each picked as `parentOf` would. Held like
 * `parentOf`. A batch that fails leaves its companies without a parent this time. Never throws.
 */
export async function parentAccountsOf(
  companies: Array<{ companyName: string; salesforceAccountID?: string | null }>,
): Promise<Map<string, ParentAccount | null>> {
  const out = new Map<string, ParentAccount | null>();
  const todo: Array<{ key: string; urls: string[]; sf: string[] }> = [];
  for (const c of companies) {
    const key = parentKey(c.companyName, c.salesforceAccountID);
    if (out.has(key) || todo.some((t) => t.key === key)) continue;
    const hit = held.get(key);
    if (hit && Date.now() - hit.at < (hit.failed ? FAILED_HOLD_MS : HOLD_MS)) {
      out.set(key, hit.parent);
      continue;
    }
    const urls = parentAccountUrls(c.companyName);
    const sf = salesforceIds(c.salesforceAccountID);
    if (urls.length || sf.length) todo.push({ key, urls, sf });
    else out.set(key, null);
  }
  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!todo.length || !authKey) {
    for (const t of todo) out.set(t.key, null);
    return out;
  }
  // Batches of about BATCH_URLS lookups, each answered by one query, BATCH_PARALLEL at a time.
  const batches: Array<typeof todo> = [];
  let cur: typeof todo = [];
  let size = 0;
  for (const t of todo) {
    if (size + t.urls.length + t.sf.length > BATCH_URLS && cur.length) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += t.urls.length + t.sf.length;
  }
  if (cur.length) batches.push(cur);
  const runBatch = async (batch: typeof todo) => {
    let found: ParentAccount[] = [];
    let failed = false;
    try {
      const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: PARENT_ACCOUNT_QUERY.replace('limit: 10', 'limit: 100'),
          variables: { urls: [...new Set(batch.flatMap((t) => t.urls))], sf: [...new Set(batch.flatMap((t) => t.sf))] },
        }),
        signal: AbortSignal.timeout(BATCH_TIMEOUT_MS),
      });
      const body = (await r.json()) as { data?: { CompetitorComparisonPage?: { items?: Item[] } }; errors?: unknown };
      if (!r.ok || body.errors) throw new Error(`Graph answered ${r.status}`);
      found = (body.data?.CompetitorComparisonPage?.items ?? []).map((i) => ({
        url: i._metadata?.url?.hierarchical ?? '',
        logo: i.customerLogo || null,
        domain: i.brandDomain || null,
        salesforceAccountID: i.salesforceAccountID || null,
      }));
    } catch (err) {
      failed = true;
      console.warn('[parent-account] batch not read:', err instanceof Error ? err.message : err);
    }
    for (const t of batch) {
      const parent = failed ? null : pickParentAccount(t.urls, found, t.sf);
      held.set(t.key, { at: Date.now(), parent, failed });
      out.set(t.key, parent);
    }
  };
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(BATCH_PARALLEL, batches.length) }, async () => {
      while (next < batches.length) await runBatch(batches[next++]);
    }),
  );
  return out;
}

/** The key `parentAccountsOf` answers a company under (the same `parentOf` holds it under). */
export function parentKey(companyName: string, salesforceAccountID?: string | null): string {
  return `${companyName}|${salesforceAccountID ?? ''}`;
}
