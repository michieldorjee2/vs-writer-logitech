/**
 * Someone from Optimizely's Microsoft Teams photo, for api/page-photo.ts (the people a public page
 * names) and api/me-photo.ts (the person signed in, in the search page's corner). README, "Teams
 * photos on pages".
 *
 * Where it comes from:
 *
 *   - the wiki's people directory (md.optimizely.com, its D41/D42), for account and person pages and
 *     the profile menu. Showcase is a relay app there (`showcase`, lib/auth-relay.ts RELAY_APPS), so it
 *     proves itself with the secret it already signs people in with (OPTIID_RELAY_SECRET): a request
 *     token, HS256, key = HMAC-SHA256(secret, "mark-down/people-api/v1"), typ `people-call+jwt`, iss
 *     `showcase`, aud `<wiki>/api/auth/people`, a minute long. It asks the photo route itself
 *     (`/api/auth/people/photo?email=`), which answers an app's token with the bytes, so the wiki's signed
 *     photo link, which dies in an hour or two, is never made, held, or put anywhere.
 *   - Limitless, for an offer page's hosts (api/_lib/aldus.ts hostPhoto), with the machine token this
 *     site already holds. Limitless is keyed by offer and host and holds the offer's own list of hosts.
 *
 * Only an @optimizely.com address ever gets here (optimizelyAddress); a customer's never leaves the site.
 *
 * Kept per instance, so a page of six people is not six calls to the wiki: a photo ten minutes, a
 * "none" five, a failure not at all; two asks for one person at once share a call; and the wiki is
 * called at most WIKI_CALLS_PER_MINUTE times a minute from an instance whatever is asked of it.
 */
import { createHash, createHmac } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { optimizelyAddress } from '../../src/lib/page-photos.js';
import { aldusConfigured, hostPhoto } from './aldus.js';
import { RELAY_APP_ID, wikiOrigin } from './auth.js';
import { countStore, type CountStore } from './badge-read-limit.js';
import { FETCH_TIMEOUT_MS, photoFrom, type Photo, type PhotoAnswer } from './photo-bytes.js';

/**
 * Off unless exactly "on" ("On" and "true" are off), as OFFER_SIGNUP_FORM is. Showing a colleague's
 * Teams photo on a page customers see is a choice; nothing is asked of the wiki or Limitless, and
 * every card is as it was, until it is made. Limitless has its own switch of the same name.
 */
export const photosOn = (): boolean => process.env.PAGE_PEOPLE_PHOTOS === 'on';

// ─── The wiki's request token ─────────────────────────────────────────────

export const PEOPLE_TOKEN_TYPE = 'people-call+jwt';
/** The label relay apps derive their request key under. The wiki's `PEOPLE_KEY_LABEL`: changing it there breaks every app. */
export const PEOPLE_KEY_LABEL = 'mark-down/people-api/v1';
/** Well under the wiki's five-minute ceiling: the token is made for one call. */
const TOKEN_SECONDS = 60;

const b64url = (data: string): string => Buffer.from(data).toString('base64url');

/** A request token for the wiki's people API, signed with this app's relay secret. `origin` is the wiki's own (its `iss`). */
export function peopleRequestToken(secret: string, origin: string, nowMs = Date.now()): string {
  const key = createHmac('sha256', secret).update(PEOPLE_KEY_LABEL).digest();
  // A few seconds back: the wiki refuses an `iat` from its own future, and our clock is not its clock.
  const iat = Math.floor(nowMs / 1000) - 5;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: PEOPLE_TOKEN_TYPE }));
  const payload = b64url(JSON.stringify({ iss: RELAY_APP_ID, aud: `${origin}/api/auth/people`, iat, exp: iat + TOKEN_SECONDS }));
  return `${header}.${payload}.${createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url')}`;
}

// ─── What is kept ─────────────────────────────────────────────────────────

const WIKI_KEEP_MS = 10 * 60_000;
const LIMITLESS_KEEP_MS = 60_000;
const NONE_KEEP_MS = 5 * 60_000;
const MAX_KEPT = 200;
const MAX_KEPT_BYTES = 8 * 1024 * 1024;

