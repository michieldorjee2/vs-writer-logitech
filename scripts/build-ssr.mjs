/**
 * Bundle the SSR handler into a single api/ssr.js file.
 *
 * Why: Vercel's @vercel/node runtime transpiles but does NOT bundle local
 * imports when "type":"module" is set. esbuild resolves all local src/
 * imports at build time so the deployed Lambda is a single self-contained file.
 *
 * ALL npm packages are bundled in to avoid CJS/ESM interop issues
 * (react-use uses require('react') internally, which breaks when React
 * is external ESM). Only Node.js builtins are external.
 */
import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';
import path from 'node:path';

// Read the Vite-built HTML template and bake it into the bundle.
// This eliminates the need for Vercel's includeFiles + fs.readFileSync at runtime.
let htmlTemplate;
try {
  htmlTemplate = readFileSync('dist/index.html', 'utf-8');
} catch {
  htmlTemplate = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><div id="root"></div></body></html>';
  console.warn('⚠ dist/index.html not found, using fallback shell');
}

/*
 * The search page's own document (home.html, served at /search) and a page's address
 * while Mark builds it (build.html), rendered into by the same handler. Each has one
 * small stylesheet, inlined: the first paint then waits on no request but the document,
 * which is most of what a phone on a slow network sees.
 */
function ownDocument(file, entry) {
  try {
    return readFileSync(`dist/${file}`, 'utf-8').replace(
      new RegExp(`<link rel="stylesheet"[^>]*href="(/assets/${entry}-[^"]+\\.css)"[^>]*>`),
      (_tag, href) => `<style>${readFileSync(path.join('dist', href), 'utf-8')}</style>`,
    );
  } catch {
    console.warn(`⚠ dist/${file} not found, its routes fall back to the main shell`);
    return htmlTemplate;
  }
}
const homeTemplate = ownDocument('home.html', 'home');
const buildTemplate = ownDocument('build.html', 'build');

await esbuild.build({
  entryPoints: ['server/ssr-handler.tsx'],
  outfile: 'api/_ssr-bundle.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',

  // Only Vercel runtime type is external — everything else bundled.
  external: ['@vercel/node'],

  // Stylesheets a server-rendered component imports (SearchHome's) are the browser
  // build's business; on the server they are nothing, so no stray CSS bundle is written.
  loader: { '.css': 'empty' },

  // Replace browser-only hooks with SSR-safe stubs.
  // These hooks use browser APIs (window, rAF, mouse events) that don't
  // exist during renderToString. The stubs return sensible defaults.
  alias: {
    'react-use/lib/useWindowSize': './server/stubs/useWindowSize.ts',
    'react-use/lib/useRafLoop': './server/stubs/useRafLoop.ts',
    'react-use/lib/useMouseHovered': './server/stubs/useMouseHovered.ts',
    'react-use-measure': './server/stubs/useMeasure.ts',
    /*
     * Mirrors vite.config.ts's '@/' alias (-> src/vendor/opticom). The Visual Builder render
     * chain server/ssr-handler.tsx pulls in (layout/column, layout/row, blank-section, the
     * draft-mode shims, display-defaults' cn/draftClass helpers) all import through this
     * alias, exactly as authored for the client bundle. Without it esbuild fails the build
     * with "Could not resolve @/lib/...", not a runtime error — caught here, at build time,
     * rather than in production.
     */
    '@': path.resolve('src/vendor/opticom'),
  },

  // JSX transform (matches tsconfig jsx: react-jsx)
  jsx: 'automatic',
  jsxImportSource: 'react',

  // Inline the HTML template as a compile-time constant.
  // Avoids needing fs.readFileSync + includeFiles at runtime.
  define: {
    '__HTML_TEMPLATE__': JSON.stringify(htmlTemplate),
    '__HOME_TEMPLATE__': JSON.stringify(homeTemplate),
    '__BUILD_TEMPLATE__': JSON.stringify(buildTemplate),
  },

  // Source maps for Vercel runtime error traces
  sourcemap: true,

  // Readable output for debugging
  minify: false,

  // Banner: createRequire shim so CJS packages (react-dom/server) can
  // require() Node builtins when running in ESM context.
  banner: {
    js: [
      '/* SSR handler — bundled by esbuild at build time */',
      'import { createRequire as __createRequire } from "module";',
      'const require = __createRequire(import.meta.url);',
    ].join('\n'),
  },
});

console.log('✓ SSR handler bundled → api/_ssr-bundle.mjs');
