import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2'

const PAGE_QUERY = `
query GetPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
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
  }
}
`

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
`

/** Helper to send a JSON response in Vite middleware */
function jsonResponse(res: any, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

const TESTIMONIALS_QUERY = `
query GetTestimonials($keys: [String!]) {
  TestimonialBlock(where: { _metadata: { key: { in: $keys } } }) {
    items { _metadata { key } Quote AuthorName AuthorTitle }
  }
}
`

/** Run a Graph query and return the raw JSON response */
async function fetchGraph(authKey: string, query: string, variables: Record<string, unknown>) {
  const graphRes = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return graphRes.json() as any
}

/** Run a Graph query and return the first item from the given root field, or null */
async function queryGraph(authKey: string, query: string, variables: Record<string, unknown>, rootField: string) {
  const json = await fetchGraph(authKey, query, variables)
  return json?.data?.[rootField]?.items?.[0] ?? null
}

/** Resolve testimonial content references by fetching their actual data */
async function resolveTestimonials(authKey: string, refs: Array<{ key: string }>) {
  if (!refs?.length) return []
  const keys = refs.map((r: any) => r.key)
  const json = await fetchGraph(authKey, TESTIMONIALS_QUERY, { keys })
  const items = json?.data?.TestimonialBlock?.items ?? []
  const byKey = new Map(items.map((t: any) => [t._metadata.key, t]))
  return refs.map((ref: any) => {
    const t = byKey.get(ref.key) as any
    return {
      key: ref.key,
      item: t ? { Quote: t.Quote, AuthorName: t.AuthorName, AuthorTitle: t.AuthorTitle } : null,
    }
  })
}

/**
 * Vite plugin that proxies /api/content and /api/preview during dev.
 * Auth keys stay server-side — never shipped to the browser.
 */
function graphDevProxy(authKey: string, singleKey: string): Plugin {
  return {
    name: 'graph-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost')

        if (url.pathname === '/api/content') {
          const slug = url.searchParams.get('slug')
          if (!slug) return jsonResponse(res, 400, { error: 'Missing slug parameter' })

          try {
            const item = await queryGraph(authKey, PAGE_QUERY, { slug: `/${slug}/` }, 'CompetitorComparisonPage')
            if (!item) return jsonResponse(res, 404, { error: 'Page not found' })
            if (item.Testimonials?.length) {
              item.Testimonials = await resolveTestimonials(authKey, item.Testimonials)
            }
            jsonResponse(res, 200, item)
          } catch (err) {
            console.error('[graph-dev-proxy]', err)
            jsonResponse(res, 500, { error: 'Graph fetch failed' })
          }
          return
        }

        if (url.pathname === '/api/preview') {
          const key = url.searchParams.get('key')
          if (!key) return jsonResponse(res, 400, { error: 'Missing key parameter' })

          const variables: Record<string, unknown> = { key }
          const ver = url.searchParams.get('ver')
          const loc = url.searchParams.get('loc')
          if (ver) variables.ver = ver
          if (loc) variables.loc = [loc]

          try {
            const item = await queryGraph(singleKey, PREVIEW_QUERY, variables, '_Content')
            if (!item) return jsonResponse(res, 404, { error: 'Content not found' })
            if (item.__typename === 'CompetitorComparisonPage' && item.Testimonials?.length) {
              item.Testimonials = await resolveTestimonials(singleKey, item.Testimonials)
            }
            res.setHeader('Cache-Control', 'no-store')
            jsonResponse(res, 200, item)
          } catch (err) {
            console.error('[graph-dev-proxy]', err)
            jsonResponse(res, 500, { error: 'Graph fetch failed' })
          }
          return
        }

        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authKey = env.GRAPH_AUTH_KEY || ''
  const singleKey = env.GRAPH_SINGLE_KEY || authKey

  return {
    plugins: [
      react(),
      ...(authKey ? [graphDevProxy(authKey, singleKey)] : []),
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
