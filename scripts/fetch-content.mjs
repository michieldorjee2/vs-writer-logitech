/**
 * Pre-fetches all CompetitorComparisonPage items from Optimizely Content Graph
 * and writes them as static JSON files for production builds.
 *
 * The auth key is only used at build time — never shipped to the browser.
 *
 * Usage: GRAPH_AUTH_KEY=xxx node scripts/fetch-content.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2'

const FULL_PAGE_QUERY = `
query GetAllCompetitorPages {
  CompetitorComparisonPage(locale: en) {
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
      FaqSection { key item { ... on AccordionBlock { Heading Items { ... on AccordionEntryBlock { Heading MainContent { html } OpenedByDefault } } } } }
      PromoCard { Eyebrow Heading Description CtaText CtaUrl { default } }
      ClosingCta { Headline { html } Subheadline PrimaryCtaText PrimaryCtaUrl { default } BackgroundStyle }
    }
  }
}
`

async function main() {
  const authKey = process.env.GRAPH_AUTH_KEY
  if (!authKey) {
    console.error('Error: GRAPH_AUTH_KEY environment variable is required')
    process.exit(1)
  }

  console.log('Fetching all CompetitorComparisonPage items from Graph...')

  const res = await fetch(`${GRAPH_ENDPOINT}?auth=${authKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: FULL_PAGE_QUERY }),
  })

  if (!res.ok) {
    console.error(`Graph returned ${res.status}: ${await res.text()}`)
    process.exit(1)
  }

  const json = await res.json()
  const items = json?.data?.CompetitorComparisonPage?.items || []

  if (items.length === 0) {
    console.warn('No pages found in Graph. Skipping content generation.')
    return
  }

  // Write each page as a JSON file matching its URL slug
  const contentDir = join(__dirname, '..', 'public', 'api', 'content')
  const routes = []

  for (const item of items) {
    const hierarchical = item._metadata.url.hierarchical // e.g. "/vs-writer-ai-logitech/"
    const slug = hierarchical.replace(/^\/|\/$/g, '') // "vs-writer-ai-logitech"

    // Create nested directory matching the API path: public/api/content/vs-writer-ai-logitech/
    const pageDir = join(contentDir, slug)
    mkdirSync(pageDir, { recursive: true })
    writeFileSync(join(pageDir, 'index.json'), JSON.stringify(item, null, 2))

    routes.push({ slug, key: item._metadata.key, title: item.PageTitle })
    console.log(`  ✓ ${slug} (${item.PageTitle})`)
  }

  // Write a route manifest for the app to discover all available pages
  mkdirSync(contentDir, { recursive: true })
  writeFileSync(join(contentDir, '_routes.json'), JSON.stringify(routes, null, 2))

  console.log(`\nDone! ${items.length} page(s) written to public/api/content/`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
