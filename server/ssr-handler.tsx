import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderToString } from 'react-dom/server';
import DynamicComparisonPageServer from '../src/components/DynamicComparisonPage.server';
import ABMHyperPageServer from '../src/components/ABMHyperPage.server';
import RetailCustomerPageServer from '../src/components/RetailCustomerPage.server';
import FinServPageServer from '../src/components/FinServPage.server';
import PersonPageServer from '../src/components/PersonPage.server';
import { isFinServDemoSlug, synthFinServPageFromDemo } from '../src/lib/finserv-demo-content';
/*
 * UseCasePage is imported DIRECTLY, not through a `.server.tsx` twin like the
 * five above it. Those twins exist for two reasons — React.lazy does not work
 * with renderToString, and the tracking hook has to come out — and neither
 * applies here: this renderer lazy-loads nothing, and useOdpTracking does all
 * its work inside useEffect, which never runs on the server. Duplicating it
 * would only buy the drift the existing twins already have (the server copy of
 * DynamicComparisonPage has quietly lost the hero's `id="hero"` anchor).
 */
import UseCasePage from '../src/components/UseCasePage';
import { includes, resolveComponentPlan } from '../src/lib/limitless/component-plan';
import { EXPERIENCE_QUERIES, normalizeExperienceItem } from '../src/lib/experience-queries';

/*
 * Visual Builder (/vb/:slug) render chain — imported directly rather than through
 * `src/cms/rendering/visual-builder.tsx`.
 *
 * That file's `Component` dispatch (`./component-factory.tsx`) pulls in THREE vendored lane
 * registries — `content-area/section.tsx`, `content-area/element.tsx`, `content-area/block.tsx`
 * — and every one of them calls `import.meta.glob(...)` UNGUARDED at module scope (no
 * try/catch, unlike `src/cms/rendering/registry.ts` and `src/cms/rendering/display-defaults.ts`,
 * which both wrap the same call). Confirmed by bundling each with esbuild/node18 exactly as
 * `scripts/build-ssr.mjs` does and importing the result: `content-area/section.tsx` throws
 * "import.meta.glob is not a function" at import time, before any request is even served.
 * Because this handler's imports are static, that throw would happen at COLD START — it would
 * take down SSR for every route on the site, not just `/vb/:slug`, which is exactly the
 * regression rule 2 (touch nothing that serves the 2,709 live pages) exists to prevent.
 *
 * The 27 element renderers themselves have no such problem — `src/cms/rendering/registry.ts`
 * is the only thing standing between them and a server render, and it fails soft (its glob IS
 * try/caught, so it resolves to an empty registry rather than throwing — confirmed the same
 * way: `repoRenderers` comes back `{}` under this bundler). So they are imported directly here,
 * by name, and dispatched by a small SSR-only copy of `visual-builder.tsx`'s tree walk (nodes
 * -> rows -> columns -> elements) that never touches `component-factory.tsx` or the three
 * vendored lane files. `BlankSection` — the one section type any Visual Builder blueprint on
 * this CMS uses — is imported the same way, straight from its own folder, which has no glob of
 * its own: it only lazy-imports `content-area/mapper` via `React.lazy`, and that import is
 * never triggered because a section with rows gets its `children` prop pre-rendered by
 * `VbRows` below, never a `rows` prop — see `visual-builder.tsx`'s own header comment for why
 * that shape avoids upstream's mapper.
 *
 * Kept in exact structural lockstep with `visual-builder.tsx` (same wrapper elements, same
 * conditional children/rows handling, same displaySettings defaulting calls) so a client that
 * ever hydrates this markup has as little to reconcile as possible. `withContentTypeDefaults`
 * and `withNodeTypeDefaults` resolve to empty maps under this same glob limitation — a real,
 * separate gap in `src/cms/rendering/display-defaults.ts` (repo-side display-setting DEFAULTS
 * for a node the CMS never customised are a browser-only concept today) — so they are called
 * here anyway, for parity and so a future fix to that file benefits both render paths, but a
 * node that relies purely on a repo default rather than a CMS-stored value can render with a
 * different class list server-side than client-side until that file grows the same kind of
 * Node fallback `src/cms/registry.ts` already has. It does not affect whether an element's own
 * CONTENT renders — every field below comes from Graph, not from a display-setting default.
 *
 * `src/components/VisualBuilderPage.tsx`'s `useExperience` hook also does not yet consume
 * `window.__SSR_DATA__` the way `usePageContent` does for the legacy templates — this handler
 * writes it (see the /vb/ branch below) for forward-compatibility, but until that hook is
 * updated the client still re-fetches over `/api/content` on mount and replaces this markup,
 * which will produce a hydration mismatch console warning rather than a clean hydrate. That is
 * a client-side change outside this file's scope; the markup this handler sends is real,
 * complete HTML either way, which is what /vb/:slug lacked entirely before this.
 */
import Column from '../src/vendor/opticom/components/layout/column';
import Row from '../src/vendor/opticom/components/layout/row';
import BlankSection from '../src/vendor/opticom/components/section/blank-section';
import { EditableBlock } from '../src/vendor/opticom/lib/optimizely/features/draft';
import { withContentTypeDefaults, withNodeTypeDefaults } from '../src/cms/rendering/display-defaults';
// The same shapes `visual-builder.tsx` types its own walk against — reused here so the SSR
// copy of that walk (below) takes the real composition shape instead of `any`.
import type {
  Column as ColumnNode,
  ExperienceElement,
  Row as RowNode,
  SafeVisualBuilderExperience,
  VisualBuilderNode,
} from '../src/vendor/opticom/lib/optimizely/types/experience';
// Type only — erased at compile time, so this never runs `registry.ts`'s own module body
// (the empty-under-Node `repoRenderers` the big comment above describes). Just borrowing the
// shape it declares for a renderer component.
import type { Renderer } from '../src/cms/rendering/registry';
import { cn } from '../src/vendor/opticom/lib/utils';
import { draftClass } from '../src/vendor/opticom/lib/utils/draft-helpers';

