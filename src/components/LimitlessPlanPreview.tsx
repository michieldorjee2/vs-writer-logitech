import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DynamicComparisonPage from "./DynamicComparisonPage";
import { planToComparisonPageProps } from "../lib/limitless/plan-to-page";
import type { Plan, PlanAccount } from "../lib/limitless/plan-types";

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
 * Fetches straight from aldus-ui's local dev server — a deliberate seam for
 * this build (there is no deployed bridge between the two apps yet), scoped
 * with VITE_INTELLIGENCE_API_URL.
 */
export default function LimitlessPlanPreview() {
  const { accountId } = useParams<{ accountId: string }>();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; plan: Plan; account: PlanAccount }
  >({ status: "loading" });

  useEffect(() => {
    if (!accountId) return;
    const base = import.meta.env.VITE_INTELLIGENCE_API_URL || "http://localhost:3000";
    setState({ status: "loading" });
    fetch(`${base}/api/intelligence/plan?accountId=${encodeURIComponent(accountId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setState({ status: "ready", plan: data.plan, account: data.account });
      })
      .catch((err) => setState({ status: "error", message: String(err.message || err) }));
  }, [accountId]);

  if (state.status === "loading") {
    return (
      <div style={{ padding: 48, fontFamily: "monospace" }}>
        Resolving plan for <strong>{accountId}</strong>…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={{ padding: 48, fontFamily: "monospace", color: "#b00" }}>
        Could not load a plan for <strong>{accountId}</strong>: {state.message}
        <br />
        <br />
        Is aldus-ui running locally (<code>npm run dev</code> in ~/Claude/aldus-ui, port
        3000)? Set <code>VITE_INTELLIGENCE_API_URL</code> to point elsewhere.
      </div>
    );
  }

  const page = planToComparisonPageProps(state.plan, state.account);
  return <DynamicComparisonPage page={page} />;
}
