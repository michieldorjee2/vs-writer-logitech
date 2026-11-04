/**
 * Reads showcase events from ODP, one visitor at a time (the only way ODP serves events: the
 * `events` query requires an identifier). Many visitors go in one request as aliases. Also the
 * page's Salesforce account as ODP holds it (synced from Salesforce), for its stage.
 *
 * Server-only: ODP_PRIVATE_KEY is a full-access account key. It is read here and nowhere else, is
 * never logged, and never reaches the browser.
 *
 * What ODP refuses, and what this file therefore never sends (probed 4 Nov 2026):
 *   - a vuid with dashes ("could not resolve any of the supplied identifiers"): ids are 32 hex;
 *   - an unknown field on Event (the whole request fails): FIELDS is the checked list;
 *   - `page` bare: it is a relation, read as `page { page }`.
 * The page filter is the path as sent, so both "/lenovo/" and "/lenovo" are asked for.
 */
import type { ActivityEvent } from '../../src/lib/page-activity.js';

const HOST = 'showcase.optimizely.com';
/** Per request; each visitor costs two aliases (this page, and their pageviews elsewhere). */
const VUIDS_PER_REQUEST = 20;
const PARALLEL = 4;
const PAGE_SIZE = 1000;
/** A visitor with more than this many events on one page is a test loop, not a reader. */
const MAX_PAGES_PER_VISITOR = 5;
const TIMEOUT_MS = 20_000;

/** Event fields read for this page's events. Every one exists on ODP's Event type. */
const FIELDS = [
  'ts', 'event_type', 'action', 'session_id', 'section', 'element', 'label', 'position', 'cta_type',
  'time_on_page_sec', 'max_scroll_pct', 'html_element_path', 'html_element_tag', 'is_rage_click',
  'scroll_depth_percentage', 'is_final_depth', 'isp', 'country', 'device_type', 'referral_host',
  'source', 'medium', 'campaign', 'likely_machine_generated',
].join(' ');
/** Enough of a visitor's pageviews elsewhere to tell team from visitors. */
const PAGEVIEW_FIELDS = 'ts action isp referral_host likely_machine_generated';

type Node = Record<string, unknown> & { page?: { page?: string | null } | null };
type Conn = { edges?: Array<{ node: Node }>; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } | null;

export interface OdpClient {
  query(query: string): Promise<{ data?: Record<string, Conn> | null; errors?: Array<{ message?: string; path?: unknown[] }> }>;
}

export function odpClient(): OdpClient | null {
  const key = process.env.ODP_PRIVATE_KEY;
  if (!key) return null;
  const base = (process.env.ODP_API_BASE || 'https://api.zaius.com').replace(/\/+$/, '');
  return {
    async query(query) {
      const r = await fetch(`${base}/v3/graphql`, {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`ODP answered ${r.status}`);
      return r.json();
    },
  };
}

/** Both forms the page's path is sent in. Keys are validated (isPageKey) before they get here. */
export function pathFilter(pageKey: string): string {
  return `hostname = '${HOST}' and (page = '/${pageKey}/' or page = '/${pageKey}')`;
}

const toEvent = (vuid: string, n: Node): ActivityEvent => ({
  ...(n as unknown as ActivityEvent),
  vuid,
  ts: Number(n.ts),
  page: n.page?.page ?? null,
  session_id: n.session_id == null ? null : String(n.session_id),
});

/**
 * Every event these visitors sent on this page since `from`, plus each one's pageviews anywhere on
 * the site (to tell Optimizely people from visitors). Visitors ODP does not know are skipped: ODP
 * reports them as an error on their own alias and answers the rest.
 */
export async function fetchPageEvents(odp: OdpClient, pageKey: string, vuids: string[], from: number, sinceAll: number): Promise<ActivityEvent[]> {
  const ids = vuids.filter((v) => /^[0-9a-f]{32}$/.test(v));
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += VUIDS_PER_REQUEST) chunks.push(ids.slice(i, i + VUIDS_PER_REQUEST));
  const out: ActivityEvent[] = [];
  const more: Array<{ vuid: string; after: string }> = [];
  const here = pathFilter(pageKey);
  const pageviews = `hostname = '${HOST}' and action = 'pageview'`;

  async function run(chunk: string[]) {
    const q = chunk
      .map(
        (v, i) =>
          `h${i}: events(vuid: "${v}", first: ${PAGE_SIZE}, earliest_time: ${from}, filter: "${here}") { edges { node { ${FIELDS} page { page } } } pageInfo { hasNextPage endCursor } } ` +
          `p${i}: events(vuid: "${v}", first: ${PAGE_SIZE}, earliest_time: ${sinceAll}, filter: "${pageviews}") { edges { node { ${PAGEVIEW_FIELDS} page { page } } } }`,
      )
      .join(' ');
    const r = await odp.query(`{ ${q} }`);
    chunk.forEach((v, i) => {
      const h = r.data?.[`h${i}`];
      for (const e of h?.edges ?? []) out.push(toEvent(v, e.node));
      if (h?.pageInfo?.hasNextPage && h.pageInfo.endCursor) more.push({ vuid: v, after: h.pageInfo.endCursor });
      // Pageviews on this page are already in `h`; only the other pages matter for team detection.
      for (const e of r.data?.[`p${i}`]?.edges ?? []) {
        const ev = toEvent(v, e.node);
        if (!samePage(ev.page, pageKey) || ev.ts < from) out.push(ev);
      }
    });
  }
  await pool(chunks, run);

  for (const m of more) {
    let after: string | null = m.after;
    for (let p = 1; after && p < MAX_PAGES_PER_VISITOR; p++) {
      const r = await odp.query(
        `{ h: events(vuid: "${m.vuid}", first: ${PAGE_SIZE}, after: ${JSON.stringify(after)}, earliest_time: ${from}, filter: "${here}") { edges { node { ${FIELDS} page { page } } } pageInfo { hasNextPage endCursor } } }`,
      );
      for (const e of r.data?.h?.edges ?? []) out.push(toEvent(m.vuid, e.node));
      after = r.data?.h?.pageInfo?.hasNextPage ? (r.data.h.pageInfo.endCursor ?? null) : null;
    }
  }
  return out;
}

