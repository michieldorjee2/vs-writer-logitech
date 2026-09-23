#!/usr/bin/env node
/**
 * Build the sample Visual Builder page — `/vb/vb-sample`, the Northwind Traders account
 * takeout — from the `abm-takeout` blueprint, and prove it arrived.
 *
 * Run it with tsx, because it imports the blueprint modules straight out of `src/cms`:
 *
 *     npx tsx scripts/create-sample-page.mjs
 *     npx tsx scripts/create-sample-page.mjs --dry-run     # project and report, write nothing
 *
 * IT IS IDEMPOTENT, AND THAT IS NOT A CONVENIENCE. The content key is `md5('vb-sample')`, a
 * value the CMS honours on create, so a second run finds the same page instead of minting a
 * second one; and every node id is `uuidv5(pageKey:slotId:index)`, so re-writing the
 * composition is a MERGE onto the nodes that are already there rather than a replacement of
 * them. `randomUUID()` per node — which the optimizely.com reference implementation uses —
 * would change every id on every run, and with them Visual Builder's editing continuity, any
 * per-node display setting an editor had set, and anything holding a node-level reference.
 *
 * WHAT THIS SCRIPT MEASURED THAT THE CONTRACT DOC DID NOT. Both were found by 400/404, and
 * both are the difference between a page and an error:
 *
 *   1. `PATCH /preview3/experimental/content/{key}/versions/{versionId}` needs `?locale=en`.
 *      Without it the surface answers 404 "Unable to find content item with key … and
 *      version …" for a version that `/v1/content/{key}/versions` lists happily.
 *   2. A composition's element properties are FLAT (`{"StatValue": "38%"}`). Wrapping them
 *      as `{"value": …}` — which is what the /v1 VERSION surface stores and returns, and what
 *      mcp-optimizely-cms's projection sends — is a 400 naming the exact property:
 *      "The requested operation requires an element of type 'String', but the target element
 *      has type 'Object'." Both shapes were sent in one PATCH; the flat node was accepted and
 *      the wrapped one rejected, so this is measured rather than inferred.
 *
 * And one the contract doc DID warn about, confirmed here: the experimental surface 404s
 * intermittently on a key it has just returned (2 of 3 attempts on the first write). Retry on
 * 404 only. A 400 is a shape problem and will never resolve by retrying.
 *
 * VERIFY BY READ-BACK, NEVER BY STATUS CODE. A composition write can be accepted and partly
 * discarded with a 200 — display settings written as siblings of `displayTemplate` instead of
 * nested under `settings` are the measured case. So the script reads the composition back off
 * the CMS, and then reads the whole page back through Graph, and reports per slot what
 * actually arrived.
 */

import { createHash } from 'node:crypto';
import process from 'node:process';
import { readFileSync, existsSync } from 'node:fs';

import { BLUEPRINTS_BY_ID, SLOT_MAP, slotKey } from '../src/cms/blueprints/index.ts';
import { PATHS, req } from '../src/cms/client.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLUEPRINT_ID = 'abm-takeout';
const ROUTE_SEGMENT = 'vb-sample';
const LOCALE = 'en';
const DISPLAY_NAME = 'Northwind Traders';
/** The Showcase site root. Every account page hangs directly off it. */
const SITE_ROOT_CONTAINER = '3fbbcee66f954d089df0f4e62b75ca3c';
const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

/**
 * The namespace every node id is derived under — the same constant
 * `mcp-optimizely-cms/src/services/node-id.ts` uses, so a page written by this script and one
 * written by `create_experience_page` have identical ids for identical slots. Changing it
 * re-keys every node on every page, so it must never change.
 */
const NODE_ID_NAMESPACE = '6f1d4f2e-9c3a-4b57-8a21-0d5e7c9b4f80';
/** Each feed owns a band of 1000 indices, so pruning one feed cannot renumber another. */
const FEED_INDEX_STRIDE = 1000;
/**
 * `compose.ts`'s `sectionNodeFor` gives every feed its own row (one column per item in it),
 * except a `sharedRow` slot's one shared row (one column per feed). Three structural bands,
 * none overlapping each other or the non-negative element-id band
 * (`feedIndex * FEED_INDEX_STRIDE + itemIndex`):
 *
 *   section         -1                              (always exactly one)
 *   own row          -1000 - feedIndex               (one per feed, `sharedRow` slots have none)
 *   shared row       -2                               (`sharedRow` slots only, always exactly one)
 *   column           -3000 - feedIndex*STRIDE - itemIndex   (one per item; a `sharedRow` slot's
 *                                                      one column per feed is itemIndex 0)
 *
 * Stable per feed/item index regardless of which OTHER feeds or items get pruned that run,
 * which is what keeps an id constant across re-runs.
 */
const STRUCTURAL_INDEX = { section: -1, sharedRow: -2 };
function ownRowStructuralIndex(feedIndex) {
  return -1000 - feedIndex;
}
function columnStructuralIndex(feedIndex, itemIndex = 0) {
  return -3000 - feedIndex * FEED_INDEX_STRIDE - itemIndex;
}

/**
 * Two images this page does not own.
 *
 * A real account page gets its screenshot from the crawler and its logo from Brandfetch,
 * keyed on `brandDomain`. Northwind Traders is a sample account with no domain to crawl, so
 * rather than borrow another customer's screenshot — which is what the nearest real page
 * would have offered — these are honest placeholders in the brand's own colours.
 */
