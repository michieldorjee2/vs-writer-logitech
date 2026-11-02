/**
 * Reading a badge with Mark, for api/badge-read.ts. Server only (node:crypto).
 *
 * Off until MARK_BADGE_AGENT_ID names Mark's badge reader (and OPAL_PAT is
 * set): the search page then shows no camera at all. The agent's spec, and the
 * one run that proves a `file` parameter reaches it as pixels, wait on
 * Michiel's go (scratchpad sweep/badge-agent-spec.md).
 *
 * The photo: the route strips it of EXIF (location, camera, time) and shrinks
 * it, uploads it to Mark's file server, and starts a private run of the reader
 * on it. The showcase keeps neither the photo nor what was read: no Blob, no
 * Redis, no log line. Mark keeps the photo in its file server under the PAT's
 * owner, referenced by that private run.
 *
 * The run is followed through a ticket the browser holds: the run's id, the
 * rep's email and ten minutes, signed. Nothing to store, and a rep can follow
 * only a read they started, never another Mark run by its id.
 *
 * Local preview only: BADGE_READ_STUB answers without Mark (see stubOutcome).
 * Refused whenever VERCEL_ENV or NODE_ENV is production.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BADGE_ERRORS, cardFromAgent, MAX_PHOTO_BYTES, MAX_PHOTO_DATA_URL, type BadgeReadStatus } from '../../src/lib/badge-card.js';
import { INSTANCE_ID, MarkError, markFileHeaders, type MarkAgentExecution } from './mark.js';

type Env = Record<string, string | undefined>;

/* ---------- Whether it is on ---------- */

export type BadgeMode = 'off' | 'stub' | 'live';

/** The stub never answers in production, whatever the env says. */
export const stubRefused = (env: Env) => env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';

export const badgeAgentId = (env: Env = process.env) => (env.MARK_BADGE_AGENT_ID || '').trim();

export function badgeMode(env: Env = process.env): BadgeMode {
  if ((env.BADGE_READ_STUB || '').trim() && !stubRefused(env)) return 'stub';
  if (env.OPAL_PAT && badgeAgentId(env)) return 'live';
  return 'off';
}

/* ---------- The ticket ---------- */

export type Ticket = { ex: string; em: string; exp: number };
export const TICKET_MS = 10 * 60 * 1000;

const mac = (key: string, data: string) => createHmac('sha256', key).update(data).digest('base64url');

/** Its own key, derived from the session secret, so a ticket can never pass for a session cookie. */
export const ticketKey = (sessionSecret: string) => mac(sessionSecret, 'showcase badge-read ticket v1');

