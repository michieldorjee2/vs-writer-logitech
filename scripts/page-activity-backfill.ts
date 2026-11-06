/**
 * page-activity-backfill — fills the Report's visitor index (pa:v:<page>, see
 * api/_lib/page-activity-store.ts) with the visitors pages had before the site recorded them
 * itself (api/page-visit.ts, from Nov 2026).
 *
 * Input: Optimizely Analytics extracts of the site's ODP pageviews, one JSON array per file of
 * { vuid, page, first_ts?, last_ts? } (and isps_*.json of { vuid, isp }), the shape aldus-ui's
 * `npm run showcase:refresh` caches in .cache/showcase-metrics/. Machine networks (BOT_ISPS) are
 * left out: they would only cost ODP lookups. Writing keeps the later of two visit times, so
 * running it twice, or after live recording began, changes nothing it should not.
 *
 *   npx tsx --env-file=.env.local scripts/page-activity-backfill.ts <dir> [<dir>…] [--dry-run]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Redis } from '@upstash/redis';
import { BOT_ISPS, isPageKey, normalizeVuid, pageKey } from '../src/lib/page-activity.js';
import { MAX_PER_PAGE } from '../api/_lib/page-activity-store.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const dirs = args.filter((a) => !a.startsWith('--'));
if (!dirs.length) throw new Error('usage: page-activity-backfill <dir>… [--dry-run]');

type Row = { vuid?: unknown; page?: unknown; isp?: unknown; first_ts?: unknown; last_ts?: unknown };
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => join(d, f)));
const rows = (prefix: string) => files.filter((f) => f.split('/').pop()!.startsWith(prefix)).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as Row[]);

const bots = new Set(rows('isps_').filter((r) => BOT_ISPS.has(String(r.isp ?? '').toLowerCase())).map((r) => normalizeVuid(r.vuid)));
const byPage = new Map<string, Map<string, number>>();
let skippedBots = 0;
let skippedPages = 0;
for (const r of rows('pageviews_')) {
  const vuid = normalizeVuid(r.vuid);
  const page = pageKey(typeof r.page === 'string' ? r.page : '');
  if (!vuid) continue;
  if (!isPageKey(page)) { skippedPages++; continue; }
  if (bots.has(vuid)) { skippedBots++; continue; }
  const ts = Number(r.last_ts ?? r.first_ts ?? 0);
  if (!Number.isFinite(ts) || ts <= 0) continue;
  const m = byPage.get(page) ?? new Map<string, number>();
  m.set(vuid, Math.max(m.get(vuid) ?? 0, ts));
  byPage.set(page, m);
}
const pairs = [...byPage.values()].reduce((a, m) => a + m.size, 0);
console.log(`${files.length} files · ${byPage.size} pages · ${pairs} visitor-page pairs · left out: ${skippedBots} machine-network rows, ${skippedPages} non-page rows`);
if (dry) process.exit(0);

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
if (!url || !token) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN not set');
const redis = new Redis({ url, token });
let done = 0;
const entries = [...byPage];
for (let i = 0; i < entries.length; i += 50) {
  const p = redis.pipeline();
  for (const [page, m] of entries.slice(i, i + 50)) {
    const members = [...m].map(([member, score]) => ({ score, member }));
    const [first, ...rest] = members;
    // GT: keep the later visit when the page already recorded this visitor.
    p.zadd(`pa:v:${page}`, { gt: true }, first, ...rest);
    p.zremrangebyrank(`pa:v:${page}`, 0, -(MAX_PER_PAGE + 1));
    p.expire(`pa:v:${page}`, 400 * 86400);
  }
  await p.exec();
  done += Math.min(50, entries.length - i);
  process.stdout.write(`\r${done}/${entries.length} pages written`);
}
console.log('');