const PLACEHOLDER_SHOT = 'https://placehold.co/1280x800/08251a/abff44/png?text=northwindtraders.com';
const PLACEHOLDER_LOGO = 'https://placehold.co/280x96/ffffff/08251a/png?text=NORTHWIND';
const MEETING_URL = 'https://www.optimizely.com/contact-sales/';

// ---------------------------------------------------------------------------
// The copy
// ---------------------------------------------------------------------------

/**
 * The page, as the flat keys the blueprint's feeds name.
 *
 * One entry per `flatKey` in `abm-takeout`'s slots: a single object for a `one` feed, an
 * array of objects for a `many` one. The keys inside each object are CMS PROPERTY names, as
 * `src/cms/components/<folder>/content-type.ts` declares them — `NewsDate` not `Date`,
 * `Description` not `StatDescription`, `ScreenshotUrl` not `challengeScreenshotUrl`.
 *
 * `##phrase##` in a `StackedHeadingElement` marks the run the renderer draws as stacked
 * extruded type. It is the same marker optimizely.com uses and it is parsed, not printed.
 */
const CONTENT = {
  // ---- hero -------------------------------------------------------------
  eyebrow: { Text: 'Prepared for Northwind Traders', HeadingLevel: 'h4' },
  headline: {
    Text: 'Your rewards relaunch is ##waiting on a release train##',
    HeadingLevel: 'h1',
  },
  subheadline: {
    MainBody:
      'Northwind runs three Adobe Experience Manager instances behind one storefront, and ' +
      'every campaign page still ships through the same fortnightly release. The eleven weeks ' +
      'between brief and live page is not a content problem — it is a deployment problem, and ' +
      'it is the reason the loyalty relaunch has slipped twice. Here is what changes when the ' +
      'page stops being code.',
  },
  cta: {
    ButtonText: 'Book the 30-minute teardown',
    ButtonUrl: MEETING_URL,
    Variant: 'primary',
  },

  // ---- signal-pills -----------------------------------------------------
  intelStats: [
    { StatValue: '4.8M', Description: 'monthly visits across northwindtraders.com and the rewards portal' },
    { StatValue: '11 wks', Description: 'median brief-to-live for a campaign page, measured on your own release notes' },
    { StatValue: '3', Description: 'AEM instances behind one storefront after the Brightwood acquisition' },
    { StatValue: 'Mar 2027', Description: 'Adobe Experience Manager renewal — the decision window this page is written for' },
  ],

  // ---- account-intel ----------------------------------------------------
  intelEyebrow: { Text: 'Account intelligence', HeadingLevel: 'h4' },
  intelHeadline: { Text: 'What we found ##before we wrote this##', HeadingLevel: 'h2' },
  techStack: [
    { Name: 'Adobe Experience Manager 6.5', ColorTag: 'darkpink' },
    { Name: 'Adobe Target', ColorTag: 'pink' },
    { Name: 'Salesforce Commerce Cloud', ColorTag: 'ltblue' },
    { Name: 'Segment CDP', ColorTag: 'lime' },
  ],
  newsItems: [
    {
      NewsDate: 'Aug 2026',
      Headline: 'Northwind completes the Brightwood Foods acquisition, adding 140 stores and a third AEM instance',
      Url: 'https://www.northwindtraders.com/newsroom/brightwood-close',
    },
    {
      NewsDate: 'Jun 2026',
      Headline: 'Q2 earnings call: "digital experience velocity" named one of three FY27 operating priorities',
      Url: 'https://www.northwindtraders.com/investors/q2-2026',
    },
    {
      NewsDate: 'Apr 2026',
      Headline: 'Northwind Rewards relaunch slips to FY27 for the second time',
      Url: 'https://www.northwindtraders.com/newsroom/rewards-update',
    },
  ],
  stakeholders: [
    {
      Name: 'Priya Raghunathan',
      Role: 'VP, Digital Experience',
      Initials: 'PR',
      AvatarColor: 'lime',
      EngagementTier: 'engaged',
      EngagementNote:
        'Opened the FY27 platform review in June and asked for a migration cost model by October. Two meetings, both hers.',
      PersonSlug: 'priya-raghunathan',
      CrmContactId: '003Ny00000QpL41IAF',
      LinkedInUrl: 'https://www.linkedin.com/in/example-priya-raghunathan/',
    },
    {
      Name: 'Marcus Feld',
      Role: 'Director of Marketing Technology',
      Initials: 'MF',
      AvatarColor: 'ltblue',
      EngagementTier: 'warm',
      EngagementNote:
        'Owns the release train. Sceptical of another platform migration and right to be — ask him about the 2024 PIM project first.',
      PersonSlug: 'marcus-feld',
      CrmContactId: '003Ny00000QpL42IAF',
      LinkedInUrl: 'https://www.linkedin.com/in/example-marcus-feld/',
    },
    {
      Name: 'Dana Oyelaran',
      Role: 'Head of Loyalty',
      Initials: 'DO',
      AvatarColor: 'midfir',
      EngagementTier: 'cold',
      EngagementNote:
        'Has the budget the rewards relaunch keeps missing. No contact yet; Priya is the introduction.',
      PersonSlug: 'dana-oyelaran',
      CrmContactId: '003Ny00000QpL43IAF',
      LinkedInUrl: 'https://www.linkedin.com/in/example-dana-oyelaran/',
    },
  ],

  // ---- challenge-shot ---------------------------------------------------
  challengeHeadline: {
    Headline: 'The rewards landing page has not changed since the FY25 campaign',
    ScreenshotUrl: PLACEHOLDER_SHOT,
    ScreenshotAlt:
      'The Northwind Rewards landing page: a hero carousel, a static tier table and a sign-up form that posts to a 2024 endpoint.',
    BrowserUrl: 'northwindtraders.com/rewards',
  },

  // ---- comparison-table -------------------------------------------------
  comparisonHeadline: { Text: 'Northwind on Optimizely vs ##Adobe Experience Manager##', HeadingLevel: 'h2' },
  comparisonDescription: {
    MainBody:
      'Scored against the four things your own FY27 platform review asks for. Where AEM can do ' +
      'something but not without a developer, it is marked Limited rather than No — that is the ' +
      'honest answer and it is usually the expensive one.',
  },
  comparisonTableRows: [
    {
      Category: 'Publish a campaign page without a release',
      OurValue: 'Yes',
      OurDetail: 'Visual Builder writes to the live site; no deploy, no release train.',
      CompetitorValue: 'Limited',
      CompetitorDetail: 'Editable templates ship with code. Your fortnightly train is the constraint.',
    },
    {
      Category: 'Experiment on the page you just published',
      OurValue: 'Yes',
      OurDetail: 'Web and feature experimentation on the same content, one audience model.',
      CompetitorValue: 'Limited',
      CompetitorDetail: 'Adobe Target is a separate purchase, a separate tag and a separate audience.',
    },
    {
      Category: 'One content model across three instances',
      OurValue: 'Yes',
      OurDetail: 'Graph federates the three storefronts; Brightwood keeps its own authoring.',
      CompetitorValue: 'No',
      CompetitorDetail: 'Each AEM instance carries its own templates, components and upgrade path.',
    },
    {
      Category: 'Migration without re-authoring every page',
      OurValue: 'Yes',
      OurDetail: 'The importer maps AEM components to blocks; 1,100 of your 1,400 pages map 1:1.',
      CompetitorValue: 'No',
      CompetitorDetail: 'The 6.5 to Cloud Service move is the re-authoring project you already priced.',
    },
    {
      Category: 'Total cost of the next three years',
      OurValue: 'Yes',
      OurDetail: 'One platform contract covering CMS, experimentation and personalisation.',
      CompetitorValue: 'Limited',
      CompetitorDetail: 'AEM Cloud Service plus Target plus the integration work between them.',
    },
  ],

  // ---- proof-wall -------------------------------------------------------
  logoWallCustomerSlot: {
    ImageUrl: PLACEHOLDER_LOGO,
    AltText: 'Northwind Traders',
    Caption: 'Where Northwind would sit on the wall',
  },

  // ---- roi-projection ---------------------------------------------------
  roiTitle: { Text: 'What eleven weeks ##costs you a year##', HeadingLevel: 'h2' },
  roiDescription: {
    MainBody:
      'Modelled on your own numbers: 26 campaign pages a year, the 11-week median from your ' +
      'release notes, and the £4.10 revenue per session the Q2 deck reports. Every figure below ' +
      'is traceable to a source you published.',
  },
  roiProjectionValue: {
    StatValue: '£2.4M',
    Description: 'annual revenue currently sitting in the gap between brief and live page',
  },
  roiCards: [
    {
      Metric: '9',
      Unit: 'weeks saved',
      Label: 'Median brief-to-live falls from 11 weeks to under 2 once the page stops shipping with code.',
      CitationText: 'Optimizely customer benchmark, 2026 CMS cohort (n=140)',
    },
    {
      Metric: '26',
      Unit: 'campaigns / year',
      Label: 'The campaign calendar Northwind already runs, from the FY26 marketing plan.',
      CitationText: 'Northwind Traders FY26 marketing plan, p.12',
    },
    {
      // The currency goes in `Unit`, NOT in `Metric`. `abm-roi-card-element` counts the
      // metric up from zero and strips everything but digits and the decimal point to do it,
      // so an authored "£4.10" animates to a bare "4.10" and the currency silently
      // disappears once the card scrolls into view. Its content type says the same thing —
      // "keep the unit out of the field" — this is what obeying that looks like.
      Metric: '4.10',
      Unit: 'GBP per session',
      Label: 'Revenue per session on the rewards funnel, the number the Q2 call reported.',
      CitationText: 'Northwind Q2 2026 earnings call transcript',
    },
  ],

  // ---- migration-timeline -----------------------------------------------
  migrationTitle: { Text: 'How the move ##actually happens##', HeadingLevel: 'h2' },
  migrationDescription: {
    MainBody:
      'Three phases, and the first one does not touch AEM. Northwind keeps publishing on the ' +
      'current stack until the rewards funnel is live and measured on ours — which is the only ' +
      'way Marcus signs off on it.',
  },
  timelinePhases: [
    {
      Title: 'Weeks 1-4 — the rewards funnel, alongside AEM',
      Description:
        'Nine pages of the rewards funnel are rebuilt in Visual Builder and served on a subdomain. ' +
        'AEM is untouched. The measurement is live from day one.',
      MarkerColor: 'lime',
    },
    {
      Title: 'Weeks 5-10 — the 1,100 pages that map 1:1',
      Description:
        'The importer moves the catalogue and campaign pages. Your authors work in both tools for ' +
        'six weeks; nothing is cut over until they ask for it.',
      MarkerColor: 'ltblue',
    },
    {
      Title: 'Weeks 11-16 — Brightwood and the third instance',
      Description:
        'The acquired estate comes onto the same content model, which is the piece the AEM path ' +
        'never had a plan for.',
      MarkerColor: 'midfir',
    },
  ],

  // ---- analyst-proof ----------------------------------------------------
  analystHeadline: { Text: 'Says who? ##Third parties, mostly##', HeadingLevel: 'h2' },
  analystQuote: {
    Quote:
      'Optimizely is a Leader in the 2026 Gartner Magic Quadrant for Digital Experience Platforms, ' +
      'recognised for completeness of vision in composable content and experimentation.',
    AuthorName: 'Gartner',
    AuthorTitle: 'Magic Quadrant for Digital Experience Platforms, 2026',
  },
  analystCards: [
    { Badge: 'Leader', Source: 'Gartner MQ for DXP', Category: '2026', Url: 'https://www.optimizely.com/analyst-reports/' },
    { Badge: 'Leader', Source: 'Forrester Wave: CMS', Category: 'Q1 2026', Url: 'https://www.optimizely.com/analyst-reports/' },
    { Badge: '#1', Source: 'G2 Grid, Experimentation', Category: 'Winter 2026', Url: 'https://www.g2.com/categories/ab-testing' },
  ],
  analystCTA: {
    ButtonText: 'Read the reports',
    ButtonUrl: 'https://www.optimizely.com/analyst-reports/',
    Variant: 'secondary',
  },

  // ---- customer-stories -------------------------------------------------
  testimonial1: {
    QuoteText:
      'We went from a six-week release cycle for campaign pages to publishing the same afternoon ' +
      'the brief lands. The marketing team stopped filing tickets against my backlog, which is the ' +
      'metric I actually cared about.',
    Attribution: 'Head of Digital Platforms, European grocery retailer',
    CompanyName: 'Grocery retail, 900 stores',
    ResourceType: 'Customer story',
    Duration: '4 min read',
    ResourceUrl: 'https://www.optimizely.com/customers/',
  },
  testimonial2: {
    QuoteText:
      'The migration we were dreading took eleven weeks and none of the re-authoring we had ' +
      'budgeted for. Two thirds of the pages came across untouched.',
    Attribution: 'Marketing Technology Director, North American retail group',
    CompanyName: 'Retail group, 3 brands',
    ResourceType: 'Customer story',
    Duration: '6 min read',
    ResourceUrl: 'https://www.optimizely.com/customers/',
  },

  // ---- friction-points --------------------------------------------------
  painPoints: [
    {
      Title: 'A campaign page needs a developer and a release slot',
      Description:
        'Every rewards page change goes through the fortnightly train, so a seasonal offer is ' +
        'planned around the deploy calendar rather than the season. Your own release notes show ' +
        'nine campaign pages waiting on the same two sprints.',
    },
    {
      Title: 'Three instances, three content models, one storefront',
      Description:
        'Brightwood came with its own AEM instance and its own components. Today a change to the ' +
        'tier table is three changes, and the three drift apart between them.',
    },
    {
      Title: 'Experimentation lives outside the page it tests',
      Description:
        'Target runs on a separate tag with a separate audience model, so a result is argued about ' +
        'before it is acted on. Nothing on the rewards funnel has been tested since January.',
    },
  ],

  // ---- contact-close ----------------------------------------------------
  ctaTitle: {
    Title: 'Thirty minutes, your rewards funnel, no slides',
    Description:
      'We rebuild one page of the Northwind rewards funnel live, on your content, and you keep it ' +
      'whether or not the conversation goes anywhere. Bring Marcus — the release train question is ' +
      'the one worth arguing about.',
    ButtonText: 'Book the teardown',
    ScheduleUrl: MEETING_URL,
  },
  teamMembers: [
    { Initials: 'MD', Name: 'Michiel Dorjee', Role: 'Director, AI Innovation', Email: 'michiel@optimizely.com' },
    { Initials: 'SK', Name: 'Sofia Kallio', Role: 'Enterprise Account Executive, Nordics', Email: 'sofia.kallio@example.com' },
    { Initials: 'TB', Name: 'Tom Byrne', Role: 'Principal Solutions Architect', Email: 'tom.byrne@example.com' },
  ],

  // ---- sticky-cta -------------------------------------------------------
  stickyCTAText: { Text: 'Book the Northwind teardown', Url: MEETING_URL },
};

