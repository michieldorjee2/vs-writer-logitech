import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
/*
 * The Visual Builder queries are IMPORTED rather than copied. Every other query in this file
 * is a second copy of one in `api/content.ts`, and the copies HAD drifted: PAGE_QUERY and
 * PREVIEW_QUERY below used to still select CanonicalUrl, FeatureSection, FaqSection,
 * ComparisonRowProperty.OurHighlight/CompetitorHighlight and ABMTimelinePhaseProperty.Weeks —
 * the same six dead selections whose removal from the schema 404'd 2,676 pages, reintroduced
 * here even after api/content.ts and server/ssr-handler.tsx were fixed. `npm run check:graph`
 * did not catch it because this file was not in its SOURCES list; it is now (see
 * scripts/check-graph-queries.mjs), which is what makes a future reintroduction here fail the
 * same way it already fails for the other two files. One module, two callers.
 */
import { EXPERIENCE_QUERIES, normalizeExperienceItem } from './src/lib/experience-queries'
import { ACCOUNT_PAGE_QUERY } from './src/lib/account-page-query'
import { graphItems, type GraphResponse } from './src/lib/graph-envelope'
import { homeIndexFor, loadHomeIndex } from './src/lib/home-index'

const GRAPH_ENDPOINT = 'https://cg.optimizely.com/content/v2'

/* The account page: the same field list as api/content.ts and the CMS preview. */
const PAGE_QUERY = ACCOUNT_PAGE_QUERY

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


/** Helper to send a JSON response in Vite middleware */
function jsonResponse(res: ServerResponse, status: number, body: unknown) {
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
  return graphRes.json() as Promise<GraphResponse>
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

/**
 * Write the view transitions boot script (src/lib/view-transitions-boot.js) into both documents'
 * <head>, in place of their `<script data-view-transitions-boot></script>`: a classic inline
 * script, so its pageswap / pagereveal listeners exist before the browser fires them (a module
 * script would run too late). One source for index.html and home.html.
 */
function viewTransitionsBoot(): Plugin {
  const PLACEHOLDER = '<script data-view-transitions-boot></script>';
  return {
    name: 'view-transitions-boot',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!html.includes(PLACEHOLDER)) return html;
        const source = readFileSync(path.resolve(__dirname, 'src/lib/view-transitions-boot.js'), 'utf8')
          .replace(/^\/\*[\s\S]*?\*\/\s*/, '');
        return html.replace(PLACEHOLDER, `<script>${source.trim()}</script>`);
      },
    },
  };
}

/** Read the JSON body off a Node IncomingMessage (Vite dev middleware). */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
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
 * Dev-only: the page-build and offer routes run their own files (api/page-builds/*,
 * api/offers/*), loaded through Vite, with the request and response shape @vercel/node gives them. No
 * second copy of their logic lives here; they read .env.local like the rest of dev.
 */
function pageBuildsDev(env: Record<string, string>): Plugin {
  return {
    name: 'page-builds-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        let url = new URL(req.url || '', 'http://localhost')
        // A personal link, as vercel.json rewrites it.
        const short = /^\/s\/([^/]+)$/.exec(url.pathname)
        if (short) url = new URL(`/api/share-go?code=${encodeURIComponent(short[1])}`, 'http://localhost')
        // The functions this serves, as Vercel routes them: [pattern, file, the path segment that is `id`].
        const routes: Array<[RegExp, string]> = [
          [/^\/api\/badge-read$/, '/api/badge-read.ts'],
          [/^\/api\/page-builds$/, '/api/page-builds/index.ts'],
          // Before [id], as Vercel serves a file ahead of a dynamic segment.
          [/^\/api\/page-builds\/match$/, '/api/page-builds/match.ts'],
          [/^\/api\/page-builds\/([^/]+)$/, '/api/page-builds/[id].ts'],
          [/^\/api\/offers$/, '/api/offers/index.ts'],
          [/^\/api\/offers\/([^/]+)\/look$/, '/api/offers/[id]/look.ts'],
          [/^\/api\/offer-signup$/, '/api/offer-signup.ts'],
          // The one-click ask. Sends nothing in dev: the Mark webhook is set on Production only.
          [/^\/api\/cta-ping$/, '/api/cta-ping.ts'],
          [/^\/api\/offers\/([^/]+)\/pages$/, '/api/offers/[id]/pages.ts'],
          // The CMS preview's draft: the function itself, so dev reads it exactly as production does.
          [/^\/api\/preview$/, '/api/preview.ts'],
          // Activity mode: the visitor index write and the report, both straight from their files.
          [/^\/api\/page-visit$/, '/api/page-visit.ts'],
          [/^\/api\/page-activity$/, '/api/page-activity.ts'],
          // Personal links: make and list, the recipient's note, the short link, Teams and email.
          [/^\/api\/share-links$/, '/api/share-links.ts'],
          [/^\/api\/share-note$/, '/api/share-note.ts'],
          [/^\/api\/share-go$/, '/api/share-go.ts'],
          [/^\/api\/share-send$/, '/api/share-send.ts'],
        ]
        let file: string | null = null
        let id: string | null = null
        for (const [pattern, path] of routes) {
          const m = pattern.exec(url.pathname)
          if (m) {
            file = path
            id = m[1] ? decodeURIComponent(m[1]) : null
            break
          }
        }
        if (!file) return next()
        for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v
        try {
          const mod = await server.ssrLoadModule(file)
          const vreq = Object.assign(req, {
            query: { ...Object.fromEntries(url.searchParams), ...(id ? { id } : {}) },
            cookies: Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])),
            body: req.method === 'POST' ? await readJsonBody(req) : undefined,
          })
          const vres = Object.assign(res, {
            status(code: number) { res.statusCode = code; return vres },
            json(body: unknown) { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return vres },
            send(body: unknown) { res.end(typeof body === 'string' ? body : JSON.stringify(body)); return vres },
          })
          await mod.default(vreq, vres)
        } catch (err) {
          console.error('[page-builds-dev]', err)
          if (!res.writableEnded) jsonResponse(res, 500, { error: String(err) })
        }
      })
    },
  }
}

