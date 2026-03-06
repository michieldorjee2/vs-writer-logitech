import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

const COMPETITOR_PAGE_QUERY = `
query GetCompetitorComparisonPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      PageTitle MetaDescription
      CanonicalUrl { default }
      HeroSection {
        Eyebrow Headline { html } Subheadline
        PrimaryCtaText PrimaryCtaUrl { default } BackgroundStyle
      }
      LogoBar { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } }
      FeatureSection { Headline { html } Features { Title Description { html } } }
      ComparisonTable {
        OurLabel CompetitorLabel
        Rows { Category OurValue { html } OurHighlight CompetitorValue { html } CompetitorHighlight }
      }
      AnalystSection { SectionHeading { html } Quote AnalystSource CtaText CtaUrl { default } }
      Testimonials { ... on TestimonialBlock { Quote AuthorName AuthorTitle } }
      FaqSection { key item { ... on AccordionBlock { Heading } } }
      PromoCard { Eyebrow Heading Description CtaText CtaUrl { default } }
      ClosingCta { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } BackgroundStyle }
    }
  }
}
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug;
  const authKey = process.env.GRAPH_AUTH_KEY;

  if (!authKey) {
    return res.status(500).json({ error: 'GRAPH_AUTH_KEY not configured' });
  }

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  // Graph stores hierarchical URLs with leading/trailing slashes
  const normalizedSlug = `/${slug}/`;

  try {
    const graphRes = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: COMPETITOR_PAGE_QUERY,
        variables: { slug: normalizedSlug },
      }),
    });

    const json = await graphRes.json();
    const items = (json as any)?.data?.CompetitorComparisonPage?.items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Cache for 60s, stale-while-revalidate for 5min
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(items[0]);
  } catch (err) {
    console.error('[api/content] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch content' });
  }
}
