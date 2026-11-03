---
title: vs-writer-logitech
aliases: [vs-writer-logitech]
type: web-app
product: independent
status: experimental
stack: [typescript, react, vite, upstash-redis, framer-motion, gsap, tailwind]
tags: [web-app, writing, logitech, input-device, aldus, showcase]
related:
  - "[[_MOCs/Web Apps]]"
  - "[[_MOCs/Aldus Suite]]"
updated: 2026-11-02
---

# vs-writer-logitech

Vercel-deployed writing-assistant web app that takes Logitech device input and produces AI-assisted writing output. Vite + React 19 + Upstash Redis, with Framer Motion and GSAP driving the interaction layer.

**Deployment note:** despite the folder name, this codebase is what deploys as the Vercel project **`aldus`** — production at **showcase.optimizely.com**, pre-prod previews aliased to **aldus-preprod.vercel.app**. It has grown into the Aldus showcase (retail, FinServ, ABM pages) with the live Edit mode. There is no separate "aldus" repo; deploy from here.

## Purpose

An experiment in input-device–driven writing: capture raw input from Logitech hardware (mouse gestures, MX Creative dial, etc.) and map it into writing operations (rewrite, expand, simplify, tone shift).

## Stack

- **Frontend:** React 19 + Vite
- **Animation:** Framer Motion, GSAP
- **Styling:** Tailwind + custom CSS
- **State/storage:** Upstash Redis
- **Build:** SSR via esbuild
- **Deploy:** Vercel

## Setup

```bash
npm install
npm run dev
```

## Checks

```bash
npm run check          # everything that needs no network: both type-checks, lint, check:render, check:limitless, check:signup
npm run check:graph    # every shipped GraphQL query against the live schema (needs GRAPH_AUTH_KEY)
```

`npm run check` is what to run before pushing. It is deliberately not wired into `npm run build` yet — Vercel's build still runs only `tsc -b` — so a deploy is not blocked by anything new without a decision to do that.

Five things it covers that the build does not:

- **`server/` and `api/` are type-checked** (`typecheck:server`, `tsconfig.server.json`). The app config includes only `src/`, so the code that server-renders every page had never been checked; it now is, with `strictNullChecks` on, which is what the `api/` handlers' `if (!x.ok)` narrowing was written for. The app config is unchanged.
- **Lint runs and passes.** It had been crashing at config load — a stale `node_modules` with `zod@3.22.4` hoisted — so 204 errors built up unseen. A clean `npm ci` fixes the crash; if `npm run lint` dies with `ERR_PACKAGE_PATH_NOT_EXPORTED … zod`, that is the cause. `src/vendor/**` is ignored on purpose (see its `UPSTREAM.md`). The remaining warnings are `react-refresh` hot-reload hints, a dev-server convenience.
- **`check:render`** server-renders the use-case template and asserts against the HTML.
- **`check:limitless`** holds the search page's links back to Limitless to the people aldus-ui names, then reruns itself against mutants of the guarded files, each of which must fail it.
- **`check:signup`** holds the offer page's email form (below): the render-time swap, the close band with and without it, the data-layer wrap and `POST /api/offer-signup`, all against stand-ins for the network.

## www design (live, the default)

Every account page (`/<company>/`) and offer page (`/vb/<slug>`) renders in the www design, the default since 2 November 2026. `?design=classic` renders the previous design for that one request (to compare, or to fall back for one page without a redeploy); `?design=www` still works for old links. Person, retail and fin-serv pages are not affected. The pages are 1:1 landing pages built from optimizely.com's own React components (vendored in `src/vendor/www`, see its `UPSTREAM.md`): no navigation or footer, a full-screen hero at three quarters of the window so the next scene peeks in, then one scene per idea at least that tall, white and Neutral 3 before a full-window dark close, LFGreen for the action only. The hero says whose page it is once, with the account's logo above the headline, and plays an intro on load; every other scene plays its own entrance when it scrolls into view (the waypoints in `useScenes`, the motion section of `www.css`). The close has one call to action. The content model is untouched; `src/www/account-fields.ts` maps all 67 `CompetitorComparisonPage` properties, and offer pages are read back from their Visual Builder composition (`src/www/offer-content.ts`). X-ray and Edit mode work on both designs (`data-xray` hooks).

