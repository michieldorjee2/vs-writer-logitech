import type { CompetitorComparisonPage } from '../graph-types';
import type { Plan as LimitlessPlan } from './plan-types';

/**
 * The component plan: which sections a page shows, in which variant, and why.
 *
 * WHY THIS EXISTS
 * ---------------
 * Today every section on an account page is gated on its own content being
 * non-null — `{page.roiTitle && <RoiSection/>}`. Content presence IS the
 * decision. That works, and it is why 2,695 pages render, but it cannot
 * express four things the programme needs:
 *
 *   1. A VARIANT. "Show the hero, competitive-displacement framing" is a
 *      different decision from "show the hero" and the fields cannot say so.
 *   2. SUPPRESSION WITH A REASON. A missing comparison table and a
 *      deliberately withheld comparison table look identical on the page and
 *      in the CMS. Laura cannot audit the second case, which is the one the
 *      pilot got wrong.
 *   3. A DEFECT SIGNAL. If the plan says include and the agent wrote nothing,
 *      that is a bug. Under field-sniffing it is invisible — the section just
 *      does not appear.
 *   4. A UNIT OF LEARNING. docs/architecture.md's payoff is per-component
 *      measurement. You cannot attribute an outcome to a component whose
 *      inclusion was never recorded.
 *
 * So the renderer stops asking "do I have content for this?" and starts asking
 * "did the plan include this?". Content absence becomes a reportable defect
 * rather than a silent non-event.
 *
 * THREE SOURCES, ONE SHAPE
 * ------------------------
 * `source` is always carried, never inferred, because a reader must be able to
 * tell an authored decision from a reconstructed one:
 *
 *   cms      — the page carries a `componentPlan` blob the decision engine
 *              wrote. The real mechanism. Needs the CMS field (staged, see
 *              aldus-ui/docs/limitless-use-case-template.md).
 *   live     — resolved from Aldus at render time via /api/intelligence/plan.
 *              What /limitless-preview/:accountId uses. No CMS dependency.
 *   derived  — reconstructed from which fields are populated. The
 *              compatibility layer for every page written before any of this
 *              existed. It reproduces the CURRENT conditions exactly (see
 *              DERIVED_FROM below), so no existing page changes.
 *   fixture  — a hand-built plan used by a local demo route.
 *
 * `derived` is deliberately last in that list. It is what we are moving away
 * from, kept because 2,695 pages depend on it and none of them will be
 * rewritten.
 */

// ---- Component ids ---------------------------------------------------------

/**
 * The showcase's component vocabulary. An id earns a place here only when a
 * renderer exists for it — this registry answers "how does it draw and where
 * does its content come from", which is a different question from Aldus's
 * registry ("is this account eligible for it"). The ids are the contract
 * between the two; see LIMITLESS_ID_MAP.
 */
export type ComponentId =
  // chrome
  | 'nav-rail'
  // hero cluster
  | 'hero'
  | 'signal-pills'
  // the use-case shape — Laura's "Use Case Template v2"
  | 'use-case-matrix'
  | 'why-now-thesis'
  | 'friction-points'
  | 'contact-close'
  // the takeout shape — the existing ABM template's sections
  | 'account-intel'
  | 'challenge-shot'
  | 'comparison-table'
  | 'proof-wall'
  | 'roi-projection'
  | 'migration-timeline'
  | 'analyst-proof'
  | 'customer-stories'
  // offer + conversion
  | 'offer-card'
  | 'sticky-cta'
  // the offer shape — a campaign page promoting one offer (Visual Builder only; the legacy
  // renderers have no section for these, so `renderedBy` is empty)
  | 'offer-hosts'
  | 'offer-outcomes'
  | 'offer-agenda'
  | 'offer-fit';

export interface ComponentPlanEntry {
  id: ComponentId;
  include: boolean;
  /** Free-form; each renderer documents the variants it understands. */
  variant?: string;
  /** Always populated. A decision with no reason is not auditable. */
  why: string;
}

export type PlanSource = 'cms' | 'live' | 'derived' | 'fixture';

export interface ComponentPlan {
  source: PlanSource;
  /** The ladder rung that produced this plan. Absent on a derived plan — a
   *  reconstructed plan has no rung, and guessing one would be a fabrication. */
  rungId?: string;
  rungLabel?: string;
  fit?: { verdict: string; by: string; why: string };
  resolvedAt?: string;
  entries: ComponentPlanEntry[];
}

