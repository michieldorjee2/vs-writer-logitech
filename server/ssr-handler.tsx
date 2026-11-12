import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderToString } from 'react-dom/server';
import { Suspense, type ReactElement } from 'react';
import RetailCustomerPage from '../src/components/RetailCustomerPage';
import FinServPageServer from '../src/components/FinServPage.server';
import WwwPersonPage from '../src/www/PersonPage';
import { isFinServDemoSlug, synthFinServPageFromDemo } from '../src/lib/finserv-demo-content';
import AccountRoute from '../src/www/AccountRoute';
import { accountTemplateOf } from '../src/www/account-template';
import WwwOfferPage from '../src/www/OfferPage';
import OfferEndedPage from '../src/www/OfferEndedPage';
import { isEndedOffer } from '../src/lib/offer-ended';
import { isOfferExperience } from '../src/www/design';
import { agentPlatformHead } from '../src/www/agent-platform/content';
import { resolveUrl } from '../src/lib/graph-types';
import { graphItems } from '../src/lib/graph-envelope';
import { ACCOUNT_PAGE_QUERY } from '../src/lib/account-page-query';
import { PERSON_PAGE_QUERY } from '../src/lib/person-page-query';
import { publicPersonPage } from '../src/www/person-content';
import type {
  AtelierNoteBlock,
  CompetitorComparisonPage,
  FinServHeroBlock,
  FinServPage,
  PersonPage,
  RetailCustomerPage as RetailPageData,
  RetailHeroBlock,
} from '../src/lib/graph-types';
import { EXPERIENCE_QUERIES, normalizeExperienceItem } from '../src/lib/experience-queries';
import { authEnabled, currentIdentity, safeNext, signInPath } from '../api/_lib/auth';
import { badgeRootAttr } from '../api/_lib/badge-mode';
import { renderLoginPage } from './login-page';
import { renderSettled } from './render-settled';
import SearchHome from '../src/components/SearchHome';
import { buildForRoute, buildStore } from '../api/_lib/page-builds-store';
import type { BuildRecord } from '../src/lib/page-builds';
import { randomScene } from '../src/lib/home-scenes';
import { isOfferId, OFFER_COOKIE, type ShownOffer } from '../src/lib/offer-looks';
import { aldusConfigured, runningOffers } from '../api/_lib/aldus';
import { signupCacheControl, withOfferSignup } from '../api/_lib/offer-signup';
import { withParentAccount } from '../api/_lib/parent-account';
import { endedCacheControl, withOfferEnded } from '../api/_lib/offer-ended';
import { withPageCopy } from '../api/_lib/page-copy';
import { firstCandidateFound, startRead, whichPageQuery, type Candidate } from './reads';
import { graphOp, postGraphRead } from '../api/_lib/graph-read';

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
// optimizely.com's CURRENT layout components — must match src/cms/rendering/visual-builder.tsx,
// or hydration keeps the server's markup. See src/cms/layout-prod.
import { ProdColumn as Column, ProdRow as Row, ProdSection as BlankSection } from '../src/cms/layout-prod';
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
import FaqItemElement from '../src/cms/components/faq-item-element';
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
import { bandOf } from '../src/cms/rendering/band';