An account page in the www design renders one of two templates. The default is the agent platform template (`src/www/AgentPlatformPage.tsx`): Laura Perez Riau's eight-section page from Dan Tranter's pitch, where the lifecycle state sets the hero, headline, proof and CTAs. The account research is threaded through the page rather than kept in one homework section: one stored fact per scene, the stack and investments marked with the same tag, and each use case showing what in the account's own data put it first. It reads `AgentPlatformContent`, which `src/www/agent-platform/content.ts` fills from the stored page until the agents write it directly; `?review=1` shows where each part came from and `?state=` switches the state. `?template=takeout` renders the competitive takeout page with every stored field. On both, the one-click ask (hero, sticky bar, close) pings the account team once per page view and opens a connect panel instead of a form (`src/www/ConnectModal.tsx`). Edit mode on the agent platform page offers only the parts a stored field drives, spotlights the part Mark is working on, and re-renders the page live from Mark's streamed values (see the template's docs). The agent changes this template needs are drafted, not deployed, in [docs/agent-platform-template](docs/agent-platform-template/README.md).

```bash
npm run check:www                              # 137 offline tests: helpers, field coverage, x-ray hooks, brand rules, Laura's rules
WWW_UPSTREAM=~/Claude/OptimizelyHeadless npm run check:www   # + proves src/vendor/www still matches upstream
npm run build && npx tsx scripts/serve-prod.ts &               # local production stand-in on :5199
npm run e2e:www                                # 76 Playwright checks, desktop + phone: layout, intro, one CTA, X-ray/Edit, all network mocked
npx tsx scripts/smoke-live-pages.ts [base]     # every live account page in the www design: renders, 8 sections, title, one CTA, no competitor/stakeholder names
```

## Sign-in

`/search`, the booth sidebar on `?search=1` links (Search, X-ray, Edit) and the routes behind them are for people signed in with Optimizely. Sign-in is "Log in with Optimizely" through the Mark Down wiki's sign-in relay (`md.optimizely.com/api/auth/relay`, app id `showcase`), the same way aldus-ui and Mark AEO sign in: the wiki runs Opti ID, then hands back a signed two-minute assertion that `api/auth/optimizely/callback.ts` verifies, burns (Redis `SET NX`) and swaps for this app's own 180-day session cookie. The code is `api/_lib/auth.ts`; the registered callbacks are `https://showcase.optimizely.com/api/auth/optimizely/callback` and the same path on `aldus-preprod.vercel.app`.

What each surface does:

- **`/search`** redirects into sign-in when there is no session, and is served `private, no-store` (it used to sit in the edge cache).
- **Account pages stay public and edge-cached.** Nothing identity-specific is server-rendered into them; on `?search=1` the sidebar asks `/api/auth/me` from the browser. Signed out, no tools render: an alert says this is the employee URL, and after five seconds the page drops `?search=1` (a client-side replace, no reload), so the address the visitor copies next is the public one. Employees get the tools back by signing in on `/search`.
- **Edit and "add new"** send the signed-in address. `api/opal-edit-stream`, `opal-feedback`, `opal-create-page` and `opal-create-person-page` take the email from the session and ignore one in the body; there is no email prompt anymore.
- **`/api/search-index` and `/api/edit-status`** answer 401 without a session. The index is now cached in function memory for five minutes instead of at the edge.
- **Only `@optimizely.com` identities** get a session; anyone else lands on `/login?error=not_optimizely`.
- **Log out** is a POST to `/api/auth/logout` from the search page's profile menu, which shows the person's Gravatar (initials when they have none). It lands on `/login`, not `/search`, which would sign the person straight back in while Okta still remembers them.
- **Limitless admins** also get Open Limitless in that menu and a pencil on the offer the page runs as (each opens aldus-ui in a new tab). aldus-ui says who: `/api/offers` asks its `POST /api/machine/showcase/viewer` with `ALDUS_SHOWCASE_TOKEN` about the session's email, and with `ALDUS_UI_URL` or the token unset nobody gets the links (`npm run check:limitless`).

```bash
OPTIID_RELAY_SECRET=   # required in production; the wiki's AUTH_RELAY_SECRET_SHOWCASE
SESSION_SECRET=        # optional; rotating it signs everyone out
WIKI_URL=              # optional; defaults to https://md.optimizely.com
DEV_AUTH_EMAIL=        # local dev only: the dev server's stand-in for a signed-in person
```

Unset `OPTIID_RELAY_SECRET` means no gate, and no identity unless `DEV_AUTH_EMAIL` is set — a deploy that forgot the secret cannot edit or create anything. The Vite dev server has no Opti ID round trip, so set `DEV_AUTH_EMAIL` in `.env.local` to work on the signed-in UI and leave it out to see the signed-out one.

## Edit mode (live)

The showcase's "Edit mode" (`src/components/EditMode.tsx` + `api/opal-edit-stream.ts`) streams the `account_page_live_edit` Opal specialized agent over SSE and animates its edits on-page before the agent commits a single `update_page`. It absorbed the retired standalone `aldus-live-edit` app (June 2026).

Server-side environment (Vercel project `aldus`; also in local `.env.local`):

```bash
OPAL_PAT=          # Opal Personal Access Token — required, never sent to the browser
OPAL_BASE_URL=     # default https://opal.optimizely.com
OPAL_INSTANCE_ID=  # default 4f42a24e93f945bcb262bff01a9a1562
OPAL_AGENT_ID=     # default 6c6d1d88-55ee-4f9c-a2d3-28de4bee1149 (account_page_live_edit)
```

Without `OPAL_PAT` the endpoint responds with a clean SSE error ("Server is missing OPAL_PAT"); the older fire-and-forget webhook lives at `api/opal-feedback.ts`.

The Limitless preview routes read one more variable, browser-side and dev-only — it is never consulted on a public page render:

```bash
VITE_INTELLIGENCE_API_URL=   # Aldus dev server; defaults to http://localhost:3000
```

`next dev` does not reliably land on 3000 — several projects in this vault take turns on the same ports, and Aldus has been observed on 3111 — so set this rather than assuming. The preview's error state names the URL it tried.

## Limitless: the use-case template

A third renderer over the `CompetitorComparisonPage` content type, alongside `ABMHyperPage` (competitive takeout) and `DynamicComparisonPage` (plain comparison). Its shape comes from Laura Perez Riau's "Siemens — Account Page (Use Case Template v2)" artifact, which is deliberately *not* a takeout: it names no competitor and shows no comparison table, ROI projection or migration timeline.

What makes it different from the other two is that **every section is gated on a component plan, not on whether its own content is populated**:

```tsx
{includes(plan, 'why-now-thesis') && <Thesis/>}   // this renderer
{page.roiTitle && <Roi/>}                         // the other two
```

That matters because a plan can withhold a section *and say why*, ask for a section in a named variant, and be checked — a section the plan asked for with no content behind it is a build defect rather than an invisible non-event. Measured on 240 pages sampled across the 2,695-page inventory: **one distinct section set**, every page showing all 15 renderable sections. The old template is dynamic in principle and uniform in practice.

The plan has three sources and always says which: `componentPlan` on the page (the real mechanism, pending a CMS field), a live fetch from Aldus, or — for every page written before any of this existed — reconstructed from populated fields, reproducing today's output exactly. Verified field-by-field against five real CMS pages.

```bash
/use-case-preview                 # Laura's Siemens content + its own plan
/use-case-preview/hartwell-bank   # the SAME content, plan resolved live by Aldus
/use-case-preview/geico?plan=0    # hide the on-page decision panel
```

`/use-case-preview/:accountId` is the demonstration worth running: the content does not change, the plan does, so the sections that appear and the reasons the rest were withheld change with the account.

Design, the component contract, the staged CMS fields and what the decision engine must pass the page-building agent: **`~/Claude/aldus-ui/docs/limitless-use-case-template.md`**.

Two things to know before touching it:

- **Adding a field to `PAGE_QUERY` before it is registered in the CMS 404s every account page.** One unknown field fails the whole GraphQL query (commit `9091988`). Register in the CMS, run `npm run check:graph`, *then* add it to the query — in all three copies (`api/content.ts`, `server/ssr-handler.tsx`, `api/preview.ts`).
- **`npm run check:render` guards this renderer.** It server-renders the fixture and asserts against the HTML: that `renderToString` survives (the renderer is SSR'd directly, with no `.server.tsx` twin), and that components the plan withheld genuinely do not reach the output. No network, no credentials — safe in CI.
- **`_json` is not an escape hatch for unregistered fields.** Graph rejects it on a page root (`The \`_json\` field is only supported within the \`item\` field`), so a field the content type does not register cannot be read at all — register it first. A `mergeRetailJson()` built on the opposite assumption sat in `api/content.ts` and `server/ssr-handler.tsx` as a silent no-op until it was removed.

## Offer pages: the email sign-up form

Each offer in Limitless picks how people sign up on its pages: the close band's button links out (the default, every page today), or an email-only form on the page (aldus-ui `lib/offers/signup.ts`; Laura's ask, Notion "Add an optional email-only form block to the offer template"). Nothing is written to the CMS and no page is regenerated.

It is off until `OFFER_SIGNUP_FORM=on`. Unset, no offer page asks Limitless anything, every page links out and `/api/offer-signup` answers 404: the site is exactly as before. On, when an offer page is served, `withOfferSignup` (`api/_lib/offer-signup.ts`) asks Limitless for the offer's choice (`GET /api/machine/showcase/offers/{id}/signup`, 1.5 s timeout, an answer held 30 s) and, for the form, `injectSignupForm` (`src/lib/offer-signup.ts`) gives the close band's `AbmClosingCtaElement` a `SignupOfferId` and points the hero's main button at `#signup`. All three experience paths do it (`api/content.ts`, `server/ssr-handler.tsx`, the dev proxy), so the HTML, `__SSR_DATA__` and a client fetch agree. With the page's edge cache, a switch shows within about six minutes. When Limitless can't answer, the page links out, the failure is held only 5 s and the page is edge-cached 10 s (`signupCacheControl`), so the next request asks again.

The form (`src/components/offer-signup/OfferSignupForm.tsx`) posts through `postSignup` to `POST /api/offer-signup` (`api/offer-signup.ts`), which takes only a JSON post from the page's own site (415 or 403 otherwise, so another website can't post to it from a visitor's browser), checks the email's shape, rate-limits while `KV_REST_API_*` is set (30 a minute per address, since one company's people often share an office's address, and 3 a minute per email, kept as a hash), reads the page from Graph to confirm it is that offer's and to take its account (never the form's), and keeps the sign-up in Limitless, where the offer screen counts them and downloads a CSV. Limitless keeps a sign-up only for an offer whose pages show the form (or switched back to link out under 15 minutes ago, for a page still cached with it); for any other it answers 409, and the visitor is thanked and nothing is kept, as a bot is.

