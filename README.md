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
updated: 2026-11-06
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
npm run check          # everything that needs no network: both type-checks, lint, check:limitless, check:signup, check:cta-ping, check:share-links, check:share-teams, check:www
npm run check:graph    # every shipped GraphQL query against the live schema (needs GRAPH_AUTH_KEY)
```

`npm run check` is what to run before pushing. It is deliberately not wired into `npm run build` yet — Vercel's build still runs only `tsc -b` — so a deploy is not blocked by anything new without a decision to do that.

Four things it covers that the build does not:

- **`server/` and `api/` are type-checked** (`typecheck:server`, `tsconfig.server.json`). The app config includes only `src/`, so the code that server-renders every page had never been checked; it now is, with `strictNullChecks` on, which is what the `api/` handlers' `if (!x.ok)` narrowing was written for. The app config is unchanged.
- **Lint runs and passes.** It had been crashing at config load — a stale `node_modules` with `zod@3.22.4` hoisted — so 204 errors built up unseen. A clean `npm ci` fixes the crash; if `npm run lint` dies with `ERR_PACKAGE_PATH_NOT_EXPORTED … zod`, that is the cause. `src/vendor/**` is ignored on purpose (see its `UPSTREAM.md`). The remaining warnings are `react-refresh` hot-reload hints, a dev-server convenience.
- **`check:limitless`** holds the search page's links back to Limitless to the people aldus-ui names, then reruns itself against mutants of the guarded files, each of which must fail it.
- **`check:page-activity`** holds the Report (below): keys, element paths, who counts as a visitor, the report and what its card shows, the account stage from ODP, and both endpoints against stand-ins for ODP and Redis that refuse what the real ones refuse.
- **`check:signup`** holds the offer page's email form (below): the render-time swap, the close band with and without it, the data-layer wrap and `POST /api/offer-signup`, all against stand-ins for the network.
- **`check:cta-ping`** runs Mark's code step for the one-click ask (`mark/cta-ping/test_step.py`, Python 3, no network) against stand-ins for Teams and Google Sheets.
- **`check:share-links`** holds personal links (below): what a rep types, the codes, all four endpoints against stand-ins for Redis, ODP, Mark and the webhook, the CTA ping's personal-link part, and both Mark steps' fixtures. **`check:share-teams`** runs the Teams step (`mark/share-teams/test_step.py`).

## www design (live, the default)

Every account page (`/<company>/`) and offer page (`/vb/<slug>`) renders in the www design, live since 2 November 2026 and the only design since 4 November, when the previous renderers (`ABMHyperPage`, `DynamicComparisonPage`, the use-case template) and every switch in the address (`?design=`, `?template=`) were removed. Person pages (`/<company>/<person>/`) render in it too, since 5 November (below); retail and fin-serv pages have their own renderers. The pages are 1:1 landing pages built from optimizely.com's own React components (vendored in `src/vendor/www`, see its `UPSTREAM.md`): no navigation or footer, a full-screen hero at three quarters of the window so the next scene peeks in, then one scene per idea at least that tall, white and Neutral 3 before a full-window dark close, LFGreen for the action only. The hero says whose page it is once, with the account's logo above the headline, and plays an intro on load; every other scene plays its own entrance when it scrolls into view (the waypoints in `useScenes`, the motion section of `www.css`). The close has one call to action. The content model is untouched: the template accounts for all 67 `CompetitorComparisonPage` properties (`src/www/account-fields.ts` lists them, `USED_FIELDS` and `NOT_SHOWN` say where each goes or why not), and offer pages are read back from their Visual Builder composition (`src/www/offer-content.ts`). X-ray and Edit mode find the account page's parts by their `data-xray` hooks. On an offer page the hero headline is sized to its own length (`fitVars` in `src/www/ui.tsx`): live headlines run from about 30 to 75 characters, and a long one steps down instead of running to seven lines and pushing the hero past the window. The extruded run gets room above it so it clears the line before it, and the opening paragraph under the hero runs in one column on the page's content width.

An account page's own pitch picks its template (`src/www/account-template.ts`), never the address. A page that pitches the agent platform (its headline names agents, or its headline or subheadline names the Agent Platform; 24 of 2,807 pages on 4 November) renders the agent platform template; every other page renders the takeout template (`src/www/AccountPage.tsx`), which shows the page's own stored pitch, every field, in the new design: a CMS takeout ("Relief for RINA S.p.A."), a testing pitch ("Prove every Lenovo launch"), Limitless itself ("Limitless for Google Cloud"). The agent platform template (`src/www/AgentPlatformPage.tsx`) is Laura Perez Riau's eight-section page from Dan Tranter's pitch, where the lifecycle state sets the hero, headline, proof and CTAs. The account research is threaded through the page rather than kept in one homework section: one stored fact per scene, the stack and investments marked with the same tag, and each use case showing what in the account's own data put it first. It reads `AgentPlatformContent`, which `src/www/agent-platform/content.ts` fills from the stored page until the agents write it directly; `?review=1` shows where each part came from and `?state=` switches the state. The one-click ask (hero, sticky bar, close) pings the account team once per page view and opens a connect panel instead of a form (`src/www/ConnectModal.tsx`). Edit mode offers each part of the page with the stored fields it shows and a hint (`TAKEOUT_EDIT` and `AGENT_PLATFORM_EDIT` in `src/lib/xray-defaults.ts`; on the agent platform page also its own text, kept beside the page in the site's Redis since the content type stays as it is; labels and the proof stories stay fixed). The request names each section's `Fields:`, so Mark changes exactly those, and the page re-renders live from the values Mark streams (`src/www/live-edit.ts`), on either template, spotlighting the part he is working on. An offer page without a logo shows its parent account page's (`api/_lib/parent-account.ts`: by Salesforce account, then the company name as the account page's URL, then a regional office or division of it). The agent changes this template needs are drafted, not deployed, in [docs/agent-platform-template](docs/agent-platform-template/README.md).

The person page (`src/www/PersonPage.tsx`, the `PersonPage` type: 33 pages on 4 November) is the 1:1 buyer page one level in from an account page, on the same layout. It keeps the order the August rebuild argued for: the hero (their account's logo and the stored eyebrow, once, then the stored headline or their name), a note from their account executive, what a seat like theirs is scored on, their operation, the product in practice, the same four steps on every page, one cited number and peer quotes, why they are seeing the page (their words and our labelled assumptions, with an invitation to correct us), and the one-click ask. It keeps that rebuild's rules, and since 6 November one more: Salesforce decides what the page argues but never appears on it (the open opportunity, the touchpoint log, the engagement summary and the engagement tier are not even fetched); no conversation of ours appears on it (no engagement badge, no "You have met", and their words only when they published them: a quote must link a public source, and one from an email, call or meeting is dropped on the server by `publicPersonPage`); and the working stays visible. The `person_page` agent (v3.1.0) writes to the same rule: nothing from a call, demo, meeting or email, quoted, paraphrased or as a figure they gave us. The account page's stakeholder cards follow it too: name, role, LinkedIn and their page, never an engagement badge or activity note. `src/www/person-content.ts` says where every stored field goes or why not (`PERSON_FIELDS`), and `check:www` fails if a never-shown field reaches the page. Two stored links are treated with care: the "Schedule a call" fast track appears only when `meetingUrl` is a booking link (21 of the 33 pages store optimizely.com/contact, a form), and the closing button keeps its stored words ("Book 30 minutes") only when it does; otherwise it reads "Talk to your team". The hero's second button scrolls to the page's argument instead of the stored contact form. X-ray and Edit mode find its parts by `data-xray` (`PERSON_XRAY_DEFAULTS`, `PERSON_EDIT`, each part with its fields for Mark); the page is not re-rendered live, Mark's edits show after the save. The CMS preview draws it with the editing hooks, as it does account pages. The old renderer (the WebGL galaxy, the starfield, its own CSS) and three.js are gone.

```bash
npm run check:www                              # 205 offline tests: helpers, field coverage, x-ray hooks, brand rules, Laura's rules, the person page, the CMS preview, the CTA ping
WWW_UPSTREAM=~/Claude/OptimizelyHeadless npm run check:www   # + proves src/vendor/www still matches upstream
npm run build && npx tsx scripts/serve-prod.ts &               # local production stand-in on :5199
npm run e2e:www                                # 133 Playwright checks, desktop + phone: both account templates, the person page, the offer page, X-ray/Edit, the CMS preview, the view transitions, all network mocked
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

It runs in the booth rail (below): pressing Edit folds the other tools out of the rail and slides Send in under it, with the number of comments waiting; the rail's first button turns from Search into Close, and "?" at its foot replays the tutorial. The first Edit in a browser opens with that tutorial (click an element, tell Mark what to change, send all your comments; don't forget to send), with Send pulsing in the rail. Close, Edit again, or Escape leaves. Until the first comment a note at the top says what to do. Mark edits the page live and reloads it when done, so there is no waiting timer on the Edit button. The comment popup, Mark's status and change cards, the tutorial and the thanks splash use the rail's surfaces and type, light or dark with the system (`src/styles/edit-mode.css`).

Server-side environment (Vercel project `aldus`; also in local `.env.local`):

```bash
OPAL_PAT=          # Opal Personal Access Token — required, never sent to the browser
OPAL_BASE_URL=     # default https://opal.optimizely.com
OPAL_INSTANCE_ID=  # default 4f42a24e93f945bcb262bff01a9a1562
OPAL_AGENT_ID=     # default 6c6d1d88-55ee-4f9c-a2d3-28de4bee1149 (account_page_live_edit)
```

Without `OPAL_PAT` the endpoint responds with a clean SSE error ("Server is missing OPAL_PAT"); the older fire-and-forget webhook lives at `api/opal-feedback.ts`.

## The booth rail and the Report (preview)

With `?search=1` and an Optimizely sign-in, a page gets the booth rail: a full-height column down the left (`src/components/FloatingSidebar.tsx`, `src/styles/booth-rail.css`) with the page set in beside it, rounded at the corners, in the search page's surfaces (Axiom tokens, light or dark with the system), spaced and coloured as Mark's own sidebar is when collapsed: rounded tiles 4 px apart, icons in Axiom's secondary foreground, the tool in use on a soft wash, each tool's name under its icon, and Mark's chevron at the foot to fold it away. Top to bottom: Search (back to `/search`), Edit (Edit mode runs in the rail, above), X-ray (also in the rail), Share (the Share card, below) and, on account pages, Report. The button at its foot folds the rail away and leaves one button at the bottom left to bring it back; the choice is kept in this browser. The rail slides and its buttons cascade in from the left. X-ray runs in the rail too, which keeps just Close while it does. Its scan, traced outlines, wires and floating cards keep their animations in the rail's surfaces and type (`src/styles/xray-mode.css`). Each part's card shows the tools that made it by their own favicons, as SVG in `public/logos/tools/` (`XrayToolLogo`; Optimizely's for ODP and the CMS), and Mark by its AI texture from the brand guidelines, turning slowly (transforms only, still for reduced motion), and opens to one line on how the part is made (`logic` in `src/lib/xray-defaults.ts`; a page's own stored note wins) and the data it is made from.

**Report.** The page's story from ODP, prospects only, over its whole history, on a card over the page, which blurs behind it, the rail included (`src/components/ActivityMode.tsx`). Its data is asked for as the rail mounts (`src/hooks/usePageActivity.ts`): the Report icon waves while it loads and turns to bars when it is in (lime when the page has visits). Journey: when the page was built and last updated, first viewed, first engaged with (a visit of 30 s or more, scrolled past half, or with a click), and first had a CTA pressed; the step it is at opens to the visits behind it. Data: first and last seen, the longest visit, CTA clicks, the account's stage, the last visit's channel and the last country known. Activity: visits in seven slots up to today (days, weeks or 30-day months, by the page's age). "Open in Salesforce" links the page's Salesforce account.

**Where the numbers come from.** ODP, through `GET /api/page-activity` (`api/page-activity.ts`, signed-in employees only, a built report held 5 minutes). Two tags write the events: ODP's universal tag records every click with the element's path in the page, rage clicks and final scroll depth; the tracking hook (`src/hooks/useOdpTracking.ts`) records the pageview, the scenes seen, CTA clicks (with `cta_type` and `position`: the connect buttons by id, the connect panel's tiles by `data-cta`) and the exit summary. ODP serves events one visitor at a time and cannot list a page's visitors, so every page view also posts `{ page, vuid }` to `POST /api/page-visit`, the one thing kept outside ODP: which ODP visitor ids opened which page (`api/_lib/page-activity-store.ts`). A signed-in employee's visit marks their id as team. The account's stage is ODP's too (its Salesforce sync, `account_stage`, found by the page's 18-character Salesforce id); the report makes no Salesforce call. Pages read before the index existed were filled from Optimizely Analytics' copy of the same ODP data (`scripts/page-activity-backfill.ts`). The account-page averages are `scripts/page-activity-bench.ts`, run by hand for now. Who counts as a visitor, the element keys, the report and what the card shows are in `src/lib/page-activity.ts`; `npm run check:page-activity` covers them (111 checks, no network). `scripts/page-activity-report.ts <page>` prints a page's report from the live data.

**Who is tracked.** Only visitors, and only the page. A click counts as the page's only inside the page itself or on one of its named CTAs (the connect panel's tiles, portaled out of the page, carry `data-cta`), never on the rail, its modes or anything else drawn over the page (`isPageClick`, `src/lib/activity-dom.ts`). A signed-in Optimizely person is never sent to ODP: signing in also sets a `showcase_staff` cookie the page can read (`src/lib/staff-marker.ts`, set and cleared with the session in `api/_lib/auth.ts`; a session from before it gets it the next time it is used). With it, `index.html` does not load ODP's SDK, opts the browser out of Optimizely before the Web Experimentation snippet runs (that snippet loads ODP's universal tag itself, and turning only its tracking off did not stop the tag sending), and the tracking hook sends nothing. The mark is not a credential: a visitor who sets it only stops being tracked.

The report still carries per-element clicks and scene reach, and `src/lib/activity-dom.ts` can find a clicked element on the page again; the card does not draw them (the first version outlined them on the page).

Env:

- `ODP_PRIVATE_KEY`: the ODP account's private API key (Production and this branch's previews). Read only in `api/_lib/odp-events.ts`, never sent to the browser. Unset, the report answers 503 and the pages still record visits.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: the visitor index, the report cache and the averages.

## Sharing a page: personal links (preview)

The rail's Share opens a card over the page, the way the Report does (`src/components/ShareSheet.tsx`, `src/styles/share-sheet.css`). It shows the page's public address. **Add a personal message** asks who it is for (name, title and, optionally, email; on a person page the name and title are filled in from the page) and the rep's note, and makes a short link, `/s/<code>` (`POST /api/share-links`, eight letters and digits). **Preview** opens it in a new tab, exactly as the recipient will see it; a signed-in preview is never counted as an open. From then on everything on the card shares that link:

- **Copy link.**
- **Send to me**: Mark's **Showcase share to Teams** workflow messages the rep in Teams, and only the signed-in rep, the link (with their note), and what the page has seen: visits, last seen, CTA clicks, the account's stage, and the link's opens (`api/share-send.ts`, `mark/share-teams/`).
- **New email**: Mark's **Showcase share email** agent (`showcase_share_email`, no tools, two credits, first words in about two seconds and done in four) writes the email from the rep's note, or a short introduction when there is none. It runs through the official Agent SDK (`@optimizely-opal/opal-agent-sdk`, `streamAgentText` in `api/_lib/mark.ts`), and the card shows it being written as Mark's words stream in. The rep then edits it on the card and opens it in Outlook on the web as a new message, addressed to the recipient. When Mark is slow or unavailable the card gets a plain template instead, never nothing.

**The recipient.** `/s/<code>` sends them to the page with `?p=<code>` (`api/share-go.ts`; nothing is counted there, because mail scanners follow links too). On the page the rep's note floats down over it, on a card of paper with a strip of lime tape (the Optimizely logo, the note, the sender's name and the page's own primary CTA, "Open your page"), before they open the page (`src/components/InviteNote.tsx`, `src/styles/invite-note.css`). Showing the note tells the site it was opened (`POST /api/share-note`): counted once per visitor per six hours, and sent to ODP as `personal_link_open` with the visitor's id and, when the rep gave one, the recipient's address, so ODP knows who read it. A CTA click later in that tab carries the code: the link counts it, ODP gets `personal_link_cta`, and the CTA ping tells the account executive whose link the visitor came by (below). Nobody signed in is ever counted or sent, so a rep can look at their own note.

**In the Report.** Once a page has links, "Shared links" lists them, newest first: who each was for, who sent it and when, and what became of it (not opened yet, opened, a CTA clicked after); a row opens to the note. Person pages have no Report, so their Share card lists them.

Links live in Upstash Redis for 400 days (`api/_lib/share-store.ts`): the link (`sl:<code>`), its counts (`sl:s:<code>`) and the page's list (`sl:p:<path>`). The note endpoint returns no addresses and only answers on the link's own page; the list returns no addresses at all. Limits: 40 links, 30 Teams messages and 40 drafts a day per rep, 30 note reads a minute per address.

Env:

- `SHARE_TEAMS_WEBHOOK_URL`, `SHARE_TEAMS_WEBHOOK_KEY`: the share workflow's webhook and its `x-showcase-key` (Production, and `feat/admin-analytics` previews). Unset, Send on Teams answers 503.
- `OPAL_PAT`: Mark's API, for the email agent (Production, and this branch's previews). `SHARE_EMAIL_AGENT_ID` overrides the agent (default `73f146bc-a052-4d5f-be22-06fc36f010cd`).
- `ODP_PRIVATE_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`: as for the Report.

## The CMS preview

The CMS shows every draft in its editor through the Showcase application's preview URL, `https://showcase.optimizely.com/preview?key={key}&ver={version}&loc={locale}&ctx={context}` plus the editor's `preview_token` (CMS Settings → Applications → Aldus). `/preview` (`src/components/CmsPreview.tsx`) draws the draft exactly as its live address would: an account page in the template its pitch calls for, an offer page in the www offer design, any other experience from its composition, and the few legacy blocks still in the CMS with `BlockPreview`. `/api/preview` reads the draft with the editor's token (published content with the site key when there is none): first `_Content` for the key's type, which Graph names in `_metadata.types` (its `__typename` there is only the base type, `_Page` or `_Experience`), then that type's own query, with the same fields and extras the live page gets (the page's own copy on an account page, the parent account's logo on an offer).

The CMS sizes its preview frame to the page's height, so in the preview the www design lays out for a fixed 900 px window (`data-cms-preview` on `<html>`; every `vh` in `src/www/www.css` reads `--www-vh`). Without that the scenes, sized by the frame, grew the frame, which grew the scenes, until Chrome's limit: a 16,777,213 px frame with the hero's content centred out of sight, and very slow.

Editing goes through Optimizely's CMS SDK (`@optimizely/cms-sdk`, pinned):

- The CMS's communication injector is loaded from the CMS instance (`VITE_CMS_URL`, defaulting to Showcase's `app-opti01saas4uc99t001.cms.optimizely.com`; it was never set on Vercel, so on-page editing had not worked before).
- `PreviewComponent` hears each save, waits until the CMS says the draft is ready, and refreshes it in place: the same URL is fetched again, a new token or version is routed to, and the page never reloads.
- In `ctx=edit` the pages carry the SDK's hooks (`getPreviewUtils().pa`, wrapped in `src/www/cms-edit.tsx`): on the takeout template `data-epi-edit` on every stored field it shows; on the agent platform template on each CMS field it shows (logo, stats, stack, investments, stakeholders, team, small print), since its headlines and body text are the template's own copy, kept beside the page and changed in Showcase's Edit mode; and `data-epi-block-id` on every offer section and element. Outside the editor there are no hooks, so the live pages render exactly as before.
- Nothing is sent from the preview: no tracking, no "talk to your team" ping and no sign-up (`src/lib/cms-preview.ts`).

Two things to know before touching the queries:

- **Adding a field to the account page query before it is registered in the CMS 404s every account page.** One unknown field fails the whole GraphQL query (commit `9091988`). Register in the CMS, run `npm run check:graph`, *then* add it to `src/lib/account-page-query.ts`: one field list that the live page (`api/content.ts`), the server render, the dev server and the CMS preview all read.
- **`_json` is not an escape hatch for unregistered fields.** Graph rejects it on a page root (`The \`_json\` field is only supported within the \`item\` field`), so a field the content type does not register cannot be read at all — register it first.

## View transitions: the search page and the pages it opens

Opening an account, person or offer page from the search page, and going back, animates instead of reloading. The search page's frame becomes the page's dark hero block, growing out to the window's top and right edges while its grey left margin widens into the booth rail. The search page's photograph moves into the hero's right half without a cross-fade, because the page shows that same photograph. The row's logo and name fly to the hero's logo tile and the line beside it, and the wordmark moves to its place. The headline with the search box, and the lists with their grey cut-out, slide down off the window. Going back runs the same in reverse: the rail narrows into the margin, the frame closes, and the search parts rise back up. The search page opens results in the same tab for this (Cmd/Ctrl/Shift or a middle click still opens a new one), and comes back from the browser's back/forward cache with its query and list as they were.

They are cross-document view transitions (`@view-transition { navigation: auto }`), because the search page (home.html) and the pages (index.html) are separate documents:

- `src/styles/view-transitions-opt-in.css`: the opt-in, inlined by `vite.config.ts` as the first thing in both `<head>`s. Reduced motion opts out. It is not in a stylesheet because the account page links its stylesheet after its scripts. The arriving page could settle its opt-in before that stylesheet was in, and about one navigation in five dropped the transition ("ViewTransition opt-in disabled").
- `<link rel="expect" href="#hero" blocking="render">` in `index.html` (`#sh-q` in `home.html`): the first paint, the one the transition captures, waits until the hero is parsed. Without it a page could be captured before its hero existed, and nothing moved.
- `src/styles/view-transitions.css`: loaded by both documents. Every moving part's timing; the frame (`vt-frame`, its dark ground drawn by the transition itself, its corners settling to the rail's); the grounds (the search page's grey stays while a page opens, the page's lower part comes in last); the rail's ground and the rail.
- The names: `www.css` names the hero block, photograph, wordmark, logo tile and account line on every page. `search-home.css` names the frame, photograph, shade and wordmark, plus the layers that travel or fade (top bar, headline and search box, lists, the badge scanner's lanyard). The lists carry the page's own colour (`.sh-panel__body`), because the transition takes the photograph without the frame's cut-out.
- `src/lib/view-transitions-boot.js`, written into both `<head>`s by `vite.config.ts` (a classic inline script, so its listeners exist before the first paint):
  - The search page names only the row you open (`pageswap`) and the row you come back from (`pagereveal`), then lets go. It hands the photograph on screen to the page it opens (`vt.scene`); the page shows it in its hero (`vt-scene-carry`, `--vt-scene`) and hands it back.
  - A page arriving by the morph skips its hero intro; a page scrolled past its hero morphs nothing.
  - Opened with the booth rail open (desktop, not folded away), the page gets the rail's room before the first paint (`vt-rail-room`) and its grey ground (`.vt-rail-shell`). The rail itself mounts after the morph, slides over that ground and takes it over (`src/lib/rail-room.ts`).
  - It also sets `window.__vtSettled`. The app (`src/main.tsx`, `src/home-main.tsx`) hydrates only after the transition the page arrived by is over (`src/lib/after-view-transition.ts`). React Router's first `replaceState`, landing in the morph's first frames, cancelled about half of them.

Chrome and Edge 126+ and Safari 18.2+ animate; any other browser just navigates. The search page's service worker serves its last copy first, so the first visit after a deploy shows the previous search page, and the next one animates. Locally, `SERVE_SIGNED_IN=<email> npx tsx scripts/serve-prod.ts` serves the search page signed in, with the search index read from Graph, to try it.

## The one-click ask: the CTA ping

"Talk to your team" on an account page or a person page (the hero, the close, the sticky bar) has no form. The click opens the connect panel and tells the account team:

1. The browser (`src/lib/cta-ping.ts`, from `src/www/ConnectModal.tsx`) posts only the page's route, which button, and the visit's `utm_*` values to `POST /api/cta-ping`. Nothing is sent from the CMS preview.
2. `api/cta-ping.ts` takes a same-site JSON post for an account page or person page route and a known button, limits it (one per visitor per page an hour, ten per page a day, 300 a day, while the KV pair is set), reads the page's team from Graph itself, and posts the click to Mark's **Showcase CTA ping** workflow with the trigger's key. Nothing the visitor sends decides who is messaged.
3. The workflow's one code step (`mark/cta-ping/step.py`) messages the page's account executive in Teams from Michiel's account. With no account executive on the page, or when the message fails, it adds a row to the **Showcase CTA follow-ups** Google Sheet instead. See [mark/cta-ping/README.md](mark/cta-ping/README.md).

A visitor who came in by a personal link (above) also sends its code. When it is one of this page's links, the click Mark gets says who the link was for and who sent it (`shared`), and the message and the sheet row say "They came in by the personal link Michiel Dorjee sent to Ana Silva (CMO, ana@…)".

The account executive is the first real contact on the page whose role is one of `AE_ROLE` (`src/lib/account-rep.ts`): the account page's `teamMembers`, a person page's `team`. On a person page the message says whose page it was. The panel names that person ("We've let Alex know"), or "your Optimizely team" when there is none, so it never names someone the ping didn't tell. On 4 Nov 2026, 1,169 of 2,812 account pages had one.

Env (Production only):

- `CTA_PING_WEBHOOK_URL`: the workflow's webhook (`https://webhook.mark.optimizely.com/...`). Unset, the endpoint answers 202 and sends nothing, which is what previews and local runs do.
- `CTA_PING_WEBHOOK_KEY`: the trigger's `x-showcase-key`. Mark refuses a post without it.
- `GRAPH_AUTH_KEY`: the page read; unset, 503. `KV_REST_API_URL`, `KV_REST_API_TOKEN`: the limits; unset, no limits.

The click is still tracked in ODP as before (`useOdpTracking`).

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

## Search page: badge scanning

Every signed-in rep has a badge icon beside the go button, on any device; on their first visits "New: Scan a conference badge" hangs off it for a few seconds (`src/lib/seen-hints.ts`). It opens the badge scanner (`src/components/BadgeLanyard.tsx`): a badge on an Optimizely lanyard drops down asking the rep to "Hold up your badge", swings, and can be grabbed and flung (`src/lib/lanyard-physics.ts`, a few Verlet points and two springs; inspired by Vercel's 3D event badge, made of the page's own elements). Behind it is the camera's picture, blurred and mapped to dark greens (an SVG gradient-map filter), so it is plain the camera is on without showing what it sees; The camera watches for a badge lifted into view and held still and sharp (`src/lib/badge-detect.ts`); when it sees one the badge flashes green and fills in. "Detect badges automatically", a switch in the window's bottom right corner (under its button on a phone), is on unless turned off (kept per browser, `src/lib/scan-prefs.ts`); off, the badge's ribbon becomes Scan and a photo is taken only when it is pressed. "Type manually", the window's quieter button, fills one in by hand, and a badge photo dropped on the search bar or pasted into it opens the scanner with that photo. A badge that couldn't be read says so and the camera keeps watching.

The filled-in badge shows the name, the title when one was read, and the company by its name alone (its logo when it has a page; never initials or a domain). Selecting a line fixes it on the badge; the name and the company suggest the index's people and companies as they are typed (`src/lib/badge-suggest.ts`), and picking a person brings their company. Leaving a field keeps what was typed. The badge always has two buttons, Company and Person: dark green with an arrow to open the page the index has, a ghost "+" to have it made. "+ Company" closes the scanner and starts the search bar's own Add company for it (the Salesforce account picker and all); "+ Person" sends the person to Mark through the person-page flow (their company's page first when it has none), and the search page shows it being made. "Scan new badge", the window's own button at the bottom, starts again. The camera runs only while the badge waits for one. On a short window (a phone on its side) the badge takes the height and the window's button moves to the corner.

The browser reads the badge itself. Tesseract (WebAssembly, `src/lib/badge-read-device.ts`) finds the lines of text, and `src/lib/badge-ocr.ts` sorts them into name, title, company and email: the biggest name-like words, the line with a title's words, the line the email's domain spells (or a legal name's ending, or the line under the name), with the event's own lines left out. No photo and no text leaves the device until the rep sends the card. Tesseract's files are this site's own, at `/ocr/<version>/` (vite.config.ts `ocrFiles` serves and builds them from node_modules; about 7 MB the first time, cached for good after), and load while the camera is open. A warm read takes about 0.3 s on a laptop.

Mark reads a badge only when the browser read nothing usable and `MARK_BADGE_AGENT_ID` names Mark's badge-reader agent with `OPAL_PAT` set (`api/badge-read.ts`, `api/_lib/badge-mode.ts`; spec in the Notion-sweep notes, `badge-agent-spec.md`). Unset, such a badge says it couldn't be read and the rep types the company. `BADGE_READ_STUB` is a local stand-in for Mark that always reads the same made-up badge, refused whenever `VERCEL_ENV` or `NODE_ENV` is production.

```bash
MARK_BADGE_AGENT_ID=   # optional: Mark reads what the browser couldn't
BADGE_READ_STUB=       # local preview only
```

```bash
npm run check:badge                    # the flow, the detector, the sorting rules, nothing kept
npm run check:badge-ocr                # Tesseract on 16 made-up badges (server/fixtures/badges)
python3 scripts/make-badge-fixtures.py # redraw those badges
```

## Related

- [[_MOCs/Web Apps]]
- [[_MOCs/Experiments]]
