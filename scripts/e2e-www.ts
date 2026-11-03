/**
 * End-to-end test of the www-design pages in a real browser, desktop and phone.
 *
 *   npm run build && npx tsx scripts/serve-prod.ts &      # or point E2E_BASE at a deployment
 *   npm run e2e:www
 *
 * Env: E2E_BASE (default http://127.0.0.1:5199), E2E_ACCOUNT (default /cdw/), E2E_OFFER
 * (default /vb/no-account-left-behind-scale-ai), E2E_OUT (screenshot folder, default a temp dir),
 * E2E_BYPASS (Vercel protection-bypass secret, for a protected preview).
 *
 * NOTHING LEAVES THE BROWSER. The contact button's sales-team webhook, sign-in, the edit
 * stream to Mark and the republish poll are all answered here; the test fails if any request
 * reaches webhook.opal.optimizely.com.
 *
 * Layout (Michiel, 2 Nov): a full-screen hero at 75% of the window with the next scene peeking in,
 * scenes at least 75%, the close the full window; one closing CTA; the intro on load settles; the
 * hero landscape is never upscaled.
 *
 * Covers, for both account templates (the agent platform one by default, ?template=takeout)
 * and the offer page: server render + hydration without errors, no sideways scroll on a phone,
 * every section present, sticky bar, the one-click connect panel (pings once per view, from the
 * sticky bar or the close), the review layer and state switch, the offer FAQ, X-ray mode
 * outlining every section, Edit mode rewriting the hero headline in place from a (mocked) Mark
 * stream, the www design as the default with no parameter, and the previous renderers unchanged on
 * ?design=classic.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ABM_XRAY_DEFAULTS, AGENT_PLATFORM_EDIT, AGENT_PLATFORM_XRAY } from '../src/lib/xray-defaults'

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:5199').replace(/\/$/, '')
const ACCOUNT = process.env.E2E_ACCOUNT || '/cdw/'
const OFFER = process.env.E2E_OFFER || '/vb/no-account-left-behind-scale-ai'
const OUT = process.env.E2E_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'www-e2e-'))
const BYPASS = process.env.E2E_BYPASS

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const

const url = (p: string, q: string) => `${BASE}${p}${p.includes('?') ? '&' : '?'}${q}`

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

  // The one-click contact: record what would be sent, send nothing.
  await ctx.addInitScript(() => {
    ;(window as unknown as { __beacons: string[] }).__beacons = []
    navigator.sendBeacon = (_url: string | URL, data?: BodyInit | null) => {
      void new Response(data ?? '').text().then((t) => (window as unknown as { __beacons: string[] }).__beacons.push(t))
      return true
    }
  })
  await ctx.route('https://webhook.opal.optimizely.com/**', (route) => {
    watch.escaped.push(route.request().url())
    return route.fulfill({ status: 200, body: '' })
  })
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
  const res = await page.goto(href, { waitUntil: 'load' })
  expect(res?.ok(), `${href} answered ${res?.status()}`)
  await page.waitForSelector('.www-page')
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

const beaconsOf = (page: Page) => page.evaluate(() => (window as unknown as { __beacons: string[] }).__beacons)

for (const vp of Object.keys(VIEWPORTS) as Array<keyof typeof VIEWPORTS>) {
  console.log(`\naccount page, agent platform template (the default), ${vp}`)
  {
    const { ctx, watch } = await newContext(browser, vp)
    const page = await open(ctx, watch, url(ACCOUNT, 'design=www'))
    await test('server-rendered and hydrated without errors', async () => {
      const html = await (await fetch(url(ACCOUNT, 'design=www'), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
      expect(/class="www-page[^"]*\bwww-ap\b/.test(html), 'the server did not render the agent platform page')
      expect(!watch.errors.length, watch.errors.join('\n'))
    })
    await test('the tab title is the template\'s, before and after hydration (no takeout pitch)', async () => {
      const html = await (await fetch(url(ACCOUNT, 'design=www'), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
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
      const beacons = await beaconsOf(page)
      expect(beacons.length === 1, `beacons: ${beacons.length}`)
      const b = JSON.parse(beacons[0])
      expect(b.event === 'demo_button_clicked' && b.source === 'sticky-connect-btn', `beacon: ${beacons[0]}`)
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
      expect((await beaconsOf(page)).length === 1, 'pinged twice')
      expect(/You're all set/.test(await page.locator('#cta-connect-btn').innerText()), 'the close button does not say it is done')
      await page.getByRole('button', { name: 'Close' }).click()
      expect(!watch.escaped.length, `a request reached the real webhook: ${watch.escaped.join(', ')}`)
    })
    if (vp === 'desktop') {
      await test('?review=1 shows where each part came from, and switches the lifecycle state', async () => {
        expect(!(await page.locator('.www-review').count()), 'review layer on the production page')
        const rp = await open(ctx, watch, url(ACCOUNT, 'design=www&review=1'))
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

  console.log(`\naccount page, takeout template (?template=takeout), ${vp}`)
  const { ctx, watch } = await newContext(browser, vp)
  const page = await open(ctx, watch, url(ACCOUNT, 'design=www&template=takeout'))

  await test('server-rendered and hydrated without errors', async () => {
    const html = await (await fetch(url(ACCOUNT, 'design=www&template=takeout'), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
    expect(html.includes('class="www-page') && html.includes('id="comparison"'), 'the server did not render the takeout page')
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
    const beacons = await beaconsOf(page)
    expect(beacons.length === 1 && JSON.parse(beacons[0]).event === 'demo_button_clicked', `beacons: ${JSON.stringify(beacons)}`)
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

  console.log(`\noffer page, ${vp}`)
  const o = await newContext(browser, vp)
  const op = await open(o.ctx, o.watch, url(OFFER, 'design=www'))
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
  const page = await open(ctx, watch, url(ACCOUNT, 'design=www&search=1'))
  // The stored stack, from the server HTML's hydration data (the page drops it once hydrated).
  {
    const html = await (await fetch(url(ACCOUNT, 'design=www'), { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
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
  await test(`Edit mode offers the ${editable.length} parts a page field drives, not the template copy`, async () => {
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('[aria-label^="Leave feedback on "]').length === n, editable.length, { timeout: 8000 })
    const labels = await page.$$eval('[aria-label^="Leave feedback on "]', (els) => els.map((e) => e.getAttribute('aria-label')!.replace('Leave feedback on ', '')))
    expect(JSON.stringify(labels.sort()) === JSON.stringify([...editable].sort()), `offered: ${labels.join(', ')}`)
    for (const t of ['Who we are', 'Proof', 'First 90 days', 'Hero headline']) expect(!labels.includes(t), `template copy offered: ${t}`)
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

console.log('\nbooth tools on the takeout page (signed in, ?search=1)')
{
  const { ctx, watch } = await newContext(browser, 'desktop', { signedIn: true })
  // Mark's edit stream, answered here: one edit to the hero headline.
  let heroText = ''
  await ctx.route('**/api/opal-edit-stream', async (route) => {
    const events = [
      { type: 'plan', sections: ['Hero headline'], summary: 'e2e' },
      { type: 'section_focus', section: 'Hero headline' },
      { type: 'edit', section: 'Hero headline', target: 'headline', kind: 'text', action: 'replace', status: 'applied', old: heroText, new: 'Rewritten by the e2e test' },
      { type: 'commit', status: 'ok', edits: 1 },
      { type: 'done', saved: true },
    ]
    const body = events.map((e) => `data: ${JSON.stringify({ k: 'text', t: JSON.stringify(e) })}\n\n`).join('') + `data: {"k":"done"}\n\n`
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'text/event-stream' }, body })
  })
  const page = await open(ctx, watch, url(ACCOUNT, 'design=www&template=takeout&search=1'))
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
  await test('Edit mode offers feedback on every section, and applies Mark\'s edit in place', async () => {
    await page.getByRole('button', { name: 'Enter edit mode' }).click()
    await page.waitForFunction((n) => document.querySelectorAll('[aria-label^="Leave feedback on "]').length >= n, onPage.length, { timeout: 8000 })
    // The edit overlay is aria-hidden from the page's own tree, so find the box by its label.
    await page.locator('[aria-label="Leave feedback on Hero headline"]').click()
    await page.locator('.edit-popup__textarea').fill('Make it about every CDW brand')
    await page.locator('.edit-popup__btn--primary').click()
    await page.locator('[aria-label="Send feedback"]').click()
    await page.waitForFunction(
      () => /Rewritten by the e2e test/.test(document.querySelector('[data-xray="hero-title"]')?.textContent || ''),
      null,
      { timeout: 15000 },
    )
    await page.screenshot({ path: path.join(OUT, 'booth-edit.png') })
  })
  await test('no errors, and nothing reached the real webhooks', async () => {
    expect(!watch.errors.length, watch.errors.join('\n'))
    expect(!watch.escaped.length, watch.escaped.join(', '))
  })
  await ctx.close()
}

console.log('\nthe default (no parameter) and ?design=classic')
const fetchHtml = async (href: string) => (await fetch(href, { headers: BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {} })).text()
await test('an account page with no parameter is the agent platform page', async () => {
  const html = await fetchHtml(`${BASE}${ACCOUNT}`)
  expect(/class="www-page[^"]*\bwww-ap\b/.test(html), 'the default account page is not the agent platform page')
})
await test('an offer page with no parameter is the www offer page', async () => {
  const html = await fetchHtml(`${BASE}${OFFER}`)
  expect(html.includes('www-page') && html.includes('id="hero"'), 'the default offer page is not the www design')
})
await test('?design=classic: the account page is ABMHyperPage, as before', async () => {
  const html = await fetchHtml(url(ACCOUNT, 'design=classic'))
  expect(html.includes('abm-page') && !html.includes('www-page'), 'the classic account page changed')
})
await test('?design=classic: the offer page is the Visual Builder renderer, as before', async () => {
  const html = await fetchHtml(url(OFFER, 'design=classic'))
  expect(html.includes('vb-experience') && !html.includes('www-page'), 'the classic offer page changed')
})

await browser.close()
console.log(`\n${passed} passed, ${failures.length} failed  (screenshots: ${OUT})`)
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