/**
 * Dev-only: /search is home.html, its own document, as it is in production
 * (server/ssr-handler.tsx renders it there, and sends /home to it). Without
 * this the SPA fallback would hand both to index.html.
 */
function homeEntryDev(): Plugin {
  return {
    name: 'home-entry-dev',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = new URL(req.url || '', 'http://localhost')
        if (/^\/(search|home)\/?$/.test(url.pathname)) req.url = `/home.html${url.search}`
        next()
      })
    },
  }
}

/**
 * Dev-only stand-in for sign-in. The dev server has no Opti ID round trip
 * (api/_lib/auth.ts runs only as Vercel functions), so DEV_AUTH_EMAIL in
 * .env.local plays the signed-in person — the same variable the functions
 * fall back to when OPTIID_RELAY_SECRET is unset. Unset means signed out.
 */
function devAuthProxy(devEmail: string | null): Plugin {
  return {
    name: 'auth-dev-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost')
        if (url.pathname !== '/api/auth/me') return next()
        if (!devEmail) return jsonResponse(res, 401, { error: 'signed_out' })
        // As api/_lib/auth.ts: the signed-in person's browser is marked, and never loads ODP.
        res.setHeader('Set-Cookie', 'showcase_staff=1; Path=/; Max-Age=15552000; SameSite=Lax')
        return jsonResponse(res, 200, { email: devEmail, name: null })
      })
    },
  }
}

/**
 * Dev-only same-origin proxy for the Opal "send feedback" webhook.
 * Mirrors api/opal-feedback.ts so the dev server behaves like prod.
 */