// The 27 Visual Builder element renderers, one static import each — see the block comment
// above for why these cannot be discovered through the registry's glob under this bundler.
import AbmAnalystCardElement from '../src/cms/components/abm-analyst-card-element';
import AbmChallengeShotElement from '../src/cms/components/abm-challenge-shot-element';
import AbmClosingCtaElement from '../src/cms/components/abm-closing-cta-element';
import AbmComparisonRowElement from '../src/cms/components/abm-comparison-row-element';
import AbmFrictionPointElement from '../src/cms/components/abm-friction-point-element';
import AbmNavRailElement from '../src/cms/components/abm-nav-rail-element';
import AbmNewsItemElement from '../src/cms/components/abm-news-item-element';
import AbmRoiCardElement from '../src/cms/components/abm-roi-card-element';
import AbmStakeholderElement from '../src/cms/components/abm-stakeholder-element';
import AbmStickyCtaElement from '../src/cms/components/abm-sticky-cta-element';
import AbmTeamMemberElement from '../src/cms/components/abm-team-member-element';
import AbmTechStackItemElement from '../src/cms/components/abm-tech-stack-item-element';
import AbmThesisElement from '../src/cms/components/abm-thesis-element';
import AbmTimelinePhaseElement from '../src/cms/components/abm-timeline-phase-element';
import AbmUseCaseLaneElement from '../src/cms/components/abm-use-case-lane-element';
import BlockquoteBlock from '../src/cms/components/blockquote-block';
import ButtonBlock from '../src/cms/components/button-block';
import CalloutBlock from '../src/cms/components/callout-block';
import CardCustomerBlock from '../src/cms/components/card-customer-block';
import CardCustomerQuoteBlock from '../src/cms/components/card-customer-quote-block';
import CardPressBlock from '../src/cms/components/card-press-block';
import ImageDisplayElement from '../src/cms/components/image-display-element';
import LinkItemElement from '../src/cms/components/link-item-element';
import SpacerBlock from '../src/cms/components/spacer-block';
import StackedHeadingElement from '../src/cms/components/stacked-heading-element';
import StatBlock from '../src/cms/components/stat-block';
import TextContentElement from '../src/cms/components/text-content-element';

const SSR_ELEMENT_RENDERERS: Record<string, Renderer> = {
  AbmAnalystCardElement,
  AbmChallengeShotElement,
  AbmClosingCtaElement,
  AbmComparisonRowElement,
  AbmFrictionPointElement,
  AbmNavRailElement,
  AbmNewsItemElement,
  AbmRoiCardElement,
  AbmStakeholderElement,
  AbmStickyCtaElement,
  AbmTeamMemberElement,
  AbmTechStackItemElement,
  AbmThesisElement,
  AbmTimelinePhaseElement,
  AbmUseCaseLaneElement,
  BlockquoteBlock,
  ButtonBlock,
  CalloutBlock,
  CardCustomerBlock,
  CardCustomerQuoteBlock,
  CardPressBlock,
  ImageDisplayElement,
  LinkItemElement,
  SpacerBlock,
  StackedHeadingElement,
  StatBlock,
  TextContentElement,
};

// ---------------------------------------------------------------------------
// Content Graph – fetch page data
// ---------------------------------------------------------------------------

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

// Query matches the registered RetailCustomerPage schema in Optimizely Graph.
// New per-customer fields (letter, polaroids, wornAnchors, questions,
// stylistName, neighborhood, initials, personalHeroLine{1,2}) are added
// via a probe-then-extend pattern below: we first introspect the live
// schema, then run a query that only includes fields that exist. This
// lets us deploy before Graph finishes propagating the schema changes
// and lights up the new fields automatically the moment they appear.
const BASE_RETAIL_FIELDS = `
  _metadata { key url { default hierarchical } published }
  template
  PageTitle MetaDescription CanonicalUrl { default }
  customerSlug customerDisplayName register monthStamp
  editorialIntro stylistNoteBody stylistNoteSignedBy closingReflection
  hero { imageUrl { default } line1 line2 linkTo { default } }
  heldForYou {
    header dynamic
    items { name priceCents priceVisibility imageUrl { default } }
  }
  setAside {
    primaryAction secondaryAction dynamic
    items { name imageUrl { default } }
  }
  atelierNote { title body cta imageUrl { default } }
  smallInvitation { itemName line cta itemImageUrl { default } }
  appointment {
    variant boutique stylistName slotPhrase slots
    primaryAction secondaryAction dynamic
  }
  footerLine
  deviceDegraded generatedAt generatedBy canvasVersion
`;

const EXTENDED_RETAIL_FIELDS_BY_NAME: Record<string, string> = {
  primaryCity: 'primaryCity',
  neighborhood: 'neighborhood',
  stylistName: 'stylistName',
  stylistBoutique: 'stylistBoutique',
  initials: 'initials',
  personalHeroLine1: 'personalHeroLine1',
  personalHeroLine2: 'personalHeroLine2',
  letter: 'letter { dateLine greeting paragraphs signoff }',
  polaroids: 'polaroids { imageUrl { default } caption rotate }',
  wornLabel: 'wornLabel',
  wornAnchors: 'wornAnchors { name qualifier season ownedImageUrl { default } pairedName pairedQualifier pairedImageUrl { default } pairedPriceLabel }',
  questions: 'questions { question answer }',
  careLabel: 'careLabel',
  careTimeline: 'careTimeline { itemName kind dueLine status note maker imageUrl { default } }',
  makerNote: 'makerNote',
};

let _retailQueryCache: { fields: string; query: string } | null = null;

