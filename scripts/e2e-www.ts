/**
 * End-to-end test of the www-design pages in a real browser, desktop and phone.
 *
 *   npm run build && npx tsx scripts/serve-prod.ts &      # or point E2E_BASE at a deployment
 *   npm run e2e:www
 *
 * Env: E2E_BASE (default http://127.0.0.1:5199), E2E_ACCOUNT (a takeout pitch, default /cdw/),
 * E2E_AP_ACCOUNT (an agent platform pitch, default /smartsheet/), E2E_PERSON (default /logitech/ben-yu/), E2E_OFFER
 * (default /vb/no-account-left-behind-scale-ai), E2E_OUT (screenshot folder, default a temp dir),
 * E2E_BYPASS (Vercel protection-bypass secret, for a protected preview).
 *
 * The checks that start on the search page need it signed in: the local stand-in does that
 * (SERVE_SIGNED_IN=<email>). Against a deployment, which sends a signed-out /search to sign-in,
 * they are skipped by name and counted as skipped in the tally (searchSignInGate).
 *
 * NOTHING LEAVES THE BROWSER. The contact button's ping (POST /api/cta-ping, which messages the
 * account executive), sign-in, the edit stream to Mark and the republish poll are all answered
 * here; the test fails if any request reaches the ping endpoint or a Mark webhook.
 *
 * Layout (Michiel, 2 Nov): a full-screen hero at 75% of the window with the next scene peeking in,
 * scenes at least 75%, the close the full window; one closing CTA; the intro on load settles; the
 * hero landscape is never upscaled.
 *
 * Covers, for both account templates (each page's own pitch picks one: src/www/account-template.ts),
 * the person page and the offer page:
 * server render + hydration without errors, no sideways scroll on a phone, every section present,
 * sticky bar, the one-click connect panel (pings once per view, from the sticky bar or the close),
 * the review layer and state switch, the offer FAQ, X-ray mode outlining every section, Edit mode
 * rewriting the page in place from a (mocked) Mark stream, the old ?design=classic and
 * ?template=takeout switches changing nothing, and the CMS preview: both pages in the CMS editor
 * with its editing hooks, a save refreshing the draft in place, and nothing sent from it; and the
 * view transitions between the search page and the pages it opens, both ways.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ABM_XRAY_DEFAULTS, AGENT_PLATFORM_EDIT, AGENT_PLATFORM_XRAY, PERSON_EDIT, PERSON_XRAY_DEFAULTS, TAKEOUT_EDIT } from '../src/lib/xray-defaults'

/** React's mark on a boundary the server sent unfinished, for the browser to draw (#419). */
const BAILED_OUT = '<!--$!-->'
const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:5199').replace(/\/$/, '')
/** A page that pitches a CMS takeout: the takeout template. */
const ACCOUNT = process.env.E2E_ACCOUNT || '/cdw/'
/** A page that pitches the agent platform: Laura's template. */
const AP_ACCOUNT = process.env.E2E_AP_ACCOUNT || '/smartsheet/'
const OFFER = process.env.E2E_OFFER || '/vb/no-account-left-behind-scale-ai'
/** A person page (the 1:1 buyer page, `/<company>/<person>/`) whose team has an account executive. */
const PERSON = process.env.E2E_PERSON || '/logitech/ben-yu/'
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'www-e2e-'))
const BYPASS = process.env.E2E_BYPASS

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const

const url = (p: string, q = '') => (q ? `${BASE}${p}${p.includes('?') ? '&' : '?'}${q}` : `${BASE}${p}`)

/* ------------------------------------------------------------------ harness */

let passed = 0
const failures: string[] = []
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    console.log(`  ok  ${name}`)
  } catch (err) {
    failures.push(name)
    console.log(`  FAIL ${name}\n       ${String((err as Error).message).split('\n').slice(0, 6).join('\n       ')}`)
  }
}
function expect(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}
const skipped: string[] = []
function skip(name: string, why: string) {
  skipped.push(name)
  console.log(`  skip ${name}\n       ${why}`)
}

/**
 * The checks that start on the search page need it signed in. The local stand-in serves it
 * signed in (SERVE_SIGNED_IN); a deployment sends a signed-out browser to Optimizely sign-in, and
 * the test has no real session to give it. There those checks are skipped, by name and counted
 * in the tally, and every other check runs. Never on a local server: there a redirect means the
 * stand-in was started without SERVE_SIGNED_IN, and the checks must fail.
 */
async function searchSignInGate(): Promise<string | null> {
  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(BASE)) return null
  const res = await fetch(url('/search'), { redirect: 'manual', headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })
  const to = res.headers.get('location') || ''
  return res.status >= 300 && res.status < 400 && /^(https?:\/\/[^/]+)?\/api\/auth\/[^/?]+\/start\b/.test(to)
    ? `needs a signed-in search page: ${BASE}/search sends a signed-out browser to sign-in (${to.split('?')[0]})`
    : null
}
const SEARCH_GATE = await searchSignInGate()
/** test() for a check that starts on the search page: skipped where it can't be signed in. */
const searchTest = (name: string, fn: () => Promise<void>) => (SEARCH_GATE ? Promise.resolve(skip(name, SEARCH_GATE)) : test(name, fn))

/** Console/page errors that are not the page's fault (third-party avatars and logos). */
const NOISE = /gravatar|brandfetch|brand-logo|Failed to load resource|favicon|zaius|net::ERR_/i

interface Watch {
  errors: string[]
  escaped: string[]
}

async function newContext(browser: Browser, vp: keyof typeof VIEWPORTS, opts: { signedIn?: boolean } = {}) {
  const ctx = await browser.newContext({
    ...VIEWPORTS[vp],
    extraHTTPHeaders: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined,
  })
  const watch: Watch = { errors: [], escaped: [] }

  // The one-click contact: record what the page would send, inside the page, and send nothing.
  await ctx.addInitScript(() => {
    const w = window as unknown as { __pings: string[] }
    w.__pings = []
    const real = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (new URL(url, location.href).pathname === '/api/cta-ping') {
        w.__pings.push(String(init?.body ?? ''))
        return Promise.resolve(new Response('{"ok":true}', { status: 202 }))
      }
      return real(input, init)
    }
  })
  // Anything that gets past that stand-in fails the run.
  for (const pattern of ['**/api/cta-ping', 'https://webhook.opal.optimizely.com/**', 'https://webhook.mark.optimizely.com/**']) {
    await ctx.route(pattern, (route) => {
      watch.escaped.push(route.request().url())
      return route.fulfill({ status: 202, json: { ok: true } })
    })
  }
  await ctx.route('**/api/auth/me', (route) =>
    opts.signedIn
      ? route.fulfill({ json: { email: 'e2e@optimizely.com', name: 'E2E' } })
      : route.fulfill({ status: 401, json: { error: 'signed_out' } }),
  )
  await ctx.route('**/api/edit-status**', (route) =>
    route.fulfill({ json: { changed: false, published: '2026-01-01T00:00:00.000Z' } }),
  )
  await ctx.route('**/api/opal-feedback', (route) => route.fulfill({ json: { ok: true } }))
  return { ctx, watch }
}

async function open(ctx: BrowserContext, watch: Watch, href: string): Promise<Page> {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => watch.errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) watch.errors.push(`console: ${m.text()}`)
  })
  // Our page drawn, not every third-party image loaded: a slow logo CDN (Brandfetch) held the
  // load event past 30s now and then, and failed a run that had nothing wrong with it.
  const res = await page.goto(href, { waitUntil: 'domcontentloaded' })
  expect(res?.ok(), `${href} answered ${res?.status()}`)
  await page.waitForSelector('.www-page')
  await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1200) // hydration + fonts
  return page
}

async function noSidewaysScroll(page: Page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
  expect(r.sw <= r.iw + 1, `page is ${r.sw}px wide in a ${r.iw}px viewport`)
}

async function revealsAll(page: Page) {
  const before = await page.evaluate(() => document.querySelectorAll('[data-scene].is-in').length)
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.6) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 150))
    }
    // End on the very bottom: the loop's last step can stop short of the close.
    scrollTo(0, document.body.scrollHeight)
  })
  // The waypoint observer answers asynchronously; give the last scene a moment, not a race.
  await page
    .waitForFunction(() => document.querySelectorAll('[data-scene].is-in').length === document.querySelectorAll('[data-scene]').length, null, { timeout: 3000 })
    .catch(() => {})
  const after = await page.evaluate(() => ({
    in: document.querySelectorAll('[data-scene].is-in').length,
    all: document.querySelectorAll('[data-scene]').length,
    hidden: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length,
  }))
  expect(before < after.all, 'every scene was revealed before scrolling')
  expect(after.in === after.all, `${after.all - after.in} scene(s) never revealed`)
  await page.waitForTimeout(1200)
  const hidden = await page.evaluate(
    () => [...document.querySelectorAll('[data-reveal], .www-w, .www-tile')].filter((e) => getComputedStyle(e).opacity === '0').length,
  )
  expect(hidden === 0, `${hidden} element(s) still invisible after scrolling through`)
  await page.evaluate(() => scrollTo(0, 0))
}

async function shot(page: Page, name: string) {
  await page.evaluate(async () => {
    // Walk the page so lazy images load before the full-page capture.
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    scrollTo(0, 0)
  })
  await page.waitForTimeout(1600) // the last scene's reveal (0.8s + stagger) has finished
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

/** The hero is three quarters of the window (the next scene peeks in), the other scenes at least that, the close the full window. */
async function sceneHeights(page: Page, vh: number) {
  const r = await page.evaluate(() => ({
    hero: document.getElementById('hero')!.getBoundingClientRect().height,
    short: [...document.querySelectorAll('[data-scene]:not(.www-hero):not(.www-scene--compact)')]
      .filter((s) => {
        const h = s.getBoundingClientRect().height
        return s.matches('.www-scene--fill') ? h < innerHeight - 25 : h < innerHeight * 0.75 - 1
      })
      .map((s) => s.id),
    next: document.querySelector('#hero + [data-scene], #main-content > [data-scene]:nth-child(2)')?.getBoundingClientRect().top ?? 0,
  }))
  // 75% of the window; a hero with more copy than that grows, but the next scene still shows.
  expect(r.hero >= vh * 0.75 - 2, `hero is ${r.hero}px in a ${vh}px window (want 75%)`)
  expect(vh - r.next >= vh * 0.15, `the next scene starts at ${r.next}px: too little of it peeks into a ${vh}px window`)
  expect(!r.short.length, `scenes shorter than 75% of the window: ${r.short.join(', ')}`)
}

/** The hero landscape is never upscaled: the file the browser picked is at least as wide as it is drawn. */
async function heroImageSharp(page: Page) {
  const r = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('.www-hero__img')!
    return { src: img.currentSrc, drawn: img.getBoundingClientRect().width * devicePixelRatio }
  })
  const w = Number(r.src.match(/-(\d+)\.(avif|webp)/)?.[1])
  expect(w >= r.drawn * 0.98, `${r.src} (${w}px) drawn ${Math.round(r.drawn)} device px wide`)
}

/** The intro plays once and settles: the landscape is fully open, the words and the panel are in. */
async function introSettles(page: Page) {
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(2600)
  const r = await page.evaluate(() => ({
    clip: getComputedStyle(document.querySelector('.www-hero__visual')!).clipPath,
    words: [...document.querySelectorAll('#hero .www-w, #hero [data-reveal], #hero .www-agents, #hero .www-fact')].filter((e) => getComputedStyle(e).opacity !== '1').length,
    running: document.getAnimations().filter((a) => a.playState === 'running' && (a.effect as KeyframeEffect)?.target?.closest?.('#hero') && !(a.effect as KeyframeEffect).target!.matches('.www-agents__live')).length,
  }))
  expect(/^(none|inset\(\s*(0(px|%)?\s*)+\))$/.test(r.clip), `hero landscape still clipped: ${r.clip}`)
  expect(r.words === 0, `${r.words} hero element(s) not fully in after the intro`)
  expect(r.running === 0, `${r.running} hero animation(s) still running after 2.6s`)
}

/* --------------------------------------------------------------------- tests */

const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-features=AsyncDns'] })
console.log(`www-design e2e against ${BASE}  (screenshots: ${OUT})`)

