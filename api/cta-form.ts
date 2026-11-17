/**
 * POST /api/cta-form — the form on an offer page's CTA (src/lib/cta-form.ts, src/www/CtaForm.tsx).
 * One endpoint, three steps, named by `step`:
 *
 *   status  { route, vuid }          Is the browser's ODP id a known visitor? → { known, missing }
 *                                    and, only on an offer that chose "Always show form", the
 *                                    visitor's own profile as `prefill` to fill the form in.
 *   lookup  { route, email, vuid? }  The typed email: which required fields ODP lacks for it →
 *                                    { missing }. Never a value. Ties the ODP id to the email.
 *   submit  { route, query, fields, tracking, email?, vuid? }
 *                                    Fills what wasn't typed from ODP (the email's profile, or the
 *                                    ODP id's), posts the website's contact form → 201; still
 *                                    missing something → 422 { missing, problems }.
 *
 * Public, like api/offer-signup.ts, so it trusts nothing it is sent:
 *
 *   0. only while OFFER_CTA_FORM=on and Limitless is configured (ctaFormsOn), else 404
 *   1. a same-site JSON post (415 / 403 otherwise), at most 8 KB; a filled honeypot (`website`)
 *      is answered as if all went well and nothing is sent anywhere
 *   2. the page: its /vb/ route must be an offer page in Graph, and that offer must have the form
 *      on in Limitless (the page's own memo), else 404. So the endpoint can't be used to post the
 *      website's form for any page or offer that didn't choose it
 *   3. while KV_REST_API_* is set, per address and per email, per minute (429); skipped without
 *   4. profile values reach the browser only for the browser's own ODP id, and only with "Always
 *      show form" on; an email typed in gets back field names, never values
 *   5. never logs an email, an ODP id or a profile value; every answer is `no-store`
 */
import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

import {
  type Contact,
  cleanContact,
  cleanTracking,
  type FieldKey,
  type FieldProblem,
  missingOf,
  REQUIRED,
  workEmailOf,
  emailProblem,
} from '../src/lib/cta-form.js';
import { routeSegmentOf } from '../src/lib/offer-signup.js';
import { normalizeVuid } from '../src/lib/page-activity.js';
import { odp, offerPageAt, type OfferPage, postToWebsiteForm, type Profile, submitUrl, websiteBody } from './_lib/cta-form.js';
import { ctaFormChoiceOf, ctaFormsOn } from './_lib/offer-signup.js';

const MAX_BODY = 8192;
const MAX_QUERY = 1000;
const MAX_UA = 500;

/**
 * Per address and per email, per minute. Generous for people (a page loads, a visitor types,
 * corrects, submits; colleagues share an office address), tight for a script walking emails.
 */
const LIMITS = {
  status: { ip: 60, email: 0 },
  lookup: { ip: 20, email: 5 },
  submit: { ip: 20, email: 5 },
} as const;
type Step = keyof typeof LIMITS;

const header = (req: VercelRequest, name: string): string => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
};

function clientIp(req: VercelRequest): string {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0]?.trim();
  return forwarded || header(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown';
}

/** Over a limit? Never fails a visitor: no KV, or KV down, is no limit. */
async function overLimit(step: Step, ip: string, email: string | null, now: Date): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  try {
    const redis = new Redis({ url, token });
    const minute = now.toISOString().slice(0, 16).replace(/\D/g, '');
    const keys: Array<[string, number]> = [[`ctaform:${step}:ip:${ip}:${minute}`, LIMITS[step].ip]];
    // The email as a hash: the key outlives the request (two minutes), the address needn't be in it.
    if (email && LIMITS[step].email > 0) {
      keys.push([`ctaform:${step}:email:${createHash('sha256').update(email).digest('hex').slice(0, 32)}:${minute}`, LIMITS[step].email]);
    }
    const counts = await Promise.all(keys.map(([key]) => redis.incr(key)));
    await Promise.all(keys.map(([key], i) => counts[i] === 1 && redis.expire(key, 120)));
    return counts.some((count, i) => count > keys[i][1]);
  } catch (err) {
    console.warn('[cta-form] rate limit skipped:', err instanceof Error ? err.message : err);
    return false;
  }
}

function pageUrlOf(req: VercelRequest, segment: string, query: string): string {
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  const safe = /^[a-z0-9.-]+(?::\d+)?$/i.test(host) ? host : 'showcase.optimizely.com';
  return `${/^localhost(?::|$)/i.test(safe) ? 'http' : 'https'}://${safe}/vb/${segment}${query}`;
}