const kept = new Map<string, { photo: Photo | null; until: number }>();
const pending = new Map<string, Promise<PhotoAnswer>>();
let keptBytes = 0;

function keep(id: string, photo: Photo | null, ttl: number, now: number): void {
  const old = kept.get(id);
  if (old?.photo) keptBytes -= old.photo.bytes.length;
  kept.delete(id);
  kept.set(id, { photo, until: now + ttl });
  if (photo) keptBytes += photo.bytes.length;
  while (kept.size > MAX_KEPT || keptBytes > MAX_KEPT_BYTES) {
    const oldest = kept.keys().next().value;
    if (oldest === undefined) break;
    const gone = kept.get(oldest);
    if (gone?.photo) keptBytes -= gone.photo.bytes.length;
    kept.delete(oldest);
  }
}

/** One answer per `id`, kept for `ttl` when it is a photo and NONE_KEEP_MS when it is none; a failure is neither kept nor shared past its own call. */
async function answer(id: string, ttl: number, load: () => Promise<PhotoAnswer>, now: number): Promise<PhotoAnswer> {
  const held = kept.get(id);
  if (held && held.until > now) return held.photo;
  let call = pending.get(id);
  if (!call) {
    call = load()
      .then((result) => {
        if (result !== 'failed') keep(id, result, result ? ttl : NONE_KEEP_MS, Date.now());
        return result;
      })
      .finally(() => pending.delete(id));
    pending.set(id, call);
  }
  return call;
}

// ─── The wiki ─────────────────────────────────────────────────────────────

/** Calls to the wiki an instance makes in a minute: far above a page's people, far below a loop. */
export const WIKI_CALLS_PER_MINUTE = 120;
const wikiWindow = { minute: 0, count: 0 };

