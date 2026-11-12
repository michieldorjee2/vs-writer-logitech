#!/usr/bin/env node
/**
 * Bundle and run server/offer-ended-check.tsx: an ended offer's pages come down
 * (src/lib/offer-ended.ts, api/_lib/offer-ended.ts, src/www/OfferEndedPage.tsx).
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

const dir = mkdtempSync(join(tmpdir(), 'offer-ended-check-'));
const out = join(dir, 'offer-ended-check.cjs');

try {
  await build({
    entryPoints: ['server/offer-ended-check.tsx'],
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
  for (const key of ['ALDUS_UI_URL', 'ALDUS_SHOWCASE_TOKEN', 'GRAPH_AUTH_KEY', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'OFFER_SIGNUP_FORM', 'OFFER_SIGNUP_WEBHOOKS']) delete env[key];
  // Its output is passed through and read: a check that stops early with nothing pending exits 0
  // without its last line (it happened while it was written), so "All checks passed." is required.
  const run = spawnSync(process.execPath, [out], { encoding: 'utf-8', env });
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  const finished = (run.stdout ?? '').includes('\nAll checks passed.');
  if (run.status === 0 && !finished) console.error('FAIL  the check exited 0 before it finished');
  process.exit(run.status === 0 && finished ? 0 : run.status || 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
