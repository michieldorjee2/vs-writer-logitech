import type { VercelRequest, VercelResponse } from '@vercel/node';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { fetchPageContent } from './_lib/fetch-content';
import { buildHeadHtml } from '../src/lib/build-head-html';
import DynamicComparisonPageServer from '../src/components/DynamicComparisonPage.server';
import { HTML_TEMPLATE } from './_lib/html-template';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const slug = url.pathname.replace(/^\/|\/$/g, '');

  // Skip SSR for non-page routes
  if (!slug || slug === 'preview') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(HTML_TEMPLATE);
  }

  const authKey = process.env.GRAPH_AUTH_KEY;
  if (!authKey) {
    // Fall back to SPA shell
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(HTML_TEMPLATE);
  }

  try {
    const page = await fetchPageContent(authKey, slug);

    if (!page) {
      // Page not found — serve SPA shell so client renders the NotFound component
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).send(HTML_TEMPLATE);
    }

    // Render the page component to HTML
    const appHtml = renderToString(
      React.createElement(DynamicComparisonPageServer, { page })
    );

    // Build head meta tags
    const headHtml = buildHeadHtml(page);

    // Inject SSR data for client hydration
    const ssrDataScript = `<script>window.__SSR_DATA__=${JSON.stringify(page).replace(/</g, '\\u003c')}</script>`;

    let html = HTML_TEMPLATE;

    // Replace title and meta description with page-specific values
    html = html.replace(
      /<title>[^<]*<\/title>/,
      '' // Remove — headHtml includes the title
    );
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      '' // Remove — headHtml includes meta description
    );

    // Inject head meta before closing </head>
    html = html.replace('</head>', `    ${headHtml}\n  </head>`);

    // Inject SSR data script before the module script
    html = html.replace(
      '<script type="module"',
      `${ssrDataScript}\n    <script type="module"`
    );

    // Inject rendered HTML into the root div
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[api/ssr] SSR failed:', err);
    // Fall back to SPA shell
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(HTML_TEMPLATE);
  }
}
