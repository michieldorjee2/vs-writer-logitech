/**
 * POST /api/cta-ping: a visitor clicked "talk to your team" on an account page
 * (src/lib/cta-ping.ts). Public, so it trusts nothing it is sent beyond which page and which button:
 *
 *   1. a JSON post (415 otherwise), from the page's own site when the browser says (Sec-Fetch-Site,
 *      403 otherwise), at most 2 KB; the route must be an account page's (`/<slug>/`) and the button
 *      one of CTA_SOURCES (400 otherwise)
 *   2. off unless CTA_PING_WEBHOOK_URL (a Mark webhook) and CTA_PING_WEBHOOK_KEY are set: answers 202
 *      and sends nothing. Set for Production only, so previews and local runs never message anyone
 *   3. while KV_REST_API_* is set: one ping per visitor (address, hashed) per page an hour, ten per
 *      page a day, 300 a day in all. Over a limit answers 202 and sends nothing: the team has been
 *      told already. No KV, or KV down, is no limit (the Mark webhook's key still stands)
 *   4. the page itself, read from Graph (404 without one): the account's name and our team on it.
 *      The account executive is src/lib/account-rep.ts's, the person the page's panel names
 *   5. handed to Mark's "Showcase CTA ping" workflow (mark/cta-ping/), which messages the account
 *      executive in Teams from Michiel's account, or adds a row to the follow-up sheet when the
 *      page has none. 202 once Mark has it, 502 when Mark refused it (the panel opens either way)
 *
 * `check` is the SHA-256 of the rest of the payload as canonical JSON (keys sorted, no spaces).
 * The workflow recomputes it and messages nobody when the click changed on its way.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

import { ACCOUNT_TEAM_QUERY } from '../src/lib/account-page-query.js';
import { accountExecutiveOf, realContacts } from '../src/lib/account-rep.js';
import { CTA_SOURCES, type CtaSource } from '../src/lib/cta-ping.js';
import type { CompetitorComparisonPage } from '../src/lib/graph-types.js';
import { UTM_KEYS } from '../src/lib/offer-signup.js';
import { deriveCustomerName } from '../src/lib/page-identity.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';
const SITE = 'https://showcase.optimizely.com';
const MAX_BODY = 2048;
const WEBHOOK_TIMEOUT_MS = 5000;
/** Mark's webhook hosts (the older name still answers). Anything else is a misconfiguration. */
const WEBHOOK_HOSTS = new Set(['webhook.mark.optimizely.com', 'webhook.opal.optimizely.com']);
export const LIMITS = { visitorPerPageHour: 1, perPageDay: 10, allDay: 300 } as const;

/** The button, as the account executive reads it. */
const BUTTON_LABEL: Record<CtaSource, string> = {
  'hero-connect-btn': 'the button at the top of the page',
  'cta-connect-btn': 'the button at the end of the page',
  'sticky-connect-btn': 'the bar that follows them down the page',
};

export interface CtaPing {
  event: 'cta_click';
  ping_id: string;
  requested_at: string;
  account: string;
  page: string;
  button: string;
  campaign: string;
  rep: { name: string; role: string; email: string } | null;
  team: Array<{ name: string; role: string }>;
  check: string;
}

type TeamPage = Pick<CompetitorComparisonPage, '_metadata' | 'eyebrow' | 'intelHeadline' | 'teamMembers'>;

/** One line of text: no control characters, single spaces, at most `max` characters. */
function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** An account page's route segment ("/tungsten-automation/" -> "tungsten-automation"), or null. */
export function accountSegmentOf(route: unknown): string | null {
  if (typeof route !== 'string') return null;
  const m = /^\/([a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?)\/?$/i.exec(route.trim());
  return m ? m[1].toLowerCase() : null;
}

/** JSON with every object's keys sorted and no spaces: the same bytes in Node and in Python. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export const checkOf = (ping: Omit<CtaPing, 'check'>): string => createHash('sha256').update(canonicalJson(ping), 'utf8').digest('hex');

/** The click as Mark receives it: everything about the account from the page, nothing from the visitor but the button and campaign. */
export function buildPing(
  page: TeamPage,
  segment: string,
  source: CtaSource,
  utm: Record<string, string>,
  now = new Date(),
  pingId: string = randomUUID(),
): CtaPing {
  const ae = accountExecutiveOf(page.teamMembers);
  const rep = ae
    ? { name: clean(ae.Name, 120), role: clean(ae.Role, 120), email: clean(ae.Email, 254).toLowerCase() }
    : null;
  const team = realContacts(page.teamMembers)
    .filter((m) => m !== ae && clean(m.Name, 120))
    .slice(0, 5)
    .map((m) => ({ name: clean(m.Name, 120), role: clean(m.Role, 120) }));
  const campaign = UTM_KEYS.filter((k) => utm[k])
    .map((k) => `${k}: ${clean(utm[k], 200)}`)
    .join(' · ');
  const body: Omit<CtaPing, 'check'> = {
    event: 'cta_click',
    ping_id: pingId,
    requested_at: now.toISOString(),
    account: clean(deriveCustomerName(page as CompetitorComparisonPage), 160) || 'their account',
    page: `${SITE}/${segment}/`,
    button: BUTTON_LABEL[source],
    campaign: clean(campaign, 600),
    rep,
    team,
  };
  return { ...body, check: checkOf(body) };
}

async function pageAt(segment: string, authKey: string): Promise<TeamPage | null> {
  for (const slug of [`/${segment}/`, `/en/${segment}/`]) {
    const res = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: ACCOUNT_TEAM_QUERY, variables: { slug } }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { CompetitorComparisonPage?: { items?: TeamPage[] } } };
    const item = body.data?.CompetitorComparisonPage?.items?.[0];
    if (item) return item;
  }
  return null;
}

