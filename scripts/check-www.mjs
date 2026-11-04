#!/usr/bin/env node
/**
 * Runs the www-design tests (src/www/__tests__/www.test.tsx) and, when an upstream checkout is
 * given, proves src/vendor/www is still optimizely.com's code plus the recorded patches.
 *
 *   npm run check:www
 *   WWW_UPSTREAM=~/Claude/OptimizelyHeadless npm run check:www
 *
 * Bundled with esbuild (TSX importing TSX; react-dom/server is CommonJS), with the app's
 * tsconfig so the `@/` alias the Visual Builder blueprints use resolves. No network.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'www-check-'));
const out = join(dir, 'www.test.cjs');
let status = 0;
try {
  await build({
    entryPoints: ['src/www/__tests__/www.test.tsx'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    tsconfig: 'tsconfig.app.json',
    loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
    outfile: out,
    logLevel: 'error',
  });
  status = spawnSync(process.execPath, [out], { stdio: 'inherit' }).status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (process.env.WWW_UPSTREAM) {
  console.log('\nvendored components');
  const sync = spawnSync(process.execPath, ['scripts/sync-www.mjs', '--upstream', process.env.WWW_UPSTREAM, '--check'], {
    stdio: 'inherit',
  });
  status ||= sync.status ?? 1;
} else {
  console.log('\n(skipped the src/vendor/www upstream check: set WWW_UPSTREAM to an OptimizelyHeadless checkout)');
}
process.exit(status);
