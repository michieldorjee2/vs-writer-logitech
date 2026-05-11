import type { VercelRequest, VercelResponse } from '@vercel/node';

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

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
      stakeholders { Initials Name Role LinkedInUrl { default } AvatarColor }
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
    for (const s of retailTries) {
      const json = await queryGraph(authKey, RETAIL_PAGE_QUERY, { slug: s });
      const items = (json as any)?.data?.RetailCustomerPage?.items;
      if (items && items.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        return res.status(200).json(mergeRetailJson({ ...items[0], __template: 'retail' }));
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
