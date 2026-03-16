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
        PageTitle MetaDescription
        CanonicalUrl { default }
        HeroSection { ... on HeroSectionBlock { Eyebrow Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } } }
        LogoBar { ... on LogoBarBlock { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } } }
        FeatureSection { ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } } }
        ComparisonTable { ... on ComparisonTableBlock { OurLabel CompetitorLabel Rows { Category OurValue { html } OurHighlight CompetitorValue { html } CompetitorHighlight } } }
        AnalystSection { ... on AnalystSectionBlock { SectionHeading { html } Quote AnalystSource CtaText CtaUrl { default } } }
        Testimonials { key }
        FaqSection { key item { __typename _json } }
        PromoCard { ... on PromoCardBlock { Eyebrow Heading Description CtaText CtaUrl { default } } }
        ClosingCta { ... on ClosingCtaBlock { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } } }
      }
      ... on HeroSectionBlock { Eyebrow Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
      ... on LogoBarBlock { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } }
      ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } }
      ... on ComparisonTableBlock { OurLabel CompetitorLabel Rows { Category OurValue { html } OurHighlight CompetitorValue { html } CompetitorHighlight } }
      ... on AnalystSectionBlock { SectionHeading { html } Quote AnalystSource CtaText CtaUrl { default } }
      ... on TestimonialBlock { Quote AuthorName AuthorTitle }
      ... on PromoCardBlock { Eyebrow Heading Description CtaText CtaUrl { default } }
      ... on ClosingCtaBlock { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
    }
  }
}
`;

const TESTIMONIALS_QUERY = `
query GetTestimonials($keys: [String!]) {
  TestimonialBlock(where: { _metadata: { key: { in: $keys } } }) {
    items { _metadata { key } Quote AuthorName AuthorTitle }
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

/** Resolve testimonial content references by fetching their actual data */
async function resolveTestimonials(authKey: string, refs: Array<{ key: string }>) {
  if (!refs?.length) return [];
  const keys = refs.map((r) => r.key);
  const json = await queryGraph(authKey, TESTIMONIALS_QUERY, { keys });
  const items = (json as any)?.data?.TestimonialBlock?.items ?? [];
  const byKey = new Map(items.map((t: any) => [t._metadata.key, t]));
  return refs.map((ref) => {
    const t = byKey.get(ref.key) as any;
    return {
      key: ref.key,
      item: t ? { Quote: t.Quote, AuthorName: t.AuthorName, AuthorTitle: t.AuthorTitle } : null,
    };
  });
}

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

    const json = await queryGraph(singleKey, PREVIEW_QUERY, variables);
    const items = (json as any)?.data?._Content?.items;

    if (!items || items.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = items[0];

    // Resolve testimonial content references for page-level preview
    if (content.__typename === 'CompetitorComparisonPage' && content.Testimonials?.length) {
      content.Testimonials = await resolveTestimonials(singleKey, content.Testimonials);
    }

    // Never cache preview content
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(content);
  } catch (err) {
    console.error('[api/preview] Graph fetch failed:', err);
    return res.status(500).json({ error: 'Failed to fetch preview content' });
  }
}