// ---- Registry --------------------------------------------------------------

/**
 * Which of the three renderers over CompetitorComparisonPage can actually draw
 * a component. Needed because a plan is written against the CONTENT TYPE, not
 * against a renderer: the ladder can include `roi-projection` on a page the
 * use-case renderer has no ROI section for. That is a coverage gap in the
 * renderer, NOT a missing-content defect in the page, and the two have
 * different fixes — one is code, the other is a re-run. Collapsing them would
 * point every investigation at the wrong place.
 */
export type RendererId = 'use-case' | 'abm' | 'comparison';

interface ComponentSpec {
  label: string;
  /** The DOM section id, so nav-rail and the x-ray overlay agree on anchors. */
  sectionId: string;
  /** Renderers with a section for this component. */
  renderedBy: RendererId[];
  /** Rail nav label. Omitted means the component is not a nav destination. */
  navLabel?: string;
  /**
   * The CURRENT field-presence condition, lifted verbatim from the renderers.
   * This is the only thing `derived` consults, which is what guarantees a
   * legacy page renders byte-identically after this change.
   *
   * `null` means "the renderer shows this unconditionally today".
   */
  derivedFrom: ((page: CompetitorComparisonPage) => boolean) | null;
}

const has = <T,>(v: T[] | null | undefined): boolean => Array.isArray(v) && v.length > 0;

export const COMPONENTS: Record<ComponentId, ComponentSpec> = {
  'nav-rail': { label: 'Navigation rail', sectionId: 'rail', renderedBy: ['use-case'], derivedFrom: null },

  hero: { label: 'Hero', sectionId: 'hero', renderedBy: ['use-case', 'abm', 'comparison'], navLabel: 'What we’d do', derivedFrom: (p) => !!p.headline },
  'signal-pills': { label: 'Signal pills', sectionId: 'pills', renderedBy: ['use-case'], derivedFrom: (p) => has(p.intelStats) },

  'use-case-matrix': {
    label: 'In-market use-case matrix',
    sectionId: 'use-cases', renderedBy: ['use-case'],
    navLabel: 'What we’d do',
    // No field to sniff until useCaseLanes is registered, so a legacy page can
    // never derive this component. Correct: none of them have one.
    derivedFrom: () => false,
  },
  'why-now-thesis': { label: 'Why-now thesis', sectionId: 'why', renderedBy: ['use-case'], navLabel: 'Why it matters', derivedFrom: () => false },
  'friction-points': { label: 'Where it breaks', sectionId: 'gaps', renderedBy: ['use-case', 'abm'], navLabel: 'Where it breaks', derivedFrom: (p) => has(p.painPoints) },
  'contact-close': {
    label: 'Who to talk to',
    sectionId: 'close', renderedBy: ['use-case', 'abm'],
    navLabel: 'Who to talk to',
    derivedFrom: (p) => has(p.teamMembers) || has(p.stakeholders) || !!p.ctaTitle,
  },

  'account-intel': {
    label: 'Account intelligence',
    sectionId: 'intel', renderedBy: ['abm'],
    navLabel: 'What we found',
    derivedFrom: (p) => !!p.intelHeadline || has(p.intelStats) || has(p.techStack) || has(p.newsItems),
  },
  'challenge-shot': { label: 'The challenge', sectionId: 'challenge', renderedBy: ['abm'], navLabel: 'The challenge', derivedFrom: (p) => !!p.challengeHeadline },
  'comparison-table': { label: 'Comparison table', sectionId: 'comparison', renderedBy: ['abm', 'comparison'], navLabel: 'Comparison', derivedFrom: (p) => has(p.comparisonTableRows) },
  'proof-wall': { label: 'Proof wall', sectionId: 'proof', renderedBy: ['abm'], navLabel: 'Proof', derivedFrom: null },
  'roi-projection': { label: 'ROI projection', sectionId: 'roi', renderedBy: ['abm'], navLabel: 'ROI', derivedFrom: (p) => !!p.roiTitle || has(p.roiCards) },
  'migration-timeline': { label: 'Migration timeline', sectionId: 'migration', renderedBy: ['abm'], navLabel: 'Timeline', derivedFrom: (p) => !!p.migrationTitle || has(p.timelinePhases) },
  'analyst-proof': { label: 'Analyst recognition', sectionId: 'analyst', renderedBy: ['abm', 'comparison'], derivedFrom: (p) => !!p.analystQuote || has(p.analystCards) },
  'customer-stories': { label: 'Customer stories', sectionId: 'testimonials', renderedBy: ['abm', 'comparison'], derivedFrom: (p) => !!p.testimonial1 || !!p.testimonial2 },

  'offer-card': { label: 'Offer card', sectionId: 'promo', renderedBy: ['comparison'], derivedFrom: (p) => !!p.promoHeading },
  'sticky-cta': { label: 'Sticky CTA', sectionId: 'sticky-cta', renderedBy: ['abm'], derivedFrom: (p) => !!p.stickyCTAText },

  'offer-hosts': { label: 'Who runs it', sectionId: 'hosts', renderedBy: [], navLabel: 'Who runs it', derivedFrom: () => false },
  'offer-outcomes': { label: 'What you walk away with', sectionId: 'outcomes', renderedBy: [], navLabel: 'What you get', derivedFrom: () => false },
  'offer-agenda': { label: 'How it runs', sectionId: 'agenda', renderedBy: [], navLabel: 'How it runs', derivedFrom: () => false },
  'offer-fit': { label: 'Is this for you?', sectionId: 'fit', renderedBy: [], navLabel: 'Is this for you?', derivedFrom: () => false },
};