async function getRetailQuery(authKey: string): Promise<string> {
  if (_retailQueryCache) return _retailQueryCache.query;
  // Probe the live schema once per cold start.
  const introspection = await queryGraph(
    authKey,
    `{ __type(name: "RetailCustomerPage") { fields { name } } }`,
    {},
  );
  const present = new Set<string>(
    ((introspection as any)?.data?.__type?.fields || []).map((f: any) => f.name),
  );
  const extras = Object.entries(EXTENDED_RETAIL_FIELDS_BY_NAME)
    .filter(([name]) => present.has(name))
    .map(([, frag]) => frag)
    .join('\n      ');
  const fields = `${BASE_RETAIL_FIELDS}\n      ${extras}`;
  const query = `
query GetRetailPage($slug: String!) {
  RetailCustomerPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      ${fields}
    }
  }
}
`;
  _retailQueryCache = { fields, query };
  return query;
}

// ---------------------------------------------------------------------------
// FinServPage (Brightstream) query. getFinServQuery() probes the live schema
// and returns null when the type isn't synced into Graph yet — callers then
// fall back to demo synthesis. The field set mirrors the registered FinServPage
// content type exactly (created in the showcase CMS), so CMS content flows the
// moment Graph finishes propagating the schema.
// ---------------------------------------------------------------------------

const FINSERV_FIELDS = `
  _metadata { key url { default hierarchical } published }
  template
  PageTitle MetaDescription
  brand tagline audience targetSlug targetName
  heroImageUrl navLinks
  headerCta { label href note }
  hero { eyebrow headline subhead highlights cta { label href note } }
  stats { value label }
  scenario { label title paragraphs pullLine }
  problems { label heading items { stat title description } }
  howItWorks { label heading steps { title description } }
  profile { quote attribution role company initials }
  savings { defaultDeposit products { id name apy benefit } }
  meeting { contactName company slots }
  footer { legal badges }
  generatedAt generatedBy
`;

let _finservQueryCache: { query: string } | null = null;
let _finservTypeAbsent = false;

async function getFinServQuery(authKey: string): Promise<string | null> {
  if (_finservQueryCache) return _finservQueryCache.query;
  if (_finservTypeAbsent) return null;
  const introspection = await queryGraph(
    authKey,
    `{ __type(name: "FinServPage") { name } }`,
    {},
  );
  const exists = !!(introspection as any)?.data?.__type?.name;
  if (!exists) {
    _finservTypeAbsent = true;
    return null;
  }
  const query = `
query GetFinServPage($slug: String!) {
  FinServPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      ${FINSERV_FIELDS}
    }
  }
}
`;
  _finservQueryCache = { query };
  return query;
}

/**
 * Six fields the flat content model never had — CanonicalUrl, FeatureSection and
 * FaqSection on the page, OurHighlight/CompetitorHighlight on ComparisonRow, Weeks
 * on ABMTimelinePhase — were carried forward from the pre-flat nested-block query
 * (a4a6fe7) and sat in this selection returning null on every page for months.
 * Optimizely Graph kept advertising the legacy names in its schema, so the query
 * still parsed; when that schema refreshed, the whole query 400'd and all 2,676
 * account pages 404'd. A selection on one unknown field fails the entire query —
 * check the registered type before adding a field here, and run
 * `npm run check:graph`.
 */
const PAGE_QUERY = `
query GetPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      PageTitle MetaDescription
      eyebrow headline subheadline cta link { default }
      comparisonHeadline
      comparisonTableRows { Category OurValue CompetitorValue }
      analystHeadline analystQuote analystSource analystCTA analystCTALink { default }
      promoEyebrow promoHeading promoDescription promoCTA promoCTALink { default }
      endHeadline endSubheadline endCTA endCTALink { default }
      testimonial1 testimonial1JobTitle testimonial1Company
      testimonial2 testimonial2JobTitle testimonial2Company
      customerLogo brandDomain brandAccentColor intelEyebrow intelHeadline competitorName
      challengeHeadline challengeScreenshotUrl { default } challengeScreenshotAlt challengeBrowserUrl
      comparisonDescription logoWallCustomerSlot
      roiTitle roiDescription roiProjectionValue roiProjectionLabel roiProjectionDetail
      migrationTitle migrationDescription stickyCTAText
      ctaTitle ctaDescription ctaButtonText modalScheduleUrl { default }
      footerTagline footerLegal
      intelStats { Value Label }
      stakeholders { Initials Name Role LinkedInUrl { default } AvatarColor EngagementTier EngagementNote PersonSlug CrmContactId }
      techStack { Name ColorTag }
      investments { Name IsPrimary }
      newsItems { Date Headline Url { default } }
      painPoints { Title Description }
      roiCards { Metric Unit Label CitationText }
      timelinePhases { Title Description MarkerColor }
      teamMembers { Initials Name Role Email }
      footerLinks { Text Url { default } }
      analystCards { Badge Source Category Url { default } }
    }
  }
}
`;

/**
 * Recover fields that the agent wrote to the CMS but the registered content
 * type doesn't yet expose (descriptor on items, image direction strings,
 * privateProvenance on set-aside items). The agent's create_page call sends
 * a propertiesJson blob; the CMS persists it verbatim under `_json` even when
 * it doesn't surface every key as a typed field. We re-merge those fields
 * into the page object so React components see the rich content the agent
 * actually generated.
 */
