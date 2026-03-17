import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { renderToString } from 'react-dom/server';
import DynamicComparisonPageServer from '../src/components/DynamicComparisonPage.server';

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

async function fetchPageContent(authKey: string, slug: string) {
  const normalizedSlug = `/${slug}/`;
  const json = await queryGraph(authKey, PAGE_QUERY, { slug: normalizedSlug });
  const items = (json as any)?.data?.CompetitorComparisonPage?.items;
  if (!items || items.length === 0) return null;
  const page = items[0];
  if (page.Testimonials?.length) {
    page.Testimonials = await resolveTestimonials(authKey, page.Testimonials);
  }
  return page;
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

  const faqJson = page.FaqSection?.item?._json as any;
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
  }

  const resolved = (page.Testimonials ?? []).filter(
    (t: any) => t.item?.Quote && t.item?.AuthorName,
  );
  if (resolved.length > 0) {
    const reviewLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: page.ComparisonTable?.OurLabel ?? 'Optimizely',
      review: resolved.map((t: any) => ({
        '@type': 'Review',
        reviewBody: t.item.Quote,
        author: {
          '@type': 'Person',
          name: t.item.AuthorName,
          ...(t.item.AuthorTitle ? { jobTitle: t.item.AuthorTitle } : {}),
        },
      })),
    };
    parts.push(`<script type="application/ld+json">${JSON.stringify(reviewLd)}</script>`);
  }

  return parts.join('\n    ');
}

// ---------------------------------------------------------------------------
// HTML template – read built dist/index.html at cold-start
// ---------------------------------------------------------------------------

let _htmlTemplate: string | null = null;

function getHtmlTemplate(): string {
  if (_htmlTemplate) return _htmlTemplate;
  try {
    _htmlTemplate = readFileSync(join(process.cwd(), 'dist/index.html'), 'utf-8');
  } catch {
    _htmlTemplate =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>';
  }
  return _htmlTemplate;
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const slug = url.pathname.replace(/^\/|\/$/g, '');
  const htmlTemplate = getHtmlTemplate();

  // Home + preview → SPA shell (no SSR needed)
  if (!slug || slug === 'preview') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlTemplate);
  }

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    console.warn('[ssr] GRAPH_AUTH_KEY not set, serving SPA shell');
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlTemplate);
  }

  try {
    const page = await fetchPageContent(authKey, slug);

    if (!page) {
      // Unknown slug → SPA shell (client renders NotFound component)
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).send(htmlTemplate);
    }

    // ---- Render React component tree to HTML ----
    const appHtml = renderToString(<DynamicComparisonPageServer page={page} />);

    // ---- Build SEO head tags ----
    const headHtml = buildHeadHtml(page);

    // ---- Embed page data for client hydration (avoids double-fetch) ----
    const ssrDataScript = `<script>window.__SSR_DATA__=${JSON.stringify(page).replace(/</g, '\\u003c')}</script>`;

    // ---- Assemble final HTML ----
    let html = htmlTemplate;

    // Replace default title/description with page-specific ones
    html = html.replace(/<title>[^<]*<\/title>/, '');
    html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, '');

    // Inject SEO head tags before </head>
    html = html.replace('</head>', `    ${headHtml}\n  </head>`);

    // Inject server-rendered markup into <div id="root">
    html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

    // Inject SSR data script before the Vite module entry
    html = html.replace('<script type="module"', `${ssrDataScript}\n    <script type="module"`);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[ssr] handler error:', err);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlTemplate);
  }
}