export const COMPONENT_IDS = Object.keys(COMPONENTS) as ComponentId[];

function isComponentId(v: unknown): v is ComponentId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(COMPONENTS, v);
}

// ---- Readers ---------------------------------------------------------------

export function includes(plan: ComponentPlan, id: ComponentId): boolean {
  return plan.entries.some((e) => e.id === id && e.include);
}

export function variantOf(plan: ComponentPlan, id: ComponentId): string | undefined {
  return plan.entries.find((e) => e.id === id && e.include)?.variant;
}

export function reasonFor(plan: ComponentPlan, id: ComponentId): string | undefined {
  return plan.entries.find((e) => e.id === id)?.why;
}

/** The withheld components, with their reasons — what the x-ray overlay and
 *  Aldus's audit view show. The whole point of recording a decision. */
export function suppressed(plan: ComponentPlan): ComponentPlanEntry[] {
  return plan.entries.filter((e) => !e.include);
}

/** Nav destinations, in registry order, for the components actually included. */
export function navItems(plan: ComponentPlan, renderer: RendererId): Array<{ href: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ href: string; label: string }> = [];
  for (const id of COMPONENT_IDS) {
    const spec = COMPONENTS[id];
    // An anchor to a section this renderer will not draw is a dead link.
    if (!spec.navLabel || !spec.renderedBy.includes(renderer) || !includes(plan, id)) continue;
    if (seen.has(spec.navLabel)) continue; // hero and use-case-matrix share a label
    seen.add(spec.navLabel);
    out.push({ href: `#${spec.sectionId}`, label: spec.navLabel });
  }
  return out;
}

/**
 * Components the plan asked for but the page has no content for. A populated
 * list is a build defect: the decision engine committed to a section and the
 * agent did not write it. Surfaced rather than swallowed — this is the check
 * that field-sniffing structurally could not perform.
 *
 * Only meaningful for components that HAVE a field-presence test. A component
 * whose content lives outside the typed fields (use-case-matrix, why-now-thesis
 * until their fields are registered) returns `derivedFrom() === false` for
 * every page and would report a false positive, so those are skipped — the
 * caller passes `contentPresent` for them instead.
 */
export function unmetInclusions(
  plan: ComponentPlan,
  page: CompetitorComparisonPage,
  renderer: RendererId,
  contentPresent: Partial<Record<ComponentId, boolean>> = {},
): ComponentId[] {
  return plan.entries
    .filter((e) => e.include)
    // A component this renderer cannot draw is reported by
    // unrenderableInclusions() instead. Counting it here would blame whatever
    // wrote the page for a section the code never had.
    .filter((e) => COMPONENTS[e.id].renderedBy.includes(renderer))
    .filter((e) => {
      if (e.id in contentPresent) return contentPresent[e.id] === false;
      const test = COMPONENTS[e.id].derivedFrom;
      return test ? !test(page) : false;
    })
    .map((e) => e.id);
}