/** The page-level properties — identity, brand, SEO, provenance. No copy. */
function pageProperties() {
  const componentPlan = {
    rung: 'takeout',
    fit: 'competitor-confirmed',
    blueprint: BLUEPRINT_ID,
    resolvedAt: '2026-09-22T00:00:00.000Z',
    components: BLUEPRINTS_BY_ID[BLUEPRINT_ID].slots.map((slot) => ({
      componentId: slot.slotId,
      include: true,
      variant: 'default',
      why: slot.why || `${slot.displayName} is part of the takeout shape.`,
    })),
  };

  return {
    salesforceAccountID: '0018c00002LmN4qAAF',
    companySlug: 'northwind-traders',
    companyName: 'Northwind Traders',
    brandDomain: 'northwindtraders.com',
    brandAccentColor: '#0E7C66',
    customerLogo: PLACEHOLDER_LOGO,
    competitorName: 'Adobe Experience Manager',
    PageTitle: 'Northwind Traders — Optimizely',
    MetaDescription:
      'Why Northwind Traders publishes a campaign page in eleven weeks, what that costs, and what ' +
      'changes when the page stops shipping with code. Written for the FY27 platform review.',
    noIndex: true,
    componentPlan: JSON.stringify(componentPlan),
    template: BLUEPRINT_ID,
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/create-sample-page.mjs',
  };
}

