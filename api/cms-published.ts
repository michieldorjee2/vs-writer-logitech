import { createHash, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { purgePages, type PurgeResult } from './_lib/purge-page.js';

/**
 * The CMS's webhook: a page was published or deleted, so its cached HTML goes.
 *
 * CMS (SaaS) calls this for every published version (`contentVersion:preview1:published`) and
 * every deleted item (`content:preview1:deleted`), through two subscriptions on the CMS's
 * webhooks API (README, "Cache"). It sends the bearer token chosen when they were made
 * (CMS_WEBHOOK_TOKEN); anything else is refused.
 *
 * The CMS calls at publish, before Optimizely Graph has the new version, and the page is rendered
 * from Graph: purged at once, the next visitor would put the old copy back in the cache. So this
 * first waits for Graph to have the version (or, for a delete, to no longer have the item), for
 * up to WAIT_MS, then deletes the page's cache (by its `page:<key>` tag; every address it was
 * cached at). Purged after the wait either way: a late purge is still a purge.
 *
 * The handshake: CMS (SaaS) verifies a new subscription the CloudEvents webhook way, an OPTIONS
 * request with `WebHook-Request-Origin`, answered with `WebHook-Allowed-Origin`. It carries
 * nothing and grants nothing: events still need the token.
 *
 * Idempotent (the CMS may deliver an event more than once): a second purge is harmless.
 */

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';
/** How long to wait for Graph to catch up with the CMS. */
export const WAIT_MS = 30_000;
/** How often to ask Graph meanwhile. */
export const POLL_MS = 1_500;
/** One Graph read's bound, as in the server render (server/ssr-handler.tsx). */
const READ_MS = 4_000;
/** At most this many pages per delivery (a batch). */
const MAX_EVENTS = 20;

const PUBLISHED = 'contentVersion:preview1:published';

const STATUS_QUERY = `
query ShowcasePublishedStatus($key: String!) {
  _Content(where: { _metadata: { key: { eq: $key } } }, limit: 10) {
    items { _metadata { key version } }
  }
}
`;

type PageEvent = { type: string; key: string; version: number | null };
type Outcome = { key: string; type: string; graph: 'current' | 'gone' | 'timeout'; waitedMs: number };

/** For the checks: the clock and the network. */
export const deps = {
  fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

/** The token check, in constant time (both sides hashed first, so lengths never differ). */
function tokenMatches(header: string | undefined, expected: string): boolean {
  const given = /^Bearer\s+(.+)$/i.exec(header ?? '')?.[1]?.trim();
  if (!given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** A content key as Graph has it: 32 hex characters, no dashes, lower case. */
export function normalizeKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(key) ? key : null;
}

/** The events in a delivery: one CloudEvent, or a batch of them. Unknown shapes are dropped. */
export function eventsOf(body: unknown): PageEvent[] {
  const list = Array.isArray(body) ? body : [body];
  const events: PageEvent[] = [];
  for (const item of list.slice(0, MAX_EVENTS)) {
    if (!item || typeof item !== 'object') continue;
    const { type, data, subject } = item as { type?: unknown; data?: unknown; subject?: unknown };
    if (typeof type !== 'string') continue;
    const d = (data && typeof data === 'object' ? data : {}) as { key?: unknown; version?: unknown };
    // The key from the data, or from the subject (`/{resource}/{version}/{key}[/…]`).
    const fromSubject = typeof subject === 'string' ? subject.split('/').map(normalizeKey).find(Boolean) : null;
    const key = normalizeKey(d.key) ?? fromSubject ?? null;
    if (!key) continue;
    const version = d.version != null && /^\d+$/.test(String(d.version)) ? Number(d.version) : null;
    events.push({ type, key, version });
  }
  return events;
}

async function readBody(req: VercelRequest): Promise<unknown> {
  const body: unknown = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  let text = typeof body === 'string' ? body : Buffer.isBuffer(body) ? body.toString('utf8') : '';
  if (!text && typeof (req as unknown as AsyncIterable<Buffer>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of req as unknown as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
    text = Buffer.concat(chunks).toString('utf8');
  }
  return text ? JSON.parse(text) : null;
}

/** The versions Graph serves for `key` (published content only: the delivery key), or null if Graph could not say. */
async function graphVersions(authKey: string, key: string): Promise<number[] | null> {
  try {
    const res = await deps.fetch(`${GRAPH_ENDPOINT}?auth=${encodeURIComponent(authKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: STATUS_QUERY, variables: { key } }),
      signal: AbortSignal.timeout(READ_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { _Content?: { items?: { _metadata?: { version?: unknown } }[] } } };
    const items = json?.data?._Content?.items;
    if (!Array.isArray(items)) return null;
    return items.map((i) => Number(i?._metadata?.version)).filter((v) => Number.isFinite(v));
  } catch {
    return null;
  }
}

/** Wait until Graph shows the event's outcome: the version published, or the item gone. */
async function waitForGraph(authKey: string, event: PageEvent): Promise<Outcome> {
  const started = deps.now();
  const published = event.type === PUBLISHED;
  for (;;) {
    const versions = await graphVersions(authKey, event.key);
    if (versions) {
      if (published && versions.some((v) => event.version == null || v >= event.version!)) {
        return { key: event.key, type: event.type, graph: 'current', waitedMs: deps.now() - started };
      }
      if (!published && versions.length === 0) {
        return { key: event.key, type: event.type, graph: 'gone', waitedMs: deps.now() - started };
      }
    }
    if (deps.now() - started + POLL_MS > WAIT_MS) {
      return { key: event.key, type: event.type, graph: 'timeout', waitedMs: deps.now() - started };
    }
    await deps.sleep(POLL_MS);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  // The subscription handshake (CloudEvents webhook validation).
  if (req.method === 'OPTIONS') {
    const origin = req.headers['webhook-request-origin'];
    res.setHeader('Allow', 'POST, OPTIONS');
    if (typeof origin === 'string' && origin) {
      res.setHeader('WebHook-Allowed-Origin', origin);
      res.setHeader('WebHook-Allowed-Rate', '*');
    }
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.CMS_WEBHOOK_TOKEN;
  if (!expected) {
    console.error('[cms-published] CMS_WEBHOOK_TOKEN not set');
    return res.status(503).json({ error: 'Not configured' });
  }
  if (!tokenMatches(req.headers.authorization, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    console.error('[cms-published] GRAPH_AUTH_KEY not set');
    return res.status(503).json({ error: 'Not configured' });
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    return res.status(400).json({ error: 'Body is not JSON' });
  }
  const events = eventsOf(body);
  if (!events.length) {
    // Nothing about a page (another event type, or no key): acknowledged, nothing to do.
    return res.status(200).json({ purged: [] });
  }

  // One wait per page: the latest version asked for, if a batch names one page twice.
  const byKey = new Map<string, PageEvent>();
  for (const e of events) {
    const prev = byKey.get(e.key);
    if (!prev || (e.version ?? 0) >= (prev.version ?? 0)) byKey.set(e.key, e);
  }
  const outcomes = await Promise.all([...byKey.values()].map((e) => waitForGraph(authKey, e)));
  const purge: PurgeResult = await purgePages(outcomes.map((o) => o.key), deps.fetch);
  for (const o of outcomes) {
    console.log(`[cms-published] ${o.type} ${o.key} graph=${o.graph} waited=${o.waitedMs}ms purged=${purge.ok}`);
  }
  return res.status(purge.ok ? 200 : 502).json({ purged: purge.ok ? outcomes : [], outcomes, purge: { ok: purge.ok, status: purge.status ?? null } });
}