function samePage(path: string | null, pageKey: string): boolean {
  const p = (path ?? '').toLowerCase().replace(/^\/+|\/+$/g, '');
  return p === pageKey;
}

async function pool<T>(items: T[], fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  const failures: unknown[] = [];
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          await fn(item);
        } catch (error) {
          failures.push(error);
        }
      }
    }),
  );
  // Some visitors missing is a smaller report; all requests failing is an outage, and says so.
  if (items.length && failures.length === items.length) throw failures[0];
}

/**
 * Every showcase event these visitors sent since `since`, on any page (for the account-page
 * averages, scripts/page-activity-bench.ts). One alias per visitor, paged.
 */
export async function fetchVisitorEvents(odp: OdpClient, vuids: string[], since: number): Promise<ActivityEvent[]> {
  const ids = vuids.filter((v) => /^[0-9a-f]{32}$/.test(v));
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += VUIDS_PER_REQUEST) chunks.push(ids.slice(i, i + VUIDS_PER_REQUEST));
  const out: ActivityEvent[] = [];
  const filter = `hostname = '${HOST}'`;
  const node = `edges { node { ${FIELDS} page { page } } } pageInfo { hasNextPage endCursor }`;
  await pool(chunks, async (chunk) => {
    const r = await odp.query(`{ ${chunk.map((v, i) => `a${i}: events(vuid: "${v}", first: ${PAGE_SIZE}, earliest_time: ${since}, filter: "${filter}") { ${node} }`).join(' ')} }`);
    for (const [i, v] of chunk.entries()) {
      let conn = r.data?.[`a${i}`];
      for (const e of conn?.edges ?? []) out.push(toEvent(v, e.node));
      for (let p = 1; conn?.pageInfo?.hasNextPage && conn.pageInfo.endCursor && p < MAX_PAGES_PER_VISITOR; p++) {
        const next = await odp.query(`{ a: events(vuid: "${v}", first: ${PAGE_SIZE}, after: ${JSON.stringify(conn.pageInfo.endCursor)}, earliest_time: ${since}, filter: "${filter}") { ${node} } }`);
        conn = next.data?.a ?? null;
        for (const e of conn?.edges ?? []) out.push(toEvent(v, e.node));
      }
    }
  });
  return out;
}

/**
 * The account's stage as ODP's Salesforce sync holds it (`account_stage`: Prospect, Active
 * Customer, Ex-Customer; `customer_stage` is empty on the accounts seen, 4 Nov 2026). ODP keys
 * accounts by the 18-character id only, so each form of the id is tried. `undefined` when ODP did
 * not answer, null when it holds no such account or no stage.
 */
export async function fetchAccountStage(odp: OdpClient, ids: string[]): Promise<{ id: string; stage: string | null } | null | undefined> {
  const valid = ids.filter((id) => /^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/.test(id));
  if (!valid.length) return null;
  try {
    const r = await odp.query(
      `{ ${valid.map((id, i) => `a${i}: salesforce_crm_sync_account(salesforce_crm_sync_account_id: "${id}") { salesforce_crm_sync_account_name account_stage customer_stage }`).join(' ')} }`,
    );
    for (const [i, id] of valid.entries()) {
      const a = r.data?.[`a${i}`] as unknown as Record<string, string | null> | null | undefined;
      if (a?.salesforce_crm_sync_account_name) return { id, stage: a.account_stage || a.customer_stage || null };
    }
    return null;
  } catch {
    return undefined;
  }
}
