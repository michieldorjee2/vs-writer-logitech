/**
 * GET /api/page-photo?p=<page>&k=<key>: the Microsoft Teams photo of someone from Optimizely who is
 * named on a public page, for the avatar to use when they have no Gravatar (src/components/GravatarAvatar.tsx,
 * src/lib/page-photos.ts). README, "Teams photos on pages". Public, like the pages that ask, so it
 * trusts nothing it is sent beyond which page and which person on it:
 *
 *   1. GET or HEAD, with exactly `p` and `k` and nothing else (a spare parameter is a way round the
 *      edge cache, so it is a 400). `p` is a page's canonical route (`acme`, `acme/pat`, `vb/spring-dinner`)
 *      and `k` the person's Gravatar hash, 32 hex characters: an opaque key, never an address.
 *   2. off unless PAGE_PEOPLE_PHOTOS is exactly "on": 404 `off`, and nothing asked of anyone.
 *   3. at most PHOTOS_PER_IP_PER_MINUTE a minute from one address (429 beyond): the shared counter when
 *      there is one, else the instance's own.
 *   4. the page itself, read from Graph (api/_lib/page-people.ts): the @optimizely.com people it draws.
 *      No such page is a 404 `no-page`. The key must be one of THEIRS, or it is a 404 `not-on-page`
 *      and nothing is asked of the wiki or Limitless. So this is never a way to fetch a colleague
 *      by address, or one who is not on this page, or anyone at a customer: whoever is not on the
 *      page the visitor is on is not served.
 *   5. the photo, from where it lives (api/_lib/teams-photo.ts): an offer page's host from Limitless
 *      (with the offer the page is for; Limitless checks the host is one of the offer's, again), anyone
 *      else from the wiki's people directory. The bytes are fetched here and served from this origin: the
 *      wiki's signed link, which dies within hours, is never made, and no token, address or link reaches the
 *      browser or the page.
 *
 * Cached publicly, and short: 5 minutes in a browser, 15 at the edge, ETag throughout. It is the same
 * image a public page already shows to everyone who opens it, with nothing of the viewer in it, so a
 * shared cache is right; and short, so a changed or removed photo shows within the hour (Limitless
 * keeps one 30 minutes, this site's edge 15, a browser 5). The response carries the page's own cache
 * tag (`page:<key>`), so a CMS publish or delete of the page empties its photos from the edge too. A
 * refusal is cached for minutes, not for the photo's quarter hour, and a failure to read (the wiki,
 * Limitless or Graph down) is not cached at all.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PHOTO_KEY, photoKeyOf, photoPageOf } from '../src/lib/page-photos.js';
import { pagePeople } from './_lib/page-people.js';
import { clientIp } from './_lib/share-http.js';
import { PHOTOS_PER_IP_PER_MINUTE, offerHostPhoto, overPhotoLimit, photosOn, sendNone, sendPhoto, wikiPhoto } from './_lib/teams-photo.js';

/** What a photo is held for: a browser 5 minutes, the edge 15. */
export const PHOTO_CACHE_CONTROL = 'public, max-age=300, s-maxage=900';
/** "No photo", "not on this page", "off", a malformed address: the same next time, and worth absorbing at the edge. */
const REFUSED_CACHE_CONTROL = 'public, max-age=60, s-maxage=300';
/** Off is read again within a minute, so switching it on shows within one. */
const OFF_CACHE_CONTROL = 'public, max-age=0, s-maxage=60';
/** A failure is not an answer: nothing keeps it, and the avatar draws initials meanwhile. */
const FAILED_CACHE_CONTROL = 'no-store';

const one = (value: string | string[] | undefined): string | null => (typeof value === 'string' ? value : null);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await serve(req, res);
  } catch (err) {
    // Nothing here should throw (every read is guarded); if something does, it is a failure, never an answer anything keeps, and never a stack in the response.
    console.error('[page-photo] failed:', err instanceof Error ? err.name : 'error');
    if (!res.headersSent) sendNone(res, 502, 'unavailable', FAILED_CACHE_CONTROL);
  }
}

async function serve(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendNone(res, 405, 'method', 'no-store');
  }

  const query = req.query ?? {};
  const p = one(query.p);
  const k = one(query.k);
  const page = photoPageOf(p);
  if (Object.keys(query).sort().join(',') !== 'k,p' || !page || page.path !== p || !k || !PHOTO_KEY.test(k)) {
    return sendNone(res, 400, 'bad-request', REFUSED_CACHE_CONTROL);
  }

  if (!photosOn()) return sendNone(res, 404, 'off', OFF_CACHE_CONTROL);

  if (await overPhotoLimit('ip', clientIp(req), PHOTOS_PER_IP_PER_MINUTE)) {
    res.setHeader('Retry-After', '60');
    return sendNone(res, 429, 'slow-down', FAILED_CACHE_CONTROL);
  }

  const people = await pagePeople(page);
  if (people === 'failed') return sendNone(res, 502, 'unavailable', FAILED_CACHE_CONTROL);
  if (!people) return sendNone(res, 404, 'no-page', REFUSED_CACHE_CONTROL);
  // The person is whoever on THIS page has this key. Nothing else is looked up.
  const email = people.emails.find((address) => photoKeyOf(address) === k);
  if (!email) return sendNone(res, 404, 'not-on-page', REFUSED_CACHE_CONTROL);

  const photo = people.kind === 'offer' && people.offerId ? await offerHostPhoto(people.offerId, email) : await wikiPhoto(email);
  if (photo === 'failed') return sendNone(res, 502, 'unavailable', FAILED_CACHE_CONTROL);
  const tag: Record<string, string> = people.key ? { 'Vercel-Cache-Tag': `page:${people.key}`, 'Cache-Tag': `page:${people.key}` } : {};
  if (!photo) return sendNone(res, 404, 'no-photo', REFUSED_CACHE_CONTROL, tag);

  // Cross-origin embedding is not wanted: only this site's pages show it.
  return sendPhoto(req, res, photo, PHOTO_CACHE_CONTROL, { 'Cross-Origin-Resource-Policy': 'same-origin', ...tag });
}
