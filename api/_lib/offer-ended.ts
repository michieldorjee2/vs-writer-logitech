/**
 * An ended offer's pages come down (src/lib/offer-ended.ts). `withOfferEnded` wraps every offer
 * page the site serves at /vb/ (api/content.ts, server/ssr-handler.tsx, the dev proxy in
 * vite.config.ts), outermost: for an account's offer page whose offer Limitless says has ended,
 * it hands back the ended stand-in (the company's mark, and its account page when it has one)
 * instead of the page. Anything else, and any failure, is the page as it is. The CMS preview
 * (api/preview.ts) doesn't ask: editors still see the page they are editing.
 *
 * Needs Limitless configured (ALDUS_UI_URL and ALDUS_SHOWCASE_TOKEN); unset, nothing is asked and
 * every page is as it was. An answer is held a minute per offer per instance, so an offer comes
 * down within about a minute of Limitless calling it Ended, plus the page's edge cache. When
 * Limitless is slow, unreachable or doesn't know the offer, the page stays: a failure is held
 * 5 s, and the page it served is edge-cached 10 s (`endedCacheControl`), so the next visitor
 * asks again rather than getting a cached page for six minutes.
 */
import { endedOffer, isEndedOffer } from '../../src/lib/offer-ended.js';
import { aldusConfigured, offerEndedFor } from './aldus.js';
import { offerIdOf } from './offer-pages.js';
import { parentAccountFor } from './parent-account.js';

const HOLD_MS = 60_000;
const FAILED_HOLD_MS = 5_000;
const TIMEOUT_MS = 1_500;
/** For a page served because its offer couldn't be asked about: the next request soon asks again. */
export const UNSURE_CACHE_CONTROL = 'public, s-maxage=10';

/** Per instance: ended, not ended (or no such offer), or unknown because the ask failed. */
const held = new Map<string, { at: number; ended: boolean; failed: boolean }>();
/** The pages served because Limitless couldn't say. */
const unsure = new WeakSet<object>();

async function endedOf(offerId: string): Promise<{ ended: boolean; failed: boolean }> {
  const hit = held.get(offerId);
  if (hit && Date.now() - hit.at < (hit.failed ? FAILED_HOLD_MS : HOLD_MS)) return hit;
  let ended = false;
  let failed = false;
  try {
    ended = (await offerEndedFor(offerId, AbortSignal.timeout(TIMEOUT_MS))) === true;
  } catch (err) {
    failed = true;
    console.warn('[offer-ended] not read, the page stays:', err instanceof Error ? err.message : err);
  }
  const answer = { at: Date.now(), ended, failed };
  held.set(offerId, answer);
  return answer;
}

/** The ended stand-in when the page's offer has ended; otherwise the page as given. Never throws. */
export async function withOfferEnded<T>(item: T): Promise<T | ReturnType<typeof endedOffer>> {
  try {
    if (!aldusConfigured()) return item;
    const page = item as { __typename?: unknown; componentPlan?: unknown } | null;
    if (!page || page.__typename !== 'ABMExperience' || isEndedOffer(page)) return item;
    const offerId = offerIdOf(typeof page.componentPlan === 'string' ? page.componentPlan : null);
    if (!offerId) return item;
    const { ended, failed } = await endedOf(offerId);
    if (failed) unsure.add(page);
    if (!ended) return item;
    // The logo is already the parent's where the page has none (withParentAccount runs first); the address is asked here.
    const parent = await parentAccountFor(page);
    return endedOffer(page as Parameters<typeof endedOffer>[0], parent?.url ?? null);
  } catch (err) {
    console.warn('[offer-ended] left the page as it is:', err instanceof Error ? err.message : err);
    return item;
  }
}

/** The Cache-Control to serve an experience with: `normal`, or UNSURE_CACHE_CONTROL when withOfferEnded couldn't ask about its offer. */
export function endedCacheControl(item: unknown, normal: string): string {
  return item !== null && typeof item === 'object' && unsure.has(item) ? UNSURE_CACHE_CONTROL : normal;
}

/** For the check: forget what was held. */
export function forgetOfferEnded(): void {
  held.clear();
}