/**
 * Components the plan asked for that this renderer has no section for.
 *
 * Expected, not exceptional: a plan is written against the content type, so a
 * takeout plan rendered through the use-case template will always list a few.
 * It is surfaced because the alternative is a page that silently drops part of
 * a decision — and because a component that keeps turning up here is the queue
 * for what to build next.
 */
export function unrenderableInclusions(plan: ComponentPlan, renderer: RendererId): ComponentId[] {
  return plan.entries
    .filter((e) => e.include && !COMPONENTS[e.id].renderedBy.includes(renderer))
    .map((e) => e.id);
}

// ---- Source: cms -----------------------------------------------------------

/**
 * Parse the `componentPlan` blob the decision engine writes onto the page.
 *
 * Defensive on purpose: this field is written by an agent, over a network, into
 * a CMS, and read on a public page. A malformed blob must degrade to `derived`
 * rather than blank the page — which is why every failure path here returns
 * null instead of throwing.
 *
 * NOTE: `componentPlan` is NOT yet a registered field on
 * CompetitorComparisonPage and is NOT in PAGE_QUERY. Selecting an unregistered
 * field fails the whole GraphQL query and 404s every page (see commit 9091988).
 * Register in the CMS, run `npm run check:graph`, and only then add it to the
 * query. This parser is ready for that day; nothing calls it with data today.
 */
export function parseCmsPlan(raw: unknown): ComponentPlan | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as Record<string, unknown>;
  const rawEntries = Array.isArray(d.components) ? d.components : Array.isArray(d.entries) ? d.entries : null;
  if (!rawEntries) return null;

  const entries: ComponentPlanEntry[] = [];
  for (const item of rawEntries) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    // Accept `componentId` (Aldus's ComponentDecision field name) as well as
    // `id`, so the engine can post its own shape without a translation step.
    const id = e.id ?? e.componentId;
    if (!isComponentId(id)) continue; // an id we have no renderer for is dropped, not guessed
    entries.push({
      id,
      include: e.include !== false,
      variant: typeof e.variant === 'string' ? e.variant : undefined,
      why: typeof e.why === 'string' ? e.why : 'no reason recorded',
    });
  }
  if (entries.length === 0) return null;

  const rung = (d.rung ?? {}) as Record<string, unknown>;
  const fit = (d.fit ?? {}) as Record<string, unknown>;
  return {
    source: 'cms',
    rungId: typeof rung.id === 'string' ? rung.id : typeof d.rungId === 'string' ? d.rungId : undefined,
    rungLabel: typeof rung.label === 'string' ? rung.label : undefined,
    fit:
      typeof fit.verdict === 'string'
        ? { verdict: fit.verdict, by: String(fit.by ?? 'unknown'), why: String(fit.why ?? '') }
        : undefined,
    resolvedAt: typeof d.resolvedAt === 'string' ? d.resolvedAt : undefined,
    entries,
  };
}

// ---- Source: live ----------------------------------------------------------

/**
 * Aldus's component ids -> the showcase's.
 *
 * The two vocabularies are NOT the same today and pretending otherwise would
 * hide the gap. Aldus's DEMO_COMPONENTS holds five ids; this template renders
 * seventeen. The mapping below is the whole contract, and the `null`s are the
 * work items:
 *
 *   hero                     -> hero                  1:1
 *   comparison-table         -> comparison-table      1:1
 *   customer-stories         -> customer-stories      1:1
 *   in-market-solutions-map  -> use-case-matrix       SAME COMPONENT, different name.
 *                               Aldus already gates it on
 *                               `signals.multiSolutionIntent`, which is exactly
 *                               the rule Laura's Siemens page follows ("three
 *                               active needs, ranked by signal strength").
 *   leadership-placements    -> analyst-proof         closest existing renderer
 *
 * Ids Aldus does not yet declare, and which therefore cannot be decided by the
 * ladder — they fall through to the rung default in planFromLimitless():
 *   signal-pills, why-now-thesis, friction-points, contact-close, nav-rail,
 *   account-intel, challenge-shot, proof-wall, roi-projection,
 *   migration-timeline, offer-card, sticky-cta
 */
export const LIMITLESS_ID_MAP: Record<string, ComponentId | null> = {
  hero: 'hero',
  'comparison-table': 'comparison-table',
  'customer-stories': 'customer-stories',
  'in-market-solutions-map': 'use-case-matrix',
  'leadership-placements': 'analyst-proof',
};