function mergeRetailJson(page: any): any {
  const raw = page?._json;
  if (!raw || typeof raw !== 'object') return page;
  const merge = (block: any, src: any) => {
    if (!src || typeof src !== 'object') return block;
    return { ...src, ...(block || {}) };
  };
  // Top-level scalars
  if (raw.customerDisplayName && !page.customerDisplayName) page.customerDisplayName = raw.customerDisplayName;
  // Hero
  if (page.hero || raw.hero) {
    page.hero = merge(page.hero, raw.hero);
  }
  // Held for you items — merge `descriptor` back onto each item by name
  if (page.heldForYou && Array.isArray(raw.heldForYou?.items)) {
    page.heldForYou = {
      ...raw.heldForYou,
      ...page.heldForYou,
      items: page.heldForYou.items.map((it: any) => {
        const fromRaw = raw.heldForYou.items.find((r: any) => r.name === it.name);
        return fromRaw ? { ...fromRaw, ...it } : it;
      }),
    };
  }
  // Set-aside items
  if (page.setAside && Array.isArray(raw.setAside?.items)) {
    page.setAside = {
      ...raw.setAside,
      ...page.setAside,
      items: page.setAside.items.map((it: any) => {
        const fromRaw = raw.setAside.items.find((r: any) => r.name === it.name);
        return fromRaw ? { ...fromRaw, ...it } : it;
      }),
    };
  }
  // Atelier note + small invitation + appointment — merge whole blocks
  page.atelierNote = merge(page.atelierNote, raw.atelierNote);
  page.smallInvitation = merge(page.smallInvitation, raw.smallInvitation);
  page.appointment = merge(page.appointment, raw.appointment);
  return page;
}

async function queryGraph(authKey: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  // A selection on a field Graph does not know fails the WHOLE query: `data`
  // comes back null, and every caller below reads that as "no such page". That
  // is how one schema drift 404'd all 2,676 account pages for days without
  // producing a single log line. Say it out loud instead.
  const errors = (json as { errors?: Array<{ message: string }> })?.errors;
  if (errors?.length) {
    const op = /query\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
    console.error(
      `[graph] ${op} failed (HTTP ${res.status}) for ${JSON.stringify(variables)}: ` +
        errors.map((e) => e.message).join(' | '),
    );
  }
  return json;
}

// PersonPage — the 1:1 buyer page, the only nested route on the site
// (/{company}/{person}). Probed first in fetchPageContent: a slug with two
// segments cannot be any of the flat types.
/**
 * The person page shows the company page's screenshot of the customer's
 * current site in its hero galaxy. That asset lives on the PARENT
 * CompetitorComparisonPage, not on PersonPage — pulling it across rather than
 * duplicating it onto the person content type means the two heroes can never
 * drift, and an editor who reshoots the company page's screenshot updates
 * every person page under it for free.
 */
const PARENT_SHOT_QUERY = `
query GetParentShot($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      challengeScreenshotUrl { default }
      challengeScreenshotAlt
      challengeBrowserUrl
    }
  }
}
`;

/**
 * Fetch the parent company page's site screenshot for a person page.
 * Best-effort: a person page whose parent has no screenshot (or whose parent
 * query fails) renders its galaxy without one, so this never blocks the page.
 */
async function fetchParentShot(
  authKey: string,
  companySlug: string | null | undefined,
): Promise<Record<string, unknown>> {
  const slug = (companySlug || '').replace(/^\/+|\/+$/g, '');
  if (!slug) return {};
  try {
    for (const s of [`/${slug}/`, `/en/${slug}/`]) {
      const json = await queryGraph(authKey, PARENT_SHOT_QUERY, { slug: s });
      const item = (json as any)?.data?.CompetitorComparisonPage?.items?.[0];
      if (item?.challengeScreenshotUrl?.default) {
        return {
          siteScreenshotUrl: item.challengeScreenshotUrl.default,
          siteScreenshotAlt: item.challengeScreenshotAlt ?? null,
          siteScreenshotDomain: item.challengeBrowserUrl ?? null,
        };
      }
    }
  } catch {
    /* the galaxy is decorative — never fail the page over it */
  }
  return {};
}

const PERSON_PAGE_QUERY = `
query GetPersonPage($slug: String!) {
  PersonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      template
      PageTitle MetaDescription noIndex
      companySlug companyName personSlug crmContactId
      personName personTitle personInitials
      personLinkedIn { default }
      personAvatarColor
      companyLogo { default }
      brandAccentColor
      heroEyebrow heroHeadline heroSubheadline heroCtaText heroCtaUrl { default }
      engagementTier engagementHeadline engagementSummary
      touchpoints { Date Kind Summary OptimizelyPerson }
      openOpportunityName openOpportunityStage openOpportunityDetail
      remitHeadline remitIntro
      remitPoints { Title Description Metric }
      roleFrame
      noteBody noteSignedBy noteSignedByRole noteSignedByInitials noteDate
      researchHeadline researchClaim
      provenance { Register Text SourceLabel SourceUrl { default } }
      scorecardHeadline scorecardIntro
      scorecard { Measure WhyHard WhatChanges Metric }
      solutionsHeadline solutionsIntro
      solutions { Product Headline Body WhyFirst }
      keyNumberValue keyNumberPrefix keyNumberSuffix keyNumberLabel keyNumberDetail
      keyNumberCitationUrl { default }
      peerProofHeadline
      peerProof { Quote PersonName PersonTitle Company SourceUrl { default } }
      teamHeadline
      team { Initials Name Role Email AvatarColor AlreadyMet }
      ctaTitle ctaBody ctaButtonText meetingUrl { default }
      footerLine generatedAt generatedBy
    }
  }
}
`;

