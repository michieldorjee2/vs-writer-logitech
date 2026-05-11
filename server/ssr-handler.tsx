import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderToString } from 'react-dom/server';
import DynamicComparisonPageServer from '../src/components/DynamicComparisonPage.server';
import ABMHyperPageServer from '../src/components/ABMHyperPage.server';
import RetailCustomerPageServer from '../src/components/RetailCustomerPage.server';

// ---------------------------------------------------------------------------
// Content Graph – fetch page data
// ---------------------------------------------------------------------------

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

// Query matches the registered RetailCustomerPage schema in Optimizely Graph.
// Fields the CMS doesn't yet expose (descriptor on items, imageDirection on
// every block, privateProvenance, customerDisplayName) are excluded here —
// the agent writes them in propertiesJson but they're dropped server-side.
// `_json` captures the raw write blob so we can recover descriptors / image
// directions client-side until those fields are added to the content type.
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
      customerSlug register monthStamp
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
  return res.json();
}

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
  for (const s of retailTries) {
    const json = await queryGraph(authKey, RETAIL_PAGE_QUERY, { slug: s });
    const items = (json as any)?.data?.RetailCustomerPage?.items;
    if (items && items.length > 0) {
      return mergeRetailJson({ ...items[0], __template: 'retail' as const });
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
    const isRetail = (page as any).__template === 'retail' || page.template === 'retail';
    const isABM = !isRetail && !!(page.intelEyebrow || page.customerLogo);

    const appHtml = isRetail
      ? renderToString(<RetailCustomerPageServer page={page} />)
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
