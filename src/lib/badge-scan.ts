import { useEffect, useState, useSyncExternalStore } from 'react';
import { BADGE_ERRORS, cardFromAgent, MAX_PHOTO_DATA_URL, type BadgeCard, type BadgeReadStatus } from './badge-card';

/*
 * The search page's side of reading a badge (api/badge-read.ts the server's):
 * whether the camera shows, the photo made small on the phone, and Mark's read
 * followed until it is done. useBadgeCard turns the card into a page request.
 */

const ENDPOINT = '/api/badge-read';
/** The header a read is followed by: never the address, which lands in the request logs. */
export const TICKET_HEADER = 'X-Badge-Ticket';
/* Phones only, as the Notion item asks: the same width search-home.css and SearchHome switch layouts at. */
const SCAN_MEDIA = '(max-width: 799.98px)';
const POLL_MS = 1500;
const READ_MS = 60_000;

/**
 * Whether the badge reader is set up, as the server that drew /search said it
 * (#root data-badge, server/ssr-handler.tsx): so production never asks. Only
 * the dev server, which draws nothing, leaves it to the route (null).
 */
export function servedBadgeReady(drawnByServer: boolean, attr: string | undefined, dev: boolean): boolean | null {
  if (drawnByServer) return attr === 'on';
  return dev ? null : false;
}

const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia(SCAN_MEDIA);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const onPhone = () => window.matchMedia(SCAN_MEDIA).matches;

/** Whether this page shows the camera: signed in, on a phone, and Mark's badge reader is set up (`served`, or asked when null). */
export function useBadgeReady(signedIn: boolean, served: boolean | null): boolean {
  const phone = useSyncExternalStore(subscribePhone, onPhone, () => false);
  const [asked, setAsked] = useState(false);
  const ask = served === null && signedIn && phone;
  useEffect(() => {
    if (!ask) return;
    let cancelled = false;
    fetch(ENDPOINT, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ ready?: unknown }>) : null))
      .then((body) => {
        if (!cancelled) setAsked(body?.ready === true);
      })
      .catch(() => {
        /* Offline: no camera. */
      });
    return () => {
      cancelled = true;
    };
  }, [ask]);
  return signedIn && phone && (served ?? asked);
}

/**
 * The photo as a JPEG data URL, its long edge at most `maxEdge`: a phone photo
 * is 3–12 MB, the read needs a fraction of it. The browser draws it upright
 * (EXIF orientation); the server re-encodes it again without any EXIF.
 */
export async function shrinkPhoto(file: Blob, maxEdge = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let data = canvas.toDataURL('image/jpeg', 0.82);
    if (data.length > MAX_PHOTO_DATA_URL) data = canvas.toDataURL('image/jpeg', 0.6);
    if (data.length > MAX_PHOTO_DATA_URL) throw new Error('too-large');
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ReadFailure = 'failed' | 'too-large' | 'timeout' | 'signed-out' | 'not-set-up' | 'unreachable' | 'too-many';

/** The first half of the line the bar shows when a read fails; the rep then types the company. */
export const READ_FAILURE: Record<Exclude<ReadFailure, 'signed-out'>, string> = {
  failed: BADGE_ERRORS.notAPhoto,
  'too-large': BADGE_ERRORS.tooLarge,
  timeout: 'Mark took too long.',
  'not-set-up': BADGE_ERRORS.notSetUp,
  unreachable: "Couldn't reach Mark.",
  'too-many': BADGE_ERRORS.tooMany,
};

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

/** Mark reads the badge in `file`: the card, or why not. Abort stops the polling. */
export async function readBadge(file: Blob, signal: AbortSignal): Promise<{ ok: true; card: BadgeCard } | { ok: false; failure: ReadFailure }> {
  const fail = (failure: ReadFailure) => ({ ok: false as const, failure });
  let image: string;
  try {
    image = await shrinkPhoto(file);
  } catch (err) {
    return fail(err instanceof Error && err.message === 'too-large' ? 'too-large' : 'failed');
  }
  const started = Date.now();
  try {
    const sent = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
      cache: 'no-store',
      signal,
    });
    if (sent.status === 401) return fail('signed-out');
    if (sent.status === 503) return fail('not-set-up');
    if (sent.status === 429) return fail('too-many');
    if (sent.status === 400) {
      const body = (await sent.json().catch(() => null)) as { error?: string } | null;
      return fail(body?.error === BADGE_ERRORS.tooLarge ? 'too-large' : 'failed');
    }
    if (!sent.ok) return fail('unreachable');
    const { ticket } = (await sent.json()) as { ticket?: string };
    if (!ticket) return fail('unreachable');

    while (Date.now() - started < READ_MS) {
      await wait(POLL_MS, signal);
      const r = await fetch(ENDPOINT, { headers: { [TICKET_HEADER]: ticket }, cache: 'no-store', signal });
      if (r.status === 401) return fail('signed-out');
      if (r.status === 404) return fail('failed');
      if (!r.ok) return fail('unreachable');
      const body = (await r.json()) as BadgeReadStatus;
      if (body.status === 'failed') return fail('failed');
      if (body.status === 'done') {
        // The same rules the server read it with, so the page never trusts a card it didn't check.
        const card = cardFromAgent(body.card);
        return card ? { ok: true, card } : fail('failed');
      }
    }
    return fail('timeout');
  } catch {
    return fail('unreachable');
  }
}
