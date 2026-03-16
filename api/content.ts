import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

const PAGE_QUERY = `
query GetPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      PageTitle
      MetaDescription
      CanonicalUrl { default }
      HeroSection {
        ... on HeroSectionBlock {
          Eyebrow Headline { html } Subheadline
          PrimaryCtaText PrimaryCtaUrl { default }
        }
      }
      LogoBar {
        ... on LogoBarBlock {
          Heading
          Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } }
        }
      }
      FeatureSection {
        ... on FeatureSectionBlock {
          Headline { html }
          Features { Title Description { html } }
        }
      }
      ComparisonTable {
        ... on ComparisonTableBlock {
          OurLabel CompetitorLabel
          Rows { Category OurValue { html } OurHighlight CompetitorValue { html } CompetitorHighlight }
        }
      }
      AnalystSection {
        ... on AnalystSectionBlock {
          SectionHeading { html } Quote AnalystSource
          CtaText CtaUrl { default }
        }
      }
      Testimonials { key item { ... on TestimonialBlock { Quote AuthorName AuthorTitle } } }
      FaqSection { key item { __typename _json } }
      PromoCard {
        ... on PromoCardBlock {
          Eyebrow Heading Description
          CtaText CtaUrl { default }
        }
      }
      ClosingCta {
        ... on ClosingCtaBlock {
          Headline { html } Subheadline
          PrimaryCtaText PrimaryCtaUrl { default }
        }
      }
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

  const normalizedSlug = `/${slug}/`;

  try {
    const graphRes = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PAGE_QUERY,
        variables: { slug: normalizedSlug },
      }),
    });

    const json = await graphRes.json();
    const items = (json as any)?.data?.CompetitorComparisonPage?.items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).json(items[0]);
  } catch (err) {
    console.error('[api/content] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch content' });
  }
}
