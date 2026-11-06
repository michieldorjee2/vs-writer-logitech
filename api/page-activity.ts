import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity, firstQuery } from './_lib/auth.js';
import { fetchAccountStage, fetchPageEvents, odpClient, type OdpClient } from './_lib/odp-events.js';
import { ACCOUNT_TTL_S, activityStore, cache, cached, pageVisitors, REPORT_TTL_S, teamOf, type ActivityStore } from './_lib/page-activity-store.js';
import { salesforceIds } from '../src/lib/parent-account.js';
import {
  accountTerms,
  ACTIVITY_RANGES,
  buildActivityReport,
  isPageKey,
  pageKey,
  rangeStart,
  TRACKING_START_TS,
  type ActivityBenchmark,
  type ActivityRange,
  type AccountSummary,
  type ActivityResponse,
  type HistoryMark,
} from '../src/lib/page-activity.js';

/**
 * GET /api/page-activity?page=lenovo&range=30d[&fresh=1]
 *
 * The booth's Report (src/components/ActivityMode.tsx): what visitors did on one page, read from
 * ODP for the visitors the index holds (api/_lib/page-activity-store.ts), plus the page's history
 * (built, saved, copy edits), its Salesforce account (id and stage, as ODP's Salesforce sync holds
 * it) and the account-page averages.
 *
 * Signed-in employees only: it names networks and the account. It never returns a visitor id or
 * an employee's identity, only counts.
 */
const MAX_VISITORS = 600;
const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

export interface PageMeta {
  created: string | null;
  published: string | null;
  lastModified: string | null;
  salesforceAccountID: string | null;
  brandDomain: string | null;
  eyebrow: string | null;
}

const PAGE_META_QUERY = `
query ActivityPageMeta($urls: [String]) {
  CompetitorComparisonPage(locale: en, limit: 1, where: { _metadata: { url: { hierarchical: { in: $urls } } } }) {
    items { _metadata { created published lastModified } salesforceAccountID brandDomain eyebrow }
  }
}
`;

async function pageMeta(page: string): Promise<PageMeta | null> {
  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey || page.startsWith('vb/')) return null;
  try {
    const r = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PAGE_META_QUERY, variables: { urls: [`/${page}/`, `/${page}`] } }),
      signal: AbortSignal.timeout(5000),
    });
    const j = (await r.json()) as { data?: { CompetitorComparisonPage?: { items?: Array<Record<string, unknown>> } } };
    const it = j.data?.CompetitorComparisonPage?.items?.[0];
    if (!it) return null;
    const m = (it._metadata ?? {}) as Record<string, string | null>;
    return {
      created: m.created ?? null,
      published: m.published ?? null,
      lastModified: m.lastModified ?? null,
      salesforceAccountID: (it.salesforceAccountID as string) || null,
      brandDomain: (it.brandDomain as string) || null,
      eyebrow: (it.eyebrow as string) || null,
    };
  } catch {
    return null;
  }
}

/** The page's Salesforce account and its stage, from ODP; cached for an hour. */
async function accountOf(store: ActivityStore, odp: OdpClient, sfid: string | null): Promise<AccountSummary | null> {
  const ids = salesforceIds(sfid);
  if (!ids.length) return null;
  const key = `pa:acct:${ids[0]}`;
  const hit = await cached<AccountSummary>(store, key);
  if (hit) return hit;
  const found = await fetchAccountStage(odp, ids);
  // ODP holding no such account still links to Salesforce by the page's id; no answer is not cached.
  const account = found ?? { id: ids[0], stage: null };
  if (found !== undefined) await cache(store, key, account, ACCOUNT_TTL_S);
  return account;
}

export function historyOf(meta: PageMeta | null, copyEdits: Array<{ at?: string }>): HistoryMark[] {
  const marks: HistoryMark[] = [];
  const ts = (iso: string | null | undefined) => (iso ? Math.floor(Date.parse(iso) / 1000) : NaN);
  const built = ts(meta?.created ?? meta?.published);
  if (Number.isFinite(built)) marks.push({ kind: 'built', ts: built });
  const saved = ts(meta?.lastModified);
  // A save within ten minutes of the build is the build itself.
  if (Number.isFinite(saved) && !(Number.isFinite(built) && saved - built < 600)) marks.push({ kind: 'saved', ts: saved });
  // Copy edits saved together are one edit.
  const copy = [...new Set(copyEdits.map((e) => Math.floor(ts(e.at) / 60) * 60).filter(Number.isFinite))];
  for (const t of copy) marks.push({ kind: 'copy', ts: t });
  return marks.sort((a, b) => a.ts - b.ts);
}

let override: { store?: ActivityStore | null; odp?: OdpClient | null } = {};
/** For the checks: stand-ins for Redis and ODP. */
export function setActivitySources(o: { store?: ActivityStore | null; odp?: OdpClient | null }): void {
  override = o;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireIdentity(req, res)) return;

  const page = pageKey(firstQuery(req.query.page)?.slice(0, 200));
  if (!isPageKey(page)) return res.status(400).json({ error: 'Unknown page' });
  const rawRange = firstQuery(req.query.range);
  const range: ActivityRange = (ACTIVITY_RANGES as string[]).includes(rawRange ?? '') ? (rawRange as ActivityRange) : '30d';
  const fresh = firstQuery(req.query.fresh) === '1';

  const store = 'store' in override ? override.store : activityStore();
  const odp = 'odp' in override ? override.odp : odpClient();
  if (!store || !odp) return res.status(503).json({ error: 'Activity is not configured here' });

  // r2: the report carries visit rows since the Report card (Nov 2026); older entries lack them.
  const cacheKey = `pa:r2:${page}:${range}`;
  try {
    if (!fresh) {
      const hit = await cached<ActivityResponse>(store, cacheKey);
      if (hit) return res.status(200).json(hit);
    }
    const now = Math.floor(Date.now() / 1000);
    const from = rangeStart(range, now);
    const [meta, vuids, copy] = await Promise.all([
      pageMeta(page),
      pageVisitors(store, page, from, MAX_VISITORS),
      store.get<{ edits?: Array<{ at?: string }> }>(`pc:${page}`).catch(() => null),
    ]);
    const [events, team, account, bench] = await Promise.all([
      fetchPageEvents(odp, page, vuids, from, TRACKING_START_TS),
      teamOf(store, vuids),
      accountOf(store, odp, meta?.salesforceAccountID ?? null).catch(() => null),
      cached<ActivityBenchmark>(store, 'pa:bench'),
    ]);
    const report = buildActivityReport({
      page,
      range,
      nowS: now,
      events,
      teamVuids: team,
      accountTerms: accountTerms(meta?.brandDomain, meta?.eyebrow),
    });
    const body: ActivityResponse = { report, history: historyOf(meta, copy?.edits ?? []), bench, account };
    await cache(store, cacheKey, body, REPORT_TTL_S);
    return res.status(200).json(body);
  } catch (error) {
    console.error('[page-activity] failed:', error instanceof Error ? error.message : 'error');
    return res.status(502).json({ error: 'Could not read activity from ODP' });
  }
}