async function fetchPageContent(authKey: string, slug: string) {
  const normalizedSlug = `/${slug}/`;

  // Retail dispatch: try RetailCustomerPage first on every request. The CMS
  // rejects '/' in route segments, so retail pages live at flat slugs like
  // `/isabella-chen`. Hierarchical `/retail/<slug>` is also supported. If
  // nothing matches the retail content type, fall through to comparison.
  const retailTries = [normalizedSlug];
  if (!slug.startsWith('en/')) retailTries.push(`/en/${slug}/`);
  // Also accept hierarchical /retail/<slug> path by stripping the prefix.
  if (slug.startsWith('retail/')) {
    const stripped = slug.replace(/^retail\//, '');
    retailTries.push(`/${stripped}/`);
    retailTries.push(`/en/${stripped}/`);
  }
  // Person pages are the only nested route, so try them before the flat
  // types; a two-segment slug can only be one of these.
  const personTries = [normalizedSlug];
  if (!slug.startsWith('en/')) personTries.push(`/en/${slug}/`);
  for (const s of personTries) {
    const pJson = await queryGraph(authKey, PERSON_PAGE_QUERY, { slug: s });
    const items = (pJson as any)?.data?.PersonPage?.items;
    if (items && items.length > 0) {
      const shot = await fetchParentShot(authKey, items[0]?.companySlug);
      return { ...items[0], ...shot, __template: 'person' as const };
    }
  }

  const retailQuery = await getRetailQuery(authKey);
  for (const s of retailTries) {
    const json = await queryGraph(authKey, retailQuery, { slug: s });
    const items = (json as any)?.data?.RetailCustomerPage?.items;
    if (items && items.length > 0) {
      return mergeRetailJson({ ...items[0], __template: 'retail' as const });
    }
  }

  // FinServ dispatch (Meridian Bank). Query Graph if the content type exists;
  // otherwise (or on miss) synthesize from demo content for known FS slugs so
  // the demo renders before the CMS content type is registered.
  const finservTries = [normalizedSlug];
  if (!slug.startsWith('en/')) finservTries.push(`/en/${slug}/`);
  const finservQuery = await getFinServQuery(authKey);
  if (finservQuery) {
    for (const s of finservTries) {
      const fsJson = await queryGraph(authKey, finservQuery, { slug: s });
      const items = (fsJson as any)?.data?.FinServPage?.items;
      if (items && items.length > 0) {
        return { ...items[0], __template: 'finserv' as const };
      }
    }
  }
  if (isFinServDemoSlug(slug)) {
    const synth = synthFinServPageFromDemo(slug);
    if (synth) return { ...synth, __template: 'finserv' as const };
  }

  let json = await queryGraph(authKey, PAGE_QUERY, { slug: normalizedSlug });
  let items = (json as any)?.data?.CompetitorComparisonPage?.items;

  // Fallback: try with /en/ prefix (Graph stores locale-prefixed URLs)
  if ((!items || items.length === 0) && !slug.startsWith('en/')) {
    const enSlug = `/en/${slug}/`;
    json = await queryGraph(authKey, PAGE_QUERY, { slug: enSlug });
    items = (json as any)?.data?.CompetitorComparisonPage?.items;
  }

  if (!items || items.length === 0) return null;
  return items[0];
}

// ---------------------------------------------------------------------------
// SEO – build <head> HTML (title, meta, JSON-LD)
// ---------------------------------------------------------------------------

const SITE_URL = 'https://showcase.optimizely.com';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHeadHtml(page: any): string {
  const parts: string[] = [];
  parts.push(`<title>${escapeHtml(page.PageTitle)}</title>`);
  parts.push(`<meta name="description" content="${escapeHtml(page.MetaDescription)}" />`);
  const canonicalHref =
    page.CanonicalUrl?.default || `${SITE_URL}${page._metadata.url.hierarchical}`;
  parts.push(`<link rel="canonical" href="${escapeHtml(canonicalHref)}" />`);

  // Social card tags. Retail pages reuse the hero image; ABM and comparison
  // pages fall back to whatever featured image they expose. og:image is
  // required for clean Slack / iMessage / LinkedIn previews.
  const isPersonPage = (page as any).__template === 'person' || page.template === 'person';
  const isRetailPage = (page as any).__template === 'retail' || page.template === 'retail';
  const isFinServPage = (page as any).__template === 'finserv' || page.template === 'finserv';
  let socialImage: string | null = null;
  if (isRetailPage) {
    socialImage =
      page.hero?.imageUrl?.default ||
      page.hero?.imageUrl ||
      page.atelierNote?.imageUrl?.default ||
      page.atelierNote?.imageUrl ||
      null;
  } else if (isFinServPage) {
    // No hero image on the FinServ template — fall back to a summary card.
    socialImage = null;
  } else {
    socialImage =
      page.heroImageUrl?.default ||
      page.heroImageUrl ||
      page.challengeScreenshotUrl?.default ||
      null;
  }
  const siteName = isRetailPage
    ? 'Maison Aurelle'
    : isFinServPage
      ? page.brand || 'Meridian Bank'
      : isPersonPage
        ? page.companyName || 'Optimizely Showcase'
        : 'Optimizely Showcase';

  parts.push(`<meta property="og:type" content="website" />`);
  parts.push(`<meta property="og:site_name" content="${escapeHtml(siteName)}" />`);
  parts.push(`<meta property="og:title" content="${escapeHtml(page.PageTitle)}" />`);
  parts.push(`<meta property="og:description" content="${escapeHtml(page.MetaDescription)}" />`);
  parts.push(`<meta property="og:url" content="${escapeHtml(canonicalHref)}" />`);
  if (socialImage) {
    parts.push(`<meta property="og:image" content="${escapeHtml(socialImage)}" />`);
    parts.push(`<meta property="og:image:alt" content="${escapeHtml(page.PageTitle)}" />`);
  }
  parts.push(`<meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}" />`);
  parts.push(`<meta name="twitter:title" content="${escapeHtml(page.PageTitle)}" />`);
  parts.push(`<meta name="twitter:description" content="${escapeHtml(page.MetaDescription)}" />`);
  if (socialImage) {
    parts.push(`<meta name="twitter:image" content="${escapeHtml(socialImage)}" />`);
  }

  const webPageLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.PageTitle,
    description: page.MetaDescription,
    url: canonicalHref,
    publisher: {
      '@type': 'Organization',
      name: 'Optimizely',
      url: 'https://www.optimizely.com',
    },
    datePublished: page._metadata.published,
  };

  if (page._metadata.url.hierarchical) {
    const slug = page._metadata.url.hierarchical.replace(/^\/|\/$/g, '');
    webPageLd.breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: page.PageTitle, item: `${SITE_URL}/${slug}` },
      ],
    };
  }
  parts.push(`<script type="application/ld+json">${JSON.stringify(webPageLd)}</script>`);

  // FAQ JSON-LD (FaqSection is now a list)
  if (Array.isArray(page.FaqSection)) {
    for (const entry of page.FaqSection) {
      const faqJson = (entry as any)?._json;
      if (faqJson?.Items?.length) {
        const faqLd = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqJson.Items.map((item: any) => ({
            '@type': 'Question',
            name: item.Heading ?? '',
            acceptedAnswer: { '@type': 'Answer', text: item.MainContent?.html ?? '' },
          })),
        };
        parts.push(`<script type="application/ld+json">${JSON.stringify(faqLd)}</script>`);
        break;
      }
    }
  }

  // Testimonial review JSON-LD (flat fields)
  const reviews: Array<Record<string, unknown>> = [];
  if (page.testimonial1 && page.testimonial1JobTitle) {
    reviews.push({
      '@type': 'Review',
      reviewBody: page.testimonial1,
      author: {
        '@type': 'Person',
        name: page.testimonial1JobTitle,
        ...(page.testimonial1Company ? { jobTitle: page.testimonial1Company } : {}),
      },
    });
  }
  if (page.testimonial2 && page.testimonial2JobTitle) {
    reviews.push({
      '@type': 'Review',
      reviewBody: page.testimonial2,
      author: {
        '@type': 'Person',
        name: page.testimonial2JobTitle,
        ...(page.testimonial2Company ? { jobTitle: page.testimonial2Company } : {}),
      },
    });
  }
  if (reviews.length > 0) {
    const reviewLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: page.ctaTitle || 'Optimizely',
      review: reviews,
    };
    parts.push(`<script type="application/ld+json">${JSON.stringify(reviewLd)}</script>`);
  }

  // Analyst cards JSON-LD (ABM pages)
  if (Array.isArray(page.analystCards) && page.analystCards.length > 0) {
    const analystLd = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Analyst Research',
      itemListElement: page.analystCards.map((card: any, idx: number) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: card.Source ?? '',
        description: card.Category ?? '',
        url: card.Url?.default ?? '',
      })),
    };
    parts.push(`<script type="application/ld+json">${JSON.stringify(analystLd)}</script>`);
  }

  return parts.join('\n    ');
}

