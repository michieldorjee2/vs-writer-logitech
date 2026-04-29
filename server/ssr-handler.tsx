import type { VercelRequest, VercelResponse } from '@vercel/node';
import { renderToString } from 'react-dom/server';
import DynamicComparisonPageServer from '../src/components/DynamicComparisonPage.server';
import ABMHyperPageServer from '../src/components/ABMHyperPage.server';

// ---------------------------------------------------------------------------
// Content Graph – fetch page data
// ---------------------------------------------------------------------------

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2';

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
    // Detect ABM template
    const isABM = !!(page.intelEyebrow || page.customerLogo);

    const appHtml = isABM
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
