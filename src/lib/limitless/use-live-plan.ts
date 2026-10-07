import { useEffect, useState } from 'react';

import type { Plan, PlanAccount } from './plan-types';

/**
 * Fetch the plan Aldus resolves for one account, for the two preview routes
 * (/limitless-preview/:accountId and /use-case-preview/:accountId).
 *
 * Both used to carry their own copy of this fetch, their own loading and error
 * states, and their own developer-facing error text — which named a path on one
 * person's laptop on a public host. One copy now.
 *
 * Shape note: state is only ever set from the fetch's own callbacks, never
 * synchronously inside the effect. The result is stored WITH the account id it
 * belongs to, and "loading" is derived — the id in the URL has no result yet —
 * rather than set. That is what keeps react-hooks/set-state-in-effect quiet, and
 * it also means a slow response for the previous account can never be shown
 * under the next one.
 *
 * Never used on a public page render: the decision record a published page
 * carries comes from the CMS (component-plan.ts's `cms` source), not from a
 * runtime call to an internal service.
 */

export type LivePlanState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; plan: Plan; account: PlanAccount }
  | { status: 'error'; message: string; url: string };

type Settled =
  | { accountId: string; ok: true; plan: Plan; account: PlanAccount }
  | { accountId: string; ok: false; message: string; url: string };

/** Aldus's dev server. Several projects in this vault take turns on the same
 *  ports, so `next dev` does not reliably land on 3000 — hence the variable. */
export const INTELLIGENCE_API_URL: string = import.meta.env.VITE_INTELLIGENCE_API_URL || 'http://localhost:3000';

export function useLivePlan(accountId: string | undefined): LivePlanState {
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!accountId) return;
    const url = `${INTELLIGENCE_API_URL}/api/intelligence/plan?accountId=${encodeURIComponent(accountId)}`;
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setSettled({ accountId, ok: true, plan: data.plan, account: data.account });
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled) setSettled({ accountId, ok: false, message, url });
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!accountId) return { status: 'idle' };
  if (!settled || settled.accountId !== accountId) return { status: 'loading' };
  if (settled.ok === true) return { status: 'ready', plan: settled.plan, account: settled.account };
  return { status: 'error', message: settled.message, url: settled.url };
}
