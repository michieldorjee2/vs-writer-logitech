/**
 * The search page's offline copy, from the page's side. The service worker
 * (public/search-sw.js) keeps the document, the build's files, the fonts and
 * the scene; the page keeps its own data here, so the lists can draw from
 * the last visit while the network answers.
 *
 * Everything lives in caches named `showcase-home-…`. They hold who is
 * signed in and their accounts, so they go when the session does: on Log out
 * (ProfileMenu.tsx), and on any 401.
 */

export const CACHE_PREFIX = 'showcase-home-';
/* Shared with public/search-sw.js, which keeps /api/auth/me in it too. */
const DATA_CACHE = 'showcase-home-data-v1';
export const INDEX_URL = '/api/home-index';

const hasCaches = () => typeof caches !== 'undefined';

export async function clearOfflineCopies(): Promise<void> {
  if (!hasCaches()) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)));
  } catch {
    /* Storage blocked (a private window): nothing was kept either. */
  }
}

/** The index as the last visit saw it, or null. */
export async function readKeptIndex<T>(): Promise<T | null> {
  if (!hasCaches()) return null;
  try {
    const hit = await (await caches.open(DATA_CACHE)).match(INDEX_URL);
    return hit ? ((await hit.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Keep a 200 from the index for next time. */
export async function keepIndex(response: Response): Promise<void> {
  if (!hasCaches()) return;
  try {
    await (await caches.open(DATA_CACHE)).put(INDEX_URL, response);
  } catch {
    /* Quota or a private window: the page still works, just not offline. */
  }
}

/** Scoped to /search: the worker never sees the account pages. */
export function registerOfflineWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // After load, so it never competes with the scene for the network.
  const go = () =>
    navigator.serviceWorker
      .register('/search-sw.js', { scope: '/search' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // The photo on screen loaded before the worker ran: name it so it is kept too.
        const shown = document.querySelector<HTMLImageElement>('.sh-scene__img')?.currentSrc;
        if (shown) reg.active?.postMessage({ scene: shown });
      })
      .catch(() => {});
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}
