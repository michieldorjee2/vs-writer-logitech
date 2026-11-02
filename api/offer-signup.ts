/**
 * POST /api/offer-signup — one sign-up from an offer page's email form (src/lib/offer-signup.ts,
 * src/components/offer-signup/OfferSignupForm.tsx). Public, like api/track-miss.ts, so it trusts
 * nothing it is sent beyond the email:
 *
 *   1. at most 4 KB; a filled honeypot (`website`) answers 200 and keeps nothing
 *   2. the offer id, the page's /vb/ route and the email's shape, else 400
 *   3. at most 5 a minute per address while KV_REST_API_* is set (429); skipped when it isn't
 *   4. the page itself, read from Graph: it must exist and be that offer's page, else 404. The
 *      account and domain are the page's, never the form's
 *   5. kept in Limitless (aldus-ui POST /api/machine/showcase/offers/{id}/signup), else 502 and
 *      the form says try again
 *   6. then, only when OFFER_SIGNUP_WEBHOOKS is set (comma-separated https URLs, unset today),
 *      each gets the sign-up the way optimizely.com's forms post to their Webhooks: `email`,
 *      `PageName`, `pageURL`, `page_key`, `form_key`, the utm_* fields, `offer_id` and
 *      `campaign_id`. A webhook that fails is logged and never fails the sign-up.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

import { routeSegmentOf, SIGNUP_WORDS, UTM_KEYS, type Utm, workEmailOf } from '../src/lib/offer-signup.js';
import { addSignup, aldusConfigured } from './_lib/aldus.js';
import { offerIdOf } from './_lib/offer-pages.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';
const MAX_BODY = 4096;
const PER_MINUTE = 5;
const WEBHOOK_TIMEOUT_MS = 3000;
const FORM_KEY = 'limitless-offer-signup';

/** The offer page a sign-up names: its account, and the offer it was written for. */
const SIGNUP_PAGE_QUERY = `
query SignupPage($slug: String!) {
  ABMExperience(where: { _metadata: { url: { hierarchical: { eq: $slug } } } }, locale: en) {
    items { companyName brandDomain componentPlan }
  }
}
`;

type Page = { companyName: string | null; brandDomain: string | null; componentPlan: string | null };

async function pageAt(segment: string, authKey: string): Promise<Page | null> {
  for (const slug of [`/${segment}/`, `/en/${segment}/`]) {
    const res = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: SIGNUP_PAGE_QUERY, variables: { slug } }),
      signal: AbortSignal.timeout(5000),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { ABMExperience?: { items?: Page[] } } };
    const item = body.data?.ABMExperience?.items?.[0];
    if (item) return item;
  }
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

/** Over the limit? Never fails a sign-up: no KV, or KV down, is no limit. */
async function overLimit(ip: string, now: Date): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  try {
    const redis = new Redis({ url, token });
    const minute = now.toISOString().slice(0, 16).replace(/\D/g, '');
    const key = `signup:ip:${ip}:${minute}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 120);
    return n > PER_MINUTE;
  } catch (err) {
    console.warn('[offer-signup] rate limit skipped:', err instanceof Error ? err.message : err);
    return false;
  }
}

function webhookUrls(): string[] {
  return (process.env.OFFER_SIGNUP_WEBHOOKS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => {
      try {
        return new URL(url).protocol === 'https:';
      } catch {
        return false;
      }
    });
}

function pageUrlOf(req: VercelRequest, segment: string): string {
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  const safe = /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : 'showcase.optimizely.com';
  return `${/^localhost(?::|$)/i.test(safe) ? 'http' : 'https'}://${safe}/vb/${segment}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  let body: unknown = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ error: 'Too large' });
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: SIGNUP_WORDS.error });
    }
  }
  if (!body || typeof body !== 'object' || JSON.stringify(body).length > MAX_BODY) {
    return res.status(body ? 413 : 400).json({ error: body ? 'Too large' : SIGNUP_WORDS.error });
  }
  const b = body as Record<string, unknown>;

  // A bot that fills every field is thanked and forgotten.
  if (typeof b.website === 'string' && b.website.trim() !== '') return res.status(200).json({ ok: true });

  const offerId = typeof b.offerId === 'string' && /^[\w.-]{1,200}$/.test(b.offerId) && !b.offerId.startsWith('.') ? b.offerId : null;
  const segment = routeSegmentOf(b.route);
  if (!offerId || !segment) return res.status(400).json({ error: SIGNUP_WORDS.error });
  const email = workEmailOf(b.email);
  if (!email) return res.status(400).json({ error: SIGNUP_WORDS.invalid });
  const given = (b.utm && typeof b.utm === 'object' ? b.utm : {}) as Record<string, unknown>;
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = typeof given[key] === 'string' ? (given[key] as string).trim() : '';
    if (value && value.length <= 200) utm[key] = value;
  }

  if (await overLimit(clientIp(req), new Date())) return res.status(429).json({ error: SIGNUP_WORDS.error });

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey || !aldusConfigured()) {
    console.error('[offer-signup] GRAPH_AUTH_KEY or ALDUS_UI_URL/ALDUS_SHOWCASE_TOKEN unset: sign-up not kept');
    return res.status(503).json({ error: SIGNUP_WORDS.error });
  }
  let page: Page | null;
  try {
    page = await pageAt(segment, authKey);
  } catch (err) {
    console.error('[offer-signup] page read failed:', err);
    return res.status(502).json({ error: SIGNUP_WORDS.error });
  }
  if (!page || offerIdOf(page.componentPlan) !== offerId) return res.status(404).json({ error: SIGNUP_WORDS.error });

  let campaignId: string | null;
  try {
    ({ campaignId } = await addSignup(offerId, { email, route: `/vb/${segment}`, account: page.companyName, domain: page.brandDomain, utm }));
  } catch (err) {
    console.error('[offer-signup] Limitless refused or unreachable:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: SIGNUP_WORDS.error });
  }

  const hooks = webhookUrls();
  if (hooks.length > 0) {
    const payload = {
      email,
      PageName: page.companyName ?? '',
      pageURL: pageUrlOf(req, segment),
      page_key: `/vb/${segment}`,
      form_key: FORM_KEY,
      offer_id: offerId,
      campaign_id: campaignId ?? utm.campaign ?? '',
      ...Object.fromEntries(UTM_KEYS.map((key) => [`utm_${key}`, utm[key] ?? ''])),
    };
    const sent = await Promise.allSettled(
      hooks.map(async (url) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });
        if (!r.ok) throw new Error(`${new URL(url).host} → ${r.status}`);
      }),
    );
    for (const result of sent) if (result.status === 'rejected') console.warn('[offer-signup] webhook failed:', String(result.reason));
  }

  return res.status(201).json({ ok: true });
}