/** What the page asked /api/cta-ping to send, parsed. */
const pingsOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __pings: string[] }).__pings.map((b) => JSON.parse(b) as { route: string; source: string; utm: Record<string, string> }))

for (const vp of Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>) {
  console.log(`\naccount page, agent platform template (an agent platform pitch), ${vp}`)
  {
    const { ctx, watch } = await newContext(browser, vp)
    const page = await open(ctx, watch, url(AP_ACCOUNT))
    await test('server-rendered and hydrated without errors', async () => {
      const html = await (await fetch(url(AP_ACCOUNT), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
      expect(/class="www-page[^"]*\bwww-ap\b/.test(html), 'the server did not render the agent platform page')
      expect(!html.includes(BAILED_OUT), 'the server left part of the page for the browser to finish (React #419)')
      expect(!watch.errors.length, watch.errors.join('\n'))
    })
    await test('the tab title is the template\'s, before and after hydration (no takeout pitch)', async () => {
      const html = await (await fetch(url(AP_ACCOUNT), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
      const server = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
      const client = await page.title()
      expect(/^Optimizely agent platform · Personalized for /.test(server), `server title: ${server}`)
      expect(client === server.replace(/&amp;/g, '&'), `client title "${client}" differs from the server's "${server}"`)
    })
    await test("Laura's eight sections, in her order", async () => {
      const ids = await page.$$eval('[data-scene]', (els) => els.map((e) => e.id))
      expect(JSON.stringify(ids) === JSON.stringify(['hero', 'who', 'intel', 'language', 'usecases', 'proof', 'migration', 'cta']), ids.join(', '))
    })
    await test('no sideways scroll', () => noSidewaysScroll(page))
    await test('scenes reveal as they enter, and every scene has revealed by the end', () => revealsAll(page))
    if (vp === 'desktop') {
      await test('desktop: full screen hero at 75% of the window, the next scene peeking in; scenes at least 75%, the close the full window', () =>
        sceneHeights(page, 900),
      )
      await test('desktop: the hero runs edge to edge, its copy lines up with the content column', async () => {
        const r = await page.evaluate(() => ({
          card: document.querySelector('.www-hero__card')!.getBoundingClientRect(),
          copy: document.querySelector('.www-hero__body h1')!.getBoundingClientRect().left,
          col: document.querySelector('#who h2')!.getBoundingClientRect().left,
        }))
        expect(r.card.left === 0 && Math.abs(r.card.width - 1440) <= 1, `hero card ${r.card.left},${r.card.width}`)
        expect(Math.abs(r.copy - r.col) <= 2, `hero copy at ${r.copy}px, content column at ${r.col}px`)
      })
    }
    if (vp === 'phone') {
      await test('phone: the hero ask is in the first screen', async () => {
        const cta = await page.locator('#hero-connect-btn').boundingBox()
        expect(cta && cta.y + cta.height <= 844 && cta.x + cta.width <= 390, `hero CTA at ${JSON.stringify(cta)}`)
      })
    }
    await test('the intro plays on load and settles (landscape open, words and panel in)', () => introSettles(page))
    await test('the hero landscape is never upscaled', () => heroImageSharp(page))
    await test('the page says whose it is once: the account logo above the H1, no "Made for"', async () => {
      const r = await page.evaluate(() => ({
        mark: document.querySelector('#hero .www-account')!.getBoundingClientRect().bottom,
        h1: document.querySelector('#hero h1')!.getBoundingClientRect().top,
        text: document.getElementById('hero')!.innerText,
      }))
      expect(r.mark <= r.h1, 'the logo is not above the H1')
      // A logo that does not load (here the logo CDN is not reachable) shows the initials, never a broken image.
      const logo = await page.evaluate(() => {
        const tile = document.querySelector('#hero .www-account__logo')!
        const img = tile.querySelector('img')
        // No helper functions in here: tsx would wrap them in a __name() the page does not have.
        const ini = tile.querySelector('.www-account__initials')
        const imgShown = !!img && getComputedStyle(img).display !== 'none'
        const iniShown = !!ini && getComputedStyle(ini).display !== 'none'
        return { brokenShown: imgShown && img!.complete && img!.naturalWidth === 0, something: (imgShown && img!.naturalWidth > 0) || iniShown }
      })
      expect(!logo.brokenShown && logo.something, `logo tile: ${JSON.stringify(logo)}`)
      expect((r.text.match(/Personalized for/g) ?? []).length === 1 && !/Made for|Built for/.test(r.text), r.text)
    })
    await test('the close has one call to action', async () => {
      const n = await page.locator('#cta .www-close-band a, #cta .www-close-band button').count()
      expect(n === 1, `${n} actions in the close band`)
    })
    await test('the sticky bar appears past the hero and hides at the close', async () => {
      await page.evaluate(() => scrollTo(0, 0))
      await page.waitForTimeout(300)
      expect(!(await page.locator('.www-sticky--visible').count()), 'visible over the hero')
      await page.locator('#usecases').scrollIntoViewIfNeeded()
      await page.waitForSelector('.www-sticky--visible', { timeout: 3000 })
    })
    await test('the sticky button pings the team once and opens the connect panel (no form)', async () => {
      await page.locator('.www-sticky--visible #sticky-connect-btn').click()
      const panel = page.getByRole('dialog')
      await panel.getByText("You're all set").waitFor({ timeout: 3000 })
      expect(!(await panel.locator('form, input, textarea').count()), 'the panel has a form field')
      const pings = await pingsOf(page)
      expect(pings.length === 1, `pings: ${pings.length}`)
      const b = pings[0]
      expect(b.source === 'sticky-connect-btn' && b.route === new URL(page.url()).pathname, `ping: ${JSON.stringify(b)}`)
      expect(Object.keys(b).sort().join() === 'route,source,utm', `the browser sent more than the page and button: ${JSON.stringify(b)}`)
      // The stored "Schedule a call" link lives here now that the close has one CTA.
      const stored = await page.evaluate(() => JSON.stringify((window as unknown as { __SSR_DATA__?: unknown }).__SSR_DATA__ ?? '').match(/"modalScheduleUrl":\{"default":"([^"]+)"/)?.[1] ?? null)
      if (stored) expect((await panel.getByRole('link', { name: /Schedule a call/ }).getAttribute('href')) === stored, 'the panel does not link the stored schedule URL')
      await page.waitForTimeout(500) // the panel's open animation (0.35s) has finished
      await page.screenshot({ path: path.join(OUT, `connect-${vp}.png`) })
      await page.keyboard.press('Escape')
      await panel.waitFor({ state: 'detached', timeout: 3000 })
    })
    await test('the close reopens the panel without pinging the team a second time', async () => {
      await page.locator('#cta').scrollIntoViewIfNeeded()
      await page.waitForFunction(() => !document.querySelector('.www-sticky--visible'), null, { timeout: 3000 })
      await page.locator('#cta-connect-btn').click()
      await page.getByRole('dialog').getByText("You're all set").waitFor({ timeout: 3000 })
      expect((await pingsOf(page)).length === 1, 'pinged twice')
      expect(/You're all set/.test(await page.locator('#cta-connect-btn').innerText()), 'the close button does not say it is done')
      await page.getByRole('button', { name: 'Close' }).click()
      expect(!watch.escaped.length, `a request reached the real webhook: ${watch.escaped.join(', ')}`)
    })
    await test('the main ask, for someone from Optimizely (the staff mark): asked first; Cancel sends nothing, Send anyway pings once', async () => {
      const staff = await newContext(browser, vp)
      await staff.ctx.addCookies([{ name: 'showcase_staff', value: '1', url: BASE }])
      const sp = await open(staff.ctx, staff.watch, url(ACCOUNT))
      await sp.locator('#cta-connect-btn').click()
      const ask = sp.getByRole('alertdialog')
      await ask.getByText("Seems like you're an Optimizely employee").waitFor({ timeout: 3000 })
      expect(/Send anyway\? This won't be tracked as a conversion\./.test(await ask.innerText()), 'the question is not the one asked for')
      await ask.getByRole('button', { name: 'Cancel' }).click()
      await ask.waitFor({ state: 'detached', timeout: 3000 })
      expect(!(await pingsOf(sp)).length, 'Cancel pinged the team')
      expect(!(await sp.getByRole('dialog').count()), 'Cancel opened the panel')
      await sp.locator('#cta-connect-btn').click()
      await sp.getByRole('alertdialog').getByRole('button', { name: 'Send anyway' }).click()
      await sp.getByRole('dialog').getByText("You're all set").waitFor({ timeout: 3000 })
      const pings = await pingsOf(sp)
      expect(pings.length === 1 && pings[0].source === 'cta-connect-btn', `pings: ${JSON.stringify(pings)}`)
      await sp.waitForTimeout(400)
      await sp.screenshot({ path: path.join(OUT, `connect-staff-${vp}.png`) })
      expect(!staff.watch.escaped.length, `a request reached the real webhook: ${staff.watch.escaped.join(', ')}`)
      await staff.ctx.close()
    })
    if (vp === 'desktop') {
      await test('?review=1 shows where each part came from, and switches the lifecycle state', async () => {
        expect(!(await page.locator('.www-review').count()), 'review layer on the production page')
        const rp = await open(ctx, watch, url(AP_ACCOUNT, 'review=1'))
        await rp.locator('.www-review').waitFor()
        await rp.locator('.www-review__state', { hasText: 'Ex-customer' }).click()
        await rp.waitForURL(/state=ex-customer/)
        await rp.waitForSelector('[data-state="ex-customer"].www-hero__card--ltblue')
        await rp.screenshot({ path: path.join(OUT, 'review-ex-customer.png') })
        await rp.close()
      })
    }
    await shot(page, `agent-platform-${vp}`)
    await ctx.close()
  }

  console.log(`\naccount page, takeout template (a CMS takeout pitch), ${vp}`)
  const { ctx, watch } = await newContext(browser, vp)
  const page = await open(ctx, watch, url(ACCOUNT))

  await test('server-rendered and hydrated without errors', async () => {
    const html = await (await fetch(url(ACCOUNT), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
    expect(html.includes('class="www-page') && html.includes('id="comparison"'), 'the server did not render the takeout page')
    // Its hero's stacked number is a lazy chunk on the server too: a fresh instance's first render
    // left it for the browser, and the edge cache kept that copy (7 Nov 2026).
    expect(!html.includes(BAILED_OUT), 'the server left part of the page for the browser to finish (React #419)')
    expect(!watch.errors.length, watch.errors.join('\n'))
  })
  await test('every section the ODP tracking observes is on the page', async () => {
    for (const id of ['hero', 'intel', 'challenge', 'comparison', 'proof', 'roi', 'migration', 'cta'])
      expect(await page.locator(`#${id}`).count(), `#${id} missing`)
  })
  await test('no sideways scroll', () => noSidewaysScroll(page))
  await test('scenes reveal as they enter, and every scene has revealed by the end', () => revealsAll(page))
  if (vp === 'desktop') {
    await test('desktop: full screen hero at 75% of the window, the next scene peeking in; scenes at least 75%', () => sceneHeights(page, 900))
  }
  await test('the intro plays on load and settles', () => introSettles(page))
  await test('the hero landscape is never upscaled', () => heroImageSharp(page))
  await test('their site screenshot is in the challenge scene, never drawn wider than it was taken', async () => {
    const shotImg = page.locator('#challenge [data-xray="challenge-screenshot"] img')
    if (!(await shotImg.count())) return
    expect(!(await page.locator('#hero [data-xray="challenge-screenshot"]').count()), 'still on the hero')
    const r = await shotImg.evaluate((img: HTMLImageElement) => ({ natural: img.naturalWidth, drawn: img.getBoundingClientRect().width }))
    expect(r.drawn <= r.natural + 1, `drawn ${r.drawn}px wide from a ${r.natural}px capture`)
  })
  await test('the close has one call to action', async () => {
    const n = await page.locator('#cta .www-btn').count()
    expect(n === 1, `${n} buttons in the close`)
  })
  await test('the sticky bar appears past the hero and hides at the contact card', async () => {
    expect(!(await page.locator('.www-sticky--visible').count()), 'visible over the hero')
    await page.locator('#comparison').scrollIntoViewIfNeeded()
    await page.waitForSelector('.www-sticky--visible', { timeout: 3000 })
    await page.locator('#cta').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.querySelector('.www-sticky--visible'), null, { timeout: 3000 })
  })
  await test('one click on the contact button tells the team, says so, and opens the connect panel', async () => {
    await page.locator('#cta-connect-btn').click()
    await page.getByRole('dialog').getByText("You're all set").waitFor({ timeout: 3000 })
    await page.keyboard.press('Escape')
    await page.locator('#cta .www-sent').waitFor({ timeout: 3000 })
    const pings = await pingsOf(page)
    expect(pings.length === 1 && pings[0].source === 'cta-connect-btn' && pings[0].route === new URL(page.url()).pathname, `pings: ${JSON.stringify(pings)}`)
    expect(!watch.escaped.length, `a request reached the real webhook: ${watch.escaped.join(', ')}`)
  })
  if (vp === 'phone') {
    await test('phone: the hero ask is in the first screen', async () => {
      const cta = await page.locator('#hero .www-btn').first().boundingBox()
      expect(cta && cta.y + cta.height <= 844 && cta.x + cta.width <= 390, `hero CTA at ${JSON.stringify(cta)}`)
    })
  }
  await shot(page, `takeout-${vp}`)
  await ctx.close()

  console.log(`\nperson page, ${vp}`)
  {
    const { ctx, watch } = await newContext(browser, vp)
    const page = await open(ctx, watch, url(PERSON))
    await test('server-rendered in the www design and hydrated without errors', async () => {
      const html = await (await fetch(url(PERSON), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
      expect(/class="www-page[^"]*\bwww-person\b/.test(html) && html.includes('id="cta"'), 'the server did not render the www person page')
      expect(!/person__sky|person-galaxy/.test(html), 'the old galaxy page is still rendered')
      expect(!watch.errors.length, watch.errors.join('\n'))
    })
    await test('every scene of the person page is there', async () => {
      for (const id of ['hero', 'note', 'problem', 'operation', 'practice', 'how', 'proof', 'working', 'cta'])
        expect(await page.locator(`#${id}`).count(), `#${id} missing`)
    })
    await test('no sideways scroll', () => noSidewaysScroll(page))
    await test('scenes reveal as they enter, and every scene has revealed by the end', () => revealsAll(page))
    if (vp === 'desktop') {
      await test('desktop: full screen hero at 75% of the window; scenes at least 75%', () => sceneHeights(page, 900))
    }
    await test('the intro plays on load and settles', () => introSettles(page))
    await test('the hero landscape is never upscaled', () => heroImageSharp(page))
    await test('personalization said once: their account logo and the stored eyebrow above the h1', async () => {
      expect((await page.locator('#hero .www-account').count()) === 1, 'no account mark, or two')
      expect(/Written for/i.test(await page.locator('#hero .www-account__label').innerText()), 'the eyebrow is not beside the logo')
    })
    await test('the close has one call to action', async () => {
      const n = await page.locator('#cta .www-btn').count()
      expect(n === 1, `${n} buttons in the close`)
    })
    await test('the sticky bar appears past the hero and hides at the close', async () => {
      await page.evaluate(() => scrollTo(0, 0))
      await page.waitForTimeout(300)
      expect(!(await page.locator('.www-sticky--visible').count()), 'visible over the hero')
      await page.locator('#practice').scrollIntoViewIfNeeded()
      await page.waitForSelector('.www-sticky--visible', { timeout: 3000 })
      await page.locator('#cta').scrollIntoViewIfNeeded()
      await page.waitForFunction(() => !document.querySelector('.www-sticky--visible'), null, { timeout: 3000 })
    })
    await test('one click tells their account executive (the panel names them), once, and asks for no form', async () => {
      await page.locator('#cta-connect-btn').click()
      const panel = page.getByRole('dialog')
      await panel.getByText("You're all set").waitFor({ timeout: 3000 })
      expect(!(await panel.locator('form, input, textarea').count()), 'the panel has a form field')
      expect(/We've let Caleb know/.test(await panel.innerText()), `the panel does not name the account executive: ${(await panel.innerText()).slice(0, 120)}`)
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(OUT, `person-connect-${vp}.png`) })
      await page.keyboard.press('Escape')
      await page.locator('#cta .www-sent').waitFor({ timeout: 3000 })
      const pings = await pingsOf(page)
      expect(pings.length === 1 && pings[0].source === 'cta-connect-btn' && pings[0].route === new URL(page.url()).pathname, `pings: ${JSON.stringify(pings)}`)
      expect(!watch.escaped.length, `a request reached the real webhook: ${watch.escaped.join(', ')}`)
    })
    if (vp === 'phone') {
      await test('phone: the hero ask is in the first screen', async () => {
        await page.evaluate(() => scrollTo(0, 0))
        await page.waitForTimeout(300)
        const cta = await page.locator('#hero .www-btn').first().boundingBox()
        expect(cta && cta.y + cta.height <= 844 && cta.x + cta.width <= 390, `hero CTA at ${JSON.stringify(cta)}`)
      })
    }
    await shot(page, `person-${vp}`)
    await ctx.close()
  }

  console.log(`\noffer page, ${vp}`)
  const o = await newContext(browser, vp)
  const op = await open(o.ctx, o.watch, url(OFFER))
  await test('server-rendered and hydrated without errors', async () => {
    expect(!o.watch.errors.length, o.watch.errors.join('\n'))
  })
  await test('hero, sign-up and every in-page link target exist', async () => {
    expect(await op.locator('#hero h1').count(), 'no hero h1')
    expect(await op.locator('#signup').count(), 'no sign-up card')
    const hrefs = await op.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')!))
    for (const h of new Set(hrefs)) expect(await op.locator(h).count(), `link to ${h} goes nowhere`)
  })
  await test('no sideways scroll', () => noSidewaysScroll(op))
  await test('the intro plays on load and settles', () => introSettles(op))
  await test('the hero landscape is never upscaled', () => heroImageSharp(op))
  await test('scenes reveal as they enter, and every scene has revealed by the end', () => revealsAll(op))
  if (await op.locator('#faq').count()) {
    await test('a FAQ answer opens on click', async () => {
      const item = op.locator('#faq [data-state]').first()
      await op.locator('#faq button').first().click()
      await op.waitForFunction((el) => el?.getAttribute('data-state') === 'open', await item.elementHandle(), { timeout: 2000 })
    })
  }
  await shot(op, `offer-${vp}`)
  // Laura, 3 Nov: a long headline ran to seven lines and pushed the hero past the window, and
  // the extruded run sat on the descenders of the line above. The longest live headline (74
  // characters) and the North Face one she reported, on the page as served.
  // Laura, 3 Nov: tighten the space after "What you'll leave with". Scenes on the same
  // background follow each other at one scene's padding, not two scenes each padded to 75%.
  await test('offer scenes on the same background are one gap apart, not two padded scenes', async () => {
    const lp = await open(o.ctx, o.watch, url('/vb/sitecore-switch-volvo-cars'))
    await lp.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) {
        scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 40))
      }
    })
    await lp.waitForTimeout(1200)
    // No named helpers inside evaluate: tsx wraps them in a __name() the page doesn't have.
    const gaps = await lp.evaluate(() => {
      const scenes = [...document.querySelectorAll<HTMLElement>('section[data-scene][data-tone]')].map((s) => {
        const kids = [...(s.firstElementChild as HTMLElement).children].filter((k) => (k as HTMLElement).offsetHeight)
        return {
          id: s.id,
          tone: s.dataset.tone,
          top: Math.min(...kids.map((k) => k.getBoundingClientRect().top)),
          bottom: Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)),
        }
      })
      const out: Array<{ between: string; gap: number }> = []
      for (let i = 1; i < scenes.length; i++) {
        if (scenes[i].tone !== scenes[i - 1].tone) continue
        out.push({ between: `${scenes[i - 1].id} → ${scenes[i].id}`, gap: Math.round(scenes[i].top - scenes[i - 1].bottom) })
      }
      return out
    })
    expect(gaps.length > 0, 'no two scenes on the same background on this page')
    const limit = vp === 'desktop' ? 130 : 110
    const wide = gaps.filter((g) => g.gap > limit)
    expect(!wide.length, `gaps over ${limit}px: ${wide.map((g) => `${g.between} ${g.gap}px`).join(', ')}`)
    await lp.close()
  })
  for (const long of ['/vb/sitecore-switch-volvo-cars', '/vb/the-north-face-retail-cx-personalization-lab-ralph-lauren-corp']) {
    await test(`a long headline steps down instead of pushing the hero past the window (${long})`, async () => {
      const lp = await open(o.ctx, o.watch, url(long))
      const r = await lp.evaluate(() => {
        const h1 = document.querySelector('#hero h1') as HTMLElement
        const run = h1.querySelector('.origin-bottom-left') as HTMLElement | null
        const before = run?.previousElementSibling ?? run?.parentElement?.previousElementSibling ?? null
        // The last line of the words before the run, when the run starts on a line below it.
        const last = before ? [...before.getClientRects()].at(-1) : undefined
        const top = run?.getBoundingClientRect().top ?? 0
        return {
          hero: document.getElementById('hero')!.getBoundingClientRect().height,
          h1: h1.getBoundingClientRect().height,
          gap: last && top > last.top + 1 ? top - last.bottom : null,
        }
      })
      const vh = vp === 'desktop' ? 900 : 844
      // 75% is the hero's height; a page with two stacked buttons runs a little over, and the
      // next scene must still show (the live page's long headline took it past the window).
      if (vp === 'desktop') expect(r.hero <= vh * 0.8, `hero is ${r.hero}px in a ${vh}px window (want at most 80%)`)
      expect(r.h1 <= vh * 0.45, `the headline is ${r.h1}px tall in a ${vh}px window`)
      expect(r.gap === null || r.gap >= 0, `the extruded run's line starts ${r.gap}px into the line above`)
      await lp.close()
    })
  }
  await o.ctx.close()
}

