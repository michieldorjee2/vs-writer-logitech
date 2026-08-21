import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

// Query _Content (base interface) so we can resolve ANY content type by key —
// pages AND individual blocks. The __typename tells the frontend what it got.
const PREVIEW_QUERY = `
query GetPreviewContent($key: String!, $ver: String, $loc: [Locales]) {
  _Content(
    where: { _metadata: { key: { eq: $key }, version: { eq: $ver } } }
    locale: $loc
  ) {
    items {
      __typename
      _metadata { key version url { default hierarchical } published }
      ... on CompetitorComparisonPage {
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
      ... on HeroSectionBlock { Eyebrow Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
      ... on LogoBarBlock { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } }
      ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } }
      ... on ComparisonTableBlock { OurLabel CompetitorLabel Rows { Category OurValue OurHighlight CompetitorValue CompetitorHighlight } }
      ... on AnalystSectionBlock { SectionHeading { html } Quote AnalystSource CtaText CtaUrl { default } }
      ... on TestimonialBlock { Quote AuthorName AuthorTitle }
      ... on PromoCardBlock { Eyebrow Heading Description CtaText CtaUrl { default } }
      ... on ClosingCtaBlock { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
    }
  }
}
`;

async function queryGraph(authKey: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function queryGraphWithToken(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(GRAPH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { key, ver, loc, preview_token } = req.query;

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  // Prefer preview_token (Bearer auth from CMS live preview) over HMAC key
  const previewToken = typeof preview_token === 'string' ? preview_token : null;
  const singleKey = process.env.GRAPH_SINGLE_KEY || process.env.GRAPH_AUTH_KEY;

  if (!previewToken && !singleKey) {
    return res.status(500).json({ error: 'No auth configured for preview' });
  }

  try {
    const variables: Record<string, unknown> = { key };
    if (ver && typeof ver === 'string') variables.ver = ver;
    if (loc && typeof loc === 'string') variables.loc = [loc];

    // Use Bearer token auth if preview_token is provided, otherwise HMAC key
    const json = previewToken
      ? await queryGraphWithToken(previewToken, PREVIEW_QUERY, variables)
      : await queryGraph(singleKey!, PREVIEW_QUERY, variables);

    const items = (json as any)?.data?._Content?.items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = items[0];

    // Never cache preview content
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(content);
  } catch (err) {
    console.error('[api/preview] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch preview content' });
  }
}