/** The page's query string as the browser sent it: "?…", one line, at most 1,000 characters; else none. */
function queryOf(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('?') || raw.length > MAX_QUERY || /[\s<>"]/.test(raw)) return '';
  return raw;
}

/** The profile, or null when ODP has none, isn't configured or can't say (then the visitor is simply asked). */
async function profileOf(by: { vuid: string } | { email: string }): Promise<Profile | null> {
  const client = odp();
  if (!client) return null;
  try {
    return await client.profile(by);
  } catch (err) {
    console.warn('[cta-form] ODP lookup failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function identify(vuid: string | null, email: string): Promise<void> {
  const client = odp();
  if (!client || !vuid) return;
  try {
    await client.identify(vuid, email);
  } catch (err) {
    console.warn('[cta-form] ODP identify failed:', err instanceof Error ? err.message : err);
  }
}

/** Contact without the fields a profile must never supply: consent and the free-text question are only ever the visitor's own. */
function fromProfile(contact: Contact): Contact {
  const { Marketing_Consent__c: _consent, Other_Additional_Information__c: _other, ...rest } = contact;
  return rest;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Off, there is no such endpoint: as before the form existed.
  if (!ctaFormsOn()) return res.status(404).json({ error: 'Not found' });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (!/^application\/json(?:;|$)/i.test(header(req, 'content-type').trim())) return res.status(415).json({ error: 'Unsupported' });
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
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Bad request' });
  if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ error: 'Too large' });
  const b = body as Record<string, unknown>;

  const step = b.step;
  if (step !== 'status' && step !== 'lookup' && step !== 'submit') return res.status(400).json({ error: 'Bad request' });
  const segment = routeSegmentOf(b.route);
  if (!segment) return res.status(400).json({ error: 'Bad request' });
  const vuid = normalizeVuid(b.vuid);

  // A bot that fills every field is answered as if all went well, and nothing goes anywhere.
  const bot = typeof b.website === 'string' && b.website.trim() !== '';
  if (bot && step === 'lookup') return res.status(200).json({ missing: REQUIRED.filter((k) => k !== 'email') });
  if (bot && step === 'submit') return res.status(201).json({ ok: true });

  const typedEmail = step === 'status' ? null : workEmailOf(b.email);
  if (await overLimit(step, clientIp(req), typedEmail, new Date())) return res.status(429).json({ error: 'Too many requests' });

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    console.error('[cta-form] GRAPH_AUTH_KEY unset: no page can be checked');
    return res.status(503).json({ error: 'Unavailable' });
  }
  let page: OfferPage | null;
  try {
    page = await offerPageAt(segment, authKey);
  } catch (err) {
    console.error('[cta-form] page read failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Unavailable' });
  }
  if (!page) return res.status(404).json({ error: 'Not found' });
  const choice = await ctaFormChoiceOf(page.offerId);
  if (!choice.on) return res.status(404).json({ error: 'Not found' });

  // ── status: the browser's own ODP id ──
  if (step === 'status') {
    const profile = vuid ? await profileOf({ vuid }) : null;
    if (!profile?.email) return res.status(200).json({ known: false, missing: [...REQUIRED] });
    const known = fromProfile(profile.contact);
    const answer: { known: true; missing: FieldKey[]; prefill?: Contact } = { known: true, missing: missingOf(known) };
    // Only the visitor's own profile, only to fill in the form an offer chose to always show.
    if (choice.alwaysShow) answer.prefill = known;
    return res.status(200).json(answer);
  }

  // ── lookup: a typed email → field names only ──
  if (step === 'lookup') {
    const problem = emailProblem(b.email);
    if (!typedEmail) return res.status(422).json({ missing: ['email'], problems: { email: problem ?? 'invalidEmail' } });
    const profile = await profileOf({ email: typedEmail });
    await identify(vuid, typedEmail);
    return res.status(200).json({ missing: missingOf({ ...fromProfile(profile?.contact ?? {}), email: typedEmail }) });
  }

  // ── submit ──
  const url = submitUrl();
  if (!url) {
    console.error('[cta-form] CTA_FORM_SUBMIT_URL is not an https URL on function.zaius.app: nothing sent');
    return res.status(503).json({ error: 'Unavailable' });
  }
  const typed = cleanContact(b.fields);
  const problems: Partial<Record<FieldKey, FieldProblem>> = { ...typed.problems };
  if (b.email !== undefined && !typedEmail) problems.email = emailProblem(b.email) ?? 'invalidEmail';
  if (Object.keys(problems).length > 0) return res.status(422).json({ missing: [], problems });

  // Whose details fill what wasn't typed: the typed email's profile, else the browser's own.
  const email = typedEmail ?? typed.values.email ?? null;
  const profile = email ? await profileOf({ email }) : vuid ? await profileOf({ vuid }) : null;
  const contact: Contact = { ...fromProfile(profile?.contact ?? {}), ...typed.values };
  if (email) contact.email = email;
  const missing = missingOf(contact);
  if (missing.length > 0) return res.status(422).json({ missing, problems: {} });

  const query = queryOf(b.query);
  const payload = websiteBody({
    contact,
    tracking: cleanTracking(b.tracking),
    pageUrl: pageUrlOf(req, segment, query),
    query,
    userAgent: header(req, 'user-agent').slice(0, MAX_UA),
    pageKey: page.key,
    pageName: page.companyName,
  });
  try {
    await postToWebsiteForm(url, payload);
  } catch (err) {
    console.error('[cta-form] the website form refused or was unreachable:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Unavailable' });
  }
  await identify(vuid, contact.email as string);
  return res.status(201).json({ ok: true });
}
