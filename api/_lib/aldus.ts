/**
 * Aldus UI's routes for the showcase (aldus-ui lib/offers/showcase-look.ts):
 * the running offers, saving or clearing one offer's look, and asking for one
 * page of an offer that takes pages from search (askOfferPage). Its own
 * token, which may do nothing else.
 *
 * Env: ALDUS_UI_URL, ALDUS_SHOWCASE_TOKEN. Unset: no offers, and the search
 * page is the usual one.
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
  /** Pages from search: 'off', 'on' or 'approval'. Absent from an Aldus UI before it, which reads as 'off'. */
  fromSearch?: string;
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
  if (!res.ok) throw new Error(`Aldus UI ${init.method ?? 'GET'} ${path} → ${res.status} ${body.error ?? ''}`.trim());
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

export async function saveLook(offerId: string, look: Omit<ShowcaseLook, 'madeAt'>): Promise<ShowcaseLook> {
  const { look: saved } = await call<{ look: ShowcaseLook }>(`/api/machine/showcase/offers/${encodeURIComponent(offerId)}/look`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(look),
  });
  held = null;
  return saved;
}

/**
 * Asks Aldus UI for one page of a running offer, for the account a website
 * names, as the rep who asked. Its answer comes back whatever its status, so
 * the search page can say why it was refused. Up to 100 s: a cold account
 * list is waited for once there.
 */
export async function askOfferPage(
  offerId: string,
  body: { website: string; requestedBy: { email: string; name?: string } },
): Promise<{ status: number; body: unknown }> {
  const base = (process.env.ALDUS_UI_URL || '').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/machine/showcase/offers/${encodeURIComponent(offerId)}/pages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.ALDUS_SHOWCASE_TOKEN}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(100_000),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