export function signTicket(ticket: Ticket, key: string): string {
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${payload}.${mac(key, payload)}`;
}

/** The ticket's run, when it is genuine, this rep's and still fresh; else null. */
export function openTicket(token: unknown, key: string, email: string, now = Date.now()): Ticket | null {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length) return null;
  const want = Buffer.from(mac(key, payload));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let ticket: Partial<Ticket>;
  try {
    ticket = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as Partial<Ticket>;
  } catch {
    return null;
  }
  if (typeof ticket.ex !== 'string' || !ticket.ex || typeof ticket.em !== 'string' || typeof ticket.exp !== 'number') return null;
  if (ticket.em !== email.trim().toLowerCase() || ticket.exp < now) return null;
  return { ex: ticket.ex, em: ticket.em, exp: ticket.exp };
}

/* ---------- The photo ---------- */

const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** The bytes of the photo the page sent (a JPEG, PNG or WebP data URL of at most 3 MB), or the line to show. */
export function readPhoto(image: unknown): { ok: true; bytes: Buffer } | { ok: false; error: string } {
  if (typeof image !== 'string') return { ok: false, error: BADGE_ERRORS.notAPhoto };
  if (image.length > MAX_PHOTO_DATA_URL) return { ok: false, error: BADGE_ERRORS.tooLarge };
  const m = DATA_URL.exec(image);
  if (!m) return { ok: false, error: BADGE_ERRORS.notAPhoto };
  const bytes = Buffer.from(m[1], 'base64');
  if (!bytes.length) return { ok: false, error: BADGE_ERRORS.notAPhoto };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, error: BADGE_ERRORS.tooLarge };
  return { ok: true, bytes };
}

/**
 * Upright, at most 1600px, re-encoded as JPEG: sharp writes no metadata unless
 * asked, so the EXIF (GPS, camera, time) stays behind. Throws on bytes that are
 * not an image.
 */
export async function cleanPhoto(bytes: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(bytes, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/* ---------- Mark's file server ---------- */

const backendUrl = () => (process.env.OPAL_BACKEND_URL || 'https://opal-backend.optimizely.com').replace(/\/+$/, '');

async function backend<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: { ...markFileHeaders(), Accept: 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new MarkError(`Mark files ${init.method ?? 'GET'} ${path.split('?')[0]} → ${res.status}`, res.status);
  return (await res.json()) as T;
}

let customer: Promise<string> | null = null;
function customerId(): Promise<string> {
  customer ??= backend<{ customer_id?: string; data?: { customer_id?: string } }>(
    `/api/v1/auth/status?instance_id=${encodeURIComponent(INSTANCE_ID)}`,
  ).then((status) => {
    const id = status.customer_id ?? status.data?.customer_id;
    if (!id) throw new MarkError('Mark named no customer for the PAT', 502);
    return id;
  });
  customer.catch(() => {
    customer = null;
  });
  return customer;
}

/** The file record's gs:// address (its field name is not pinned down yet: the first gs:// string in it). */
export function gsUriOf(record: unknown, depth = 0): string | null {
  if (typeof record === 'string') return record.startsWith('gs://') ? record : null;
  if (!record || typeof record !== 'object' || depth > 3) return null;
  for (const value of Object.values(record as Record<string, unknown>)) {
    const hit = gsUriOf(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * Puts the cleaned photo on Mark's file server (signed-URL upload, then the
 * file record) and returns its gs:// address. The signed URL is a short-lived
 * credential: it is never logged or returned.
 */
export async function uploadBadgePhoto(jpeg: Buffer): Promise<string> {
  const cid = encodeURIComponent(await customerId());
  const meta = JSON.stringify({ filename: `badge-${Date.now()}.jpg`, mime_type: 'image/jpeg', size: jpeg.byteLength });
  const json = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: meta };
  const signed = await backend<{ signed_url?: string; data?: { signed_url?: string } }>(`/api/v2/customer/${cid}/files/upload/signed-url`, json);
  const uploadUrl = signed.signed_url ?? signed.data?.signed_url;
  const fileId = uploadUrl ? /file-contents\/([A-Za-z0-9_-]+)/.exec(uploadUrl)?.[1] : undefined;
  if (!uploadUrl || !fileId) throw new MarkError('Mark gave no upload address', 502);
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array(jpeg) });
  if (!put.ok) throw new MarkError(`Mark files PUT → ${put.status}`, put.status);
  const record = await backend<unknown>(`/api/v2/customer/${cid}/files/${fileId}/create`, json);
  const uri = gsUriOf(record);
  if (!uri) throw new MarkError('Mark kept no file record', 502);
  return uri;
}

/** The reader's one parameter, in the shape Hypatia's own execute example gives a file. */
export const badgeParameters = (uri: string) => ({ badge: { type: 'file', url: uri } });

/* ---------- Following the run ---------- */

const isDone = (s: string) => /^(completed|success|succeeded)$/i.test(s);
const isFailed = (s: string) => /^(failed|error|cancelled|canceled|timed_out|timeout|paused|stopped|superseded)$/i.test(s);

/** Where a reader run is, as the page is told: still reading, the card, or failed (a run that read nothing too). */
export function executionOutcome(execution: MarkAgentExecution): BadgeReadStatus {
  const status = String(execution.status_code || execution.status || '');
  if (isFailed(status)) return { status: 'failed' };
  if (!isDone(status)) return { status: 'reading' };
  const answer = typeof execution.result === 'string' ? execution.result : (execution.result?.response ?? '');
  const card = cardFromAgent(answer);
  return card ? { status: 'done', card } : { status: 'failed' };
}

/* ---------- The local preview's stand-in ---------- */

/** How long the stand-in "reads", so the reading state shows. */
export const STUB_READ_MS = 2500;
/* A made-up person at a made-up company, written the way the reader answers. */
const STUB_ANSWER =
  '```json\n{"name":"JANE DOE","title":"VP Marketing","company":"Acme Corp","email":"jane@acmecorp.example","website":""}\n```';

/**
 * BADGE_READ_STUB answers for Mark in a local preview:
 *   1        a card for Jane Doe, VP Marketing at Acme Corp (acmecorp.example, no page)
 *   fail     a read that failed
 *   {…}      that JSON, as if the reader had answered it (try a company that has a page)
 */
export function stubOutcome(env: Env, startedAt: number, now = Date.now()): BadgeReadStatus {
  if (now - startedAt < STUB_READ_MS) return { status: 'reading' };
  const value = (env.BADGE_READ_STUB || '').trim();
  if (value === 'fail') return { status: 'failed' };
  const card = cardFromAgent(value.startsWith('{') ? value : STUB_ANSWER);
  return card ? { status: 'done', card } : { status: 'failed' };
}
