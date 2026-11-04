/**
 * The visitor index behind Activity mode, in the site's Upstash Redis.
 *
 * ODP answers events per visitor, never per page, so this is the one thing kept outside ODP: which
 * visitors (ODP vuids, pseudonymous) opened which page, and when last. Everything they did is read
 * from ODP at report time.
 *
 *   pa:v:<page>      sorted set   vuid -> last visit (epoch s)   newest MAX_PER_PAGE kept, 400-day TTL
 *   pa:team          hash         vuid -> first seen signed in    an employee's browser
 *   pa:rl:<ip>       counter      visits recorded this minute     abuse limit on the public write
 *   pa:r:<page>:<r>  json         a built report                  REPORT_TTL_S
 *   pa:deal:<sfid>   json         Salesforce opportunities        DEAL_TTL_S
 *   pa:bench         json         account-page averages           written by scripts/page-activity-bench.ts
 */
import { Redis } from '@upstash/redis';

export const MAX_PER_PAGE = 2000;
const INDEX_TTL_S = 400 * 86400;
/**
 * Recording is one write per page view; a person reading quickly opens a few pages a minute. 60
 * per minute per address leaves room for an office behind one address and stops a script.
 */
export const VISITS_PER_MINUTE = 60;
export const REPORT_TTL_S = 5 * 60;
export const DEAL_TTL_S = 60 * 60;

export type ActivityStore = Pick<Redis, 'zadd' | 'zremrangebyrank' | 'zrange' | 'expire' | 'hset' | 'hmget' | 'incr' | 'set' | 'get'>;

export function activityStore(): ActivityStore | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const indexKey = (page: string) => `pa:v:${page}`;

/** Records that this visitor opened this page now. Keys are validated by the caller. */
export async function recordVisit(store: ActivityStore, page: string, vuid: string, nowS: number, team: boolean): Promise<void> {
  const key = indexKey(page);
  await store.zadd(key, { score: nowS, member: vuid });
  // Keep the newest; a page read by thousands loses its oldest visitors from the report, not the site.
  await store.zremrangebyrank(key, 0, -(MAX_PER_PAGE + 1));
  await store.expire(key, INDEX_TTL_S);
  if (team) await store.hset('pa:team', { [vuid]: nowS });
}

/** False once this address has recorded VISITS_PER_MINUTE visits this minute. */
export async function underVisitLimit(store: ActivityStore, ip: string, nowS: number): Promise<boolean> {
  const key = `pa:rl:${ip}:${Math.floor(nowS / 60)}`;
  const n = await store.incr(key);
  if (n === 1) await store.expire(key, 120);
  return n <= VISITS_PER_MINUTE;
}

/** Visitors of this page last seen at or after `from`, newest first, at most `limit`. */
export async function pageVisitors(store: ActivityStore, page: string, from: number, limit: number): Promise<string[]> {
  const ids = await store.zrange<string[]>(indexKey(page), '+inf', from, { byScore: true, rev: true, offset: 0, count: limit });
  return ids.filter((v) => /^[0-9a-f]{32}$/.test(v));
}

/** Which of these visitors were seen signed in. */
export async function teamOf(store: ActivityStore, vuids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < vuids.length; i += 200) {
    const part = vuids.slice(i, i + 200);
    const got = await store.hmget<Record<string, unknown>>('pa:team', ...part);
    if (got) for (const v of part) if (got[v] != null) out.add(v);
  }
  return out;
}

export async function cached<T>(store: ActivityStore, key: string): Promise<T | null> {
  return (await store.get<T>(key)) ?? null;
}

export async function cache(store: ActivityStore, key: string, value: unknown, ttl: number): Promise<void> {
  await store.set(key, value, { ex: ttl });
}
