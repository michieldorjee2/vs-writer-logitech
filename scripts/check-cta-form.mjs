#!/usr/bin/env node
/**
 * Bundle and run server/cta-form-check.tsx: the form on an offer page's CTA
 * (src/lib/cta-form.ts): the rules, the data-layer marker and POST /api/cta-form.
 *
 * Bundled as check-use-case-render.mjs bundles its check (TSX importing TSX, CJS because
 * react-dom/server is CommonJS), with build-ssr.mjs's '@' alias for the vendored components.
 * No network and no credentials: every fetch in it is a stand-in, so it runs in `npm run check`.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'cta-form-check-'));
const out = join(dir, 'cta-form-check.cjs');

try {
  await build({
    entryPoints: ['server/cta-form-check.tsx'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
    alias: { '@': resolve('src/vendor/opticom') },
    outfile: out,
    logLevel: 'error',
  });

  const env = { ...process.env };
  // The check sets its own; nothing from the shell or .env.local reaches it.
  for (const key of ['ALDUS_UI_URL', 'ALDUS_SHOWCASE_TOKEN', 'GRAPH_AUTH_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'OFFER_SIGNUP_FORM', 'OFFER_SIGNUP_WEBHOOKS', 'OFFER_CTA_FORM', 'CTA_FORM_SUBMIT_URL', 'ODP_PRIVATE_KEY', 'ODP_API_BASE']) delete env[key];
  const run = spawnSync(process.execPath, [out], { stdio: 'inherit', env });
  process.exit(run.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