/**
 * The section set each rung gets for the components Aldus has no opinion on.
 *
 * This is a DEFAULT, not a decision: it is what the template shows when the
 * ladder did not speak. Every entry says so in its `why`, so a reader can tell
 * a rung default from a resolved decision. As Aldus's registry grows these
 * shrink; the goal is for this table to end up empty.
 */
const RUNG_DEFAULTS: Record<string, ComponentId[]> = {
  // Laura's Siemens shape. No comparison table, no ROI projection, no
  // migration timeline — a use-case page names no competitor.
  'use-case-default': ['nav-rail', 'hero', 'signal-pills', 'use-case-matrix', 'why-now-thesis', 'friction-points', 'contact-close'],
  'industry-fsi': ['nav-rail', 'hero', 'signal-pills', 'use-case-matrix', 'why-now-thesis', 'friction-points', 'contact-close'],
  'agent-orchestration-enterprise': ['nav-rail', 'hero', 'signal-pills', 'use-case-matrix', 'why-now-thesis', 'friction-points', 'contact-close'],
  // The takeout rung keeps the ABM template's full section set.
  'takeout-confirmed': ['nav-rail', 'hero', 'account-intel', 'challenge-shot', 'comparison-table', 'proof-wall', 'roi-projection', 'migration-timeline', 'contact-close', 'sticky-cta'],
};

const FALLBACK_RUNG = 'use-case-default';

export function planFromLimitless(plan: LimitlessPlan): ComponentPlan {
  const entries = new Map<ComponentId, ComponentPlanEntry>();

  // 1. Rung defaults first, so an explicit decision can overwrite one.
  const defaults = RUNG_DEFAULTS[plan.rung.id] ?? RUNG_DEFAULTS[FALLBACK_RUNG];
  for (const id of defaults) {
    entries.set(id, { id, include: true, why: `rung default for "${plan.rung.id}" (the ladder did not decide this component)` });
  }

  // 2. The ladder's own decisions, including its suppressions and reasons.
  for (const decision of plan.components) {
    const mapped = LIMITLESS_ID_MAP[decision.componentId];
    if (!mapped) continue;
    entries.set(mapped, {
      id: mapped,
      include: decision.include,
      variant: decision.variant,
      why: decision.why,
    });
  }

  // 3. The offer is a separate axis from the pitch (docs/architecture.md), so
  //    it is decided by the presence of an offer, not by the rung.
  entries.set('offer-card', {
    id: 'offer-card',
    include: !!plan.offer,
    why: plan.offer?.why ?? 'no eligible offer in window',
  });

  return {
    source: 'live',
    rungId: plan.rung.id,
    rungLabel: plan.rung.label,
    fit: plan.fit,
    resolvedAt: plan.resolvedAt,
    entries: COMPONENT_IDS.filter((id) => entries.has(id)).map((id) => entries.get(id)!),
  };
}

// ---- Source: derived -------------------------------------------------------

/**
 * Reconstruct a plan from which fields are populated — today's implicit model,
 * made explicit and confined to one function.
 *
 * Every predicate is the condition its renderer already uses, so this produces
 * exactly the section set a legacy page shows now. The `why` says "derived",
 * never invents a rationale, and the plan carries no rung because a
 * reconstructed plan does not know which one produced it.
 */
export function derivePlan(page: CompetitorComparisonPage): ComponentPlan {
  return {
    source: 'derived',
    entries: COMPONENT_IDS.map((id) => {
      const test = COMPONENTS[id].derivedFrom;
      const include = test ? test(page) : true;
      return {
        id,
        include,
        why: test
          ? include
            ? 'derived: the fields this section reads are populated'
            : 'derived: the fields this section reads are empty'
          : 'derived: this section is unconditional in the renderer',
      };
    }),
  };
}

// ---- Entry point -----------------------------------------------------------

/**
 * Resolve the plan for a page, preferring an authored decision over a
 * reconstructed one.
 *
 * `livePlan` is passed by the preview route, which has already fetched it from
 * Aldus. Nothing here makes a network call: a public page render must not
 * depend on an internal service being up.
 */
export function resolveComponentPlan(
  page: CompetitorComparisonPage & { componentPlan?: unknown },
  opts: { livePlan?: LimitlessPlan | null } = {},
): ComponentPlan {
  return parseCmsPlan(page.componentPlan) ?? (opts.livePlan ? planFromLimitless(opts.livePlan) : derivePlan(page));
}