Env (Production already has `ALDUS_UI_URL`, `ALDUS_SHOWCASE_TOKEN`, `GRAPH_AUTH_KEY` and the KV pair for the search page's offers):

- `OFFER_SIGNUP_FORM`: **unset.** `on` turns the form on (above); any other value is off. Set aldus-ui's switch of the same name with it: that one shows the offer screen's Sign-ups panel and its "Use email form", so neither promises what the other won't do.
- `ALDUS_UI_URL`, `ALDUS_SHOWCASE_TOKEN`: Limitless and the showcase's token. Unset: off, as above.
- `GRAPH_AUTH_KEY`: the page read; unset, the endpoint answers 503.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: the rate limit; unset, no limit.
- `OFFER_SIGNUP_WEBHOOKS`: **unset.** Comma-separated https URLs that each also get every sign-up, the way optimizely.com's forms post to their Webhooks (`email`, `PageName`, `pageURL`, `page_key`, `form_key`, `utm_source` … `utm_content`, `offer_id`, `campaign_id`): a Google Sheet's Apps Script web app for a live sheet, or later the ODP and Marketo form proxy. `campaign_id` is the offer's conversion campaign in Limitless, or empty, never the visitor's own `utm_campaign`. A webhook that fails is logged and never fails the sign-up.

Until a webhook is set, nobody who signs up hears anything more: someone imports the offer's CSV from Limitless into the event's registration, which sends the details. Removing someone's sign-up (an erasure request) is done in Limitless's store; aldus-ui `docs/offers-section.md` §22 says how.

Never submit the form on a preview whose `ALDUS_UI_URL` is production Limitless: the sign-up lands in production's list. Locally, set `ALDUS_UI_URL` to a local aldus-ui.

## Related

- [[_MOCs/Web Apps]]
- [[_MOCs/Experiments]]
