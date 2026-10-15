import { Redis } from '@upstash/redis';

/**
 * One account-page request per website at a time.
 *
 * A build takes 10-15 minutes and costs ~100 credits. Reps who had not seen
 * their page yet asked again after 2-13 minutes: MYOB was built six times on
 * 2026-10-14, Officeworks three times on 10-09, Teledyne twice on 10-13. The
 * browser's 60-second cooldown can't see a request from another tab or another
 * person, so the lock lives in the shared store, keyed by the domain the Opal
 * one-off resolves ("https://www.myob.com/au" and "myob.com" are one website).
 */
export const LOCK_SECONDS = 15 * 60;

export interface PageRequest {
  email: string;
  at: number;
}

export type LockStore = Pick<Redis, 'set' | 'get' | 'del'>;

const keyFor = (domain: string) => `page-request:${domain}`;

/** The shared store, or null when it isn't configured (requests then go through unlocked). */
export function lockStore(): LockStore | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

/**
 * Claims the website for this request. Returns null when the claim is now this
 * request's, or the earlier request that still holds it.
 */
export async function claimWebsite(
  store: LockStore,
  domain: string,
  email: string,
  now = Date.now(),
): Promise<PageRequest | null> {
  const set = await store.set(keyFor(domain), { email, at: now }, { nx: true, ex: LOCK_SECONDS });
  if (set) return null;
  // Expired between the two calls: nothing holds it any more, so go ahead.
  return (await store.get<PageRequest>(keyFor(domain))) ?? null;
}

/** Frees the website again, for a request that never reached Opal. */
export async function releaseWebsite(store: LockStore, domain: string): Promise<void> {
  await store.del(keyFor(domain));
}

/** What the rep is told instead of starting a second build. */
export function alreadyRequestedMessage(
  domain: string,
  earlier: PageRequest,
  email: string,
  now = Date.now(),
): string {
  const plural = (n: number) => (n === 1 ? '1 minute' : `${n} minutes`);
  const minutes = Math.max(0, Math.floor((now - earlier.at) / 60_000));
  const ago = minutes === 0 ? 'just now' : `${plural(minutes)} ago`;
  if (earlier.email.toLowerCase() === email.toLowerCase()) {
    return `You asked for ${domain} ${ago}. A page takes about 15 minutes; you'll get a Teams message when it's live.`;
  }
  const left = Math.max(1, Math.ceil((earlier.at + LOCK_SECONDS * 1000 - now) / 60_000));
  return `A colleague asked for ${domain} ${ago}, so it's already being built. Search for it again in about ${plural(left)}.`;
}
