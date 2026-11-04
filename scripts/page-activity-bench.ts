/**
 * page-activity-bench — the account-page averages the Report can compare a page against
 * (pa:bench: each scene's reach, median time, connect rate; src/lib/page-activity.ts
 * benchmarkFrom). Reads every indexed visitor's events from ODP once, builds each account page's
 * visitor report for the last 90 days, and averages the pages that had visitors.
 *
 * Offer pages (vb/…) are left out: they are a different template.
 *
 *   npx tsx --env-file=.env.local scripts/page-activity-bench.ts [--dry-run]
 */
import { Redis } from '@upstash/redis';
import { fetchVisitorEvents, odpClient } from '../api/_lib/odp-events.js';
import { teamOf, type ActivityStore } from '../api/_lib/page-activity-store.js';
import { benchmarkFrom, buildActivityReport, pageKey, rangeStart, TRACKING_START_TS, type ActivityEvent } from '../src/lib/page-activity.js';

const dry = process.argv.includes('--dry-run');
const redis = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
const odp = odpClient();
if (!odp) throw new Error('ODP_PRIVATE_KEY not set');
const now = Math.floor(Date.now() / 1000);
const from = rangeStart('90d', now);

const pages: string[] = [];
let cursor = '0';
do {
  const [next, keys] = await redis.scan(cursor, { match: 'pa:v:*', count: 1000 });
  cursor = String(next);
  pages.push(...keys.map((k) => k.slice(5)).filter((p) => !p.startsWith('vb/')));
} while (cursor !== '0');

const visitorsOf = new Map<string, string[]>();
for (let i = 0; i < pages.length; i += 100) {
  const p = redis.pipeline();
  for (const page of pages.slice(i, i + 100)) p.zrange(`pa:v:${page}`, '+inf', from, { byScore: true, rev: true });
  const res = (await p.exec()) as string[][];
  pages.slice(i, i + 100).forEach((page, j) => res[j]?.length && visitorsOf.set(page, res[j]));
}
const all = [...new Set([...visitorsOf.values()].flat())];
console.log(`${pages.length} account pages indexed · ${visitorsOf.size} with visitors in 90 days · ${all.length} visitors`);

const t0 = Date.now();
const events = await fetchVisitorEvents(odp, all, TRACKING_START_TS);
console.log(`${events.length} events from ODP in ${Math.round((Date.now() - t0) / 1000)}s`);
const team = await teamOf(redis as unknown as ActivityStore, all);
const byVisitor = new Map<string, ActivityEvent[]>();
for (const e of events) (byVisitor.get(e.vuid) ?? byVisitor.set(e.vuid, []).get(e.vuid)!).push(e);

const reports = [...visitorsOf].map(([page, vuids]) =>
  buildActivityReport({ page: pageKey(page), range: '90d', nowS: now, events: vuids.flatMap((v) => byVisitor.get(v) ?? []), teamVuids: team, accountTerms: [] }).visitors,
);
const bench = benchmarkFrom(reports, new Date(now * 1000).toISOString());
console.log(JSON.stringify(bench, null, 1));
if (!dry) {
  await redis.set('pa:bench', bench);
  console.log('saved pa:bench');
}