async function fetchWikiPhoto(address: string): Promise<PhotoAnswer> {
  const secret = process.env.OPTIID_RELAY_SECRET;
  // No relay secret (a local run, a preview without it) is no way to ask: no photo, not an error.
  if (!secret) return null;
  const minute = Math.floor(Date.now() / 60_000);
  if (wikiWindow.minute !== minute) {
    wikiWindow.minute = minute;
    wikiWindow.count = 0;
  }
  if (++wikiWindow.count > WIKI_CALLS_PER_MINUTE) {
    console.warn('[page-photo] wiki: over this instance\'s calls a minute');
    return 'failed';
  }
  const origin = wikiOrigin();
  let response: Response;
  try {
    response = await fetch(`${origin}/api/auth/people/photo?email=${encodeURIComponent(address)}`, {
      headers: { Authorization: `Bearer ${peopleRequestToken(secret, origin)}`, Accept: 'image/jpeg,image/png,image/webp' },
      cache: 'no-store',
      // The wiki's own route and nothing else: a redirect would send the token somewhere it was not made for.
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn(`[page-photo] wiki: ${err instanceof Error ? err.name : 'network'}`);
    return 'failed';
  }
  return photoFrom(response, 'wiki');
}

/** The Teams photo of someone at Optimizely from the wiki's directory; null when the address is not an @optimizely.com one, or they have none (yet). Never throws. */
export function wikiPhoto(email: string, now = Date.now()): Promise<PhotoAnswer> {
  const address = optimizelyAddress(email);
  if (!address) return Promise.resolve(null);
  return answer(`wiki:${address}`, WIKI_KEEP_MS, () => fetchWikiPhoto(address), now);
}

// ─── Limitless ────────────────────────────────────────────────────────────

/**
 * The key Limitless knows a host by: the first 32 hex characters of the SHA-256 of their lower-cased
 * address (aldus-ui lib/offers/host-photos.ts hostKey). Not the Gravatar hash the browser asks us by:
 * that one is ours, this one is Limitless's, and each is made here from the address the page holds.
 */
export const hostKey = (email: string): string => createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 32);

/** An offer host's photo through Limitless; null when the address is not Optimizely's, Limitless is not configured, or it has none. Never throws. */
export function offerHostPhoto(offerId: string, email: string, now = Date.now()): Promise<PhotoAnswer> {
  const address = optimizelyAddress(email);
  if (!address || !aldusConfigured()) return Promise.resolve(null);
  const key = hostKey(address);
  return answer(`host:${offerId}:${key}`, LIMITLESS_KEEP_MS, () => hostPhoto(offerId, key), now);
}

// ─── How many may ask ─────────────────────────────────────────────────────

/** Photos a visitor's address may ask for in a minute: a page names a handful and the edge answers most of them. */
export const PHOTOS_PER_IP_PER_MINUTE = 90;
/** The signed-in person's own: one, once per page. */
export const OWN_PHOTOS_PER_MINUTE = 30;

let storeOverride: { store: CountStore | null } | null = null;
/** For the checks: a stand-in for the shared counter (null: none, so the instance's own). */
export function setPhotoLimitStore(store: CountStore | null | undefined): void {
  storeOverride = store === undefined ? null : { store };
}

const memoryWindows = new Map<string, { minute: number; count: number }>();
const MAX_MEMORY_WINDOWS = 5_000;

function overInMemory(id: string, minute: number, limit: number): boolean {
  const window = memoryWindows.get(id);
  if (!window || window.minute !== minute) {
    if (memoryWindows.size >= MAX_MEMORY_WINDOWS) {
      for (const [key, w] of memoryWindows) if (w.minute !== minute) memoryWindows.delete(key);
      if (memoryWindows.size >= MAX_MEMORY_WINDOWS) memoryWindows.clear();
    }
    memoryWindows.set(id, { minute, count: 1 });
    return 1 > limit;
  }
  window.count++;
  return window.count > limit;
}

/**
 * Counts this ask against `who`'s minute (an address or a person, hashed: nothing readable is kept);
 * true when it is one too many. The shared counter when there is one (every instance together),
 * else this instance's own, and a counter that fails is this instance's own too: a limit that
 * vanishes when its store does is not one.
 */
export async function overPhotoLimit(scope: string, who: string, limit: number, nowMs = Date.now()): Promise<boolean> {
  const minute = Math.floor(nowMs / 60_000);
  const id = `photo:${scope}:${createHash('sha256').update(who).digest('hex').slice(0, 32)}:${minute}`;
  const store = storeOverride ? storeOverride.store : countStore();
  if (store) {
    try {
      const count = await store.incr(id);
      if (count === 1) await store.expire(id, 120);
      return count > limit;
    } catch (err) {
      console.warn('[page-photo] shared counter unavailable, counting here:', err instanceof Error ? err.message : err);
    }
  }
  return overInMemory(id, minute, limit);
}

// ─── The answer ───────────────────────────────────────────────────────────

/** What every photo answer carries, whoever may keep it. */
const SAFE_HEADERS = {
  // A photo is never run or framed, whatever it claims to be.
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

/** A refusal: a code and nothing about any person. */
export function sendNone(res: VercelResponse, status: number, code: string, cacheControl: string, headers: Record<string, string> = {}): void {
  for (const [name, value] of Object.entries({ ...SAFE_HEADERS, ...headers })) res.setHeader(name, value);
  res.setHeader('Cache-Control', cacheControl);
  res.status(status).json({ code });
}

/** The photo: 200 with the image, 304 when the browser's copy is current, no body for HEAD. */
export function sendPhoto(req: VercelRequest, res: VercelResponse, photo: Photo, cacheControl: string, headers: Record<string, string> = {}): void {
  for (const [name, value] of Object.entries({ ...SAFE_HEADERS, ...headers })) res.setHeader(name, value);
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Content-Type', photo.type);
  res.setHeader('ETag', photo.etag);
  const given = String(req.headers['if-none-match'] ?? '').split(',').map((tag) => tag.trim());
  if (given.includes(photo.etag)) {
    res.status(304).end();
    return;
  }
  if (req.method === 'HEAD') {
    res.setHeader('Content-Length', String(photo.bytes.length));
    res.status(200).end();
    return;
  }
  res.status(200).send(Buffer.from(photo.bytes));
}

/** Forget everything kept and every window counted. The checks use it; nothing else needs to. */
export function forgetTeamsPhotos(): void {
  kept.clear();
  pending.clear();
  keptBytes = 0;
  wikiWindow.minute = 0;
  wikiWindow.count = 0;
  memoryWindows.clear();
}
