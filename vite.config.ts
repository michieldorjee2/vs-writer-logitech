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
`

const SEARCH_INDEX_QUERY = `
query SearchIndex($limit: Int!, $skip: Int!) {
  CompetitorComparisonPage(
    locale: en
    limit: $limit
    skip: $skip
    orderBy: { _metadata: { published: DESC } }
  ) {
    total
    items {
      _metadata { url { default hierarchical } published }
      headline
      eyebrow
      competitorName
      brandDomain
      brandAccentColor
      customerLogo
      intelHeadline
    }
  }
}
`
const SEARCH_INDEX_PAGE_SIZE = 100
const SEARCH_INDEX_MAX = 5000

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
      ... on HeroSectionBlock { Eyebrow Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } }
      ... on LogoBarBlock { Heading Logos { key item { ... on ImageMedia { _metadata { url { default } displayName } } } } }
      ... on FeatureSectionBlock { Headline { html } Features { Title Description { html } } }
      ... on ComparisonTableBlock { OurLabel CompetitorLabel Rows { Category OurValue OurHighlight CompetitorValue CompetitorHighlight } }
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

/**
 * Strip HTML comments (and their surrounding blank lines) from the
 * built index.html. Keeps source readable but ships a smaller,
 * comment-free file. Conditional comments (`<!--[if IE]>`) are left
 * untouched for the handful of bots/readers that still care.
 */
function stripHtmlComments(): Plugin {
  return {
    name: 'strip-html-comments',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/^\s*<!--(?!\[if)[\s\S]*?-->\s*$/gm, '')
          .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
          // Collapse 3+ consecutive blank lines the replacements may leave.
          .replace(/\n{3,}/g, '\n\n');
      },
    },
  };
}

/** Read the JSON body off a Node IncomingMessage (Vite dev middleware). */
async function readJsonBody(req: any): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => { raw += chunk.toString('utf-8') })
    req.on('end', () => {
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

/**
 * Dev-only same-origin proxy for the Opal "send feedback" webhook.
 * Mirrors api/opal-feedback.ts so the dev server behaves like prod.
 */
function opalFeedbackDevProxy(): Plugin {
  const OPAL_WEBHOOK_URL =
    'https://webhook.opal.optimizely.com/webhooks/4f42a24e93f945bcb262bff01a9a1562/4a159bac-e9fb-43d1-82c1-a4431baebedc'
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

  return {
    name: 'opal-feedback-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost')
        if (url.pathname !== '/api/opal-feedback') return next()
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' })

        let body: any = {}
        try { body = await readJsonBody(req) } catch { return jsonResponse(res, 400, { error: 'Bad JSON' }) }
        const { company_name, company_slug, suggested_edit, edit_user_email } = body || {}

        if (
          typeof company_name !== 'string' || !company_name.trim() ||
          typeof company_slug !== 'string' || !company_slug.trim() ||
          typeof suggested_edit !== 'string' || !suggested_edit.trim() ||
          typeof edit_user_email !== 'string' || !EMAIL_RE.test(edit_user_email)
        ) {
          return jsonResponse(res, 400, { error: 'Missing or invalid fields' })
        }

        try {
          const upstream = await fetch(OPAL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ company_name, company_slug, suggested_edit, edit_user_email }),
          })
          const text = await upstream.text()
          jsonResponse(res, upstream.ok ? 200 : 502, {
            ok: upstream.ok,
            status: upstream.status,
            body: text.slice(0, 2000),
          })
        } catch (err) {
          console.error('[opal-feedback-dev-proxy]', err)
          jsonResponse(res, 502, { error: 'Upstream fetch failed' })
        }
      })
    },
  }
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
            jsonResponse(res, 200, item)
          } catch (err) {
            console.error('[graph-dev-proxy]', err)
            jsonResponse(res, 500, { error: 'Graph fetch failed' })
          }
          return
        }

        if (url.pathname === '/api/search-index') {
          try {
            const first = await fetchGraph(authKey, SEARCH_INDEX_QUERY, {
              limit: SEARCH_INDEX_PAGE_SIZE,
              skip: 0,
            })
            const total: number = first?.data?.CompetitorComparisonPage?.total ?? 0
            const items: unknown[] = [...(first?.data?.CompetitorComparisonPage?.items ?? [])]

            const target = Math.min(total, SEARCH_INDEX_MAX)
            const fetches: Promise<any>[] = []
            for (let skip = SEARCH_INDEX_PAGE_SIZE; skip < target; skip += SEARCH_INDEX_PAGE_SIZE) {
              fetches.push(fetchGraph(authKey, SEARCH_INDEX_QUERY, {
                limit: SEARCH_INDEX_PAGE_SIZE,
                skip,
              }))
            }
            const rest = await Promise.all(fetches)
            for (const chunk of rest) {
              items.push(...(chunk?.data?.CompetitorComparisonPage?.items ?? []))
            }

            res.setHeader('Cache-Control', 'no-store')
            jsonResponse(res, 200, { items, total })
          } catch (err) {
            console.error('[graph-dev-proxy]', err)
            jsonResponse(res, 500, { error: 'Graph fetch failed' })
          }
          return
        }

        if (url.pathname === '/api/edit-status') {
          const key = url.searchParams.get('key')
          const since = url.searchParams.get('since')
          if (!key) return jsonResponse(res, 400, { error: 'Missing key parameter' })

          const STATUS_QUERY = `
            query EditStatusByKey($key: String!) {
              CompetitorComparisonPage(
                where: { _metadata: { key: { eq: $key } } }
                locale: en
              ) {
                items { _metadata { key published } }
              }
            }
          `

          try {
            const json = await fetchGraph(authKey, STATUS_QUERY, { key })
            const meta = (json as any)?.data?.CompetitorComparisonPage?.items?.[0]?._metadata
            if (!meta) return jsonResponse(res, 404, { error: 'Page not found' })
            // The dev server has no Vercel edge cache to purge; just
            // surface the same `changed` shape so the client behaves
            // identically against dev and prod.
            const changed = !!since && meta.published !== since
            res.setHeader('Cache-Control', 'no-store')
            return jsonResponse(res, 200, {
              key: meta.key,
              published: meta.published,
              changed,
            })
          } catch (err) {
            console.error('[graph-dev-proxy]', err)
            return jsonResponse(res, 500, { error: 'Graph fetch failed' })
          }
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
      stripHtmlComments(),
      ...(authKey ? [graphDevProxy(authKey, singleKey)] : []),
      opalFeedbackDevProxy(),
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
      /*
       * /search is the fast-path entry; it doesn't need framer-motion
       * or the shared content-mappers chunk. Filter those out of the
       * auto-generated <link rel="modulepreload"> list so we don't
       * force the booth iPad to fetch 40kB of JS it'll never run.
       * Route-specific lazy chunks still load normally when needed.
       */
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter(
            (d) => !/vendor-motion|content-mappers|ABMHyperPage|DynamicComparisonPage|BlockPreview|FloatingSidebar/.test(d),
          ),
      },
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