const SSR_ELEMENT_RENDERERS: Record<string, Renderer> = {
  AbmAnalystCardElement,
  AbmChallengeShotElement,
  AbmClosingCtaElement,
  AbmComparisonRowElement,
  AbmFrictionPointElement,
  FaqItemElement,
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
  _metadata { key url { default hierarchical } published lastModified }
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
    ((introspection as TypeProbe)?.data?.__type?.fields || []).map((f) => f.name),
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
  _metadata { key url { default hierarchical } published lastModified }
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
  const exists = !!(introspection as TypeProbe)?.data?.__type?.name;
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
const PAGE_QUERY = ACCOUNT_PAGE_QUERY;

/** The two introspection probes' answers. */
type TypeProbe = { data?: { __type?: { name?: string; fields?: Array<{ name: string }> | null } | null } | null } | null | undefined;

/**
 * Everything fetchPageContent can return, tagged by which renderer owns it.
 * Account pages come back untagged — they are the default arm — and every
 * other type is tagged on its way out, which is what lets the dispatch below be
 * a switch the compiler can narrow instead of a chain of casts.
 */
type FetchedPage =
  | (PersonPage & { __template: 'person' })
  | (RetailPageData & { __template: 'retail' })
  | (FinServPage & { __template: 'finserv' })
  | (CompetitorComparisonPage & { __template?: undefined });

/*
 * Graph reads are bounded, and a stalled one is asked once more (api/_lib/graph-read.ts). A second
 * stall fails the page as any Graph error does (the shell, uncached).
 */
async function queryGraph(authKey: string, query: string, variables: Record<string, unknown>) {
  const { res, json } = await postGraphRead(
    `${GRAPH_ENDPOINT}?auth=${authKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) },
    graphOp(query),
  );
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

/** One candidate's whole page: the full query for its type at its address, or null. */
async function readPage(authKey: string, c: Candidate, finservQuery: string | null): Promise<FetchedPage | null> {
  switch (c.kind) {
    case 'person': {
      const items = graphItems<PersonPage>(await queryGraph(authKey, PERSON_PAGE_QUERY, { slug: c.slug }), 'PersonPage');
      // Their unpublished words never leave the server (src/www/person-content.ts).
      return items?.length ? { ...publicPersonPage(items[0]), __template: 'person' as const } : null;
    }
    case 'retail': {
      const items = graphItems<RetailPageData>(await queryGraph(authKey, await getRetailQuery(authKey), { slug: c.slug }), 'RetailCustomerPage');
      return items?.length ? { ...items[0], __template: 'retail' as const } : null;
    }
    case 'finserv': {
      if (!finservQuery) return null;
      const items = graphItems<FinServPage>(await queryGraph(authKey, finservQuery, { slug: c.slug }), 'FinServPage');
      return items?.length ? { ...items[0], __template: 'finserv' as const } : null;
    }
    case 'account': {
      const items = graphItems<CompetitorComparisonPage>(await queryGraph(authKey, PAGE_QUERY, { slug: c.slug }), 'CompetitorComparisonPage');
      // The page's own copy on the agent platform template (api/_lib/page-copy.ts).
      return items?.length ? withPageCopy(items[0]) : null;
    }
  }
}

/** A Meridian Bank demo slug, synthesized so the demo renders before the CMS type has content. */
function finservDemo(slug: string): FetchedPage | null {
  const synth = isFinServDemoSlug(slug) ? synthFinServPageFromDemo(slug) : null;
  return synth ? { ...synth, __template: 'finserv' as const } : null;
}

// PersonPage (src/lib/person-page-query.ts) is the only nested route on the site
// (/{company}/{person}). Probed first in fetchPageContent: a slug with two
// segments cannot be any of the flat types.
//
// The order decides: person, retail, fin-serv, the fin-serv demo, then the account page. Graph
// is asked once which of them has a page (server/reads.ts, whichPageQuery), then that page is
// read: two requests, where asking each in turn cost an account page seven.
async function fetchPageContent(authKey: string, slug: string): Promise<FetchedPage | null> {
  const normalizedSlug = `/${slug}/`;
  const tries = [normalizedSlug];
  // Fallback: the /en/ prefix (Graph stores locale-prefixed URLs).
  if (!slug.startsWith('en/')) tries.push(`/en/${slug}/`);

  // Retail dispatch: RetailCustomerPage is tried on every request. The CMS
  // rejects '/' in route segments, so retail pages live at flat slugs like
  // `/isabella-chen`. Hierarchical `/retail/<slug>` is also supported. If
  // nothing matches the retail content type, fall through to comparison.
  const retailTries = [...tries];
  // Also accept hierarchical /retail/<slug> path by stripping the prefix.
  if (slug.startsWith('retail/')) {
    const stripped = slug.replace(/^retail\//, '');
    retailTries.push(`/${stripped}/`);
    retailTries.push(`/en/${stripped}/`);
  }

  // FinServ dispatch (Meridian Bank): asked only when the content type exists in Graph (probed
  // once per instance), since a type Graph does not know fails the whole question.
  const finservQuery = await getFinServQuery(authKey);
  const candidates: Candidate[] = [
    // Person pages are the only nested route, so they come before the flat
    // types; a two-segment slug can only be one of these.
    ...tries.map((s) => ({ kind: 'person' as const, slug: s })),
    ...retailTries.map((s) => ({ kind: 'retail' as const, slug: s })),
    ...(finservQuery ? tries.map((s) => ({ kind: 'finserv' as const, slug: s })) : []),
    ...tries.map((s) => ({ kind: 'account' as const, slug: s })),
  ];

  // No answer at all (Graph down, or the read timed out) fails the page here, as any Graph failure
  // always has: asking eight more times would only wait eight times as long.
  const { query, variables } = whichPageQuery(candidates);
  const answer = await queryGraph(authKey, query, variables);
  let found: Candidate | null;
  try {
    found = firstCandidateFound(candidates, answer);
  } catch (err) {
    // Graph answered the question with errors: ask each candidate in turn, as before.
    console.error('[ssr] WhichPage failed, reading each candidate in turn:', err instanceof Error ? err.message : err);
    for (const c of candidates) {
      if (c.kind === 'account') {
        const demo = finservDemo(slug);
        if (demo) return demo;
      }
      const page = await readPage(authKey, c, finservQuery);
      if (page) return page;
    }
    return null;
  }
  // The demo comes after the fin-serv pages and before the account pages.
  if (!found || found.kind === 'account') {
    const demo = finservDemo(slug);
    if (demo) return demo;
  }
  return found ? readPage(authKey, found, finservQuery) : null;
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

/**
 * The fields buildHeadHtml reads, from whichever of the four page types it was
 * handed. Past the first three, each exists on only some of them, so they are
 * optional — the function already tolerates their absence.
 */
interface HeadSource {
  PageTitle?: string | null;
  MetaDescription?: string | null;
  _metadata: { url: { hierarchical: string }; published?: string | null };
  __template?: string | null;
  template?: string | null;
  CanonicalUrl?: { default: string } | null;
  /** Retail and FinServ both have a hero block; only the retail one carries an image. */
  hero?: RetailHeroBlock | FinServHeroBlock | null;
  atelierNote?: AtelierNoteBlock | null;
  heroImageUrl?: string | { default: string } | null;
  challengeScreenshotUrl?: { default: string } | null;
  brand?: string | null;
  companyName?: string | null;
  ctaTitle?: string | null;
  testimonial1?: string | null;
  testimonial1JobTitle?: string | null;
  testimonial1Company?: string | null;
  testimonial2?: string | null;
  testimonial2JobTitle?: string | null;
  testimonial2Company?: string | null;
  analystCards?: Array<{ Source?: string | null; Category?: string | null; Url?: { default?: string | null } | null }> | null;
}

function buildHeadHtml(page: HeadSource): string {
  const parts: string[] = [];
  // PersonPage declares both as optional. A page missing one used to throw
  // inside escapeHtml and fall through to the SPA shell; now it gets an empty tag.
  const title = page.PageTitle ?? '';
  const description = page.MetaDescription ?? '';
  parts.push(`<title>${escapeHtml(title)}</title>`);
  parts.push(`<meta name="description" content="${escapeHtml(description)}" />`);
  const canonicalHref =
    page.CanonicalUrl?.default || `${SITE_URL}${page._metadata.url.hierarchical}`;
  parts.push(`<link rel="canonical" href="${escapeHtml(canonicalHref)}" />`);

  // Social card tags. Retail pages reuse the hero image; ABM and comparison
  // pages fall back to whatever featured image they expose. og:image is
  // required for clean Slack / iMessage / LinkedIn previews.
  const isPersonPage = page.__template === 'person' || page.template === 'person';
  const isRetailPage = page.__template === 'retail' || page.template === 'retail';
  const isFinServPage = page.__template === 'finserv' || page.template === 'finserv';
  let socialImage: string | null;
  if (isRetailPage) {
    // resolveUrl reads either URL shape Graph has used ({ default } or a bare
    // string). The old `x?.imageUrl?.default || x?.imageUrl` chain handed the
    // OBJECT to escapeHtml whenever `default` was missing, and threw.
    const heroImage = page.hero && 'imageUrl' in page.hero ? page.hero.imageUrl : null;
    socialImage = resolveUrl(heroImage) || resolveUrl(page.atelierNote?.imageUrl) || null;
  } else if (isFinServPage) {
    // No hero image on the FinServ template — fall back to a summary card.
    socialImage = null;
  } else {
    socialImage = resolveUrl(page.heroImageUrl) || page.challengeScreenshotUrl?.default || null;
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
  parts.push(`<meta property="og:title" content="${escapeHtml(title)}" />`);
  parts.push(`<meta property="og:description" content="${escapeHtml(description)}" />`);
  parts.push(`<meta property="og:url" content="${escapeHtml(canonicalHref)}" />`);
  if (socialImage) {
    parts.push(`<meta property="og:image" content="${escapeHtml(socialImage)}" />`);
    parts.push(`<meta property="og:image:alt" content="${escapeHtml(title)}" />`);
  }
  parts.push(`<meta name="twitter:card" content="${socialImage ? 'summary_large_image' : 'summary'}" />`);
  parts.push(`<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  parts.push(`<meta name="twitter:description" content="${escapeHtml(description)}" />`);
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
      itemListElement: page.analystCards.map((card, idx) => ({
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
        // Outermost, withOfferEnded: an ended offer's page is its stand-in (src/lib/offer-ended.ts).
        return (await withOfferEnded(
          await withOfferSignup(await withParentAccount(normalizeExperienceItem({ ...(items[0] as object), __typename: typeName, __template: template }))),
        )) as ExperienceItem;
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
      {/* The browser draws each of these through registry.ts's suspend(): a lazy chunk in its
          own <Suspense fallback={null}>. The server imports them statically, but must still
          emit the boundary — hydration expects its <!--$--> marker around every element. */}
      <Suspense fallback={null}>
        <Renderer
          {...element.component}
          displaySettings={withContentTypeDefaults(typeName, element.displaySettings)}
          isFirst={index === 0}
          locale={locale}
          preview={preview}
        />
      </Suspense>
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
      {/* data-band must match the client renderer's or hydration keeps the server's. See src/cms/rendering/band.ts. */}
      <div className={draftClass(preview, 'vb:grid')} data-band={bandOf(withContentTypeDefaults(typeName, node.displaySettings))}>
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
    <div data-vb-root className={cn('relative w-full flex-1', draftClass(preview, 'vb:outline'))}>
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
/** The search page's own document (home.html): no router, no Tailwind, no third-party tags. */
declare const __HOME_TEMPLATE__: string;
const homeTemplate: string = __HOME_TEMPLATE__;
/** A page's address while Mark builds it (build.html → BuildView.tsx). */
declare const __BUILD_TEMPLATE__: string;
const buildTemplate: string = __BUILD_TEMPLATE__;

/* A build owns its address for this long after it finishes, so a reload that beats
   Graph's indexing of the new page still finds the build, not "not found". */
const BUILD_GRACE_MS = 10 * 60 * 1000;

/**
 * The offer /search is run as, from the profile menu's cookie, with its look (lib/offer-looks.ts).
 * Null when there is none, it no longer runs, or Aldus UI is slow to say: the page then draws
 * as usual and takes the offer on itself.
 */
async function shownOfferFor(cookie: unknown): Promise<ShownOffer | null> {
  if (!isOfferId(cookie) || !aldusConfigured()) return null;
  try {
    const quickly = <T,>(p: Promise<T>) => Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))]);
    let offer = (await quickly(runningOffers()))?.find((o) => o.id === cookie);
    // An offer without a look is the one whose look may have just been made: ask again rather than trust the held list.
    if (offer && !offer.look) offer = (await quickly(runningOffers(true)))?.find((o) => o.id === cookie) ?? offer;
    return offer ? { id: offer.id, title: offer.title, look: offer.look } : null;
  } catch {
    return null;
  }
}

/** The build that owns this address, if any (only page-shaped paths are looked up). */
async function buildAt(slug: string): Promise<BuildRecord | null> {
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(slug)) return null;
  const store = buildStore();
  if (!store) return null;
  try {
    return await buildForRoute(store, slug);
  } catch (err) {
    console.error('[ssr] build lookup', err);
    return null;
  }
}

function sendBuildView(res: VercelResponse, build: BuildRecord): void {
  const attrs = `data-build="${escapeHtml(build.id)}" data-route="${escapeHtml(build.finalRoute ?? build.route)}"`;
  const html = buildTemplate
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(`Mark is building ${build.name}`)} · Optimizely Showcase</title>`)
    .replace('<div id="root"></div>', `<div id="root" ${attrs}></div>`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

/**
 * Server-render a page inside the exact shell the browser renders it in.
 *
 * src/App.tsx wraps every route in `<main>` (since 7bf27cb) and every page renderer in a
 * `<Suspense>` boundary (the renderers are lazy chunks). React marks a server-rendered
 * boundary with `<!--$-->` comments, and hydration walks the DOM expecting them. This used
 * to render the page bare — no `<main>`, no marker — so React hit `<main class="abm-page">`
 * where it expected the boundary, failed with #418 on every server-rendered page, threw the
 * server HTML away and client-rendered the whole root. Measured 2026-10-08: 11 of 13 page
 * types failing in production; the two "clean" ones were never hydrated at all.
 *
 * The SHAPE of the children matters too, not just the wrappers. useId() encodes a
 * component's position, and React counts a parent's children ARRAY: PageLoader renders
 * `{body}<PageExtras/>` — two slots (PageExtras draws nothing until hydration is done) —
 * while the /vb/ route renders one. Give the page one slot where the browser gives it
 * two and every useId() below it differs (OpalStamp's ids, on every retail page). So there
 * is one helper per route, each mirroring that route's element in App.tsx exactly.
 *
 * Keep these in step with App.tsx: a wrapper or a sibling added there without being added
 * here breaks hydration again. The fallback is irrelevant on the server — content is
 * rendered, never the fallback — so it is null rather than a copy of the client's spinner.
 *
 * Both render through renderSettled (./render-settled.ts): a lazy chunk inside the page that
 * has not loaded yet on a fresh instance is waited for, not left for the browser (React #419).
 */

/** Mirrors App.tsx's PageLoader: `<Suspense>{body}<PageExtras/></Suspense>`. */
function renderPageRoute(page: ReactElement): Promise<string> {
  return renderSettled(() =>
    renderToString(
      <main>
        <Suspense fallback={null}>
          {page}
          {/* PageExtras' slot (the booth sidebar, a personal link's note): browser-only, but a slot. */}
          {false}
        </Suspense>
      </main>,
    ),
  );
}

/** Mirrors App.tsx's /vb/:slug route element: `<Suspense><VisualBuilderPage/></Suspense>`. */
function renderExperienceRoute(page: ReactElement): Promise<string> {
  return renderSettled(() =>
    renderToString(
      <main>
        <Suspense fallback={null}>{page}</Suspense>
      </main>,
    ),
  );
}

/*
 * The edge cache of a page's HTML. A page is purged from it whenever the CMS publishes or deletes
 * it (api/cms-published.ts, by the tag below), so it can live there far longer than a page that
 * nothing purges: an hour fresh, then served once more while it re-renders for up to a day. A
 * deploy empties the cache too. Pages without a key (nothing could purge them) and the not-found
 * shell keep SHORT_CACHE_CONTROL.
 */
export const PAGE_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=86400';
const SHORT_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

/** Tag the response with its page, for api/_lib/purge-page.ts. `Vercel-Cache-Tag` is the header
 *  Vercel's CDN reads; `Cache-Tag` was set alone until 7 Nov 2026, which no purge could reach. */
function setPageTag(res: { setHeader(name: string, value: string): unknown }, key: string) {
  res.setHeader('Vercel-Cache-Tag', `page:${key}`);
  res.setHeader('Cache-Tag', `page:${key}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const slug = url.pathname.replace(/^\/|\/$/g, '');
  const template = htmlTemplate;

  // The site has no page of its own at its root: the search page is where everyone starts.
  // Temporary, so browsers don't hold on to it if the root gets a page later. (vercel.json
  // redirects / before it reaches here; this covers the dev server and serve-prod.)
  if (!slug) {
    res.setHeader('Location', `/search${url.search}`);
    return res.status(307).end();
  }

  // Preview → SPA shell (no SSR needed)
  if (slug === 'preview') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);
  }

  // /login — where a refused sign-in or a sign-out lands. See server/login-page.ts.
  if (slug === 'login') {
    const next = safeNext(url.searchParams.get('next'));
    const reason = url.searchParams.has('signed_out') ? 'signed_out' : url.searchParams.get('error');
    res.setHeader('Cache-Control', 'no-store');
    // Already signed in and nothing to explain: carry on to where they were going.
    if (!reason && currentIdentity(req, res)) {
      res.setHeader('Location', next);
      return res.status(302).end();
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderLoginPage({ reason, signInHref: signInPath(next) }));
  }

  // /home was the new search page's preview address; it is /search now.
  if (slug === 'home') {
    res.setHeader('Location', `/search${url.search}`);
    return res.status(308).end();
  }

  // /search — the search page (SearchHome), its own document (home.html), drawn here.
  // Signed-in Optimizely people only: it is the index of every account page.
  if (slug === 'search') {
    // Per person from here on, so never in the shared edge cache. The document itself carries
    // nobody's data (the page fetches it), so the browser may keep it for back/forward.
    if (authEnabled()) res.setHeader('Cache-Control', 'private, no-cache');
    if (authEnabled() && !currentIdentity(req, res)) {
      res.setHeader('Location', signInPath(`${url.pathname}${url.search}`));
      return res.status(302).end();
    }

    const title = 'Optimizely Showcase — Every brand deserves its own story';
    const description =
      'Search 1,000+ AI-generated brand experiences. Mark builds 1:1 landing pages for every company you pitch, grounded in Optimizely Graph.';
    const canonical = `${SITE_URL}/${slug}`;
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
    let html = homeTemplate;
    html = html.replace(/^\s*<title>[^<]*<\/title>\s*$/m, '');
    html = html.replace(/^\s*<meta name="description" content="[^"]*"\s*\/?>\s*$/m, '');
    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.replace('</head>', `    ${headHtml}\n  </head>`);
    // Drawn with a photograph picked per request, so it paints before any script runs;
    // src/home-main.tsx reads the pick off #root and hydrates the same tree.
    const scene = randomScene();
    // Run as an offer (the profile menu's pick, kept in a cookie): its look is drawn here, so it is
    // the first paint. Aldus UI is asked briefly; a slow answer draws the usual page, which takes
    // the offer on itself once it has read the running offers.
    const offer = await shownOfferFor(req.cookies?.[OFFER_COOKIE]);
    const body = renderToString(<SearchHome scene={scene} offer={offer} />);
    const offerAttr = offer ? ` data-offer="${escapeHtml(JSON.stringify(offer))}"` : '';
    // Whether Mark's badge reader is set up, for badges the browser can't read: said here, so the page never asks.
    html = html.replace('<div id="root"></div>', `<div id="root" data-scene="${scene.id}"${offerAttr}${badgeRootAttr()}>${body}</div>`);

    res.setHeader('Content-Type', 'text/html');
    if (!authEnabled()) res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(html);
  }

  /*
   * The page's Graph reads start here, beside the build lookup below rather than after it:
   * they are read-only, and an answer the build makes unnecessary (its view, its redirect) is
   * simply never awaited. Visual Builder experiences (/vb/:slug) are dispatched ahead of
   * `fetchPageContent`, so a request for one never runs that function's person / retail /
   * fin-serv / account reads: no legacy content type is ever registered at a `vb/`-prefixed
   * URL, so every one of those queries was guaranteed to come back empty for this slug shape.
   */
  const authKey = process.env.GRAPH_AUTH_KEY;
  const expSlug = slug.startsWith('vb/') ? slug.slice('vb/'.length) : null;
  const experienceRead = authKey && expSlug ? startRead(fetchExperienceContent(authKey, expSlug)) : null;
  const pageRead = authKey && expSlug === null ? startRead(fetchPageContent(authKey, slug)) : null;

  /*
   * An address Mark is building a page at (api/page-builds). Signed-in people see the
   * build there (BuildView.tsx) until the page is done; everyone else sees what is there.
   * While a build owns the address nothing is cached, for anyone: the edge would hand the
   * "not found" shell it cached for a prospect to the rep. `?view=page` is the page so far,
   * for the build view's preview.
   */
  const build = await buildAt(slug);
  const buildOpen = build && (build.status !== 'done' || Date.now() - (build.finishedAt ?? 0) < BUILD_GRACE_MS);
  if (build?.status === 'done' && build.finalRoute && build.finalRoute !== slug) {
    // Mark put the page somewhere else than the address it was given: send that address there.
    res.setHeader('Location', `/${build.finalRoute}${url.search}`);
    return res.status(302).end();
  }
  if (buildOpen) {
    const setHeader = res.setHeader.bind(res);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader = ((name: string, value: number | string | readonly string[]) =>
      name.toLowerCase() === 'cache-control' ? res : setHeader(name, value)) as typeof res.setHeader;
    if (build.status !== 'done' && url.searchParams.get('view') !== 'page' && currentIdentity(req, res)) {
      return sendBuildView(res, build);
    }
  }

  if (!authKey) {
    console.warn('[ssr] GRAPH_AUTH_KEY not set, serving SPA shell');
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);
  }

  // Visual Builder experiences (/vb/:slug): their read started above, beside the build lookup.
  if (expSlug !== null) {
    try {
      const item = experienceRead ? await experienceRead() : null;

      if (!item) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).send(template);
      }

      const preview = url.searchParams.get('ctx') === 'edit';
      // An ended offer's stand-in, an offer in the www offer design, any other experience from its
      // composition. Mirrors ExperienceBody in VisualBuilderPage.tsx.
      const ended = isEndedOffer(item);
      const appHtml = ended
        ? await renderExperienceRoute(<OfferEndedPage experience={item} />)
        : isOfferExperience(item)
        ? await renderExperienceRoute(<WwwOfferPage experience={item} />)
        : await renderExperienceRoute(
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
        wantsFresh ? 'no-store' : endedCacheControl(item, signupCacheControl(item, 'public, s-maxage=60, stale-while-revalidate=300')),
      );
      if (!wantsFresh && item._metadata?.key) setPageTag(res, item._metadata.key);
      if (item.noIndex !== false) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      // 410 Gone: the offer is over, and the address is kept for the stand-in.
      return res.status(ended ? 410 : 200).send(html);
    } catch (err) {
      console.error('[ssr] vb handler error:', err);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(template);
    }
  }

  try {
    const page = pageRead ? await pageRead() : null;

    if (!page) {
      // Built a moment ago and not in Graph yet: the build view, which reloads into the page.
      if (buildOpen && currentIdentity(req, res)) return sendBuildView(res, build);
      // Unknown slug → SPA shell (client renders NotFound component)
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).send(template);
    }

    // ---- Render React component tree to HTML ----
    // Person, retail and fin-serv pages by their tag; every account page the agent platform
    // template. Mirrors src/App.tsx's renderPageBody.
    let appHtml: string;
    // What the <head> is built from: the page, except on the agent platform template.
    let headSource: typeof page = page;
    switch (page.__template) {
      case 'person':
        // The www design (src/www/PersonPage.tsx). The CMS editor's hooks come from its own
        // preview route (/preview), never from the address, exactly as on account pages.
        appHtml = await renderPageRoute(<WwwPersonPage page={page} />);
        break;
      case 'retail':
        appHtml = await renderPageRoute(<RetailCustomerPage page={page} />);
        break;
      case 'finserv':
        appHtml = await renderPageRoute(<FinServPageServer page={page} />);
        break;
      default:
        // The template the page's own pitch calls for (src/www/account-template.ts). The agent
        // platform template's <head> replaces the stored title and description (N2).
        appHtml = await renderPageRoute(<AccountRoute page={page} search={url.search} />);
        if (accountTemplateOf(page) === 'agent-platform') headSource = agentPlatformHead(page);
    }

    // ---- Build SEO head tags ----
    // No preload of the renderer's lazy chunk: anything that starts the app before the hero image
    // has painted holds that paint back (see the chunk note in vite.config.ts). With the preloads
    // and the chunk change together, mobile LCP went from 3.6 s to 5.9 s (6 Nov 2026).
    const headHtml = buildHeadHtml(headSource);

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
     * persist next to the canonical one. Everything else is kept at
     * the edge for PAGE_CACHE_CONTROL, with the page's tag: every CMS
     * publish or delete of the page purges it (api/cms-published.ts),
     * as does Edit mode's save (api/edit-status.ts). */
    const wantsFresh = url.searchParams.has('refresh');
    res.setHeader('Cache-Control', wantsFresh ? 'no-store' : page._metadata?.key ? PAGE_CACHE_CONTROL : SHORT_CACHE_CONTROL);
    if (!wantsFresh && page._metadata?.key) setPageTag(res, page._metadata.key);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[ssr] handler error:', err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);
  }
}
