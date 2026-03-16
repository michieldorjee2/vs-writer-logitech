import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

const PREVIEW_QUERY = `
query GetPreviewContent($key: String!, $ver: String, $loc: [Locales]) {
  CompetitorComparisonPage(
    where: { _metadata: { key: { eq: $key }, version: { eq: $ver } } }
    locale: $loc
  ) {
    items {
      _metadata { key version url { default hierarchical } published }
      PageTitle MetaDescription
      CanonicalUrl { default }
      HeroSection { ... on HeroSectionBlock { Eyebrow Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } } }
      LogoBar { ... on LogoBarBlock { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } } }
      FeatureSection { ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } } }
      ComparisonTable { ... on ComparisonTableBlock { OurLabel CompetitorLabel Rows { Category OurValue { html } OurHighlight CompetitorValue { html } CompetitorHighlight } } }
      AnalystSection { ... on AnalystSectionBlock { SectionHeading { html } Quote AnalystSource CtaText CtaUrl { default } } }
      Testimonials { key item { ... on TestimonialBlock { Quote AuthorName AuthorTitle } } }
      FaqSection { key item { __typename _json } }
      PromoCard { ... on PromoCardBlock { Eyebrow Heading Description CtaText CtaUrl { default } } }
      ClosingCta { ... on ClosingCtaBlock { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } } }
    }
  }
}
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { key, ver, loc } = req.query;

  // Preview uses the single key (HMAC) which has access to draft content
  const singleKey = process.env.GRAPH_SINGLE_KEY || process.env.GRAPH_AUTH_KEY;

  if (!singleKey) {
    return res.status(500).json({ error: 'GRAPH_SINGLE_KEY not configured' });
  }

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  try {
    const variables: Record<string, unknown> = { key };
    if (ver && typeof ver === 'string') variables.ver = ver;
    if (loc && typeof loc === 'string') variables.loc = [loc];

    const graphRes = await fetch(`${GRAPH_ENDPOINT}?auth=${singleKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: PREVIEW_QUERY, variables }),
    });

    const json = await graphRes.json();
    const items = (json as any)?.data?.CompetitorComparisonPage?.items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Never cache preview content
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(items[0]);
  } catch (err) {
    console.error('[api/preview] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch preview content' });
  }
}
