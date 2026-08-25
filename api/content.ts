import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isFinServDemoSlug, synthFinServPageFromDemo } from '../src/lib/finserv-demo-content.js';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

// FinServPage (Brightstream). The content type + instances exist in the
// showcase CMS; until Optimizely Graph finishes propagating the schema, a query
// against the not-yet-synced type returns { errors, data:null } (HTTP 200), so
// the items check below simply skips and we fall back to demo synthesis. Fields
// mirror the registered FinServPage type exactly.
const FINSERV_PAGE_QUERY = `
query GetFinServPage($slug: String!) {
  FinServPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
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
    }
  }
}
`;

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

const RETAIL_PAGE_QUERY = `
query GetRetailPage($slug: String!) {
  RetailCustomerPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
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
    }
  }
}
`;

const PAGE_QUERY = `
query GetPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      PageTitle MetaDescription CanonicalUrl { default }
      eyebrow headline subheadline cta link { default }
      comparisonHeadline
      comparisonTableRows { Category OurValue OurHighlight CompetitorValue CompetitorHighlight }
      analystHeadline analystQuote analystSource analystCTA analystCTALink { default }
      promoEyebrow promoHeading promoDescription promoCTA promoCTALink { default }
      endHeadline endSubheadline endCTA endCTALink { default }
      testimonial1 testimonial1JobTitle testimonial1Company
      testimonial2 testimonial2JobTitle testimonial2Company
      FeatureSection { ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } } }
      FaqSection { __typename _json }
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
      timelinePhases { Weeks Title Description MarkerColor }
      teamMembers { Initials Name Role Email }
      footerLinks { Text Url { default } }
      analystCards { Badge Source Category Url { default } }
    }
  }
}
`;

/**
 * Recover fields the agent wrote in propertiesJson but the registered
 * content type doesn't expose as typed fields (descriptor, imageDirection,
 * privateProvenance, customerDisplayName). Same logic as ssr-handler.tsx.
 */
function mergeRetailJson(page: any): any {
  const raw = page?._json;
  if (!raw || typeof raw !== 'object') return page;
  const merge = (block: any, src: any) =>
    src && typeof src === 'object' ? { ...src, ...(block || {}) } : block;
  if (raw.customerDisplayName && !page.customerDisplayName) page.customerDisplayName = raw.customerDisplayName;
  if (page.hero || raw.hero) page.hero = merge(page.hero, raw.hero);
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
  return res.json();
}

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug;
  const authKey = process.env.GRAPH_AUTH_KEY;

  if (!authKey) {
    return res.status(500).json({ error: 'GRAPH_AUTH_KEY not configured' });
  }

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  const normalizedSlug = `/${slug}/`;

  try {
    // Retail dispatch: try RetailCustomerPage first on every request (CMS
    // rejects '/' in route segments, so retail pages live at flat slugs).
    const retailTries = [normalizedSlug];
    if (!slug.startsWith('en/')) retailTries.push(`/en/${slug}/`);
    if (slug.startsWith('retail/')) {
      const stripped = slug.replace(/^retail\//, '');
      retailTries.push(`/${stripped}/`);
      retailTries.push(`/en/${stripped}/`);
    }
    // PersonPage dispatch. Person pages are the only nested route
    // (/{company}/{person}), so a two-segment slug can only be one of these —
    // try it first and skip the flat-type queries entirely when it hits.
    const personTries = [normalizedSlug];
    if (!slug.startsWith('en/')) personTries.push(`/en/${slug}/`);
    for (const s of personTries) {
      const pJson = await queryGraph(authKey, PERSON_PAGE_QUERY, { slug: s });
      const items = (pJson as any)?.data?.PersonPage?.items;
      if (items && items.length > 0) {
        const shot = await fetchParentShot(authKey, items[0]?.companySlug);
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json({ ...items[0], ...shot, __template: 'person' });
      }
    }

    for (const s of retailTries) {
      const json = await queryGraph(authKey, RETAIL_PAGE_QUERY, { slug: s });
      const items = (json as any)?.data?.RetailCustomerPage?.items;
      if (items && items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json(mergeRetailJson({ ...items[0], __template: 'retail' }));
      }
    }

    // FinServ dispatch: try Graph (no-op if the type isn't registered), then
    // synthesize from demo content for known FS slugs.
    const finservTries = [normalizedSlug];
    if (!slug.startsWith('en/')) finservTries.push(`/en/${slug}/`);
    for (const s of finservTries) {
      const fsJson = await queryGraph(authKey, FINSERV_PAGE_QUERY, { slug: s });
      const items = (fsJson as any)?.data?.FinServPage?.items;
      if (items && items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json({ ...items[0], __template: 'finserv' });
      }
    }
    if (isFinServDemoSlug(slug)) {
      const synth = synthFinServPageFromDemo(slug);
      if (synth) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json({ ...synth, __template: 'finserv' });
      }
    }

    let json = await queryGraph(authKey, PAGE_QUERY, { slug: normalizedSlug });
    let items = (json as any)?.data?.CompetitorComparisonPage?.items;

    // Fallback: try with /en/ prefix (Graph stores locale-prefixed URLs)
    if ((!items || items.length === 0) && !slug.startsWith('en/')) {
      const enSlug = `/en/${slug}/`;
      json = await queryGraph(authKey, PAGE_QUERY, { slug: enSlug });
      items = (json as any)?.data?.CompetitorComparisonPage?.items;
    }

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = items[0];

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).json(page);
  } catch (err) {
    console.error('[api/content] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch content' });
  }
}
