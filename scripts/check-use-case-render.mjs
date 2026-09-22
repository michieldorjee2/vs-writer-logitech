#!/usr/bin/env node
/**
 * Bundle and run src/lib/limitless/render-check.tsx.
 *
 * It needs bundling because it is TSX importing TSX, and CJS because
 * react-dom/server is CommonJS and `require("util")` does not survive an ESM
 * bundle. Both mirror what scripts/build-ssr.mjs already does for the real SSR
 * handler.
 *
 * Unlike check:graph this needs no network and no credentials, so it is safe to
 * wire into CI or a pre-push hook.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'use-case-render-'));
const out = join(dir, 'render-check.cjs');

try {
  await build({
    entryPoints: ['src/lib/limitless/render-check.tsx'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    // The renderer imports no CSS today; keep the loader so adding an import
    // does not turn this check into a confusing bundling error.
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: out,
    logLevel: 'error',
  });

  const run = spawnSync(process.execPath, [out], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
