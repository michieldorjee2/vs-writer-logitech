#!/usr/bin/env node
/**
 * Bundle and run server/badge-ocr-check.ts: the browser's badge reader on the
 * made-up badges in server/fixtures/badges. Tesseract and sharp stay outside the
 * bundle and resolve from this checkout (node_modules/.tmp, as check:badge).
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync('node_modules/.tmp', { recursive: true });
const dir = mkdtempSync(join('node_modules/.tmp', 'badge-ocr-check-'));
const out = join(dir, 'badge-ocr-check.mjs');
try {
  await build({
    entryPoints: ['server/badge-ocr-check.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: ['sharp', 'tesseract.js'],
    outfile: out,
    logLevel: 'error',
  });
  const run = spawnSync(process.execPath, [out], { stdio: 'inherit' });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
