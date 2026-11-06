import { useCallback, useEffect, useState } from 'react';
import type { ShareLinkRow } from '../lib/share-links';

export type ShareLinksLoad = { state: 'loading' } | { state: 'error' } | { state: 'ready'; links: ShareLinkRow[] };

/**
 * The page's personal links (GET /api/share-links), for the Report and the Share sheet: who each was
 * for, who sent it, and whether it was opened. Read when the booth tools mount; `reload` after a new
 * link, or when the Report opens, so an open from a minute ago shows.
 */
export function useShareLinks(route: string, enabled: boolean): { load: ShareLinksLoad; reload: () => void } {
  const [load, setLoad] = useState<ShareLinksLoad>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !route) return;
    const ctrl = new AbortController();
    fetch(`/api/share-links?page=${encodeURIComponent(route)}`, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ links: ShareLinkRow[] }>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => setLoad({ state: 'ready', links: Array.isArray(data.links) ? data.links : [] }))
      .catch(() => {
        if (!ctrl.signal.aborted) setLoad((prev) => (prev.state === 'ready' ? prev : { state: 'error' }));
      });
    return () => ctrl.abort();
  }, [route, enabled, attempt]);

  // A reload keeps the list on screen until the new one is in.
  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  return { load, reload };
}
