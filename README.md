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
updated: 2026-10-19
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
npm run check          # everything that needs no network: both type-checks, lint, check:render
npm run check:graph    # every shipped GraphQL query against the live schema (needs GRAPH_AUTH_KEY)
```

`npm run check` is what to run before pushing. It is deliberately not wired into `npm run build` yet — Vercel's build still runs only `tsc -b` — so a deploy is not blocked by anything new without a decision to do that.

Three things it covers that the build does not:

- **`server/` and `api/` are type-checked** (`typecheck:server`, `tsconfig.server.json`). The app config includes only `src/`, so the code that server-renders every page had never been checked; it now is, with `strictNullChecks` on, which is what the `api/` handlers' `if (!x.ok)` narrowing was written for. The app config is unchanged.
- **Lint runs and passes.** It had been crashing at config load — a stale `node_modules` with `zod@3.22.4` hoisted — so 204 errors built up unseen. A clean `npm ci` fixes the crash; if `npm run lint` dies with `ERR_PACKAGE_PATH_NOT_EXPORTED … zod`, that is the cause. `src/vendor/**` is ignored on purpose (see its `UPSTREAM.md`). The remaining warnings are `react-refresh` hot-reload hints, a dev-server convenience.
- **`check:render`** server-renders the use-case template and asserts against the HTML.

## Sign-in

`/search`, the booth sidebar on `?search=1` links (Search, X-ray, Edit) and the routes behind them are for people signed in with Optimizely. Sign-in is "Log in with Optimizely" through the Mark Down wiki's sign-in relay (`md.optimizely.com/api/auth/relay`, app id `showcase`), the same way aldus-ui and Mark AEO sign in: the wiki runs Opti ID, then hands back a signed two-minute assertion that `api/auth/optimizely/callback.ts` verifies, burns (Redis `SET NX`) and swaps for this app's own 180-day session cookie. The code is `api/_lib/auth.ts`; the registered callbacks are `https://showcase.optimizely.com/api/auth/optimizely/callback` and the same path on `aldus-preprod.vercel.app`.

What each surface does:

- **`/search`** redirects into sign-in when there is no session, and is served `private, no-store` (it used to sit in the edge cache).
- **Account pages stay public and edge-cached.** Nothing identity-specific is server-rendered into them; on `?search=1` the sidebar asks `/api/auth/me` from the browser. Signed out, no tools render: an alert says this is the employee URL, and after five seconds the page drops `?search=1` (a client-side replace, no reload), so the address the visitor copies next is the public one. Employees get the tools back by signing in on `/search`.
- **Edit and "add new"** send the signed-in address. `api/opal-edit-stream`, `opal-feedback`, `opal-create-page` and `opal-create-person-page` take the email from the session and ignore one in the body; there is no email prompt anymore.
- **`/api/search-index` and `/api/edit-status`** answer 401 without a session. The index is now cached in function memory for five minutes instead of at the edge.
- **Only `@optimizely.com` identities** get a session; anyone else lands on `/login?error=not_optimizely`.
- **Log out** is a POST to `/api/auth/logout` from the search page's profile menu, which shows the person's Gravatar (initials when they have none). It lands on `/login`, not `/search`, which would sign the person straight back in while Okta still remembers them.

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

## Related

- [[_MOCs/Web Apps]]
- [[_MOCs/Experiments]]
