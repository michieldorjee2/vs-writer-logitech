import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import UseCasePage from './UseCasePage';
import { planFromLimitless, type ComponentPlan } from '../lib/limitless/component-plan';
import { SIEMENS_USE_CASE_PAGE, SIEMENS_USE_CASE_PLAN } from '../lib/limitless/siemens-fixture';
import type { Plan as LimitlessPlan } from '../lib/limitless/plan-types';

/**
 * Preview the use-case template, and prove the plan is what drives it.
 *
 *   /use-case-preview                 fixture content + fixture plan.
 *                                     Laura's Siemens page, rendered through
 *                                     the registered content type.
 *   /use-case-preview/:accountId      fixture content + a LIVE plan resolved by
 *                                     Aldus for that account.
 *   ?plan=0                           hide the decision panel.
 *
 * The second form is the demonstration worth having. The content does not
 * change; the plan does — so the sections that appear, the hero's variant and
 * the list of withheld components all change with the account, and the panel at
 * the bottom says which source decided. Resolve `geico` (an S2 customer with
 * four solution areas) against `hartwell-bank` (S3, one solution area) and the
 * page is visibly different with byte-identical content.
 *
 * Content stays fixture in the live form ON PURPOSE. Aldus resolves DECISIONS,
 * not copy — the agent writes copy. Pretending otherwise by generating lanes
 * here would be the renderer inventing content, which is the one thing this
 * design is trying to stop.
 */
export default function UseCasePreview() {
  const { accountId } = useParams<{ accountId?: string }>();
  const [searchParams] = useSearchParams();
  const showPlan = searchParams.get('plan') !== '0';

  const [livePlan, setLivePlan] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'ready'; plan: LimitlessPlan; companyName: string } | { status: 'error'; message: string }
  >({ status: accountId ? 'loading' : 'idle' });

  useEffect(() => {
    if (!accountId) {
      setLivePlan({ status: 'idle' });
      return;
    }
    const base = import.meta.env.VITE_INTELLIGENCE_API_URL || 'http://localhost:3000';
    const url = `${base}/api/intelligence/plan?accountId=${encodeURIComponent(accountId)}`;
    setLivePlan({ status: 'loading' });
    let cancelled = false;
    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setLivePlan({ status: 'ready', plan: data.plan, companyName: data.account?.companyName ?? accountId });
      })
      .catch((err) => {
        // Name the URL that failed. `next dev` does not always land on 3000 —
        // several projects in this vault take turns on the same ports — and
        // "failed to fetch" with no URL sends you looking in the wrong place.
        if (!cancelled) setLivePlan({ status: 'error', message: `${String(err?.message ?? err)} (tried ${url})` });
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (livePlan.status === 'loading') {
    return (
      <div style={{ padding: 48, fontFamily: 'monospace' }}>
        Resolving the ladder for <strong>{accountId}</strong>&hellip;
      </div>
    );
  }

  if (livePlan.status === 'error') {
    return (
      <div style={{ padding: 48, fontFamily: 'monospace', color: '#b00', lineHeight: 1.6 }}>
        Could not resolve a plan for <strong>{accountId}</strong>: {livePlan.message}
        <br />
        <br />
        Is aldus-ui running locally (<code>npm run dev</code> in ~/Claude/aldus-ui, port 3000)? Set{' '}
        <code>VITE_INTELLIGENCE_API_URL</code> to point elsewhere, or drop the account id to render
        the fixture plan.
      </div>
    );
  }

  const plan: ComponentPlan = livePlan.status === 'ready' ? planFromLimitless(livePlan.plan) : SIEMENS_USE_CASE_PLAN;
  const companyName = livePlan.status === 'ready' ? livePlan.companyName : 'Siemens';

  return <UseCasePage page={SIEMENS_USE_CASE_PAGE} plan={plan} companyName={companyName} showPlan={showPlan} />;
}
