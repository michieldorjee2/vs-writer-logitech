import { useParams } from "react-router-dom";
import LivePlanStatus from "./LivePlanStatus";
import DynamicComparisonPage from "./DynamicComparisonPage";
import { planToComparisonPageProps } from "../lib/limitless/plan-to-page";
import { useLivePlan } from "../lib/limitless/use-live-plan";

/**
 * Local-dev preview of the Limitless ladder's output rendered through the
 * REUSED, UNMODIFIED DynamicComparisonPage — see docs/architecture.md's
 * "components, not templates" step and plan-to-page.ts's header comment.
 *
 * Mounted at /limitless-preview/:accountId, added as a literal route BEFORE
 * the `/*` catch-all in App.tsx (see the showcase survey's routing note: a
 * more specific path added ahead of the catch-all intercepts only its own
 * prefix, leaving PageLoader's shape-sniffed dispatch completely untouched).
 *
 * Fetches straight from aldus-ui's dev server through useLivePlan() — a
 * deliberate seam (there is no deployed bridge between the two apps), scoped
 * with VITE_INTELLIGENCE_API_URL.
 */
export default function LimitlessPlanPreview() {
  const { accountId } = useParams<{ accountId: string }>();
  const state = useLivePlan(accountId);

  if (state.status === "loading" || state.status === "error") {
    return <LivePlanStatus state={state} accountId={accountId} />;
  }
  if (state.status === "idle") return null;

  const page = planToComparisonPageProps(state.plan, state.account);
  return <DynamicComparisonPage page={page} />;
}
