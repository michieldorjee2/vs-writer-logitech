# src/vendor/www: optimizely.com's components, for the www-design pages

The www-design account and offer pages (`src/www`, served on `?design=www`) are built from
optimizely.com's own React components. This directory is those components, copied from the
site's source, plus the few shims a Vite app needs in place of Next.js.

```bash
node scripts/sync-www.mjs --upstream ~/Claude/OptimizelyHeadless           # copy + patch
node scripts/sync-www.mjs --upstream ~/Claude/OptimizelyHeadless --check   # prove, write nothing
```

`--check` exits non-zero the moment a file here stops being *upstream + the transforms + its
recorded patch*. `npm run check:www` runs it too when `WWW_UPSTREAM` points at a checkout.

## Why a second vendored tree

`src/vendor/opticom` was taken from an older upstream snapshot (Next 16.2.0-canary, 31 blocks)
and is live under every Visual Builder page. The components these pages use (StatBlock, the
logo carousel and CompanyBlock, TableBlock, the quote and arrow cards, the accordion, the
footer wordmark) only exist in the newer upstream (Next 16.2.4, 71 blocks), whose `lib/utils.ts`
alone differs from the old one by 270 lines. Upgrading the old slice in place would change live
pages; a separate tree changes nothing already served.

## Source

| | |
| --- | --- |
| checkout | `~/Claude/OptimizelyHeadless` (no git metadata; package `opticom`, Next 16.2.4) |
| vendored on | 2026-11-01 |
| files | 55 vendored, 7 shims, 1 patch |

## Transforms (every vendored file)

1. a leading `'use client'` is dropped
2. `@/x` imports become relative paths inside this directory, so nothing here resolves into
   the older `src/vendor/opticom` through the shared `@/` alias
3. `motion/react` becomes `framer-motion` (the package `motion/react` re-exports, already installed)
4. `next/image` and `next/link` become `_shims/next-image` and `_shims/next-link`

## Patches

| file | change | why |
| --- | --- | --- |
| `lib/utils.ts` | the `next/navigation` import becomes a structural type | `next/navigation` is not installed; `createUrl` only uses `toString()` |

## Shims (ours)

| file | what |
| --- | --- |
| `lib/optimizely/graphql.ts` | `graphql()` returns its source, `readFragment()` is the identity. The pages map Showcase content onto props directly; gql.tada's generated schema is not in any checkout |
| `lib/optimizely/features/draft/index.ts`, `editable-field.tsx` | the non-edit branches of `EditableField` / `EditableHtml`; these pages are never edited in the CMS on-page editor |
| `components/layout/footer/assets/index.ts` | exports only the wordmark (the other footer icons are not vendored) |
| `_shims/next-image.tsx`, `_shims/next-link.tsx` | a plain `<img>` and `<a>` |

## Known upstream gaps, handled outside this directory

- `text-headline-3xs` and `text-headline-xxs` are used (PortraitTextQuoteCard on a phone, one
  card title) but upstream's token set never defines them, so on optimizely.com they fall back to
  body size. `src/www/www.css` defines both.
- The table and icon CSS TableBlock relies on lives in upstream's unscoped `app/globals.css`;
  `src/www/www.css` carries a scoped copy.
- The accordion mounts an answer only when it opens, so server HTML has no answers; the offer
  page adds FAQPage structured data with every answer.
- `CardArrowCard` plays `/assets/Slow_2.5m.mp4` on hover; the file is not in `public/` yet, so
  the hover shows the static card.
