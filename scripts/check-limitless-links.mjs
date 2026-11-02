#!/usr/bin/env node
/**
 * Bundle and run server/checks/limitless-links-check.tsx (the search page's
 * links back to Limitless), then prove it can fail: the same check is built
 * again against each mutant below, a copy of one guarded file with one change,
 * and every one must make it print a FAIL line and exit 1. A mutant whose
 * anchor isn't in the file fails this script, so a rename can't quietly turn
 * a control into a pass.
 *
 * Bundled for the reasons check-use-case-render.mjs gives: TSX importing TSX
 * and the api/ code, CJS because react-dom/server is CommonJS. No network and
 * no credentials: the check stubs fetch and sets its own env.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ENTRY = 'server/checks/limitless-links-check.tsx';

/** Each must be caught. `all`: every occurrence of `from` changes (at least one must exist); otherwise exactly one. */
const MUTANTS = [
  {
    name: 'the menu draws the links whatever `limitless` says',
    file: 'src/components/ProfileMenu.tsx',
    from: '{limitless && (',
    to: '{(true as boolean) && (',
    all: true,
  },
  {
    name: 'api/offers sends the address without asking',
    file: 'api/offers/index.ts',
    from: 'limitless: admin ? limitlessOrigin() : null',
    to: 'limitless: limitlessOrigin()',
  },
  {
    name: 'api/offers asks about the email in the query',
    file: 'api/offers/index.ts',
    from: 'isLimitlessAdmin(identity.email, fresh)',
    to: 'isLimitlessAdmin(String(req.query.email ?? identity.email), fresh)',
  },
  {
    name: 'limitlessOrigin skips its https test',
    file: 'api/_lib/aldus.ts',
    from: "return url.protocol === 'https:' || (url.protocol === 'http:' && local) ? url.origin : null;",
    to: 'return local || url.origin ? url.origin : null;',
  },
  {
    name: 'a failed answer is held for five minutes',
    file: 'api/_lib/aldus.ts',
    from: '  } catch {\n    return false;\n  }',
    to: '  } catch {\n    viewers.set(who, { at: Date.now(), admin: false });\n    return false;\n  }',
  },
  {
    name: 'any answer counts as yes',
    file: 'api/_lib/aldus.ts',
    from: "    if (typeof admin !== 'boolean') return false;\n",
    to: '',
  },
  {
    name: 'the viewer request loses its 3 s limit',
    file: 'api/_lib/aldus.ts',
    from: '      signal: AbortSignal.timeout(3000),\n',
    to: '',
  },
  {
    name: 'limitlessFrom takes any string',
    file: 'src/lib/offer-looks.ts',
    from: "typeof value === 'string' && /^https?:\\/\\/[^/?#\\s@\\\\]+$/.test(value)",
    to: "typeof value === 'string' && value.length > 0",
  },
];

async function bundle(out, mutant) {
  const applied = { count: 0 };
  const plugins = mutant
    ? [
        {
          name: 'mutant',
          setup(b) {
            const target = path.resolve(mutant.file);
            b.onLoad({ filter: /\.(ts|tsx)$/ }, (args) => {
              if (args.path !== target) return undefined;
              const source = readFileSync(args.path, 'utf-8');
              const found = source.split(mutant.from).length - 1;
              if (mutant.all ? found < 1 : found !== 1) throw new Error(`mutant "${mutant.name}": its anchor is in ${mutant.file} ${found} time(s)`);
              applied.count = found;
              return { contents: source.split(mutant.from).join(mutant.to), loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
            });
          },
        },
      ]
    : [];
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: out,
    logLevel: 'error',
    plugins,
  });
  return applied.count;
}

const dir = mkdtempSync(path.join(tmpdir(), 'limitless-links-'));
let failed = 0;
try {
  const real = path.join(dir, 'check.cjs');
  await bundle(real);
  const run = spawnSync(process.execPath, [real], { stdio: 'inherit', timeout: 120_000 });
  if (run.status !== 0) failed++;

  console.log('\nControls: each mutant must fail the check');
  for (const [i, mutant] of MUTANTS.entries()) {
    const out = path.join(dir, `mutant-${i}.cjs`);
    let applied = 0;
    try {
      applied = await bundle(out, mutant);
    } catch (err) {
      failed++;
      console.log(`FAIL  control: ${mutant.name} — ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const result = spawnSync(process.execPath, [out], { encoding: 'utf-8', timeout: 120_000 });
    const fails = (result.stdout ?? '').split('\n').filter((line) => line.startsWith('FAIL'));
    const caught = applied > 0 && result.status === 1 && fails.length > 0;
    if (!caught) failed++;
    console.log(
      `${caught ? 'ok  ' : 'FAIL'}  control: ${mutant.name} — ${caught ? `caught by ${fails.length}: ${fails[0].replace(/^FAIL\s+/, '').slice(0, 110)}` : `not caught (exit ${result.status}, applied ${applied})${result.stderr ? ` ${result.stderr.slice(0, 300)}` : ''}`}`,
    );
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} failed` : '\ncheck and controls passed');
process.exit(failed ? 1 : 0);
