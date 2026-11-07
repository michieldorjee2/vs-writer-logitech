import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import './index.css'
/*
 * The Material Symbols icon font, imported here rather than through `src/index.css` /
 * `src/vendor/opticom/app/globals.css`'s own `@import 'material-symbols/rounded.css'` line
 * (which is patched out — see UPSTREAM.md, "The CSS entry point"). Routing this import
 * through Tailwind's own CSS pipeline (`@tailwindcss/postcss`, which resolves the whole
 * `@import` graph starting from index.css) breaks Vite's asset handling for the package's
 * relative `url(./material-symbols-rounded.woff2)`: measured with `npm run build`, the font
 * file is never copied into `dist/assets` and the url is left unrewritten, so every icon
 * would silently 404 in production while looking fine in dev. A plain JS-level import gives
 * Vite's normal CSS-asset pipeline (not Tailwind's) the file, which resolves and fingerprints
 * the woff2 correctly — the same reason Google Fonts is loaded via a `<link>` in index.html
 * rather than a CSS `@import` (see index.css's own first line).
 *
 * Since 6 Nov 2026 this import resolves to src/styles/material-symbols/rounded.css (an alias in
 * vite.config.ts): the same face and class with only the icons the site draws (151 kB, not the
 * package's 5.4 MB). A name only the CMS knows brings in the whole font (src/lib/icon-font.ts).
 */
import 'material-symbols/rounded.css'
import App from './App.tsx'
import { inCmsPreview } from './lib/cms-preview'
import { afterViewTransition } from './lib/after-view-transition'

/*
 * The CMS's preview (/preview): set before anything renders, so even the first loading screen is
 * laid out for a fixed window. The CMS sizes its frame to the page, so a page sized by the frame
 * would grow without end (src/www/www.css, src/index.css).
 */
if (inCmsPreview()) document.documentElement.setAttribute('data-cms-preview', '');

const root = document.getElementById('root')!;

// Opened from the search page, the page morphs in from the server's HTML first: the app starts
// once that is over (src/lib/after-view-transition.ts), or it cancels the transition.
afterViewTransition(() => {
  if (root.innerHTML.trim().length > 0) {
    // Server-rendered HTML present — hydrate instead of full render
    hydrateRoot(root, <StrictMode><App /></StrictMode>);
  } else {
    // SPA mode (home page, preview, or dev without SSR)
    createRoot(root).render(<StrictMode><App /></StrictMode>);
  }
});
