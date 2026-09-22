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
updated: 2026-09-17
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
- **`_json` is not an escape hatch for unregistered fields.** Graph rejects it on a page root (`The \`_json\` field is only supported within the \`item\` field`), no shipped query selects it, and `mergeRetailJson()` in `api/content.ts` and `server/ssr-handler.tsx` is therefore dead code despite a comment claiming otherwise.

## Related

- [[_MOCs/Web Apps]]
- [[_MOCs/Experiments]]
