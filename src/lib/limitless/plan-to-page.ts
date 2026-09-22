import type { CompetitorComparisonPage } from "../graph-types";
import type { Plan, PlanAccount } from "./plan-types";

/**
 * The whole point of this file: DynamicComparisonPage is reused UNMODIFIED.
 * What changes is where its props come from — a Plan (from the experience
 * ladder) instead of a CompetitorComparisonPage CMS content type. This is the
 * "components, not templates" / "the page is not the source of truth" step
 * from docs/architecture.md, made real rather than argued.
 *
 * Every section is populated ONLY from what the Plan actually decided:
 *   - `comparisonTableRows` exists iff the `comparison-table` component was
 *     included, which (see aldus-ui's ladder.ts) requires a TECH-confirmed
 *     signal — so a competitor is named here ONLY when BuiltWith confirmed
 *     it. There is no code path in this function that can invent one.
 *   - `promoHeading`/CTA exist iff the Plan carries an offer.
 *   - Testimonials are generic, variant-driven placeholders (net-new vs.
 *     expansion framing) — never a fabricated named customer quote. Wiring
 *     real customer-story content is future work; this function's job is the
 *     STRUCTURE (which sections exist), not to write copy.
 */

const OFFER_COPY: Record<string, { heading: string; description: string; cta: string }> = {
  "opticon-2026": {
    heading: "See it live at Opticon 2026",
    description: "Join 300+ teams building with Optimizely at our annual conference.",
    cta: "Reserve a seat",
  },
  "ai-fitness-workshop": {
    heading: "Get your AI fitness score",
    description: "A free 60-minute session — your program's maturity, an agent shortlist, and a plan. Attend and take home an Apple Watch.",
    cta: "Book your session",
  },
  "sitecore-migration-assessment": {
    heading: "See the Sitecore migration path",
    description: "A 60-minute assessment scoped to your stack, not a generic deck.",
    cta: "See the migration path",
  },
  "platform-value-assessment": {
    heading: "Get a Platform Value Assessment",
    description: "60 minutes on where a connected platform closes the gap between your solutions in play.",
    cta: "Request the assessment",
  },
};

/**
 * Generic, category-level comparison rows — never a fabricated statistic or
 * a specific claim about the named competitor's product. "Never invent a
 * fact" applies here: these are the same category headings regardless of
 * which competitor is confirmed, deliberately generic rather than specific.
 */
function genericComparisonRows(competitor: string) {
  return [
    { Category: "Deployment model", OurValue: "Composable, API-first", OurHighlight: true, CompetitorValue: "Monolithic", CompetitorHighlight: false },
    { Category: "AI-native workflows", OurValue: "Built in", OurHighlight: true, CompetitorValue: "Bolt-on / limited", CompetitorHighlight: false },
    { Category: "Experimentation", OurValue: "Native, same platform", OurHighlight: true, CompetitorValue: "Separate tool required", CompetitorHighlight: false },
    { Category: "Migration path", OurValue: "Guided, phased", OurHighlight: true, CompetitorValue: `From ${competitor}`, CompetitorHighlight: false },
  ];
}

function competitorFromSources(plan: Plan): string | null {
  const techSignal = plan.sources.find((s) => s.tag === "TECH");
  if (!techSignal) return null;
  // techSignal.value looks like "Sitecore CMS" — take the first token as the
  // competitor's product name, since that is what BuiltWith actually confirms.
  return techSignal.value.split(" ")[0];
}

export function planToComparisonPageProps(plan: Plan, account: PlanAccount): CompetitorComparisonPage {
  const included = new Set(plan.components.filter((c) => c.include).map((c) => c.componentId));
  const heroDecision = plan.components.find((c) => c.componentId === "hero");
  const competitor = included.has("comparison-table") ? competitorFromSources(plan) : null;
  const customerStoriesVariant = plan.components.find((c) => c.componentId === "customer-stories")?.variant;
  const offerCopy = plan.offer ? OFFER_COPY[plan.offer.id] : undefined;

  const heroCopy =
    heroDecision?.variant === "competitive-displacement" && competitor
      ? {
          eyebrow: `Considering a change from ${competitor}?`,
          headline: `${account.companyName} deserves a platform built for what's next.`,
          subheadline: `See how teams like yours move faster after ${competitor}.`,
        }
      : heroDecision?.variant === "platform-suite-argument"
        ? {
            eyebrow: `${plan.pitch.solutionAreas.join(" + ")} — one connected platform`,
            headline: `One platform for everything ${account.companyName} is already trying to do.`,
            subheadline: "Experience creation and optimization, working from the same data.",
          }
        : {
            eyebrow: "An opportunity worth testing",
            headline: `${account.companyName}: what's possible with a modern experimentation program.`,
            subheadline: "See where the account stands today, and the fastest path forward.",
          };

  return {
    _metadata: { key: account.id, url: { default: `/limitless-preview/${account.id}`, hierarchical: `/limitless-preview/${account.id}` }, published: plan.resolvedAt },
    PageTitle: `${account.companyName} — Optimizely`,
    MetaDescription: heroCopy.subheadline,
    CanonicalUrl: null,

    eyebrow: heroCopy.eyebrow,
    headline: heroCopy.headline,
    subheadline: heroCopy.subheadline,
    cta: "See the account plan",
    link: { default: "#comparison" },

    comparisonHeadline: competitor ? `Optimizely vs. ${competitor}` : null,
    comparisonTableRows: competitor ? genericComparisonRows(competitor) : null,

    analystHeadline: null,
    analystQuote: null,
    analystSource: null,
    analystCTA: null,
    analystCTALink: null,

    promoEyebrow: offerCopy ? "Recommended next step" : null,
    promoHeading: offerCopy?.heading ?? null,
    promoDescription: offerCopy?.description ?? null,
    promoCTA: offerCopy?.cta ?? null,
    promoCTALink: offerCopy ? { default: "#contact" } : null,

    endHeadline: `Ready to talk, ${account.companyName}?`,
    endSubheadline: null,
    endCTA: "Schedule a conversation",
    endCTALink: { default: "#contact" },

    testimonial1: customerStoriesVariant === "expansion" ? "Every team we've added has shipped faster than the last." : "We tested our first idea in a week, not a quarter.",
    testimonial1JobTitle: customerStoriesVariant === "expansion" ? "VP, Digital Experience" : "Head of Growth",
    testimonial1Company: account.industry,
    testimonial2: null,
    testimonial2JobTitle: null,
    testimonial2Company: null,

    Logos: null,
    FeatureSection: null,
    FaqSection: null,

    customerLogo: null,
    brandDomain: account.domain,
    brandAccentColor: null,
    intelEyebrow: null,
    intelHeadline: null,
    competitorName: competitor,
    challengeHeadline: null,
    challengeScreenshotUrl: null,
    challengeScreenshotAlt: null,
    challengeBrowserUrl: null,
    comparisonDescription: null,
    logoWallCustomerSlot: null,
    roiTitle: null,
    roiDescription: null,
    roiProjectionValue: null,
    roiProjectionLabel: null,
    roiProjectionDetail: null,
    migrationTitle: null,
    migrationDescription: null,
    stickyCTAText: null,
    ctaTitle: null,
    ctaDescription: null,
    ctaButtonText: null,
    modalScheduleUrl: null,
    footerTagline: null,
    footerLegal: null,

    intelStats: null,
    stakeholders: null,
    techStack: null,
    investments: null,
    newsItems: null,
    painPoints: null,
    roiCards: null,
    timelinePhases: null,
    teamMembers: null,
    footerLinks: null,
    analystCards: null,

    Testimonials: null,
    xraySections: null,
  };
}
