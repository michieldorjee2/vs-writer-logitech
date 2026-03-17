import type { VercelRequest, VercelResponse } from '@vercel/node';

// Thin wrapper that delegates to the esbuild-bundled SSR handler.
// The bundle is generated during `npm run build` by scripts/build-ssr.mjs
// and includes React, react-dom/server, and all component code.

let _handler: ((req: VercelRequest, res: VercelResponse) => Promise<void>) | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!_handler) {
    const mod = await import('./_ssr-bundle.mjs');
    _handler = mod.default;
  }
  return _handler!(req, res);
}
