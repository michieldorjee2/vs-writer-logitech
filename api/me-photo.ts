/**
 * GET /api/me-photo: the signed-in person's own Microsoft Teams photo, for the search page's corner
 * (src/components/ProfileMenu.tsx) when they have no Gravatar. README, "Teams photos on pages".
 *
 * The address is the session's (api/_lib/auth.ts requireIdentity), never one the request names, so
 * there is nothing here to ask anyone else's by: 401 without a session, 404 for an identity that is not an
 * @optimizely.com one, and the same switch as the pages' (PAGE_PEOPLE_PHOTOS, exactly "on"). The photo is
 * the wiki's, as for a page (api/_lib/teams-photo.ts). Private to the one browser: the answer follows the
 * cookie, so no shared cache ever holds it.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { optimizelyAddress } from '../src/lib/page-photos.js';
import { requireIdentity } from './_lib/auth.js';
import { OWN_PHOTOS_PER_MINUTE, overPhotoLimit, photosOn, sendNone, sendPhoto, wikiPhoto } from './_lib/teams-photo.js';

/** Five minutes in the browser that asked; revalidated by ETag after. */
const OWN_CACHE_CONTROL = 'private, max-age=300';
const NOT_SHARED = { Vary: 'Cookie' } as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await serve(req, res);
  } catch (err) {
    console.error('[me-photo] failed:', err instanceof Error ? err.name : 'error');
    if (!res.headersSent) sendNone(res, 502, 'unavailable', 'no-store');
  }
}

async function serve(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return sendNone(res, 405, 'method', 'no-store');
  }
  const identity = requireIdentity(req, res);
  if (!identity) return;
  const email = optimizelyAddress(identity.email);
  if (!photosOn() || !email) return sendNone(res, 404, 'no-photo', 'private, max-age=60', NOT_SHARED);
  if (await overPhotoLimit('me', email, OWN_PHOTOS_PER_MINUTE)) {
    res.setHeader('Retry-After', '60');
    return sendNone(res, 429, 'slow-down', 'no-store');
  }

  const photo = await wikiPhoto(email);
  if (photo === 'failed') return sendNone(res, 502, 'unavailable', 'no-store');
  if (!photo) return sendNone(res, 404, 'no-photo', 'private, max-age=60', NOT_SHARED);
  return sendPhoto(req, res, photo, OWN_CACHE_CONTROL, NOT_SHARED);
}
