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
 */
import 'material-symbols/rounded.css'
import App from './App.tsx'

const root = document.getElementById('root')!;

if (root.innerHTML.trim().length > 0) {
  // Server-rendered HTML present — hydrate instead of full render
  hydrateRoot(root, <StrictMode><App /></StrictMode>);
} else {
  // SPA mode (home page, preview, or dev without SSR)
  createRoot(root).render(<StrictMode><App /></StrictMode>);
}
