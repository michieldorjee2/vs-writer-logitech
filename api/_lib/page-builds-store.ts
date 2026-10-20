import { Redis } from '@upstash/redis';
import type { BuildRecord } from '../../src/lib/page-builds.js';

/**
 * Where the page builds are kept: the shared Upstash store the request lock
 * already uses (page-request-lock.ts).
 *
 *   pb:<id>          the build (BuildRecord)
 *   pb:user:<email>  the rep's builds, newest first (what the search page lists)
 *   pb:route:<route> the build that owns an address, so the address can show it
 *   pb:site:<domain> the account build for a website, so a person can wait for it
 *
 * Kept three days: long enough to come back to a build, short enough that the
 * address goes back to being an ordinary page.
 */
const KEEP_SECONDS = 3 * 24 * 60 * 60;
const PER_REP = 12;

export type BuildStore = Pick<Redis, 'get' | 'set' | 'del' | 'lpush' | 'ltrim' | 'lrange' | 'expire' | 'mget'>;

export function buildStore(): BuildStore | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const key = (id: string) => `pb:${id}`;
const userKey = (email: string) => `pb:user:${email.trim().toLowerCase()}`;
const routeKey = (route: string) => `pb:route:${route.toLowerCase()}`;
const siteKey = (domain: string) => `pb:site:${domain.toLowerCase()}`;

export async function saveBuild(store: BuildStore, build: BuildRecord): Promise<void> {
  await store.set(key(build.id), build, { ex: KEEP_SECONDS });
}

/** A new build: kept, listed for its rep, and the owner of its address. */
export async function addBuild(store: BuildStore, build: BuildRecord): Promise<void> {
  await saveBuild(store, build);
  await store.set(routeKey(build.route), build.id, { ex: KEEP_SECONDS });
  if (build.kind === 'account' && build.domain) await store.set(siteKey(build.domain), build.id, { ex: KEEP_SECONDS });
  await store.lpush(userKey(build.email), build.id);
  await store.ltrim(userKey(build.email), 0, PER_REP - 1);
  await store.expire(userKey(build.email), KEEP_SECONDS);
}

export async function getBuild(store: BuildStore, id: string): Promise<BuildRecord | null> {
  return (await store.get<BuildRecord>(key(id))) ?? null;
}

export async function buildForRoute(store: BuildStore, route: string): Promise<BuildRecord | null> {
  const id = await store.get<string>(routeKey(route));
  return id ? getBuild(store, id) : null;
}

export async function buildsForRep(store: BuildStore, email: string): Promise<BuildRecord[]> {
  const ids = await store.lrange<string>(userKey(email), 0, PER_REP - 1);
  if (!ids.length) return [];
  const builds = await store.mget<(BuildRecord | null)[]>(...ids.map(key));
  return builds.filter((b): b is BuildRecord => !!b);
}

/** Whether an address already belongs to a build in the last three days. */
export async function routeTaken(store: BuildStore, route: string): Promise<boolean> {
  return Boolean(await store.get(routeKey(route)));
}

/** The latest account build for a website, if one ran in the last three days. */
export async function buildForSite(store: BuildStore, domain: string): Promise<BuildRecord | null> {
  const id = await store.get<string>(siteKey(domain));
  return id ? getBuild(store, id) : null;
}