console.log('\nbooth tools on the agent platform page (signed in, ?search=1)')
{
  const { ctx, watch } = await newContext(browser, 'desktop', { signedIn: true })
  // Mark's edit stream (agent v1.4), answered here: add a tool to their stack, with the field's
  // full new value, the way the agent now sends it. The request it was sent is kept to check.
  let stack: Array<{ Name: string; ColorTag: string | null }> = []
  let sent: { suggested_edit?: string } | null = null
  await ctx.route('**/api/opal-edit-stream', async (route) => {
    sent = route.request().postDataJSON()
    const value = [{ Name: 'Shopify Plus', ColorTag: null }, ...stack]
    const events = [
      { type: 'plan', sections: ['What they run today'], summary: 'e2e' },
      { type: 'section_focus', section: 'What they run today' },
      { type: 'edit', index: 1, section: 'What they run today', target: 'stack tool', kind: 'item-add', status: 'applied', old: '', new: 'Shopify Plus', field: 'techStack', value },
      { type: 'commit', status: 'saving', edits: 1 },
      { type: 'done', saved: true },
    ]
    const body = events.map((e) => `data: ${JSON.stringify({ k: 'text', t: JSON.stringify(e) })}\n\n`).join('') + `data: {"k":"done"}\n\n`
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
  })
  const page = await open(ctx, watch, url(AP_ACCOUNT, 'search=1'))
  // The stored stack, from the server HTML's hydration data (the page drops it once hydrated).
  {
    const html = await (await fetch(url(AP_ACCOUNT), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
    const data = JSON.parse(html.match(/window\.__SSR_DATA__=(\{[\s\S]*?\})<\/script>/)![1]) as { techStack?: typeof stack }
    stack = data.techStack ?? []
  }
  const onPage = await page.evaluate(
    (ids) => ids.filter((id) => document.querySelector(`[data-xray="${id}"]`)),
    ABM_XRAY_DEFAULTS.map((s) => s.id),
  )
  await test(`X-ray outlines every section on the page (${onPage.length}), the new ones included`, async () => {
    for (const id of AGENT_PLATFORM_XRAY.map((s) => s.id)) expect(onPage.includes(id), `no hook for ${id}`)
    await page.getByRole('button', { name: 'Enter X-ray mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('.xray-card').length >= n, onPage.length, { timeout: 8000 })
    const titles = await page.$$eval('.xray-card__title', (els) => els.map((e) => e.textContent))
    for (const t of ABM_XRAY_DEFAULTS.filter((s) => onPage.includes(s.id)).map((s) => s.title)) expect(titles.includes(t), `no X-ray card for "${t}"`)
    await page.screenshot({ path: path.join(OUT, 'booth-xray-agent-platform.png') })
    await page.getByRole('button', { name: 'Exit X-ray mode' }).click()
  })
  const editable = await page.evaluate((secs) => secs.filter((s) => document.querySelector(s.selector)).map((s) => s.title), AGENT_PLATFORM_EDIT.map((s) => ({ selector: s.selector, title: s.title })))
  await test(`Edit mode offers ${editable.length} parts: the page fields and the page's own text, the headline included`, async () => {
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('[aria-label^="Leave feedback on "]').length === n, editable.length, { timeout: 8000 })
    const labels = await page.$$eval('[aria-label^="Leave feedback on "]', (els) => els.map((e) => e.getAttribute('aria-label')!.replace('Leave feedback on ', '')))
    expect(JSON.stringify(labels.sort()) === JSON.stringify([...editable].sort()), `offered: ${labels.join(', ')}`)
    // Michiel, 3 Nov: "things like H1 also weren't [editable]. Most content should be."
    for (const t of ['Headline', 'Subtitle', 'Who we are', 'First 90 days', 'Close']) expect(labels.includes(t), `not offered: ${t}`)
  })
  await test('Mark\'s edit shows live: the section in focus is spotlit and the real page re-renders from the new value', async () => {
    await page.locator('[aria-label="Leave feedback on What they run today"]').click()
    await page.locator('.edit-popup__hint').waitFor({ timeout: 3000 })
    await page.locator('.edit-popup__textarea').fill('They run Shopify Plus now')
    await page.locator('.edit-popup__btn--primary').click()
    await page.locator('[aria-label="Send feedback"]').click()
    await page.waitForSelector('.edit-spot--on', { timeout: 8000 })
    await page.waitForFunction(() => /Shopify Plus/.test(document.querySelector('[data-xray="tech-stack"]')?.textContent || ''), null, { timeout: 15000 })
    // The rest of their stack is still there: the page re-rendered from the whole new value.
    const tiles = await page.locator('[data-xray="tech-stack"] .www-tile').count()
    expect(stack.length > 0 && tiles > 1, `only ${tiles} tile(s) after the edit (stored stack: ${stack.length})`)
    // The changed parts glow once the re-render has landed (two frames after the new value).
    await page.waitForFunction(
      () => [...document.querySelectorAll('.live-changed')].some((e) => ((e as HTMLElement).dataset.field || '').split(' ').includes('techStack')),
      null,
      { timeout: 3000 },
    )
    await page.screenshot({ path: path.join(OUT, 'booth-edit-agent-platform.png') })
    const ask = sent?.suggested_edit ?? ''
    expect(/^Page template: agent platform\./.test(ask) && /Section: What they run today\nFields: techStack\nFeedback: They run Shopify Plus now/.test(ask), `sent: ${ask}`)
  })
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nEdit mode on the agent platform page: the page\'s own text (the headline)')
{
  const { ctx, watch } = await newContext(browser, 'desktop', { signedIn: true })
  // Mark rewrites the headline: a copy field, so no update_page. The route answers with the
  // copy it saved (api/opal-edit-stream.ts), and Edit mode reloads without waiting for the CMS.
  let sent: { suggested_edit?: string; page_key?: string } | null = null
  let statusPolls = 0
  const NEW_H1 = 'Your stack already knows. ##Agents act on it##.'
  await ctx.route('**/api/opal-edit-stream', async (route) => {
    sent = route.request().postDataJSON()
    const events = [
      { type: 'section_focus', section: 'Headline' },
      { type: 'edit', index: 1, section: 'Headline', target: 'headline', kind: 'text', status: 'applied', old: '', new: NEW_H1, field: 'copy.hero.h1', value: NEW_H1 },
      { type: 'done', saved: true },
    ]
    const body =
      events.map((e) => `data: ${JSON.stringify({ k: 'text', t: JSON.stringify(e) })}\n\n`).join('') +
      `data: ${JSON.stringify({ k: 'copy', saved: ['hero.h1'] })}\n\ndata: {"k":"done"}\n\n`
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
  })
  await ctx.route('**/api/edit-status**', (route) => {
    statusPolls++
    return route.fulfill({ json: { changed: false } })
  })
  const page = await open(ctx, watch, url(AP_ACCOUNT, 'search=1'))
  const before = await page.locator('#hero h1').innerText()
  await test('Mark\'s new headline shows live, and Edit mode reloads without waiting for a CMS republish', async () => {
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.locator('[aria-label="Leave feedback on Headline"]').click()
    await page.locator('.edit-popup__textarea').fill('Make it about what their stack already knows')
    await page.locator('.edit-popup__btn--primary').click()
    const started = Date.now()
    const reloaded = page.waitForURL(/[?&]refresh=\d+/, { timeout: 60000 })
    await page.locator('[aria-label="Send feedback"]').click()
    await page.waitForFunction(() => /Agents act on it/.test(document.querySelector('#hero h1')?.textContent || ''), null, { timeout: 15000 })
    expect(!/Agents act on it/.test(before), 'the headline already said it')
    await page.screenshot({ path: path.join(OUT, 'booth-edit-headline.png') })
    await reloaded
    // Well inside the 120 s a CMS republish wait would take (the live preview and the replay take ~10 s).
    expect(Date.now() - started < 45000, `the reload took ${Date.now() - started}ms`)
    expect(statusPolls === 0, `polled the CMS republish ${statusPolls} times for a copy-only edit`)
    const ask = sent?.suggested_edit ?? ''
    expect(/Section: Headline\nFields: copy\.hero\.h1\nNow:\n {2}copy\.hero\.h1 = "[^"]+"\nFeedback: Make it about/.test(ask), `sent: ${ask}`)
    expect(/^[a-f0-9]{32}$/i.test(sent?.page_key ?? ''), `no page key sent (${sent?.page_key})`)
  })
  await test('no errors, and nothing reached the real webhooks (headline edit)', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nEdit mode on the agent platform page when Mark saves without narrating (agent v1.4.2 did)')
{
  const { ctx, watch } = await newContext(browser, 'desktop', { signedIn: true })
  // The stored page, and the same page as Mark saved it: one tool added to the stack.
  const slug = AP_ACCOUNT.replace(/^\/+|\/+$/g, '')
  const stored = (await (await fetch(`${BASE}/api/content?slug=${encodeURIComponent(slug)}`, { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).json()) as { techStack?: Array<{ Name: string; ColorTag: string | null }> }
  const saved = { ...stored, techStack: [{ Name: 'Shopify Plus', ColorTag: null }, ...(stored.techStack ?? [])] }
  await ctx.route('**/api/opal-edit-stream', async (route) => {
    // Only the terminal event: no plan, no focus, no edit lines.
    const done = { type: 'done', saved: true, changes: ['Added Shopify Plus to the stack'] }
    const body = `data: ${JSON.stringify({ k: 'tool', name: 'update_page', phase: 'result', ok: true })}\n\ndata: ${JSON.stringify({ k: 'text', t: JSON.stringify(done) })}\n\ndata: {"k":"done"}\n\n`
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
  })
  // The save is live at once, and the saved page is what the content API answers after it.
  await ctx.route('**/api/edit-status**', (route) => route.fulfill({ json: { changed: true, published: '2026-01-01T00:00:00.000Z' } }))
  await ctx.route(/\/api\/content\?slug=[^&]+&_=/, (route) => route.fulfill({ json: saved }))
  const page = await open(ctx, watch, url(AP_ACCOUNT, 'search=1'))
  await test('the saved change is shown on the page before the reload: spotlight, re-render, glow', async () => {
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.locator('[aria-label="Leave feedback on What they run today"]').click()
    await page.locator('.edit-popup__textarea').fill('They use Shopify Plus too')
    await page.locator('.edit-popup__btn--primary').click()
    await page.locator('[aria-label="Send feedback"]').click()
    await page.waitForSelector('.edit-spot--on', { timeout: 15000 })
    await page.waitForFunction(() => /Shopify Plus/.test(document.querySelector('[data-xray="tech-stack"]')?.textContent || ''), null, { timeout: 15000 })
    await page.waitForFunction(() => [...document.querySelectorAll('.live-changed')].some((e) => ((e as HTMLElement).dataset.field || '').split(' ').includes('techStack')), null, { timeout: 3000 })
    await page.screenshot({ path: path.join(OUT, 'booth-edit-replay.png') })
  })
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nbooth tools on the takeout page (signed in, ?search=1)')
{
  const { ctx, watch } = await newContext(browser, 'desktop', { signedIn: true })
  // Mark's edit stream, answered here, as the agent sends it: each applied edit with its field and
  // the field's full new value. One to the hero headline, one to a part the page newly offers.
  let heroText = ''
  let asked = ''
  await ctx.route('**/api/opal-edit-stream', async (route) => {
    asked = route.request().postData() || ''
    const events = [
      { type: 'plan', sections: ['Hero headline', 'Comparison headline'], summary: 'e2e' },
      { type: 'section_focus', section: 'Hero headline' },
      { type: 'edit', section: 'Hero headline', target: 'headline', kind: 'text', action: 'replace', status: 'applied', old: heroText, new: 'Rewritten by the e2e test', field: 'headline', value: 'Rewritten by the e2e test' },
      { type: 'section_focus', section: 'Comparison headline' },
      { type: 'edit', section: 'Comparison headline', target: 'comparisonHeadline', kind: 'text', action: 'replace', status: 'applied', old: '', new: 'Compared by the e2e test', field: 'comparisonHeadline', value: 'Compared by the e2e test' },
      { type: 'commit', status: 'ok', edits: 2 },
      { type: 'done', saved: true },
    ]
    const body = events.map((e) => `data: ${JSON.stringify({ k: 'text', t: JSON.stringify(e) })}\n\n`).join('') + `data: {"k":"done"}\n\n`
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
  })
  const page = await open(ctx, watch, url(ACCOUNT, 'search=1'))
  heroText = (await page.locator('[data-xray="hero-title"] h1').innerText()).replace(/\s+/g, ' ').trim()

  const onPage = await page.evaluate(
    (ids) => ids.filter((id) => document.querySelector(`[data-xray="${id}"]`)),
    ABM_XRAY_DEFAULTS.map((s) => s.id),
  )

  await test('the page tools render for a signed-in employee', async () => {
    await page.getByRole('button', { name: 'Enter X-ray mode' }).waitFor({ timeout: 5000 })
  })
  await test(`X-ray outlines every section on the page (${onPage.length})`, async () => {
    await page.getByRole('button', { name: 'Enter X-ray mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('.xray-card').length >= n, onPage.length, { timeout: 8000 })
    const titles = await page.$$eval('.xray-card__title', (els) => els.map((e) => e.textContent))
    const want = ABM_XRAY_DEFAULTS.filter((s) => onPage.includes(s.id)).map((s) => s.title)
    for (const t of want) expect(titles.includes(t), `no X-ray card for "${t}"`)
    await page.screenshot({ path: path.join(OUT, 'booth-xray.png') })
    await page.getByRole('button', { name: 'Exit X-ray mode' }).click()
  })
  const editable = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-xray="${id}"]`)), TAKEOUT_EDIT.map((s) => s.id))
  await test(`Edit mode offers every part of the takeout page (${editable.length} of ${TAKEOUT_EDIT.length}), each named for Mark`, async () => {
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('[aria-label^="Leave feedback on "]').length >= n, editable.length, { timeout: 8000 })
    const labels = await page.$$eval('[aria-label^="Leave feedback on "]', (els) => els.map((e) => e.getAttribute('aria-label')!.replace('Leave feedback on ', '')))
    for (const s of TAKEOUT_EDIT.filter((x) => editable.includes(x.id))) expect(labels.includes(s.title), `"${s.title}" is not offered`)
    expect(editable.length >= TAKEOUT_EDIT.length - 3, `only ${editable.length} of the parts are on the page`)
  })
  await test("Mark is told each section's fields, and his streamed values re-render the page live", async () => {
    // The edit overlay is aria-hidden from the page's own tree, so find the box by its label.
    for (const [part, note] of [['Hero headline', 'Make it about every CDW brand'], ['Comparison headline', 'Name AEM as a Service']]) {
      await page.locator(`[aria-label="Leave feedback on ${part}"]`).click()
      await page.locator('.edit-popup__textarea').fill(note)
      await page.locator('.edit-popup__btn--primary').click()
    }
    await page.locator('[aria-label="Send feedback"]').click()
    await page.waitForFunction(
      () =>
        /Rewritten by the e2e test/.test(document.querySelector('[data-xray="hero-title"]')?.textContent || '') &&
        /Compared by the e2e test/.test(document.querySelector('[data-xray="comparison-heading"]')?.textContent || ''),
      null,
      { timeout: 15000 },
    )
    const req = JSON.parse(asked || '{}').suggested_edit || ''
    expect(/Section: Hero headline\nFields: headline\n/.test(req), `the request does not name the headline field: ${req.slice(0, 200)}`)
    expect(/Section: Comparison headline\nFields: comparisonHeadline, comparisonDescription, competitorName\n/.test(req), 'the request does not name the comparison fields')
    // React drew it from the value (the element that shows the field flashed), not a retyped overlay.
    expect(await page.locator('[data-field="headline"]').count(), 'the headline has no data-field')
    await page.screenshot({ path: path.join(OUT, 'booth-edit.png') })
  })
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nbooth tools on the person page (signed in, ?search=1)')
{
  const { ctx, watch } = await newContext(browser, 'desktop', { signedIn: true })
  let asked = ''
  await ctx.route('**/api/opal-edit-stream', async (route) => {
    asked = route.request().postData() || ''
    const events = [
      { type: 'plan', sections: ['The note'], summary: 'e2e' },
      { type: 'section_focus', section: 'The note' },
      { type: 'done', saved: false },
    ]
    const body = events.map((e) => `data: ${JSON.stringify({ k: 'text', t: JSON.stringify(e) })}\n\n`).join('') + `data: {"k":"done"}\n\n`
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
  })
  const page = await open(ctx, watch, url(PERSON, 'search=1'))
  const onPage = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-xray="${id}"]`)), PERSON_XRAY_DEFAULTS.map((s) => s.id))
  await test('the page tools render for a signed-in employee', async () => {
    await page.getByRole('button', { name: 'Enter X-ray mode' }).waitFor({ timeout: 5000 })
  })
  await test(`X-ray outlines every part of the person page (${onPage.length} of ${PERSON_XRAY_DEFAULTS.length})`, async () => {
    expect(onPage.length >= PERSON_XRAY_DEFAULTS.length - 2, `only ${onPage.join(', ')}`)
    await page.getByRole('button', { name: 'Enter X-ray mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('.xray-card').length >= n, onPage.length, { timeout: 8000 })
    const titles = await page.$$eval('.xray-card__title', (els) => els.map((e) => e.textContent))
    for (const t of PERSON_XRAY_DEFAULTS.filter((s) => onPage.includes(s.id)).map((s) => s.title)) expect(titles.includes(t), `no X-ray card for "${t}"`)
    await page.screenshot({ path: path.join(OUT, 'booth-person-xray.png') })
    await page.getByRole('button', { name: 'Exit X-ray mode' }).click()
  })
  await test('Edit mode offers every part of the person page and names its fields for Mark', async () => {
    const editable = PERSON_EDIT.filter((s) => onPage.includes(s.id))
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('[aria-label^="Leave feedback on "]').length >= n, editable.length, { timeout: 8000 })
    const labels = await page.$$eval('[aria-label^="Leave feedback on "]', (els) => els.map((e) => e.getAttribute('aria-label')!.replace('Leave feedback on ', '')))
    for (const s of editable) expect(labels.includes(s.title), `"${s.title}" is not offered`)
    await page.locator('[aria-label="Leave feedback on The note"]').click()
    await page.locator('.edit-popup__textarea').fill('Shorter, please')
    await page.locator('.edit-popup__btn--primary').click()
    await page.locator('[aria-label="Send feedback"]').click()
    await page.waitForFunction(() => true, null, { timeout: 2000 })
    for (let i = 0; i < 30 && !asked; i++) await page.waitForTimeout(200)
    const req = JSON.parse(asked || '{}').suggested_edit || ''
    expect(/Section: The note\nFields: noteBody, noteSignedBy, noteSignedByRole, noteSignedByInitials, noteDate\nFeedback: Shorter, please/.test(req), `the request does not name the note's fields: ${req.slice(0, 200)}`)
  })
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nthe CMS preview (/preview, as the CMS opens it in its editor)')
{
  const CMS = 'https://app-opti01saas4uc99t001.cms.optimizely.com'
  const keyOf = async (q: string) => ((await (await fetch(`${BASE}/api/content?${q}`, { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).json()) as { _metadata?: { key?: string } })._metadata?.key
  const accountKey = await keyOf(`slug=${encodeURIComponent(ACCOUNT.replace(/^\/|\/$/g, ''))}`)
  const apKey = await keyOf(`slug=${encodeURIComponent(AP_ACCOUNT.replace(/^\/|\/$/g, ''))}`)
  const offerKey = await keyOf(`kind=experience&slug=${encodeURIComponent(OFFER.replace(/^\/vb\/|\/$/g, ''))}`)
  const personKey = await keyOf(`slug=${encodeURIComponent(PERSON.replace(/^\/|\/$/g, ''))}`)
  const { ctx, watch } = await newContext(browser, 'desktop')
  // The CMS's editor script is the CMS's own: stood in here, and noted, so the test stays on this machine.
  const injector: string[] = []
  await ctx.route(`${CMS}/**`, (route) => {
    injector.push(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.__injector = true' })
  })
  // Every draft fetch, noted. A token the test makes up is taken off before the request goes on, so
  // the stand-in server reads the published page with its own key instead of failing the token.
  const drafts: string[] = []
  await ctx.route('**/api/preview?**', (route) => {
    const u = new URL(route.request().url())
    drafts.push(u.search)
    u.searchParams.delete('preview_token')
    return route.continue({ url: u.toString() })
  })
  const savesFor = async (page: Page, previewUrl: string, token: string) =>
    page.evaluate(
      ([u, t]) => {
        // What the CMS sends on a save: the editor's token and where the edit was, then "ready".
        window.dispatchEvent(new CustomEvent('optimizely:cms:contentSaved', { detail: { previewUrl: u, previewToken: t, nodeIds: [] } }))
        window.dispatchEvent(new CustomEvent('optimizely:cms:contentSaved', { detail: { previewUrl: u, previewToken: 'ready' } }))
      },
      [previewUrl, token] as const,
    )

  await test('the keys of the pages under test were found', async () => {
    expect(accountKey && apKey && offerKey && personKey, `account ${accountKey}, agent platform ${apKey}, offer ${offerKey}, person ${personKey}`)
  })
  const page = await open(ctx, watch, `${BASE}/preview?key=${accountKey}&loc=en&ctx=edit`)
  await test('a takeout pitch in the editor is the takeout page in the new design, as at its address', async () => {
    await page.waitForSelector('.www-page #comparison', { timeout: 10000 })
    expect(!(await page.locator('.www-ap, .abm-page').count()), 'not the takeout page')
  })
  await test('the page lays out for a fixed window, so the frame the CMS sizes to it cannot run away', async () => {
    // The CMS sets its frame to the page's height. Stand in for that: a frame 20 times taller.
    const before = await page.evaluate(() => document.documentElement.scrollHeight)
    await page.setViewportSize({ width: 1440, height: 18000 })
    await page.waitForTimeout(400)
    const after = await page.evaluate(() => document.documentElement.scrollHeight)
    const hero = await page.evaluate(() => document.querySelector('#hero')?.getBoundingClientRect().height ?? 0)
    await page.setViewportSize({ width: 1440, height: 900 })
    expect(after <= Math.max(before, 18000) + 2 && Math.abs(after - before) < 50 + Math.max(0, 18000 - before), `page ${before}px in a 900px frame, ${after}px in an 18,000px one`)
    expect(hero > 300 && hero < 900, `the hero is ${hero}px tall in an 18,000px frame`)
  })
  await test("the CMS's editor script is loaded from the CMS", async () => {
    await page.waitForFunction(() => (window as unknown as { __injector?: boolean }).__injector === true, null, { timeout: 5000 })
    expect(injector.some((u) => u === `${CMS}/util/javascript/communicationinjector.js`), injector.join(', '))
  })
  await test('every stored field the takeout page shows is outlined for the editor (data-epi-edit)', async () => {
    const hooks = await page.$$eval('[data-epi-edit]', (els) => [...new Set(els.map((e) => e.getAttribute('data-epi-edit')))])
    for (const f of ['headline', 'subheadline', 'customerLogo', 'techStack', 'challengeHeadline', 'comparisonTableRows', 'competitorName', 'roiTitle', 'timelinePhases', 'ctaTitle', 'teamMembers'])
      expect(hooks.includes(f), `no hook for ${f}: ${hooks.join(', ')}`)
  })
  await test('a save the CMS reports refreshes the draft in place: fetched again, the page never reloads', async () => {
    await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1))
    const before = drafts.length
    await savesFor(page, page.url(), 'same-token')
    const t0 = Date.now()
    while (drafts.length === before && Date.now() - t0 < 5000) await page.waitForTimeout(100)
    expect(drafts.length === before + 1, `${drafts.length - before} draft fetches after a save`)
    expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept === 1), 'the page reloaded')
  })
  await test("a save with the editor's new token loads the draft with that token, still without a reload", async () => {
    const before = drafts.length
    const next = new URL(page.url())
    next.searchParams.set('preview_token', 'e2e-new-token')
    await savesFor(page, next.toString(), 'e2e-new-token')
    const t0 = Date.now()
    while (drafts.length === before && Date.now() - t0 < 5000) await page.waitForTimeout(100)
    expect(drafts.slice(before).some((q) => new URLSearchParams(q).get('preview_token') === 'e2e-new-token'), `fetched ${drafts.slice(before).join(' | ')}`)
    expect(new URL(page.url()).searchParams.get('preview_token') === 'e2e-new-token', `the address is ${page.url()}`)
    expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept === 1), 'the page reloaded')
    await page.waitForSelector('.www-page #comparison')
  })
  await test('in the preview the one-click ask tells nobody', async () => {
    await page.locator('#cta-connect-btn').click()
    await page.getByRole('dialog').getByText("You're all set").waitFor({ timeout: 3000 })
    await page.keyboard.press('Escape')
    expect(!(await pingsOf(page)).length, 'the preview pinged the team')
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await shot(page, 'cms-preview-account')

  // A preview token lives five minutes. An old one gets a plain message, and the page stays its
  // own size in the CMS's frame (it grew to Chrome's 16,777,213 px limit on the error screen).
  {
    const tp = await ctx.newPage()
    await tp.route('**/api/preview?**', (route) =>
      route.fulfill({ status: 401, json: { error: 'The preview token was refused (Token expired)', expired: true } }),
    )
    await tp.setViewportSize({ width: 1440, height: 18000 })
    await tp.goto(`${BASE}/preview?key=${accountKey}&loc=en&ctx=edit&preview_token=expired`)
    await test('an expired preview says so, and stays its own size in a frame sized to it', async () => {
      await tp.getByText('This preview has timed out').waitFor({ timeout: 8000 })
      const h = await tp.evaluate(() => document.documentElement.scrollHeight)
      expect(h <= 18000 && (await tp.evaluate(() => document.querySelector('h1')?.getBoundingClientRect().top ?? 1e9)) < 600, `error screen in an 18,000px frame: page ${h}px, message out of sight`)
    })
    await tp.close()
  }

  const apView = await open(ctx, watch, `${BASE}/preview?key=${apKey}&loc=en&ctx=edit`)
  await test('an agent platform pitch in the editor is the agent platform page, its CMS fields outlined and its template copy not', async () => {
    await apView.waitForSelector('.www-page.www-ap', { timeout: 10000 })
    const hooks = await apView.$$eval('[data-epi-edit]', (els) => [...new Set(els.map((e) => e.getAttribute('data-epi-edit')))])
    for (const f of ['customerLogo', 'techStack', 'stakeholders']) expect(hooks.includes(f), `no hook for ${f}: ${hooks.join(', ')}`)
    expect(!hooks.some((h) => h?.startsWith('copy.')), `a template copy key is outlined: ${hooks.join(', ')}`)
  })
  await shot(apView, 'cms-preview-agent-platform')

  const plainView = await open(ctx, watch, `${BASE}/preview?key=${accountKey}&loc=en&ctx=preview`)
  await test("the CMS's plain preview (ctx=preview) is the reader's page, with no editing hooks", async () => {
    await plainView.waitForSelector('.www-page #comparison')
    expect(!(await plainView.locator('[data-epi-edit], [data-epi-block-id]').count()), 'editing hooks outside the editor')
  })

  const op = await open(ctx, watch, `${BASE}/preview?key=${offerKey}&loc=en&ctx=edit`)
  await test('an offer draft in the editor is the www offer page, every section outlined by its node', async () => {
    await op.waitForSelector('.www-page.www-offer', { timeout: 10000 })
    // The intro scene is the hero section's opening paragraph drawn on its own: the paragraph is
    // outlined (an element of the hero section), the scene is not a section of its own.
    const sections = await op.$$eval('section[data-scene]:not(#intro)', (els) => els.map((e) => e.getAttribute('data-epi-block-id')))
    expect(sections.length > 3 && sections.every(Boolean), `sections: ${JSON.stringify(sections)}`)
    if (await op.locator('#intro').count()) expect(await op.locator('#intro [data-epi-block-id]').count(), 'the intro paragraph is not outlined')
    expect((await op.locator('#main-content [data-epi-block-id]').count()) > sections.length, 'the elements are not outlined')
  })
  await shot(op, 'cms-preview-offer')

  const pv = await open(ctx, watch, `${BASE}/preview?key=${personKey}&loc=en&ctx=edit`)
  await test('a person page in the editor is the www person page, its stored fields outlined, and its ask tells nobody', async () => {
    await pv.waitForSelector('.www-page.www-person #note', { timeout: 10000 })
    const hooks = await pv.$$eval('[data-epi-edit]', (els) => [...new Set(els.map((e) => e.getAttribute('data-epi-edit')))])
    for (const f of ['heroEyebrow', 'companyLogo', 'noteBody', 'scorecard', 'provenance', 'solutions', 'peerProof', 'team', 'ctaTitle', 'footerLine'])
      expect(hooks.includes(f), `no hook for ${f}: ${hooks.join(', ')}`)
    await pv.locator('#cta-connect-btn').click()
    await pv.getByRole('dialog').getByText("You're all set").waitFor({ timeout: 3000 })
    await pv.keyboard.press('Escape')
    expect(!(await pingsOf(pv)).length, 'the preview pinged the team')
  })
  await shot(pv, 'cms-preview-person')
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nview transitions: the search page and the pages it opens, both ways')
{
  // Its own browser: the back/forward cache is what brings the search page back as it was, and
  // Playwright turns it off by default. No service worker, so the stand-ins below answer.
  const vtBrowser = await chromium.launch({ channel: 'chrome', args: ['--disable-features=AsyncDns'], ignoreDefaultArgs: ['--disable-back-forward-cache'] })
  const SEARCH_ME = 'e2e@optimizely.com'
  const meta = (route: string) => ({ url: { default: route, hierarchical: route }, published: '2026-11-01T00:00:00Z' })
  const index = {
    companies: [{ _metadata: meta(ACCOUNT), headline: 'One platform', eyebrow: 'Personalized for CDW', competitorName: 'Adobe', brandDomain: 'cdw.com', brandAccentColor: null, customerLogo: null, intelHeadline: 'We know <em>CDW</em>' }],
    total: 1,
    people: [{ _metadata: meta(PERSON), personName: 'Ben Yu', personTitle: 'Head of Brand', personInitials: 'BY', companyName: 'Logitech G', companyLogo: null, brandAccentColor: null }],
    mine: [],
    viewer: SEARCH_ME,
  }
  // One running offer with one page: the offer page the suite already reads (OFFER).
  const offerPage = { route: OFFER.replace(/^\//, ''), companyName: 'Scale AI', domain: 'scale.com', logoUrl: null, published: '2026-11-01T00:00:00Z' }
  const running = { id: 'e2e-offer', title: 'No account left behind', windowStart: '2026-11-01', windowEnd: '2026-12-31', look: null, pages: [offerPage], fromSearch: 'off' }
  const vtContext = async (opts: { reducedMotion?: 'reduce' } = {}) => {
    const ctx = await vtBrowser.newContext({ ...VIEWPORTS.desktop, serviceWorkers: 'block', reducedMotion: opts.reducedMotion ?? 'no-preference', extraHTTPHeaders: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined })
    const watch: Watch = { errors: [], escaped: [] }
    await ctx.route('**/api/auth/me', (route) => route.fulfill({ json: { email: SEARCH_ME, name: 'E2E' } }))
    await ctx.route('**/api/home-index', (route) => route.fulfill({ json: index }))
    await ctx.route('**/api/offers', (route) => route.fulfill({ json: { offers: [running] } }))
    await ctx.route('**/api/offers/**', (route) => {
      watch.escaped.push(route.request().url())
      return route.fulfill({ status: 404, json: { error: 'not in this test' } })
    })
    await ctx.route('**/api/page-builds', (route) => route.fulfill({ json: { builds: [] } }))
    await ctx.route('**/api/edit-status**', (route) => route.fulfill({ json: { changed: false, published: '2026-01-01T00:00:00.000Z' } }))
    // The booth rail's own reads: no Report (it shows its error state), no shared links yet.
    await ctx.route('**/api/page-activity**', (route) => route.fulfill({ status: 404, json: { error: 'not here' } }))
    await ctx.route('**/api/share-links**', (route) => route.fulfill({ json: { links: [] } }))
    await ctx.route('**/api/page-visit', (route) => route.fulfill({ status: 204, body: '' }))
    for (const pattern of ['**/api/cta-ping', 'https://webhook.opal.optimizely.com/**', 'https://webhook.mark.optimizely.com/**']) {
      await ctx.route(pattern, (route) => {
        watch.escaped.push(route.request().url())
        return route.fulfill({ status: 202, json: { ok: true } })
      })
    }
    // What each document's view transition did, written down before the page's own scripts run.
    await ctx.addInitScript(() => {
      type VT = { ready: Promise<void>; finished: Promise<void>; types?: Set<string> }
      const w = window as unknown as { __vt: Array<Record<string, unknown>> }
      w.__vt = []
      addEventListener('pageshow', (e) => w.__vt.push({ at: 'pageshow', persisted: (e as PageTransitionEvent).persisted }))
      // The server's page, marked as it is parsed: the app must take it over, not replace it. A
      // boundary updated before it had hydrated was thrown away for the spinner, a full-window
      // flash as the morph settled (7 Nov 2026).
      document.addEventListener('DOMContentLoaded', () => {
        const ssr = document.querySelector('.www-page') as (Element & { __ssr?: boolean }) | null
        if (ssr) ssr.__ssr = true
        const root = document.getElementById('root')
        if (root)
          new MutationObserver(() => {
            if (root.querySelector('.animate-spin')) (window as unknown as { __spinner?: boolean }).__spinner = true
          }).observe(root, { childList: true, subtree: true })
      })
      addEventListener('pagereveal', (e) => {
        const vt = (e as Event & { viewTransition?: VT | null }).viewTransition
        w.__vt.push({ at: 'reveal', vt: !!vt })
        vt?.ready.then(() => {
          // Every named part that animates: it moves (its group), or only fades in or out (its
          // new or old image: the search page's own layers have no counterpart on the page).
          const groups = document
            .getAnimations()
            .map((a) => (a.effect as KeyframeEffect | null)?.pseudoElement || '')
            .map((p) => /^::view-transition-(?:group|old|new)\((.+)\)$/.exec(p)?.[1] ?? '')
            .filter(Boolean)
          // Where the hero's logo is as the morph sets off, and the rail's room under it.
          const logo = document.querySelector('.www-hero .www-account__logo')
          const railOut = document
            .getAnimations()
            .some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-old(vt-rail)' && (a as CSSAnimation).animationName === 'vt-rail-out')
          const hero = document.querySelector('.www-hero__img')
          w.__vt.push({
            at: 'ready',
            t: performance.now(),
            groups: [...new Set(groups)],
            types: vt.types ? [...vt.types] : [],
            logoLeft: logo ? Math.round(logo.getBoundingClientRect().left) : null,
            room: getComputedStyle(document.body).paddingLeft,
            railOut,
            heroContent: hero ? getComputedStyle(hero).content : null,
            // Which animation each part runs ("::view-transition-old(vt-scene) vt-scene-square").
            moves: document
              .getAnimations()
              .map((a) => `${(a.effect as KeyframeEffect | null)?.pseudoElement ?? ''} ${(a as CSSAnimation).animationName ?? ''}`)
              .filter((m) => m.startsWith('::view-transition')),
          })
        })
        // A tick later: the page's own clean-up runs on the same promise, after this one.
        vt?.finished.then(() => {
          const t = performance.now()
          setTimeout(() => w.__vt.push({ at: 'finished', t, named: document.querySelectorAll('[data-vt-named]').length }), 0)
        })
      })
    })
    return { ctx, watch }
  }
  const log = (page: Page) => page.evaluate(() => (window as unknown as { __vt: Array<Record<string, unknown>> }).__vt)
  const lastReady = async (page: Page) => {
    const t0 = Date.now()
    while (Date.now() - t0 < 8000) {
      const entries = await log(page).catch(() => [])
      const ready = [...entries].reverse().find((x) => x.at === 'ready') as
        | { t: number; groups: string[]; types: string[]; logoLeft: number | null; room: string; railOut: boolean; heroContent: string | null; moves: string[] }
        | undefined
      const finished = [...entries].reverse().find((x) => x.at === 'finished') as { t: number } | undefined
      // How long it ran: a transition the page cancels (its own start, a resize) ends in a few ms.
      if (ready && finished) return { ...ready, ran: Math.round(finished.t - ready.t) }
      await page.waitForTimeout(100)
    }
    return null
  }
  /** The photograph the search page shows: its top layer that is in. */
  const searchPhoto = (page: Page) =>
    page.evaluate(() => ([...document.querySelectorAll('.sh-scene__layer.is-in .sh-scene__img')].pop() as HTMLImageElement | undefined)?.currentSrc ?? '')
  const search = async (page: Page, q: string) => {
    await page.goto(url('/search'), { waitUntil: 'domcontentloaded' })
    await page.locator('.sh-search__input').waitFor({ timeout: 10000 })
    await page.locator('.sh-search__input').fill(q)
    await page.locator('[data-vt-slug]').first().waitFor({ timeout: 8000 })
  }

  const { ctx, watch } = await vtContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => watch.errors.push(`pageerror: ${e.message}`))
  const slug = ACCOUNT.replace(/^\/|\/$/g, '')
  await searchTest('both documents opt in, and the boot script is in both <head>s', async () => {
    for (const path of ['/search', ACCOUNT]) {
      const html = await (await fetch(url(path), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
      const head = html.slice(0, html.indexOf('</head>'))
      expect(/addEventListener\('pagereveal'/.test(head) && /addEventListener\('pageswap'/.test(head), `${path}: no boot script in <head>`)
      expect(!html.includes('data-view-transitions-boot'), `${path}: the placeholder was not replaced`)
      // The opt-in comes first, inline: before any script or stylesheet. In a stylesheet linked
      // after the scripts, the page arrived on dropped about one transition in five.
      const optIn = head.search(/<style>@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/)
      const firstOther = head.search(/<script|<link rel="stylesheet"/)
      expect(optIn >= 0 && optIn < firstOther, `${path}: the opt-in is not inline ahead of the scripts and stylesheets (at ${optIn}, first script or stylesheet at ${firstOther})`)
      // The first paint, the one the transition lands on, waits for the hero (the search box).
      const expects = path === '/search' ? '#sh-q' : '#hero'
      expect(head.includes(`<link rel="expect" href="${expects}" blocking="render"`), `${path}: the first paint doesn't wait for ${expects}`)
    }
  })
  await searchTest('a search result opens its page in the same tab, and the row, the wordmark and the photograph move into it, the whole way', async () => {
    await search(page, 'cdw')
    const photo = await searchPhoto(page)
    // The search page's frame and its photograph's size: the crop the hero has to land on.
    const frame = await page.evaluate(() => {
      const f = document.querySelector('.sh-scene')!.getBoundingClientRect()
      const img = [...document.querySelectorAll('.sh-scene__layer.is-in .sh-scene__img')].pop() as HTMLImageElement
      return [f.width, f.height, img.naturalWidth, img.naturalHeight]
    })
    await page.locator(`[data-vt-slug="${slug}"]`).click()
    await page.waitForURL(`**${ACCOUNT.replace(/\/$/, '')}?search=1`, { timeout: 10000 })
    await page.locator('.www-page').waitFor({ timeout: 10000 })
    const ready = await lastReady(page)
    expect(ready, `no view transition on the account page: ${JSON.stringify(await log(page))}`)
    for (const g of ['vt-scene', 'vt-frame', 'vt-wordmark', 'vt-logo', 'vt-name']) expect(ready.groups.includes(g), `${g} did not move: ${ready.groups.join(', ')}`)
    expect(ready.types.includes('from-search') && ready.types.includes('carry-scene'), `types: ${ready.types}`)
    // It runs its course (620 ms): the app starts after it, not during it (it cancelled the morph).
    expect(ready.ran >= 500, `the transition was cut short after ${ready.ran} ms`)
    // The hero shows the search page's photograph, so the photograph moves without a cross-fade.
    expect(!!photo && (ready.heroContent ?? '').includes(photo), `the hero's photograph is ${ready.heroContent}, the search page showed ${photo}`)
    // One photograph moves (the search page's), the page's own stays out of it; the headline with
    // the search box and the lists travel down off the window.
    for (const m of [
      '::view-transition-old(vt-scene) vt-scene-square',
      '::view-transition-old(vt-search-lift) vt-search-down',
      '::view-transition-old(vt-search-panel) vt-search-down',
      // The frame opens into the hero block; the rail's ground slides in with its left edge.
      '::view-transition-image-pair(vt-frame) vt-frame-open',
      '::view-transition-new(vt-rail-shell) vt-rail-ground-in',
    ])
      expect(ready.moves.includes(m), `not running: ${m} (${ready.moves.join(', ')})`)
    expect(!ready.moves.some((m) => m.startsWith('::view-transition-new(vt-scene) -ua-')), 'the photograph cross-fades')
    expect(await page.evaluate(() => document.documentElement.classList.contains('vt-in')), 'the hero intro played under the morph')
    expect(ctx.pages().length === 1, 'opened in a new tab')
    // The morph ends on the page: the hero draws the photograph at the crop the search page's
    // image of it lands at (src/lib/view-transitions-boot.js, sceneZoom).
    const hero = await page.evaluate(() => {
      const p = document.querySelector('.www-page .www-hero__visual picture')!.getBoundingClientRect()
      return { w: p.width, h: p.height, z: getComputedStyle(document.documentElement).getPropertyValue('--vt-scene-z').trim() }
    })
    const [fw, fh, nw, nh] = frame
    const z = (Math.max(fw / nw, fh / nh) * Math.max(hero.w / fw, hero.h / fh)) / Math.max(hero.w / nw, hero.h / nh)
    expect(z > 1.001 ? Math.abs(Number(hero.z) - z) < 0.002 : hero.z === '', `the hero's zoom is ${hero.z || 'none'}, the landing needs ${z.toFixed(4)}`)
    // Once the app has started (the rail is its), the page on screen is still the server's.
    await page.locator('.booth-rail.is-open').waitFor({ timeout: 10000 })
    const kept = await page.evaluate(() => ({
      ssr: (document.querySelector('.www-page') as (Element & { __ssr?: boolean }) | null)?.__ssr === true,
      spinner: (window as unknown as { __spinner?: boolean }).__spinner === true,
    }))
    expect(kept.ssr, "the app replaced the server's page as it started")
    expect(!kept.spinner, 'the spinner was drawn as the page started (a full-window flash)')
  })
  await searchTest("the booth rail's room is there from the first frame: the rail slides into it and the page holds still", async () => {
    const ready = await lastReady(page)
    expect(ready?.room === '64px', `no room for the rail as the morph set off (padding-left ${ready?.room})`)
    await page.locator('.booth-rail.is-open').waitFor({ timeout: 10000 })
    await page.waitForTimeout(900) // the rail's slide (520 ms) and the page's padding transition, if any
    const after = await page.evaluate(() => ({
      logoLeft: Math.round(document.querySelector('.www-hero .www-account__logo')!.getBoundingClientRect().left),
      room: document.documentElement.classList.contains('vt-rail-room'),
      ground: document.querySelectorAll('.vt-rail-shell').length,
      rail: document.documentElement.classList.contains('booth-page--rail'),
      railRight: Math.round(document.querySelector('.booth-rail')!.getBoundingClientRect().right),
    }))
    expect(ready?.logoLeft === after.logoLeft, `the hero's logo moved after the morph, from ${ready?.logoLeft} to ${after.logoLeft} px`)
    expect(!after.room && after.rail, `the rail did not take its room over (vt-rail-room ${after.room}, booth-page--rail ${after.rail})`)
    expect(after.ground === 0, `the rail's stand-in ground is still there (${after.ground})`)
    expect(after.railRight === 64, `the rail is not in place: its right edge at ${after.railRight} px`)
  })
  await searchTest("back to search with the rail's Search button: the page comes back as it was (query, list), the logo flies back into its row, the rail slides away", async () => {
    await page.locator('.booth-rail__btn--back').click()
    await page.locator('.sh-search__input').waitFor({ timeout: 10000 })
    const ready = await lastReady(page)
    const entries = await log(page)
    expect(entries.some((x) => x.at === 'pageshow' && x.persisted === true), `not from the back/forward cache: ${JSON.stringify(entries.slice(-4))}`)
    expect((await page.locator('.sh-search__input').inputValue()) === 'cdw', 'the query is gone')
    expect(ready, 'no view transition back to the search page')
    for (const g of ['vt-scene', 'vt-wordmark', 'vt-logo', 'vt-name', 'vt-search-top', 'vt-search-lift', 'vt-search-panel', 'vt-rail']) expect(ready.groups.includes(g), `${g} did not animate: ${ready.groups.join(', ')}`)
    expect(ready.railOut, 'the rail did not slide out (vt-rail-out)')
    expect(ready.types.includes('to-search') && ready.types.includes('carry-scene'), `types: ${ready.types}`)
    // The same photograph comes back alone, and the headline with the box and the lists rise back up.
    for (const m of ['::view-transition-new(vt-scene) vt-scene-round', '::view-transition-new(vt-search-lift) vt-search-up', '::view-transition-new(vt-search-panel) vt-search-up', '::view-transition-image-pair(vt-frame) vt-frame-close'])
      expect(ready.moves.includes(m), `not running: ${m} (${ready.moves.join(', ')})`)
    const done = [...entries].reverse().find((x) => x.at === 'finished') as { named: number }
    expect(done.named === 0, `${done.named} element(s) kept a transition name`)
  })
  await searchTest('a person page morphs the same way (their company logo, their name)', async () => {
    await search(page, 'ben')
    await page.locator(`[data-vt-slug="${PERSON.replace(/^\/|\/$/g, '')}"]`).click()
    await page.locator('.www-page.www-person').waitFor({ timeout: 10000 })
    const ready = await lastReady(page)
    expect(ready, 'no view transition on the person page')
    for (const g of ['vt-scene', 'vt-wordmark', 'vt-logo', 'vt-name']) expect(ready.groups.includes(g), `${g} did not move: ${ready.groups.join(', ')}`)
    expect(ready.ran >= 500 && ready.types.includes('carry-scene'), `cut short after ${ready.ran} ms, or the photograph not carried (${ready.types})`)
  })
  await searchTest("an offer opens in the same tab too, and morphs the same way, with the search page's photograph", async () => {
    // The search page run as the offer (its cookie), so its page shows among the answers. The
    // cookie comes with the offers list, after the server drew /search: the server never reads the
    // real offers for it. The offer's look is drawn from a local photograph.
    const look = {
      headline: 'No account left behind',
      background: { base: '/e2e-look', aspect: 1.6, lqip: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', sourceUrl: 'https://example.com/photo', license: 'stock' },
      madeBy: 'e2e',
      madeAt: '2026-11-01T00:00:00Z',
    }
    await page.route('**/api/offers', (route) =>
      route.fulfill({ json: { offers: [{ ...running, look }] }, headers: { 'set-cookie': 'sh_offer=e2e-offer; Path=/; SameSite=Lax' } }),
    )
    await page.route('**/e2e-look/*', (route) => {
      const avif = route.request().url().endsWith('.avif')
      return route.fulfill({ contentType: avif ? 'image/avif' : 'image/webp', body: fs.readFileSync(`public/home/scenes/v1/river-wide-1600.${avif ? 'avif' : 'webp'}`) })
    })
    await search(page, 'scale')
    await page.locator(`[data-vt-slug="${OFFER.replace(/^\/|\/$/g, '')}"]`).waitFor({ timeout: 10000 })
    // The offer's photograph, once it has faded in over the page's.
    await page.waitForFunction(() => ([...document.querySelectorAll('.sh-scene__layer.is-in .sh-scene__img')].pop() as HTMLImageElement | undefined)?.currentSrc.includes('/e2e-look/'), null, { timeout: 10000 })
    const photo = await searchPhoto(page)
    await page.locator(`[data-vt-slug="${OFFER.replace(/^\/|\/$/g, '')}"]`).click()
    await page.locator('.www-page').waitFor({ timeout: 15000 })
    expect(new URL(page.url()).pathname.replace(/\/$/, '') === OFFER.replace(/\/$/, ''), `opened ${page.url()}`)
    expect(ctx.pages().length === 1, 'opened in a new tab')
    const ready = await lastReady(page)
    expect(ready, 'no view transition on the offer page')
    for (const g of ['vt-scene', 'vt-wordmark', 'vt-logo', 'vt-name']) expect(ready.groups.includes(g), `${g} did not move: ${ready.groups.join(', ')}`)
    expect(ready.ran >= 500, `cut short after ${ready.ran} ms`)
    expect(!!photo && (ready.heroContent ?? '').includes(photo), `the offer's hero shows ${ready.heroContent}, the search page showed ${photo}`)
    await page.unroute('**/api/offers')
    await page.unroute('**/e2e-look/*')
    await ctx.clearCookies({ name: 'sh_offer' })
  })
  await searchTest('Cmd/Ctrl-click still opens a new tab, and the search page stays', async () => {
    await search(page, 'cdw')
    const [popup] = await Promise.all([ctx.waitForEvent('page'), page.locator(`[data-vt-slug="${slug}"]`).click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] })])
    await popup.waitForURL((u) => u.pathname.startsWith(ACCOUNT.replace(/\/$/, '')), { timeout: 10000 })
    expect(new URL(page.url()).pathname === '/search', `the search page went to ${page.url()}`)
    await popup.close()
  })
  await searchTest('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()

  const reduced = await vtContext({ reducedMotion: 'reduce' })
  const calm = await reduced.ctx.newPage()
  await searchTest('a reader who asked for reduced motion just navigates', async () => {
    await search(calm, 'cdw')
    await calm.locator(`[data-vt-slug="${slug}"]`).click()
    await calm.locator('.www-page').waitFor({ timeout: 10000 })
    await calm.waitForTimeout(400)
    const entries = await log(calm)
    expect(entries.some((x) => x.at === 'reveal' && x.vt === false) && !entries.some((x) => x.at === 'ready'), JSON.stringify(entries))
  })
  await reduced.ctx.close()
  await vtBrowser.close()
}

console.log('\nthe booth tools on a phone: a bar along the bottom, clear of the page and its parts')
{
  // Signed in, on a phone, no choice made yet: the tools are up (src/styles/booth-rail.css).
  const ctx = await browser.newContext({ ...VIEWPORTS.phone, serviceWorkers: 'block', extraHTTPHeaders: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined })
  await ctx.route('**/api/auth/me', (route) => route.fulfill({ json: { email: 'e2e@optimizely.com', name: 'E2E' } }))
  await ctx.route('**/api/edit-status**', (route) => route.fulfill({ json: { changed: false, published: '2026-01-01T00:00:00.000Z' } }))
  await ctx.route('**/api/page-activity**', (route) => route.fulfill({ status: 404, json: { error: 'not here' } }))
  await ctx.route('**/api/share-links**', (route) => route.fulfill({ json: { links: [] } }))
  await ctx.route('**/api/page-visit', (route) => route.fulfill({ status: 204, body: '' }))
  const escaped: string[] = []
  for (const pattern of ['**/api/cta-ping', 'https://webhook.opal.optimizely.com/**', 'https://webhook.mark.optimizely.com/**']) {
    await ctx.route(pattern, (route) => {
      escaped.push(route.request().url())
      return route.fulfill({ status: 202, json: { ok: true } })
    })
  }
  const page = await ctx.newPage()
  await page.goto(url(ACCOUNT, 'search=1'), { waitUntil: 'domcontentloaded' })
  await page.locator('.booth-rail.is-open').waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200) // the bar's slide and its buttons' cascade
  const bar = () =>
    page.evaluate(() => {
      const r = document.querySelector('.booth-rail')!.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, vw: innerWidth, vh: innerHeight }
    })
  await test('phone: the tools float in a bar along the bottom, inside the window, and the page keeps its width', async () => {
    const b = await bar()
    expect(b.height <= 64 && b.bottom <= b.vh - 12 && b.top > b.vh / 2, `the bar is not along the bottom: ${JSON.stringify(b)}`)
    expect(b.left >= 8 && b.right <= b.vw - 8, `the bar runs off the window: ${JSON.stringify(b)}`)
    const heroLeft = await page.evaluate(() => Math.round(document.querySelector('.www-hero h1')!.getBoundingClientRect().left))
    expect(heroLeft < 40, `the page's copy starts at ${heroLeft} px: something still sits beside it`)
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom))
    expect(pad >= b.height + 12, `the page ends under the bar (padding-bottom ${pad} px)`)
  })
  await test('phone: the sticky ask stands above the bar', async () => {
    await page.mouse.wheel(0, 1600)
    await page.locator('.www-sticky--visible').waitFor({ timeout: 8000 })
    await page.waitForTimeout(600)
    const b = await bar()
    const sticky = await page.evaluate(() => document.querySelector('.www-sticky')!.getBoundingClientRect().bottom)
    expect(sticky <= b.top - 4, `the sticky ask (bottom ${sticky}) runs into the bar (top ${b.top})`)
  })
  await test("phone: Edit's tutorial stands above the bar, and the bar keeps Close, Edit and Send in a row", async () => {
    await page.mouse.wheel(0, -4000)
    await page.locator('.booth-rail__btn--edit').click()
    await page.locator('.edit-tutorial').waitFor({ timeout: 8000 })
    await page.waitForTimeout(900)
    const b = await bar()
    const tut = await page.evaluate(() => {
      const r = document.querySelector('.edit-tutorial')!.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    })
    expect(tut.bottom <= b.top - 4 && tut.top >= 0 && tut.left >= 8 && tut.right <= b.vw - 8, `the tutorial ${JSON.stringify(tut)} meets the bar ${JSON.stringify(b)}`)
    const row = await page.evaluate(() =>
      ['.booth-rail__btn--back', '.booth-rail__btn--edit', '.booth-rail__btn--send'].map((sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect()
        return r ? Math.round(r.top) : null
      }),
    )
    expect(row.every((t) => t !== null && t === row[0]), `Close, Edit and Send are not in one row: ${row}`)
    await page.locator('.edit-tutorial__ok').click()
    await page.locator('.booth-rail__btn--back').click()
  })
  await test('phone: folded away, the bar slides off the window and one button brings it back', async () => {
    await page.waitForTimeout(600)
    await page.locator('.booth-rail__fold:not(.booth-rail__help)').click()
    await page.locator('.booth-rail-mini.is-shown').waitFor({ timeout: 8000 })
    await page.waitForTimeout(800)
    const b = await bar()
    expect(b.top >= b.vh, `the folded bar is still on the window: ${JSON.stringify(b)}`)
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingBottom))
    expect(pad === 0, `the page keeps the bar's room when it is folded (${pad} px)`)
    await page.locator('.booth-rail-mini').click()
    await page.locator('.booth-rail.is-open').waitFor({ timeout: 8000 })
  })
  await test('phone: nothing reached the real webhooks', async () => {
    expect(!escaped.length, escaped.join(', '))
  })
  await ctx.close()
}

console.log('\neach account page follows its own pitch; no address switches it')
const fetchHtml = async (href: string) => (await fetch(href, { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
const isAp = (html: string) => /class="www-page[^"]*\bwww-ap\b/.test(html)
const isTakeout = (html: string) => html.includes('class="www-page') && html.includes('id="comparison"') && !isAp(html)
await test(`a CMS takeout pitch (${ACCOUNT}) is the takeout page; an agent platform pitch (${AP_ACCOUNT}) is the agent platform page`, async () => {
  expect(isTakeout(await fetchHtml(url(ACCOUNT))), `${ACCOUNT} is not the takeout page`)
  expect(isAp(await fetchHtml(url(AP_ACCOUNT))), `${AP_ACCOUNT} is not the agent platform page`)
})
await test('?design=classic and ?template=takeout change nothing (no switches in the address)', async () => {
  for (const q of ['design=classic', 'template=takeout']) {
    expect(isTakeout(await fetchHtml(url(ACCOUNT, q))), `${ACCOUNT}?${q}: not the takeout page`)
    expect(isAp(await fetchHtml(url(AP_ACCOUNT, q))), `${AP_ACCOUNT}?${q}: not the agent platform page`)
  }
})
await test('an offer page is the www offer page, with or without ?design=classic', async () => {
  for (const q of ['', 'design=classic']) {
    const html = await fetchHtml(url(OFFER, q))
    expect(html.includes('www-page') && html.includes('id="hero"') && !html.includes('vb-experience'), `?${q}: not the www offer page`)
  }
})

console.log('\nspeed: the icon subset, no renderer preloads, the page fetched ahead from the search page')
{
  await test('no renderer chunk is preloaded: the hero paints before hydration starts', async () => {
    for (const href of [url(ACCOUNT), url(ACCOUNT, 'search=1'), url(PERSON), url(OFFER)]) {
      const lazy = [...(await fetchHtml(href)).matchAll(/<link rel="modulepreload"[^>]*href="\/assets\/(AccountRoute|PersonPage|VisualBuilderPage|FloatingSidebar)-/g)].map((m) => m[1])
      expect(!lazy.length, `${href} preloads ${lazy.join(', ')}`)
    }
  })

  const { ctx, watch } = await newContext(browser, 'desktop')
  const fonts: string[] = []
  ctx.on('request', (r) => {
    if (/\.woff2(\?|$)/.test(r.url()) && /material-symbols|rounded-subset/.test(r.url())) fonts.push(new URL(r.url()).pathname)
  })
  /** Icons drawn as glyphs (about one em wide), not as their names in letters. */
  const iconsAsText = (page: Page) =>
    page.evaluate(async () => {
      await document.fonts.ready
      return [...document.querySelectorAll<HTMLElement>('.material-symbols-rounded')]
        .filter((el) => el.getBoundingClientRect().width > parseFloat(getComputedStyle(el).fontSize) * 1.4)
        .map((el) => el.textContent)
    })
  for (const href of [AP_ACCOUNT, ACCOUNT, PERSON]) {
    await test(`${href}: icons draw from the subset font; the whole font is never fetched`, async () => {
      fonts.length = 0
      const page = await open(ctx, watch, url(href))
      const asText = await iconsAsText(page)
      expect(fonts.some((f) => /rounded-subset/.test(f)), `subset not loaded: ${fonts.join(', ') || 'no icon font'}`)
      expect(!fonts.some((f) => /material-symbols-rounded-/.test(f)), `the whole font was fetched: ${fonts.join(', ')}`)
      expect(!asText.length, `icons drawn as text: ${asText.join(', ')}`)
      await page.close()
    })
  }
  await test('an icon outside the subset (a CMS-only name) brings in the whole font, and draws', async () => {
    fonts.length = 0
    const page = await open(ctx, watch, url(ACCOUNT))
    await page.evaluate(() => {
      const el = document.createElement('span')
      el.className = 'material-symbols-rounded'
      el.textContent = 'pets'
      document.body.append(el)
    })
    await page.waitForSelector('style[data-icon-font="whole"]', { state: 'attached', timeout: 3000 })
    // Both faces of the family loaded: the subset, and the whole font declared after it.
    await page.waitForFunction(() => [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Material Symbols Rounded' && f.status === 'loaded').length >= 2, null, { timeout: 20000 })
    const asText = await iconsAsText(page)
    expect(fonts.some((f) => /material-symbols-rounded-/.test(f)), `the whole font was not fetched: ${fonts.join(', ')}`)
    expect(!asText.length, `drawn as text: ${asText.join(', ')}`)
    await page.close()
  })
  await ctx.close()

  await searchTest('the search page prefetches the row a rep rests on (Speculation Rules, its own address, never a prerender)', async () => {
    const search = await browser.newContext({ ...VIEWPORTS.desktop, serviceWorkers: 'block', extraHTTPHeaders: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : undefined })
    // A signed-in Optimizely person's browser, as everyone on /search is.
    await search.addCookies([{ name: 'showcase_staff', value: '1', url: BASE }])
    const meta = (route: string) => ({ url: { default: route, hierarchical: route }, published: '2026-11-01T00:00:00Z' })
    const slug = ACCOUNT.replace(/^\/|\/$/g, '')
    const index = {
      companies: [{ _metadata: meta(ACCOUNT), headline: 'One platform', eyebrow: `Personalized for ${slug}`, competitorName: 'Adobe', brandDomain: `${slug}.com`, brandAccentColor: null, customerLogo: null, intelHeadline: slug }],
      total: 1,
      people: [],
      mine: [],
      viewer: 'e2e@optimizely.com',
    }
    await search.route('**/api/auth/me', (r) => r.fulfill({ json: { email: index.viewer, name: 'E2E' } }))
    await search.route('**/api/home-index', (r) => r.fulfill({ json: index }))
    await search.route('**/api/offers', (r) => r.fulfill({ json: { offers: [] } }))
    await search.route('**/api/page-builds', (r) => r.fulfill({ json: { builds: [] } }))
    const page = await search.newPage()
    await page.goto(url('/search'), { waitUntil: 'domcontentloaded' })
    await page.locator('.sh-search__input').waitFor({ timeout: 10000 })
    expect((await page.locator('script[type="speculationrules"]').count()) === 0, 'rules written before the rep did anything')
    await page.locator('.sh-search__input').fill(slug)
    const row = page.locator(`.sh-row[data-vt-slug="${slug}"]`).first()
    await row.waitFor({ timeout: 8000 })
    await row.hover()
    await page.waitForSelector('script[type="speculationrules"]', { state: 'attached', timeout: 3000 })
    const rules = await page.locator('script[type="speculationrules"]').allTextContents()
    expect(rules.length === 1, `${rules.length} rule scripts`)
    const parsed = JSON.parse(rules[0]) as { prefetch?: Array<{ source: string; urls: string[] }>; prerender?: unknown }
    expect(!parsed.prerender, 'a prerender rule: the view transition needs the page to start after the click (src/lib/warm-pages.ts)')
    const urls = parsed.prefetch?.[0]?.urls ?? []
    expect(urls[0] === `/${slug}?search=1`, `prefetches ${urls.join(', ') || 'nothing'}`)
    await search.close()
  })
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, `requests escaped: ${watch.escaped.join(', ')}`)
  })
}

await browser.close()
console.log(`\n${passed} passed, ${failures.length} failed${skipped.length ? `, ${skipped.length} skipped (${SEARCH_GATE})` : ''}  (screenshots: ${OUT})`)
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
