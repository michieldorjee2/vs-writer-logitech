/**
 * Where an account page's own copy is kept (src/lib/page-copy.ts): the site's Upstash Redis, the
 * store the page builds and the request lock already use.
 *
 *   pc:<route>   { values: PageCopy, edits: [{ key, by, at }] }   no expiry; it is the page's text
 *
 * `withPageCopy` adds the saved copy to an account page as `pageCopy` in every path that serves
 * one (the server render, /api/content, the dev proxy). Read fresh each time (the pages are
 * edge-cached in front of it), so a save shows on the next load anywhere. Slow or unreachable,
 * it never fails a page: after 800 ms the page is served with the template's text.
 */
import { Redis } from '@upstash/redis';
import { readCopy, type PageCopy } from '../../src/lib/page-copy.js';

const TIMEOUT_MS = 800;
const KEEP_EDITS = 50;

export type CopyStore = Pick<Redis, 'get' | 'set'>;

export function copyStore(): CopyStore | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

/** For the checks: a store to use instead of Redis. */
let override: CopyStore | null | undefined;
export function useCopyStore(store: CopyStore | null | undefined): void {
  override = store;
}
const store = (): CopyStore | null => (override !== undefined ? override : copyStore());

/** "/heineken/", "heineken", "/en/heineken" -> "heineken". */
export function routeOf(slug: string): string {
  return slug.replace(/^\/+|\/+$/g, '').replace(/^[a-z]{2}(-[a-z]{2})?\//i, '').toLowerCase();
}
const key = (route: string) => `pc:${routeOf(route)}`;

type Saved = { values?: unknown; edits?: Array<{ key: string; by: string; at: string }> };

const withTimeout = <T>(p: Promise<T>): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('page copy read timed out')), TIMEOUT_MS))]);

export async function readPageCopy(route: string): Promise<PageCopy> {
  const s = store();
  if (!s || !routeOf(route)) return {};
  const saved = await withTimeout(s.get<Saved>(key(route)));
  return readCopy(saved?.values);
}

/** Saves edits on top of what the page has; returns the page's copy after. */
export async function savePageCopy(route: string, edits: PageCopy, by: string): Promise<PageCopy> {
  const s = store();
  if (!s) throw new Error('no store configured (KV_REST_API_URL, KV_REST_API_TOKEN)');
  if (!routeOf(route)) throw new Error('no page');
  const saved = (await s.get<Saved>(key(route))) ?? {};
  const values = { ...readCopy(saved.values), ...readCopy(edits) };
  const at = new Date().toISOString();
  const log = [...Object.keys(readCopy(edits)).map((k) => ({ key: k, by, at })), ...(saved.edits ?? [])].slice(0, KEEP_EDITS);
  await s.set(key(route), { values, edits: log });
  return values;
}

type AccountPage = { __typename?: unknown; _metadata?: { url?: { hierarchical?: string | null; default?: string | null } | null } | null };

/** The account page with its own copy as `pageCopy`; any failure, the page as it is. Never throws. */
export async function withPageCopy<T>(item: T): Promise<T> {
  try {
    const page = item as AccountPage | null;
    const url = page?._metadata?.url?.hierarchical || page?._metadata?.url?.default;
    if (!page || !url) return item;
    const copy = await readPageCopy(url);
    return Object.keys(copy).length ? { ...item, pageCopy: copy } : item;
  } catch (err) {
    console.warn('[page-copy] read failed, the page shows the template text:', err instanceof Error ? err.message : err);
    return item;
  }
}