// ---------------------------------------------------------------------------
// Visual Builder (/vb/:slug) — data fetch, composition walk, head tags
// ---------------------------------------------------------------------------

/** What `fetchExperienceContent` resolves to — same shape `VisualBuilderPage.tsx` types its own state as. */
type ExperienceItem = SafeVisualBuilderExperience & Record<string, unknown>;

/**
 * The `kind=experience` dispatch, server-side. Mirrors `api/content.ts`'s branch of the same
 * name exactly — same two queries (`EXPERIENCE_QUERIES`, from `src/lib/experience-queries.ts`,
 * the one copy both callers share), same slug tries, same normalisation — because that is what
 * `VisualBuilderPage.tsx` calls client-side, and the two must agree on what a slug resolves to.
 */
async function fetchExperienceContent(authKey: string, expSlug: string): Promise<ExperienceItem | null> {
  const normalizedSlug = `/${expSlug}/`;
  const tries = [normalizedSlug];
  if (!expSlug.startsWith('en/')) tries.push(`/en/${expSlug}/`);

  for (const s of tries) {
    for (const { typeName, query, template } of EXPERIENCE_QUERIES) {
      const json = await queryGraph(authKey, query, { slug: s });
      const items = (json as { data?: Record<string, { items?: unknown[] }> })?.data?.[typeName]?.items;
      if (items && items.length > 0) {
        return normalizeExperienceItem({ ...(items[0] as object), __typename: typeName, __template: template }) as ExperienceItem;
      }
    }
  }
  return null;
}

interface VbLevelProps {
  locale?: string;
  preview?: boolean;
}

/*
 * eslint-plugin-react-refresh's `only-export-components` flags every JSX-returning function
 * below, even though none of them are exported — it treats a capitalised, JSX-returning
 * declaration as "a component this file should export alone" the moment the file also default-
 * exports something else, which this file's `handler` always has. The premise the rule
 * protects — Vite's Fast Refresh needs a component-only module to preserve state across an
 * edit — does not apply here: this file is never served through Vite. It is bundled once, by
 * esbuild, into a Vercel serverless function (see scripts/build-ssr.mjs); nothing about it is
 * hot-reloaded, ever. Scoped to this composition-walk block rather than the whole file so a
 * genuine future violation elsewhere still gets caught.
 */
/* eslint-disable react-refresh/only-export-components */

/** One element inside a column — the leaf of the tree. Ported from `visual-builder.tsx`'s `Element`. */
function VbElement({
  element,
  index,
  locale,
  preview,
}: VbLevelProps & { element: ExperienceElement; index: number }) {
  const typeName = element.component?.__typename;
  if (!typeName) return null;
  const Renderer = SSR_ELEMENT_RENDERERS[typeName];
  // A type this SSR walk carries no renderer for renders nothing — the same miss behaviour
  // `component-factory.tsx` has for an unroutable type. There is no such type on this CMS
  // today: every element content type it can produce is one of the 27 registered above.
  if (!Renderer) return null;
  return (
    <EditableBlock blockId={element.key}>
      <Renderer
        {...element.component}
        displaySettings={withContentTypeDefaults(typeName, element.displaySettings)}
        isFirst={index === 0}
        locale={locale}
        preview={preview}
      />
    </EditableBlock>
  );
}

