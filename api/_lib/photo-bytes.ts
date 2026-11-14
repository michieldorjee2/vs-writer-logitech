/**
 * Reading someone's photo off another service's answer (the wiki's people directory, Limitless's host
 * photo route), for api/page-photo.ts and api/me-photo.ts. What comes back is bytes from a server we
 * do not control, re-served from this site's origin, so it is held to what a photo is:
 *
 *   - 200 and a raster type (JPEG, PNG, WebP): never SVG or HTML, whatever the other side says
 *   - at most MAX_PHOTO_BYTES (the wiki keeps one 96 px copy: a few KB), counted as it arrives, so a
 *     reply that lies about its length is cut off rather than held
 *   - a 404 is "no photo" (a person with none, or not in the directory yet); anything else is a
 *     failure, which is never held as an answer
 */
import { createHash } from 'node:crypto';

export interface Photo {
  bytes: Uint8Array;
  /** `"<32 hex>"`: the SHA-256 of the bytes, so a browser's copy is revalidated, not refetched. */
  etag: string;
  type: string;
}

/** The answer for one person: a photo, none (null), or "could not be read just now". */
export type PhotoAnswer = Photo | null | 'failed';

export const MAX_PHOTO_BYTES = 256 * 1024;
export const FETCH_TIMEOUT_MS = 3_000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** The body of a response if it is no longer than `max`; null when it is, or when there is none. */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** The photo in a response, `null` for a 404, `'failed'` for everything else that is not a good photo. Never throws. `from` names the source in the log, never the person. */
export async function photoFrom(response: Response, from: string): Promise<PhotoAnswer> {
  if (response.status === 404) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    console.warn(`[page-photo] ${from}: HTTP ${response.status}`);
    return 'failed';
  }
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!IMAGE_TYPES.has(type)) {
    await response.body?.cancel().catch(() => undefined);
    console.warn(`[page-photo] ${from}: not an image`);
    return 'failed';
  }
  const bytes = await readCapped(response, MAX_PHOTO_BYTES).catch(() => null);
  if (!bytes || bytes.length === 0) {
    console.warn(`[page-photo] ${from}: unreadable or too large`);
    return 'failed';
  }
  return { bytes, etag: `"${createHash('sha256').update(bytes).digest('hex').slice(0, 32)}"`, type };
}