function opalFeedbackDevProxy(devEmail: string | null): Plugin {
  const OPAL_WEBHOOK_URL =
    'https://webhook.opal.optimizely.com/webhooks/4f42a24e93f945bcb262bff01a9a1562/4a159bac-e9fb-43d1-82c1-a4431baebedc'

  return {
    name: 'opal-feedback-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost')
        if (url.pathname !== '/api/opal-feedback') return next()
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' })
        if (!devEmail) return jsonResponse(res, 401, { error: 'Sign in with Optimizely first.' })
        const edit_user_email = devEmail

        let body: Record<string, unknown> = {}
        try { body = await readJsonBody(req) } catch { return jsonResponse(res, 400, { error: 'Bad JSON' }) }
        const { company_name, company_slug, suggested_edit } = body || {}

        if (
          typeof company_name !== 'string' || !company_name.trim() ||
          typeof company_slug !== 'string' || !company_slug.trim() ||
          typeof suggested_edit !== 'string' || !suggested_edit.trim()
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
 * Dev-only same-origin proxy for the Opal "create page" webhook.
 * Mirrors api/opal-create-page.ts so the dev server behaves like prod.
 */
function opalCreatePageDevProxy(devEmail: string | null): Plugin {
  const OPAL_WEBHOOK_URL = process.env.OPAL_CREATE_PAGE_WEBHOOK_URL || ''
  const MAX_COMPANY_NAME_LEN = 120

  return {
    name: 'opal-create-page-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost')
        if (url.pathname !== '/api/opal-create-page') return next()
        if (req.method !== 'POST') return jsonResponse(res, 405, { error: 'Method not allowed' })
        if (!devEmail) return jsonResponse(res, 401, { error: 'Sign in with Optimizely first.' })
        const edit_user_email = devEmail

        let body: Record<string, unknown> = {}
        try { body = await readJsonBody(req) } catch { return jsonResponse(res, 400, { error: 'Bad JSON' }) }
        const { company_name } = body || {}

        if (
          typeof company_name !== 'string' ||
          !company_name.trim() ||
          company_name.trim().length > MAX_COMPANY_NAME_LEN
        ) {
          return jsonResponse(res, 400, { error: 'Missing or invalid fields' })
        }

        try {
          const upstream = await fetch(OPAL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_name: company_name.trim(),
              edit_user_email,
              requested_at: new Date().toISOString(),
            }),
          })
          const text = await upstream.text()
          jsonResponse(res, upstream.ok ? 200 : 502, {
            ok: upstream.ok,
            status: upstream.status,
            body: text.slice(0, 2000),
          })
        } catch (err) {
          console.error('[opal-create-page-dev-proxy]', err)
          jsonResponse(res, 502, { error: 'Upstream fetch failed' })
        }
      })
    },
  }
}

/**
 * Vite plugin that proxies /api/content during dev (/api/preview runs the function itself: pageBuildsDev).
 * Auth keys stay server-side — never shipped to the browser.
 */
function graphDevProxy(authKey: string, devEmail: string | null, env: Record<string, string>): Plugin {
  return {
    name: 'graph-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', 'http://localhost')

        if (url.pathname === '/api/content') {
          const slug = url.searchParams.get('slug')
          if (!slug) return jsonResponse(res, 400, { error: 'Missing slug parameter' })

          /*
           * `/vb/:slug` — a Visual Builder experience. Mirrors the `kind=experience` branch
           * in api/content.ts, including the normalisation, so dev and prod hand the browser
           * the same JSON. Graph errors are printed rather than collapsed into a 404: a
           * composition query that stops matching the schema returns `data: null`, which is
           * indistinguishable from "no such page" unless someone says so out loud.
           */
          if (url.searchParams.get('kind') === 'experience') {
            const tries = [`/${slug}/`]
            if (!slug.startsWith('en/')) tries.push(`/en/${slug}/`)
            try {
              for (const s of tries) {
                for (const { typeName, query, template } of EXPERIENCE_QUERIES) {
                  const json = await fetchGraph(authKey, query, { slug: s })
                  if (json?.errors?.length) {
                    console.error(
                      `[graph-dev-proxy] ${typeName} query failed for ${s}: ` +
                        json.errors.map((e) => e.message ?? '').join(' | '),
                    )
                    continue
                  }
                  const item = json?.data?.[typeName]?.items?.[0]
                  if (item) {
                    // The offer's email form, as api/content.ts adds it (api/_lib/offer-signup.ts reads .env.local like the dev routes).
                    for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v
                    const { withOfferSignup } = await server.ssrLoadModule('/api/_lib/offer-signup.ts')
                    const { withParentAccount } = await server.ssrLoadModule('/api/_lib/parent-account.ts')
                    return jsonResponse(
                      res,
                      200,
                      await withOfferSignup(await withParentAccount(normalizeExperienceItem({ ...item, __typename: typeName, __template: template }))),
                    )
                  }
                }
              }
              return jsonResponse(res, 404, { error: 'Experience not found' })
            } catch (err) {
              console.error('[graph-dev-proxy] experience fetch failed', err)
              return jsonResponse(res, 500, { error: 'Graph fetch failed' })
            }
          }

          try {
            const item = await queryGraph(authKey, PAGE_QUERY, { slug: `/${slug}/` }, 'CompetitorComparisonPage')
            if (!item) return jsonResponse(res, 404, { error: 'Page not found' })
            // The page's own copy, as api/content.ts adds it (api/_lib/page-copy.ts).
            for (const [k, v] of Object.entries(env)) if (!(k in process.env)) process.env[k] = v
            const { withPageCopy } = await server.ssrLoadModule('/api/_lib/page-copy.ts')
            jsonResponse(res, 200, await withPageCopy(item))
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
            const fetches: Promise<GraphResponse>[] = []
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

        // Mirrors api/home-index.ts, with DEV_AUTH_EMAIL as the signed-in person.
        if (url.pathname === '/api/home-index') {
          if (!devEmail) return jsonResponse(res, 401, { error: 'signed_out' })
          try {
            const source = await loadHomeIndex((query, variables) => fetchGraph(authKey, query, variables))
            res.setHeader('Cache-Control', 'no-store')
            jsonResponse(res, 200, homeIndexFor(source, devEmail))
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
            const meta = graphItems<{ _metadata?: Record<string, unknown> }>(json, 'CompetitorComparisonPage')?.[0]?._metadata
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


        next()
      })
    },
  }
}

