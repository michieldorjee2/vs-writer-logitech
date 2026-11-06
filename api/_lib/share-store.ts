/**
 * Personal links (src/lib/share-links.ts), in the site's Upstash Redis.
 *
 *   sl:<code>             json     the link: page, note, recipient, sender     LINK_TTL_S
 *   sl:s:<code>           hash     opens firstOpen lastOpen ctas lastCta       LINK_TTL_S
 *   sl:p:<path>           zset     code -> created, newest PER_PAGE kept      LINK_TTL_S
 *   sl:seen:<code>:<who>  flag     one open per visitor per OPEN_WINDOW_S
 *   sl:rl:<what>:<who>:<t> counter  the limits below
 *
 * Opens are counted per visitor (their ODP vuid, or a hash of address and browser) so a reload is
 * not a second read. Nobody signed in is ever counted (the endpoints check before calling here).
 */
import { randomBytes } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { ShareLink, ShareLinkRow, ShareStats } from '../../src/lib/share-links.js';

export const LINK_TTL_S = 400 * 86400;
export const PER_PAGE = 200;
export const OPEN_WINDOW_S = 6 * 3600;
/** Per signed-in sender a day, and per address a minute for the public reads. */
export const SHARE_LIMITS_PER = { createDay: 40, teamsDay: 30, emailDay: 40, readMinute: 30 } as const;

export type ShareStore = Pick<Redis, 'set' | 'get' | 'zadd' | 'zrange' | 'zremrangebyrank' | 'expire' | 'hincrby' | 'hset' | 'hsetnx' | 'hgetall' | 'incr'>;

export function shareStore(): ShareStore | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Eight characters from a CSPRNG; 256 % 62 bias is removed by rejection. */
export function newCode(): string {
  let out = '';
  while (out.length < 8) {
    for (const b of randomBytes(16)) {
      if (b < 248 && out.length < 8) out += ALPHABET[b % 62];
    }
  }
  return out;
}

/** Saves a new link under a fresh code; returns the code. */
export async function saveLink(store: ShareStore, link: Omit<ShareLink, 'code'>): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    const full: ShareLink = { ...link, code };
    const ok = await store.set(`sl:${code}`, full, { nx: true, ex: LINK_TTL_S });
    if (ok === null) continue;
    const index = `sl:p:${link.path}`;
    await store.zadd(index, { score: link.created, member: code });
    await store.zremrangebyrank(index, 0, -(PER_PAGE + 1));
    await store.expire(index, LINK_TTL_S);
    return code;
  }
  throw new Error('no free code');
}

export async function getLink(store: ShareStore, code: string): Promise<ShareLink | null> {
  const link = await store.get<ShareLink>(`sl:${code}`);
  return link && typeof link === 'object' && link.code === code ? link : null;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function statsOf(store: ShareStore, code: string): Promise<ShareStats> {
  const h = ((await store.hgetall<Record<string, unknown>>(`sl:s:${code}`)) ?? {}) as Record<string, unknown>;
  return {
    opens: num(h.opens) ?? 0,
    firstOpen: num(h.firstOpen),
    lastOpen: num(h.lastOpen),
    ctas: num(h.ctas) ?? 0,
    lastCta: num(h.lastCta),
  };
}

/** Counts an open, once per visitor per OPEN_WINDOW_S. True when it counted. */
export async function recordOpen(store: ShareStore, code: string, visitor: string, nowS: number): Promise<boolean> {
  const fresh = await store.set(`sl:seen:${code}:${visitor}`, 1, { nx: true, ex: OPEN_WINDOW_S });
  if (fresh === null) return false;
  const key = `sl:s:${code}`;
  await store.hincrby(key, 'opens', 1);
  await store.hsetnx(key, 'firstOpen', nowS);
  await store.hset(key, { lastOpen: nowS });
  await store.expire(key, LINK_TTL_S);
  return true;
}

/** Counts a CTA click that came from the link, once per visitor an hour. True when it counted. */
export async function recordCta(store: ShareStore, code: string, visitor: string, nowS: number): Promise<boolean> {
  const fresh = await store.set(`sl:seen:cta:${code}:${visitor}`, 1, { nx: true, ex: 3600 });
  if (fresh === null) return false;
  const key = `sl:s:${code}`;
  await store.hincrby(key, 'ctas', 1);
  await store.hset(key, { lastCta: nowS });
  await store.expire(key, LINK_TTL_S);
  return true;
}

/** The page's links, newest first, with what became of each; no addresses. */
export async function pageLinks(store: ShareStore, path: string, limit = 50): Promise<ShareLinkRow[]> {
  const codes = await store.zrange<string[]>(`sl:p:${path}`, 0, limit - 1, { rev: true });
  const rows = await Promise.all(
    codes.map(async (code): Promise<ShareLinkRow | null> => {
      const [link, stats] = await Promise.all([getLink(store, code), statsOf(store, code)]);
      if (!link || link.path !== path) return null;
      return {
        code,
        recipient: { name: link.recipient.name, title: link.recipient.title },
        sender: { name: link.sender.name },
        message: link.message,
        created: link.created,
        stats,
      };
    }),
  );
  return rows.filter((r): r is ShareLinkRow => r !== null);
}

/** False once `who` has done `what` `max` times in this window. Windows: 'day' or 'minute'. */
export async function underLimit(store: ShareStore, what: string, who: string, max: number, window: 'day' | 'minute', nowS: number): Promise<boolean> {
  const span = window === 'day' ? 86400 : 60;
  const key = `sl:rl:${what}:${who}:${Math.floor(nowS / span)}`;
  const n = await store.incr(key);
  if (n === 1) await store.expire(key, span * 2);
  return n <= max;
}