/**
 * Feed order and render order used to be two different questions asked of one field
 * (`feeds[0]`, which was both "renders first" and "is the slot's primary binding"), and a
 * hardcoded `PAGE_ORDER` table lived here to paper over the five slots where they disagreed —
 * the hero's primary feed is the headline, but its own note says the eyebrow is "the kicker
 * ABOVE the headline". `compose.ts`'s `SlotSpec.feeds` is now authored in true render order
 * (see its `SlotFeed.primary`), so `binding.feeds` already IS page order and no reordering
 * happens here any more. This script only groups each feed's items into that feed's own
 * column, in the order the blueprint declares.
 */

// ---------------------------------------------------------------------------
// Deterministic node ids
// ---------------------------------------------------------------------------

/**
 * RFC 4122 v5 (SHA-1, name-based). Node ships no v5 and this repo has no `uuid` dependency,
 * so it is twenty lines here — the same twenty as `mcp-optimizely-cms/src/services/node-id.ts`,
 * so both produce the same id for the same page, slot and index.
 */
function uuidv5(name, namespace = NODE_ID_NAMESPACE) {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(namespaceBytes).update(Buffer.from(name, 'utf8')).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

function nodeId(pageKey, slotId, index) {
  return uuidv5(`${pageKey}:${slotId}:${index}`);
}

/** One item of one feed. Each feed owns its own band, so pruning one cannot renumber another. */
function elementNodeId(pageKey, slotId, feedIndex, itemIndex) {
  if (itemIndex >= FEED_INDEX_STRIDE) {
    throw new Error(
      `${slotId}: item ${itemIndex} would collide with the next feed's id band ` +
        `(stride ${FEED_INDEX_STRIDE}). A list that long is a modelling problem.`,
    );
  }
  return nodeId(pageKey, slotId, feedIndex * FEED_INDEX_STRIDE + itemIndex);
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function itemsFor(flatKey) {
  const value = CONTENT[flatKey];
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * One item -> one `component` node, wrapped in its own column (`compose.ts`'s
 * `sectionNodeFor` clones one column skeleton per feed; this clones it again per item, since
 * the item count is exactly what the skeleton cannot know).
 */
function itemColumn(columnSkeleton, pageKey, slotId, feedIndex, itemIndex, feed, properties) {
  const column = structuredClone(columnSkeleton);
  column.id = nodeId(pageKey, slotId, columnStructuralIndex(feedIndex, itemIndex));
  column.nodes = [
    {
      nodeType: 'component',
      id: elementNodeId(pageKey, slotId, feedIndex, itemIndex),
      // FLAT properties. Wrapping a scalar as {value: …} is a 400 on this surface —
      // see the header. The /v1 version surface is the one that wants them wrapped.
      component: { contentType: feed.contentType, properties: { ...properties } },
    },
  ];
  return column;
}

/**
 * The blueprint's skeleton plus this page's copy: one row per feed (`ownRowFor`), each row's
 * one column skeleton cloned once per item — or, for a `sharedRow` slot, one shared row with
 * one column per feed (`sharedRowFor`). See `compose.ts`'s `sectionNodeFor` header for why the
 * arranging settings live on a row and never a column.
 *
 * The skeleton is cloned from the blueprint rather than rebuilt, so every display-setting
 * deviation the blueprint author made — the hero's `gradient_galaxy`, the ROI band's
 * `extrusion`, signal-pills' pill-strip grid — survives into the page. A feed that supplies
 * nothing prunes just its own row (its neighbours in the same slot are unaffected); a slot
 * whose feeds ALL supply nothing is left out of the tree entirely, which is how a withheld
 * band is meant to look: absent, not empty.
 */
function project(pageKey) {
  const blueprint = BLUEPRINTS_BY_ID[BLUEPRINT_ID];
  if (!blueprint) throw new Error(`no blueprint '${BLUEPRINT_ID}'`);

  const skeleton = blueprint.composition.nodes ?? [];
  if (skeleton.length !== blueprint.slots.length) {
    throw new Error(
      `${BLUEPRINT_ID}: ${skeleton.length} section node(s) but ${blueprint.slots.length} slot(s) — ` +
        'the projection pairs them by index.',
    );
  }

  const sections = [];
  const filled = [];
  const pruned = [];

  blueprint.slots.forEach((slot, slotIndex) => {
    // SLOT_MAP is the keyed lookup Phase 3 binds on; reading the binding through it here is
    // the cheap way to prove the two agree about this blueprint's slots.
    const binding = SLOT_MAP[slotKey(BLUEPRINT_ID, slot.slotId)];
    if (!binding) throw new Error(`SLOT_MAP has no '${slotKey(BLUEPRINT_ID, slot.slotId)}'`);

    const section = structuredClone(skeleton[slotIndex]);
    section.id = nodeId(pageKey, slot.slotId, STRUCTURAL_INDEX.section);

    const usedKeys = [];
    let resultRows;

    if (binding.sharedRow) {
      const [rowSkeleton] = section.nodes?.filter((n) => n.nodeType === 'row') ?? [];
      const columnSkeletons = rowSkeleton?.nodes?.filter((n) => n.nodeType === 'column') ?? [];
      if (!rowSkeleton || columnSkeletons.length !== binding.feeds.length) {
        throw new Error(
          `${slot.slotId}: sharedRow skeleton has ${columnSkeletons.length} column(s) for ` +
            `${binding.feeds.length} feed(s) — the projection pairs them by index.`,
        );
      }
      const row = structuredClone(rowSkeleton);
      row.id = nodeId(pageKey, slot.slotId, STRUCTURAL_INDEX.sharedRow);
      const columns = [];
      binding.feeds.forEach((feed, feedIndex) => {
        const items = itemsFor(feed.flatKey);
        if (items.length === 0) return;
        usedKeys.push(feed.flatKey);
        // A shared-row feed's column holds ALL its items directly (stacked, if it has more
        // than one) — sharedRow is for seating DIFFERENT feeds side by side, not for one
        // feed's own many-cardinality arrangement, so there is no per-item explosion here.
        const column = structuredClone(columnSkeletons[feedIndex]);
        column.id = nodeId(pageKey, slot.slotId, columnStructuralIndex(feedIndex));
        column.nodes = items.map((properties, itemIndex) => ({
          nodeType: 'component',
          id: elementNodeId(pageKey, slot.slotId, feedIndex, itemIndex),
          component: { contentType: feed.contentType, properties: { ...properties } },
        }));
        columns.push(column);
      });
      row.nodes = columns;
      resultRows = columns.length > 0 ? [row] : [];
    } else {
      const rowSkeletons = section.nodes?.filter((n) => n.nodeType === 'row') ?? [];
      if (rowSkeletons.length !== binding.feeds.length) {
        throw new Error(
          `${slot.slotId}: skeleton has ${rowSkeletons.length} row(s) for ` +
            `${binding.feeds.length} feed(s) — the projection pairs them by index.`,
        );
      }
      // binding.feeds is already in render order (SlotFeed.primary separates "renders first"
      // from "is the primary binding" — see compose.ts), so this needs no reordering: the
      // Nth feed fills the Nth row skeleton.
      resultRows = [];
      binding.feeds.forEach((feed, feedIndex) => {
        const items = itemsFor(feed.flatKey);
        if (items.length === 0) return;
        usedKeys.push(feed.flatKey);

        const rowSkeleton = rowSkeletons[feedIndex];
        const [columnSkeleton] = rowSkeleton.nodes?.filter((n) => n.nodeType === 'column') ?? [];
        if (!columnSkeleton) throw new Error(`${slot.slotId}/${feed.flatKey}: row skeleton has no column`);

        const row = structuredClone(rowSkeleton);
        row.id = nodeId(pageKey, slot.slotId, ownRowStructuralIndex(feedIndex));
        row.nodes = items.map((properties, itemIndex) =>
          itemColumn(columnSkeleton, pageKey, slot.slotId, feedIndex, itemIndex, feed, properties),
        );
        resultRows.push(row);
      });
    }

    if (resultRows.length === 0) {
      pruned.push({
        slot: slot.slotId,
        why: `none of ${binding.flatKeys.join(', ')} was supplied`,
      });
      return;
    }

    section.nodes = resultRows;
    sections.push(section);
    const elements = resultRows.flatMap((row) => row.nodes.flatMap((column) => column.nodes ?? []));
    filled.push({
      slot: slot.slotId,
      displayName: slot.displayName,
      flatKeys: usedKeys,
      nodes: elements.length,
      byContentType: countBy(elements.map((e) => e.component.contentType)),
    });
  });

  return {
    composition: { ...structuredClone(blueprint.composition), nodes: sections },
    filled,
    pruned,
  };
}

function countBy(values) {
  const out = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

/** Element nodes per content type, anywhere in a tree. The read-back comparison runs on it. */
function summarize(node, into = { sections: 0, elements: 0, byContentType: {}, settings: 0 }) {
  if (!node) return into;
  if (node.nodeType === 'section') into.sections += 1;
  if (node.nodeType === 'component') {
    into.elements += 1;
    const type = node.component?.contentType ?? '(none)';
    into.byContentType[type] = (into.byContentType[type] ?? 0) + 1;
  }
  const settings = node.displaySettings?.settings;
  if (settings) into.settings += Object.keys(settings).length;
  for (const child of node.nodes ?? []) summarize(child, into);
  return into;
}

// ---------------------------------------------------------------------------
// CMS calls
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `?locale=en` is REQUIRED on the experimental version surface, and the surface 404s
 * intermittently on a version it has just minted. Retry on 404 only: a 400 is a shape problem
 * and no amount of waiting fixes it.
 */
function versionPath(key, versionId) {
  return `${PATHS.contentVersion(key, versionId)}?locale=${LOCALE}`;
}

async function withRetryOn404(label, call, attempts = 8) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await call();
    if (last.status !== 404) return last;
    if (attempt < attempts) await sleep(1500);
  }
  console.error(`  ${label}: still 404 after ${attempts} attempts`);
  return last;
}

async function ensureContentItem(key) {
  const existing = await req(`/preview3/experimental/content/${key}`);
  if (existing.ok) return { action: 'found' };
  if (existing.status !== 404) {
    throw new Error(`GET content ${key} -> ${existing.status} ${JSON.stringify(existing.body)}`);
  }

  const created = await req('/preview3/experimental/content', {
    method: 'POST',
    body: {
      key,
      contentType: 'ABMExperience',
      displayName: DISPLAY_NAME,
      locale: LOCALE,
      // Always a draft: a published experience with no composition is a live blank page.
      status: 'draft',
      container: SITE_ROOT_CONTAINER,
      routeSegment: ROUTE_SEGMENT,
      properties: pageProperties(),
    },
  });
  if (!created.ok) {
    throw new Error(`POST content -> ${created.status} ${JSON.stringify(created.body)}`);
  }
  return { action: 'created', version: created.body?.version };
}

/**
 * A draft version to write into.
 *
 * A published version cannot be edited, so a re-run forks a new one. The fork carries the
 * page-level properties (wrapped as `{value: …}` — the /v1 version surface's own shape, and
 * the opposite of the composition surface's) so identity and provenance are refreshed in the
 * same call.
 */
async function listDraftVersion(key) {
  const listed = await req(`/v1/content/${key}/versions?locales=${LOCALE}`);
  if (!listed.ok) throw new Error(`list versions -> ${listed.status}`);
  const items = listed.body?.items ?? [];
  return items.find((v) => (v.status ?? '').toLowerCase() === 'draft');
}

async function ensureDraftVersion(key) {
  const draft = await listDraftVersion(key);

  const wrapped = Object.fromEntries(
    Object.entries(pageProperties()).map(([k, v]) => [k, { value: v }]),
  );

  if (draft) {
    const versionId = draft.version ?? draft._metadata?.version;
    const patched = await req(`/v1/content/${key}/versions/${versionId}`, {
      method: 'PATCH',
      mergePatch: true,
      body: { displayName: DISPLAY_NAME, routeSegment: ROUTE_SEGMENT, properties: wrapped },
    });
    if (!patched.ok) {
      throw new Error(`PATCH version ${versionId} -> ${patched.status} ${JSON.stringify(patched.body)}`);
    }
    return { versionId, action: 'reused-draft' };
  }

  const created = await req(`/v1/content/${key}/versions`, {
    method: 'POST',
    body: {
      displayName: DISPLAY_NAME,
      locale: LOCALE,
      routeSegment: ROUTE_SEGMENT,
      properties: wrapped,
    },
  });
  if (!created.ok) {
    throw new Error(`POST version -> ${created.status} ${JSON.stringify(created.body)}`);
  }
  // A 201 from this endpoint can carry no body at all — the version id is in the `Location`
  // header, which `client.req()` does not surface. Rather than reach around the client, list
  // the versions again and take the draft it just minted. One extra GET, no second client.
  const versionId =
    created.body?.version ??
    created.body?._metadata?.version ??
    (await listDraftVersion(key))?.version;
  if (!versionId) throw new Error('created a version but could not read its id');
  return { versionId, action: 'forked' };
}

async function writeComposition(key, versionId, composition) {
  const written = await withRetryOn404('composition PATCH', () =>
    req(versionPath(key, versionId), { method: 'PATCH', mergePatch: true, body: { composition } }),
  );
  if (!written.ok) {
    throw new Error(
      `PATCH composition -> ${written.status} ${JSON.stringify(written.body).slice(0, 1200)}`,
    );
  }
  return written.body?.composition;
}

async function readComposition(key, versionId) {
  const read = await withRetryOn404('composition GET', () => req(versionPath(key, versionId)));
  return read.ok ? read.body?.composition : undefined;
}

async function publish(key, versionId) {
  const published = await req(`/v1/content/${key}/versions/${versionId}:publish`, {
    method: 'POST',
    body: {},
  });
  if (!published.ok) {
    throw new Error(`publish -> ${published.status} ${JSON.stringify(published.body)}`);
  }
}

/**
 * Publishing re-derives the slug from the display name, which silently moves the URL. Re-pin
 * it, and only when it actually drifted — a needless PATCH forks nothing but does bump
 * `lastModified` on a page an editor may be looking at.
 */
async function repinRouteSegment(key) {
  const current = await req(`/v1/content/${key}`);
  const listed = await req(`/v1/content/${key}/versions?locales=${LOCALE}`);
  const latest = listed.body?.items?.[0];
  if (!current.ok || latest?.routeSegment === ROUTE_SEGMENT) return false;

  const patched = await req(`/preview3/experimental/content/${key}`, {
    method: 'PATCH',
    mergePatch: true,
    body: { routeSegment: ROUTE_SEGMENT },
  });
  return patched.ok;
}

// ---------------------------------------------------------------------------
// Graph read-back
// ---------------------------------------------------------------------------

function graphKey() {
  if (process.env.GRAPH_AUTH_KEY) return process.env.GRAPH_AUTH_KEY;
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = /^GRAPH_AUTH_KEY=(.*)$/.exec(line.trim());
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    }
  }
  throw new Error('GRAPH_AUTH_KEY is not set and .env.local does not carry it.');
}

