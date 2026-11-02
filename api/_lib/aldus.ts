/**
 * Aldus UI's three routes for the showcase (aldus-ui lib/offers/showcase-look.ts):
 * the running offers, saving one offer's look, and whether a signed-in person
 * gets the search page's links back to Limitless (aldus-ui
 * lib/offers/showcase-viewer.ts). Its own token, which may do nothing else.
 *
 * Env: ALDUS_UI_URL, ALDUS_SHOWCASE_TOKEN. Unset: no offers, no links, and
 * the search page is the usual one.
 */
import type { ShowcaseLook } from '../../src/lib/offer-looks.js';

export type AldusOffer = {
  id: string;
  title: string;
  brief: string;
  windowStart: string;
  windowEnd: string;
  look: ShowcaseLook | null;
  pages: Array<{ accountName: string; pageUrl: string; liveSince: string | null }>;
};

export const aldusConfigured = () => Boolean(process.env.ALDUS_UI_URL && process.env.ALDUS_SHOWCASE_TOKEN);

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = (process.env.ALDUS_UI_URL || '').replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.ALDUS_SHOWCASE_TOKEN}`, Accept: 'application/json', ...(init.headers ?? {}) },
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(`Aldus UI ${init.method ?? 'GET'} ${path} → ${res.status} ${body.error ?? ''}`.trim()), { status: res.status });
  return body;
}

/* The list changes when someone edits an offer or a look is made: a few seconds is plenty. */
let held: { at: number; offers: AldusOffer[] } | null = null;
const HOLD_MS = 15_000;

export async function runningOffers(fresh = false): Promise<AldusOffer[]> {
  if (!aldusConfigured()) return [];
  if (!fresh && held && Date.now() - held.at < HOLD_MS) return held.offers;
  const { offers } = await call<{ offers: AldusOffer[] }>('/api/machine/showcase/offers');
  held = { at: Date.now(), offers };
  return offers;
}

/** Clears the offer's look in Aldus UI, so Mark makes a new one; who asked is recorded there. */
export async function clearLook(offerId: string, by: string): Promise<void> {
  await call(`/api/machine/showcase/offers/${encodeURIComponent(offerId)}/look`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ by }),
  });
  held = null;
}

/* Who gets the links back to Limitless: Aldus UI's answer per person, held a few minutes. */
const viewers = new Map<string, { at: number; admin: boolean }>();
const VIEWER_HOLD_MS = 5 * 60_000;

/**
 * Whether the signed-in person gets the search page's links back to Limitless
 * (Open Limitless, and Edit offer on the offer the page runs as), by Aldus
 * UI's rule. False when Aldus UI is unset, slow, older (404) or failing: no
 * links, never an error. A real answer is held, and so is a 404 (an Aldus UI
 * without the route won't grow one in a moment, so each page load needn't
 * ask again); a failure or a timeout isn't, so a blip doesn't hide the links
 * for five minutes.
 */
export async function isLimitlessAdmin(email: string, fresh = false): Promise<boolean> {
  if (!aldusConfigured()) return false;
  const who = email.trim().toLowerCase();
  const kept = viewers.get(who);
  if (!fresh && kept && Date.now() - kept.at < VIEWER_HOLD_MS) return kept.admin;
  try {
    const { admin } = await call<{ admin?: unknown }>('/api/machine/showcase/viewer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: who }),
      signal: AbortSignal.timeout(3000),
    });
    if (typeof admin !== 'boolean') return false;
    viewers.set(who, { at: Date.now(), admin });
    return admin;
  } catch (err) {
    if ((err as { status?: unknown } | null)?.status === 404) viewers.set(who, { at: Date.now(), admin: false });
    return false;
  }
}

/**
 * Aldus UI's address for links in the browser: ALDUS_UI_URL's origin, https
 * only (http only for localhost or 127.0.0.1, in dev). Null otherwise, and
 * then there are no links.
 */
export function limitlessOrigin(): string | null {
  try {
    const url = new URL(process.env.ALDUS_UI_URL || '');
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return url.protocol === 'https:' || (url.protocol === 'http:' && local) ? url.origin : null;
  } catch {
    return null;
  }
}

export async function saveLook(offerId: string, look: Omit<ShowcaseLook, 'madeAt'>): Promise<ShowcaseLook> {
  const { look: saved } = await call<{ look: ShowcaseLook }>(`/api/machine/showcase/offers/${encodeURIComponent(offerId)}/look`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(look),
  });
  held = null;
  return saved;
}
