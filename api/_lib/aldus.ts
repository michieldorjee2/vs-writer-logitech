/**
 * Aldus UI's two routes for the showcase (aldus-ui lib/offers/showcase-look.ts):
 * the running offers, and saving one offer's look. Its own token, which may
 * do nothing else.
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

export async function saveLook(offerId: string, look: Omit<ShowcaseLook, 'madeAt'>): Promise<ShowcaseLook> {
  const { look: saved } = await call<{ look: ShowcaseLook }>(`/api/machine/showcase/offers/${encodeURIComponent(offerId)}/look`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(look),
  });
  held = null;
  return saved;
}