/**
 * Read the published page back the way the site reads it — the shipped query, through Graph,
 * not the CMA. A composition that is correct on the write surface and absent from Graph is a
 * page that does not render, and only this check can tell the two apart.
 *
 * IT POLLS FOR THE EXPECTED SHAPE, NOT FOR ANY SHAPE. Graph lags a publish by tens of
 * seconds, and the first run of this script proved why the distinction matters: it answered
 * immediately with the PREVIOUS composition — one probe section, two nodes — and a check
 * that only asked "are there any nodes?" reported a 2-of-59 page as the answer. So the poll
 * waits until the section and element counts match what was written, and says UNVERIFIED
 * rather than wrong if they never do.
 */
async function readThroughGraph(query, expected, attempts = 24) {
  const key = graphKey();
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(`${GRAPH_ENDPOINT}?auth=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { slug: `/${ROUTE_SEGMENT}/` } }),
    });
    const json = await res.json();
    if (json?.errors?.length) {
      throw new Error(`Graph: ${json.errors.map((e) => e.message).join(' | ')}`);
    }
    const item = json?.data?.ABMExperience?.items?.[0];
    if (item) {
      last = item;
      const report = graphSlotReport(item);
      const elements = report.reduce((total, row) => total + row.elements, 0);
      if (report.length === expected.sections && elements === expected.elements) return item;
    }
    if (attempt < attempts) await sleep(5000);
  }
  return last;
}

/** Graph's read shape: section -> rows -> columns -> elements, each aliased by the query. */
function graphSlotReport(item) {
  const rows = [];
  for (const node of item?.composition?.nodes ?? []) {
    const elements = (node.rows ?? []).flatMap((row) =>
      (row.columns ?? []).flatMap((column) => column.elements ?? []),
    );
    rows.push({
      displayName: node.displayName,
      section: node.section?.__typename ?? '(none)',
      elements: elements.length,
      byContentType: countBy(elements.map((e) => e.component?.__typename ?? '(none)')),
      empty: elements.filter((e) => {
        const component = e.component ?? {};
        return !Object.entries(component).some(
          ([k, v]) => k !== '__typename' && v !== null && v !== undefined && v !== '',
        );
      }).length,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const pageKey = createHash('md5').update(ROUTE_SEGMENT).digest('hex');

  console.log(`blueprint   ${BLUEPRINT_ID}`);
  console.log(`page key    ${pageKey}   (md5 of the route segment, so a re-run finds this page)`);
  console.log(`route       /${ROUTE_SEGMENT}/  ->  /vb/${ROUTE_SEGMENT}\n`);

  const { composition, filled, pruned } = project(pageKey);
  const sent = summarize(composition);
  console.log(`projected   ${sent.sections} section(s), ${sent.elements} element node(s)`);
  for (const slot of filled) {
    console.log(
      `  fill   ${slot.slot.padEnd(19)} ${String(slot.nodes).padStart(2)} node(s)  ` +
        Object.entries(slot.byContentType)
          .map(([type, n]) => `${type}×${n}`)
          .join(' '),
    );
  }
  for (const slot of pruned) console.log(`  prune  ${slot.slot.padEnd(19)} ${slot.why}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing was written.');
    return;
  }

  console.log('');
  const item = await ensureContentItem(pageKey);
  console.log(`content     ${item.action}`);
  const version = await ensureDraftVersion(pageKey);
  console.log(`version     ${version.versionId} (${version.action})`);

  const echoed = await writeComposition(pageKey, version.versionId, composition);
  const readBack = echoed ?? (await readComposition(pageKey, version.versionId));
  const got = summarize(readBack);

  const differences = [];
  if (got.sections !== sent.sections) {
    differences.push(`sections: sent ${sent.sections}, read back ${got.sections}`);
  }
  if (got.elements !== sent.elements) {
    differences.push(`elements: sent ${sent.elements}, read back ${got.elements}`);
  }
  for (const [type, count] of Object.entries(sent.byContentType)) {
    const back = got.byContentType[type] ?? 0;
    if (back !== count) differences.push(`${type}: sent ${count}, read back ${back}`);
  }
  if (got.settings < sent.settings) {
    // The measured signature of settings written as siblings of `displayTemplate` instead of
    // nested under `settings`: accepted with a 200, discarded without a word.
    differences.push(`display settings: sent ${sent.settings} nested, read back ${got.settings}`);
  }

  if (differences.length > 0) {
    console.error('\nCMA read-back MISMATCH — nothing was published:');
    for (const line of differences) console.error(`  ${line}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `cma verify  ok — ${got.sections} sections, ${got.elements} elements, ` +
      `${got.settings} nested display settings`,
  );

  await publish(pageKey, version.versionId);
  const repinned = await repinRouteSegment(pageKey);
  console.log(`published   yes${repinned ? ' (routeSegment re-pinned)' : ''}`);

  const { ABM_EXPERIENCE_QUERY } = await import('../src/lib/experience-queries.ts');
  const graphItem = await readThroughGraph(ABM_EXPERIENCE_QUERY, sent);
  if (!graphItem) {
    console.error('\nGraph read-back: the page did not appear with a composition. UNVERIFIED.');
    process.exitCode = 1;
    return;
  }

  console.log('\ngraph read-back');
  const report = graphSlotReport(graphItem);
  for (const row of report) {
    const flag = row.elements === 0 ? 'EMPTY' : row.empty > 0 ? `${row.empty} blank` : 'ok';
    console.log(
      `  ${String(row.displayName).padEnd(22)} ${String(row.elements).padStart(2)} element(s)  ` +
        `${row.section.padEnd(12)} ${flag}`,
    );
  }

  const graphElements = report.reduce((total, row) => total + row.elements, 0);
  const pageLevel = ['companyName', 'companySlug', 'competitorName', 'PageTitle', 'componentPlan'];
  const missingPageLevel = pageLevel.filter((k) => !graphItem[k]);

  console.log('');
  console.log(`  sections   ${report.length} / ${sent.sections}`);
  console.log(`  elements   ${graphElements} / ${sent.elements}`);
  console.log(
    `  page props ${missingPageLevel.length === 0 ? 'all present' : `MISSING ${missingPageLevel.join(', ')}`}`,
  );
  console.log(`\n  http://localhost:5199/vb/${ROUTE_SEGMENT}`);

  if (graphElements !== sent.elements || report.length !== sent.sections || missingPageLevel.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
