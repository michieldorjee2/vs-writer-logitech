import { useCallback, useEffect, useState } from 'react';
import type { ActivityResponse } from '../lib/page-activity';

export type ActivityLoad = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: ActivityResponse };

/**
 * The page's report (GET /api/page-activity), asked for as soon as the booth tools mount, so it is
 * in by the time the rep opens it: the rail's Report icon waves while it loads and turns to bars
 * when it lands. All of the page's history (range=all); the API keeps a built report five minutes.
 */
export function usePageActivity(page: string, enabled: boolean): { load: ActivityLoad; retry: () => void } {
  const [load, setLoad] = useState<ActivityLoad>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !page) return;
    const ctrl = new AbortController();
    fetch(`/api/page-activity?page=${encodeURIComponent(page)}&range=all${attempt ? '&fresh=1' : ''}`, { cache: 'no-store', signal: ctrl.signal })
      .then((res) => (res.ok ? (res.json() as Promise<ActivityResponse>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => setLoad({ state: 'ready', data }))
      .catch(() => {
        if (!ctrl.signal.aborted) setLoad({ state: 'error' });
      });
    return () => ctrl.abort();
  }, [page, enabled, attempt]);

  const retry = useCallback(() => {
    setLoad({ state: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  return { load, retry };
}
