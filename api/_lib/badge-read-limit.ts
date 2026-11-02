import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

/**
 * At most READS_PER_WINDOW badge reads per rep in WINDOW_SECONDS, for
 * api/badge-read.ts. Each read leaves a file on Mark's file server, which has
 * no delete, and starts a run under the PAT, so a page or a script in a loop
 * must not pile them up.
 *
 * The shared store holds a count per rep under a hash of their email, for ten
 * minutes: nothing of a badge. No store configured (a local preview): no cap,
 * as page-request-lock.ts goes unlocked.
 */
export const READS_PER_WINDOW = 10;
export const WINDOW_SECONDS = 10 * 60;

export type CountStore = Pick<Redis, 'set' | 'incr' | 'expire'>;

export function countStore(): CountStore | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export const readCountKey = (email: string) => `badge-reads:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32)}`;

/** Counts this read against the rep's ten minutes; true when it is one too many. */
export async function overReadLimit(store: CountStore | null, email: string): Promise<boolean> {
  if (!store) return false;
  const key = readCountKey(email);
  // The window starts with the rep's first read; the count never outlives it.
  await store.set(key, 0, { nx: true, ex: WINDOW_SECONDS });
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, WINDOW_SECONDS);
  return count > READS_PER_WINDOW;
}
