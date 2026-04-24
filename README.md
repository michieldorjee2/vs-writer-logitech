---
title: vs-writer-logitech
aliases: [vs-writer-logitech]
type: web-app
product: independent
status: experimental
stack: [typescript, react, vite, upstash-redis, framer-motion, gsap, tailwind]
tags: [web-app, writing, logitech, input-device]
related:
  - "[[_MOCs/Web Apps]]"
updated: 2026-04-19
---

# vs-writer-logitech

Vercel-deployed writing-assistant web app that takes Logitech device input and produces AI-assisted writing output. Vite + React 19 + Upstash Redis, with Framer Motion and GSAP driving the interaction layer.

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

## Related

- [[_MOCs/Web Apps]]
- [[_MOCs/Experiments]]
