import { useParams, useSearchParams } from 'react-router-dom';

import LivePlanStatus from './LivePlanStatus';
import UseCasePage from './UseCasePage';
import { planFromLimitless, type ComponentPlan } from '../lib/limitless/component-plan';
import { SIEMENS_USE_CASE_PAGE, SIEMENS_USE_CASE_PLAN } from '../lib/limitless/siemens-fixture';
import { useLivePlan } from '../lib/limitless/use-live-plan';

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
  const live = useLivePlan(accountId);

  if (live.status === 'loading' || live.status === 'error') {
    return (
      <LivePlanStatus
        state={live}
        accountId={accountId}
        fallbackHint="Without an account id, /use-case-preview renders the same page against its own fixture plan."
      />
    );
  }

  const plan: ComponentPlan = live.status === 'ready' ? planFromLimitless(live.plan) : SIEMENS_USE_CASE_PLAN;
  const companyName = live.status === 'ready' ? live.account?.companyName ?? accountId : 'Siemens';

  return <UseCasePage page={SIEMENS_USE_CASE_PAGE} plan={plan} companyName={companyName} showPlan={showPlan} />;
}
