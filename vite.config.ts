import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2'

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
`

/**
 * Vite plugin that serves Graph content at /api/content?slug=:slug during dev.
 * The auth key stays server-side — never shipped to the browser.
 */
function graphDevProxy(authKey: string): Plugin {
  return {
    name: 'graph-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/content')) return next()
        const url = new URL(req.url, 'http://localhost')
        if (url.pathname !== '/api/content') return next()

        const slug = url.searchParams.get('slug')
        if (!slug) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing slug parameter' }))
          return
        }
        const normalizedSlug = `/${slug}/`

        try {
          const graphRes = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: COMPETITOR_PAGE_QUERY,
              variables: { slug: normalizedSlug },
            }),
          })

          const json: any = await graphRes.json()
          const items = json?.data?.CompetitorComparisonPage?.items

          if (!items || items.length === 0) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Page not found' }))
            return
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(items[0]))
        } catch (err) {
          console.error('[graph-dev-proxy]', err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Graph fetch failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authKey = env.GRAPH_AUTH_KEY || ''

  return {
    plugins: [
      react(),
      ...(authKey ? [graphDevProxy(authKey)] : []),
    ],
    resolve: {
      alias: {
        '@components': path.resolve(__dirname, 'src/components'),
        '@assets': path.resolve(__dirname, 'src/assets'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {}
      }
    },
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-motion': ['framer-motion'],
            'vendor-utils': ['react-use', 'react-use-measure'],
          },
        },
      },
    },
  }
})