/*
 * Tesseract's own files for reading badges in the browser (src/lib/badge-read-device.ts),
 * served from this site at /ocr/<version>/ rather than a CDN: its worker, the three LSTM
 * builds of the engine it picks between (relaxed SIMD, SIMD, plain), and the English
 * model. Fixed names, because Tesseract asks for them by name, so they sit outside
 * /assets; the version in the path lets vercel.json cache them for good. The dev server
 * answers from node_modules; the build copies them into dist.
 */
const OCR_FILES: Record<string, string> = {
  'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
}
function ocrFiles(): Plugin {
  const version = (JSON.parse(readFileSync(path.resolve(__dirname, 'node_modules/tesseract.js/package.json'), 'utf-8')) as { version: string }).version
  const base = `/ocr/${version}/`
  let ssr = false
  return {
    name: 'ocr-files',
    configResolved(config) {
      ssr = !!config.build.ssr
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith(base)) return next()
        const file = OCR_FILES[url.slice(base.length)]
        if (!file) return next()
        res.setHeader('Content-Type', url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(path.resolve(__dirname, file)))
      })
    },
    generateBundle() {
      if (ssr) return
      for (const [name, file] of Object.entries(OCR_FILES)) {
        this.emitFile({ type: 'asset', fileName: `ocr/${version}/${name}`, source: readFileSync(path.resolve(__dirname, file)) })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authKey = env.GRAPH_AUTH_KEY || ''
  const devEmail = (env.DEV_AUTH_EMAIL || '').trim().toLowerCase() || null

  return {
    plugins: [
      react(),
      viewTransitionsBoot(),
      stripHtmlComments(),
      ...(authKey ? [graphDevProxy(authKey, devEmail, env)] : []),
      devAuthProxy(devEmail),
      opalFeedbackDevProxy(devEmail),
      opalCreatePageDevProxy(devEmail),
      homeEntryDev(),
      pageBuildsDev(env),
      ocrFiles(),
    ],
    resolve: {
      alias: {
        '@components': path.resolve(__dirname, 'src/components'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        /*
         * Upstream's own alias, pointed at the vendored slice. Keeping it means the files
         * under src/vendor/opticom stay byte-comparable to optimizely.com and
         * `node scripts/sync-opticom.mjs --check` keeps working.
         *
         * The trailing slash on BOTH sides is not cosmetic. Vite matches a string alias by
         * prefix and takes the first hit, so a bare '@' would also swallow '@components/…'
         * and '@assets/…'. '@/' cannot.
         */
        '@/': path.resolve(__dirname, 'src/vendor/opticom') + '/',
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
            (d) => !/vendor-motion|content-mappers|BlockPreview|CmsPreview|FloatingSidebar/.test(d),
          ),
      },
      rollupOptions: {
        // The search page is its own document (home.html): no router, no Tailwind, no third-party tags.
        input: {
          main: path.resolve(__dirname, 'index.html'),
          home: path.resolve(__dirname, 'home.html'),
          // A page's address while Mark builds it (BuildView.tsx).
          build: path.resolve(__dirname, 'build.html'),
        },
        output: {
          /*
           * By module path, not by package entry. The object form ({ 'vendor-react': ['react', …] })
           * left react/jsx-runtime to whichever chunk imported it first — framer-motion's — so every
           * page, the search page included, loaded vendor-motion to render JSX at all, and react-dom's
           * client fell into a shared chunk. The router has its own chunk: the search page does not route.
           */
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return undefined
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
            if (/\/node_modules\/(react-router|react-router-dom|@remix-run\/router)\//.test(id)) return 'vendor-router'
            if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'vendor-motion'
            if (/\/node_modules\/(react-use|react-use-measure)\//.test(id)) return 'vendor-utils'
            return undefined
          },
        },
      },
    },
  }
})