function VbColumns({ columns, locale, preview }: VbLevelProps & { columns?: ColumnNode[] }) {
  if (!columns?.length) return null;
  return (
    <>
      {columns.map((column) => (
        <Column
          key={column.key}
          displaySettings={withNodeTypeDefaults('column', column.displaySettings)}
          preview={preview}
        >
          {column.elements?.map((element, index) => (
            <VbElement key={element.key} element={element} index={index} locale={locale} preview={preview} />
          )) ?? null}
        </Column>
      ))}
    </>
  );
}

function VbRows({ rows, locale, preview }: VbLevelProps & { rows?: RowNode[] }) {
  if (!rows?.length) return null;
  return (
    <>
      {rows.map((row) => (
        <Row key={row.key} displaySettings={withNodeTypeDefaults('row', row.displaySettings)} preview={preview}>
          <VbColumns columns={row.columns} locale={locale} preview={preview} />
        </Row>
      ))}
    </>
  );
}

/** A `_Section`/`BlankSection` node — the only section type any blueprint on this CMS places. */
function VbSectionNode({ node, locale, preview }: VbLevelProps & { node: VisualBuilderNode }) {
  const typeName = node.section?.__typename;
  if (typeName !== 'BlankSection') return null;
  const hasRows = Boolean(node.rows?.length);
  return (
    <EditableBlock blockId={node.key} className="relative w-full" visualBuilderClass="vb:section">
      <div className={draftClass(preview, 'vb:grid')}>
        <BlankSection displaySettings={withContentTypeDefaults(typeName, node.displaySettings)} preview={preview}>
          {/* undefined, never [], for an empty section — BlankSection's own "no rows and no
              children" early return only fires when `children` is falsy. */}
          {hasRows ? <VbRows rows={node.rows} locale={locale} preview={preview} /> : undefined}
        </BlankSection>
      </div>
    </EditableBlock>
  );
}

/** The experience root. Structurally identical to `visual-builder.tsx`'s default export. */
function VisualBuilderExperienceSSR({
  experience,
  locale,
  preview = false,
}: VbLevelProps & { experience?: ExperienceItem | null }) {
  const nodes = experience?.composition?.nodes;
  if (!nodes?.length) return null;
  return (
    <div className={cn('relative w-full flex-1', draftClass(preview, 'vb:outline'))}>
      {nodes.map((node) => {
        if (node.nodeType === 'section' && node.section) {
          return <VbSectionNode key={node.key} node={node} locale={locale} preview={preview} />;
        }
        // No blueprint places a component directly on the experience today (see
        // visual-builder.tsx's TopLevelComponent) — nothing to port until one does.
        return null;
      })}
    </div>
  );
}

/* eslint-enable react-refresh/only-export-components */

/**
 * `<head>` tags for an experience page. Deliberately separate from `buildHeadHtml` above,
 * which is written against the flat page model's fields (`CanonicalUrl`, `testimonial1`,
 * `analystCards`, …) — none of which an experience has; its copy lives entirely inside
 * `composition`. Mirrors exactly what `VisualBuilderPage.tsx`'s `useExperienceHead` sets
 * client-side (title, description, robots), so the tags this handler sends are the same ones
 * the client would otherwise inject after its fetch resolves.
 */
function buildExperienceHeadHtml(item: ExperienceItem): string {
  const parts: string[] = [];
  const title = typeof item.PageTitle === 'string' && item.PageTitle ? item.PageTitle : 'Optimizely Showcase';
  parts.push(`<title>${escapeHtml(title)}</title>`);
  if (typeof item.MetaDescription === 'string' && item.MetaDescription) {
    parts.push(`<meta name="description" content="${escapeHtml(item.MetaDescription)}" />`);
  }
  const canonicalHref = `${SITE_URL}${item._metadata?.url?.hierarchical ?? ''}`;
  parts.push(`<link rel="canonical" href="${escapeHtml(canonicalHref)}" />`);
  // Same rule as useExperienceHead: noindex unless the CMS explicitly says otherwise.
  if (item.noIndex !== false) {
    parts.push(`<meta name="robots" content="noindex, nofollow" />`);
  }
  return parts.join('\n    ');
}

// ---------------------------------------------------------------------------
// HTML template – baked in at build time by esbuild (see scripts/build-ssr.mjs)
// ---------------------------------------------------------------------------

