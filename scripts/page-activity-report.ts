/**
 * page-activity-report — prints what Activity mode would show for pages, read live from ODP and the
 * visitor index. For checking the numbers by hand.
 *
 *   npx tsx --env-file=.env.local scripts/page-activity-report.ts <page> [<page>…] [--range 7d|30d|90d|all]
 */
import { Redis } from '@upstash/redis';
import { fetchPageEvents, odpClient } from '../api/_lib/odp-events.js';
import { pageVisitors, teamOf, type ActivityStore } from '../api/_lib/page-activity-store.js';
import { ACTIVITY_RANGES, buildActivityReport, pageKey, rangeStart, TRACKING_START_TS, type ActivityRange } from '../src/lib/page-activity.js';

const args = process.argv.slice(2);
const ri = args.indexOf('--range');
const range = (ri >= 0 && (ACTIVITY_RANGES as string[]).includes(args[ri + 1]) ? args[ri + 1] : 'all') as ActivityRange;
const pages = args.filter((a, i) => !a.startsWith('--') && (ri < 0 || i !== ri + 1));
const store = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! }) as unknown as ActivityStore;
const odp = odpClient();
if (!odp) throw new Error('ODP_PRIVATE_KEY not set');

for (const page of pages.map(pageKey)) {
  const now = Math.floor(Date.now() / 1000);
  const from = rangeStart(range, now);
  const t0 = Date.now();
  const vuids = await pageVisitors(store, page, from, 600);
  const events = await fetchPageEvents(odp, page, vuids, from, TRACKING_START_TS);
  const rep = buildActivityReport({ page, range, nowS: now, events, teamVuids: await teamOf(store, vuids), accountTerms: [page] });
  const v = rep.visitors;
  console.log(`\n${page} (${range}): ${vuids.length} indexed, ${events.length} events, ${Date.now() - t0} ms · team ${rep.teamCount} · bots ${rep.botCount}`);
  console.log(`  visitors ${v.visitors} · visits ${v.visits} · median ${v.medianSec}s · CTA clicks ${v.ctaClicks} · connect ${v.connectVisitors} | with team: ${rep.everyone.visitors} visitors, ${rep.everyone.visits} visits`);
  console.log(`  reach ${JSON.stringify(v.sections)} · scroll ${JSON.stringify(v.scroll)}`);
  console.log(`  elements ${v.elements.slice(0, 6).map((x) => `${x.key}=${x.clicks}${x.dead ? ' (dead)' : ''}`).join('  ')}`);
  console.log(`  CTAs ${v.ctas.map((c) => `${c.type}/${c.position ?? '-'}/${c.label}=${c.clicks}`).join('  ')}`);
  console.log(`  sources ${v.sources.map((s) => `${s.name}=${s.n}`).join(' ')} · networks ${v.networks.slice(0, 4).map((n) => `${n.name}=${n.n}${n.account ? ' (account)' : ''}`).join(' ')}`);
}