/** The Mark webhook, when configured and pointing at Mark. */
function webhook(): { url: string; key: string } | null {
  const url = process.env.CTA_PING_WEBHOOK_URL?.trim();
  const key = process.env.CTA_PING_WEBHOOK_KEY?.trim();
  if (!url || !key) return null;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && WEBHOOK_HOSTS.has(u.hostname)) return { url, key };
  } catch {
    /* falls through */
  }
  console.error('[cta-ping] CTA_PING_WEBHOOK_URL is not a Mark webhook: nothing sent');
  return null;
}

const header = (req: VercelRequest, name: string): string => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
};

function clientIp(req: VercelRequest): string {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0]?.trim();
  return forwarded || header(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown';
}

/** Already told, or over a limit? Never blocks a ping when KV is unset or down. */
async function overLimit(ip: string, segment: string, now: Date): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  try {
    const redis = new Redis({ url, token });
    const day = now.toISOString().slice(0, 10);
    // The address as a hash: the key outlives the request by an hour.
    const visitor = createHash('sha256').update(`${ip}|${segment}`).digest('hex').slice(0, 32);
    const first = await redis.set(`cta:visit:${visitor}`, '1', { nx: true, ex: 3600 });
    if (first === null) return true;
    const pageKey = `cta:page:${segment}:${day}`;
    const allKey = `cta:all:${day}`;
    const [byPage, all] = await Promise.all([redis.incr(pageKey), redis.incr(allKey)]);
    await Promise.all([byPage === 1 && redis.expire(pageKey, 172800), all === 1 && redis.expire(allKey, 172800)]);
    return byPage > LIMITS.perPageDay || all > LIMITS.allDay;
  } catch (err) {
    console.warn('[cta-ping] rate limit skipped:', err instanceof Error ? err.message : err);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (!/^application\/json(?:;|$)/i.test(header(req, 'content-type').trim())) return res.status(415).json({ error: 'JSON only' });
  const site = header(req, 'sec-fetch-site');
  if (site && site !== 'same-origin') return res.status(403).json({ error: 'Forbidden' });

  let body: unknown;
  try {
    body = req.body;
  } catch {
    // @vercel/node throws reading a JSON body that doesn't parse.
    return res.status(400).json({ error: 'Bad request' });
  }
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'Too large' });
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Bad request' });
    }
  }
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > MAX_BODY) {
    return res.status(body ? 413 : 400).json({ error: body ? 'Too large' : 'Bad request' });
  }
  const b = body as Record<string, unknown>;
  const segment = accountSegmentOf(b.route);
  const source = CTA_SOURCES.find((s) => s === b.source);
  if (!segment || !source) return res.status(400).json({ error: 'Bad request' });
  const given = (b.utm && typeof b.utm === 'object' ? b.utm : {}) as Record<string, unknown>;
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    // As the browser reads them (src/lib/offer-signup.ts utmOf): a value over 200 characters is dropped, not cut.
    const value = typeof given[key] === 'string' ? clean(given[key], 400) : '';
    if (value && value.length <= 200) utm[key] = value;
  }

  const hook = webhook();
  if (!hook) return res.status(202).json({ ok: true });

  const now = new Date();
  if (await overLimit(clientIp(req), segment, now)) return res.status(202).json({ ok: true });

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    console.error('[cta-ping] GRAPH_AUTH_KEY unset: nothing sent');
    return res.status(503).json({ error: 'Unavailable' });
  }
  let page: TeamPage | null;
  try {
    page = await pageAt(segment, authKey);
  } catch (err) {
    console.error('[cta-ping] page read failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Unavailable' });
  }
  if (!page) return res.status(404).json({ error: 'Not found' });

  const ping = buildPing(page, segment, source, utm, now);
  try {
    const r = await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-showcase-key': hook.key },
      body: JSON.stringify(ping),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`Mark answered ${r.status}`);
  } catch (err) {
    console.error(`[cta-ping] /${segment}/: not handed to Mark:`, err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Unavailable' });
  }
  console.info(`[cta-ping] /${segment}/ ${ping.ping_id}: handed to Mark (${ping.rep ? 'account executive' : 'follow-up sheet'})`);
  return res.status(202).json({ ok: true });
}