declare const __HTML_TEMPLATE__: string;
const htmlTemplate: string = __HTML_TEMPLATE__;

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const slug = url.pathname.replace(/^\/|\/$/g, '');
  const template = htmlTemplate;

  // Home + preview → SPA shell (no SSR needed)
  if (!slug || slug === 'preview') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);
  }

  // /search — SPA shell with explicit meta for social cards / search engines.
  if (slug === 'search') {
    const title = 'Optimizely Showcase — Every brand deserves its own story';
    const description =
      'Search 1,000+ AI-generated brand experiences. Opal builds 1:1 landing pages for every company you pitch, grounded in Optimizely Graph.';
    const canonical = `${SITE_URL}/search`;
    const headHtml = [
      `<title>${escapeHtml(title)}</title>`,
      `<meta name="description" content="${escapeHtml(description)}" />`,
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="Optimizely Showcase" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    ].join('\n    ');

    // Strip fallback title/description (and the leading whitespace they
    // occupy) then inject the /search-specific head just before </head>.
    let html = template;
    html = html.replace(/^\s*<title>[^<]*<\/title>\s*$/m, '');
    html = html.replace(/^\s*<meta name="description" content="[^"]*"\s*\/?>\s*$/m, '');
    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.replace('</head>', `    ${headHtml}\n  </head>`);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(html);
  }

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    console.warn('[ssr] GRAPH_AUTH_KEY not set, serving SPA shell');
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);
  }

  /*
   * Visual Builder experiences (/vb/:slug) — dispatched here, ahead of `fetchPageContent`, so
   * a request for one never runs that function's six-query chain (person x2, retail x2,
   * finserv, comparison): no legacy content type is ever registered at a `vb/`-prefixed URL,
   * so every one of those queries was guaranteed to come back empty for this slug shape.
   */
  if (slug.startsWith('vb/')) {
    const expSlug = slug.slice('vb/'.length);
    try {
      const item = expSlug ? await fetchExperienceContent(authKey, expSlug) : null;

      if (!item) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).send(template);
      }

      const preview = url.searchParams.get('ctx') === 'edit';
      const appHtml = renderToString(
        <div className="vb-experience bg-primary-1 text-secondary-darkfir flex min-h-screen w-full flex-col">
          <VisualBuilderExperienceSSR experience={item} locale="en" preview={preview} />
        </div>,
      );

      const headHtml = buildExperienceHeadHtml(item);
      const ssrDataScript = `<script>window.__SSR_DATA__=${JSON.stringify(item).replace(/</g, '\\u003c')}</script>`;

      let html = template;
      html = html.replace(/^\s*<title>[^<]*<\/title>\s*$/m, '');
      html = html.replace(/^\s*<meta name="description" content="[^"]*"\s*\/?>\s*$/m, '');
      html = html.replace(/\n{3,}/g, '\n\n');
      html = html.replace('</head>', `    ${headHtml}\n  </head>`);
      html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
      html = html.replace('<script type="module"', `${ssrDataScript}\n    <script type="module"`);

      res.setHeader('Content-Type', 'text/html');
      const wantsFresh = url.searchParams.has('refresh');
      res.setHeader(
        'Cache-Control',
        wantsFresh ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300',
      );
      if (!wantsFresh && item._metadata?.key) {
        res.setHeader('Cache-Tag', `page:${item._metadata.key}`);
      }
      if (item.noIndex !== false) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      return res.status(200).send(html);
    } catch (err) {
      console.error('[ssr] vb handler error:', err);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(template);
    }
  }

  try {
    const page = await fetchPageContent(authKey, slug);

    if (!page) {
      // Unknown slug → SPA shell (client renders NotFound component)
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).send(template);
    }

    // ---- Render React component tree to HTML ----
    // Three templates: retail (luxury fashion), abm (B2B account-based), comparison (B2B vs-X).
    // Retail is tagged in fetchPageContent; ABM is signal-detected.
    const isPerson = (page as any).__template === 'person' || page.template === 'person';
    const isRetail =
      !isPerson && ((page as any).__template === 'retail' || page.template === 'retail');
    const isFinServ =
      !isPerson && !isRetail && ((page as any).__template === 'finserv' || page.template === 'finserv');
    /*
     * The use-case arm must exist HERE as well as in src/App.tsx.
     *
     * The two dispatches are independent copies, and a page that server-renders
     * as ABM while the client renders it as use-case is a hydration failure on
     * a public URL. It cannot fire yet — `componentPlan` is not a registered
     * field and is not in PAGE_QUERY, so the plan resolves `derived` and this is
     * false for all 2,695 pages — but it has to be wired before the field is,
     * not after. Keep the two in step; see
     * aldus-ui/docs/limitless-use-case-template.md.
     */
    const componentPlan = !isPerson && !isRetail && !isFinServ ? resolveComponentPlan(page as any) : null;
    const isUseCase = !!componentPlan && includes(componentPlan, 'use-case-matrix');
    const isABM =
      !isPerson && !isRetail && !isFinServ && !isUseCase && !!(page.intelEyebrow || page.customerLogo);

    const appHtml = isPerson
      ? renderToString(<PersonPageServer page={page} />)
      : isRetail
        ? renderToString(<RetailCustomerPageServer page={page} />)
        : isFinServ
          ? renderToString(<FinServPageServer page={page} />)
          : isUseCase
            ? renderToString(<UseCasePage page={page as any} plan={componentPlan!} />)
            : isABM
              ? renderToString(<ABMHyperPageServer page={page} />)
              : renderToString(<DynamicComparisonPageServer page={page} />);

    // ---- Build SEO head tags ----
    const headHtml = buildHeadHtml(page);

    // ---- Embed page data for client hydration (avoids double-fetch) ----
    const ssrDataScript = `<script>window.__SSR_DATA__=${JSON.stringify(page).replace(/</g, '\\u003c')}</script>`;

    // ---- Assemble final HTML ----
    let html = template;

    // Replace default title/description with page-specific ones.
    // Match whole lines so we don't leave empty-indented rows behind.
    html = html.replace(/^\s*<title>[^<]*<\/title>\s*$/m, '');
    html = html.replace(/^\s*<meta name="description" content="[^"]*"\s*\/?>\s*$/m, '');
    html = html.replace(/\n{3,}/g, '\n\n');

    // Inject SEO head tags before </head>
    html = html.replace('</head>', `    ${headHtml}\n  </head>`);

    // Inject server-rendered markup into <div id="root">
    html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

    // Inject SSR data script before the Vite module entry
    html = html.replace('<script type="module"', `${ssrDataScript}\n    <script type="module"`);

    res.setHeader('Content-Type', 'text/html');
    /* `?refresh=…` is the deterministic cache-buster the
     * FloatingSidebar toast appends right after a republish. Mark
     * those responses uncacheable so the busted entry doesn't
     * persist next to the canonical one. Everything else gets the
     * standard 60s + 5min SWR window, *plus* a Cache-Tag so
     * /api/edit-status can request a tag-purge — best-effort, since
     * Vercel tag eviction is eventually consistent. */
    const wantsFresh = url.searchParams.has('refresh');
    res.setHeader(
      'Cache-Control',
      wantsFresh
        ? 'no-store'
        : 'public, s-maxage=60, stale-while-revalidate=300',
    );
    if (!wantsFresh && page._metadata?.key) {
      res.setHeader('Cache-Tag', `page:${page._metadata.key}`);
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[ssr] handler error:', err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);
  }
}
