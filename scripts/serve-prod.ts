/**
 * A local production stand-in for end-to-end checks: serves the built `dist/` the way Vercel
 * does and runs the functions a page needs, api/ssr.ts (the server render), api/content.ts
 * (client-side fetches) and api/preview.ts (the CMS preview's draft), through a minimal Vercel
 * request/response adapter.
 *
 *   npm run build && npx tsx scripts/serve-prod.ts [port]     # default 5199
 *
 * Reads GRAPH_AUTH_KEY from the environment or .env.local. Read-only against Graph; it never
 * writes anywhere. Not deployed.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.argv[2] || 5199)

for (const line of fs.existsSync(path.join(ROOT, '.env.local')) ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n') : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/i)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
}

const TYPES: Record<string, string> = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.json': 'application/json',
  '.mp4': 'video/mp4', '.txt': 'text/plain', '.xml': 'application/xml',
}

type Handler = (req: unknown, res: unknown) => Promise<unknown> | unknown
const ssr: Handler = (await import(path.join(ROOT, 'api/ssr.ts'))).default
const content: Handler = (await import(path.join(ROOT, 'api/content.ts'))).default
const preview: Handler = (await import(path.join(ROOT, 'api/preview.ts'))).default

/** The parts of VercelRequest/VercelResponse the two handlers use. */
function adapt(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const vreq = Object.assign(req, { query: Object.fromEntries(url.searchParams), cookies: {}, body: undefined })
  const vres = Object.assign(res, {
    status(code: number) { res.statusCode = code; return vres },
    send(body: unknown) {
      if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) return vres.json(body)
      res.end(body as string)
      return vres
    },
    json(body: unknown) {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
      return vres
    },
    redirect(code: number | string, to?: string) {
      res.statusCode = typeof code === 'number' ? code : 307
      res.setHeader('Location', typeof code === 'number' ? to! : code)
      res.end()
      return vres
    },
  })
  return [vreq, vres] as const
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  try {
    if (url.pathname === '/api/content' || url.pathname === '/api/preview') {
      const [a, b] = adapt(req, res, url)
      return await (url.pathname === '/api/content' ? content : preview)(a, b)
    }
    const file = path.join(DIST, decodeURIComponent(url.pathname))
    if (file.startsWith(DIST) && url.pathname !== '/' && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream')
      return fs.createReadStream(file).pipe(res)
    }
    if (url.pathname.startsWith('/api/')) {
      res.statusCode = 404
      return res.end('not served by the local stand-in')
    }
    const [a, b] = adapt(req, res, url)
    return await ssr(a, b)
  } catch (err) {
    console.error(err)
    res.statusCode = 500
    res.end('stand-in error')
  }
})
// Longer than a Lighthouse or Playwright run holds a socket open.
server.keepAliveTimeout = 120_000
server.listen(PORT, '127.0.0.1', () => console.log(`serve-prod ready on http://127.0.0.1:${PORT}`))
