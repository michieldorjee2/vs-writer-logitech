/**
 * A minimal, LOCAL copy of the Plan/Account shape this app actually maps into
 * page props. The full type lives in aldus-ui's `lib/intelligence/types.ts`.
 *
 * This is a DELIBERATE, DOCUMENTED duplication, not an oversight: aldus-ui and
 * vs-writer-logitech are separate repos/deploys with no shared package, the
 * same seam docs/architecture.md already calls out between `ladder.ts` and
 * the Opal projection-assembly workflow's guard code step. Keep this file's
 * field names in sync with aldus-ui's types.ts by hand; nothing enforces it
 * automatically.
 */

export type SolutionArea = "EC" | "EO" | "AO" | "CO";

export interface PlanComponentDecision {
  componentId: string;
  include: boolean;
  variant?: string;
  why: string;
}

export interface PlanFit {
  verdict: "strong" | "moderate" | "weak" | "blend";
  by: "agent" | "rule-fallback";
  why: string;
}

export interface Plan {
  accountId: string;
  resolvedAt: string;
  rung: { id: string; rank: number; label: string };
  guards: { passed: string[]; failed: string[] };
  fit: PlanFit;
  pitch: { angle: string; solutionAreas: SolutionArea[] };
  components: PlanComponentDecision[];
  offer?: { id: string; why: string };
  sources: Array<{ tag: string; label: string; value: string }>;
}

export interface PlanAccount {
  id: string;
  companyName: string;
  industry: string;
  domain: string;
}
