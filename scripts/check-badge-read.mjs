#!/usr/bin/env node
/**
 * Bundle and run server/badge-read-check.ts: the badge reader's rules (the
 * card Mark's read becomes, the page request it makes, the flag and the local
 * stand-in, the ticket, the photo's EXIF and that nothing keeps it).
 *
 * Like check:render it needs no network and no credentials. It is bundled
 * into node_modules/.tmp (not the OS temp dir) so the one package left out of
 * the bundle, sharp (a native module), resolves from this checkout.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync('node_modules/.tmp', { recursive: true });
const dir = mkdtempSync(join('node_modules/.tmp', 'badge-read-check-'));
const out = join(dir, 'badge-read-check.mjs');

try {
  await build({
    entryPoints: ['server/badge-read-check.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: ['sharp'],
    outfile: out,
    logLevel: 'error',
    // @upstash/redis (auth.ts) is CommonJS; give its require() a home in the ESM bundle.
    banner: { js: "import { createRequire as __badgeRequire } from 'node:module'; const require = __badgeRequire(import.meta.url);" },
  });

  const run = spawnSync(process.execPath, [out], { stdio: 'inherit' });
  process.exit(run.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
