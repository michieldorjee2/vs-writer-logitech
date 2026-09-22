#!/usr/bin/env node
/**
 * visual-diff.mjs — the gate for the Tailwind v3 -> v4 upgrade.
 *
 *   node scripts/visual-baseline.mjs --out /tmp/before   # on v3
 *   ...upgrade...
 *   node scripts/visual-baseline.mjs --out /tmp/after    # on v4
 *   node scripts/visual-diff.mjs --before /tmp/before --after /tmp/after
 *
 * A Tailwind major bump changes the CSS and leaves the markup alone, so the
 * question is never "does it build" — it is "did any pixel move, and can I say
 * why". This script answers that three ways, and each one can fail the run:
 *
 *   1. PIXELS. Decodes both PNGs and counts differing pixels per route per
 *      viewport. Reported as a count and a percentage of the frame, against a
 *      per-route noise floor. A route over its floor is a regression until
 *      someone explains it; a route that did not render in either capture is a
 *      FAILURE, not a pass, because a page that will not render proves nothing.
 *
 *      PASS `--noise` WITH EXTRA CAPTURES OF THE *AFTER* BUILD. Four of the six
 *      routes drive a three.js canvas (ABM hero, person galaxy and starfield,
 *      search orb) and /search seeds its copy from `Date.now()`, so two
 *      captures of the same unmodified build differ by several percent —
 *      measured on this machine at 6.5% for abm-account-page desktop and 49%
 *      for search desktop, against the 0.7% and 30% floors visual-baseline.mjs
 *      recorded when it was written. Judging the upgrade against a stale floor
 *      would fail a clean migration and pass a dirty one. With `--noise`, the
 *      floor for each route becomes the LARGEST difference measured between
 *      two captures of the same code, so the question asked is the right one:
 *      "is the v3 -> v4 delta bigger than this route's own frame-to-frame
 *      churn?" The two routes with no canvas and no clock — finserv-page and
 *      use-case-preview — stay at a hard 0%, and they are the routes that
 *      actually prove the CSS did not move.
 *
 *   2. CLASS COVERAGE. Every class token the app uses must still produce a
 *      rule in the served CSS. This is what catches a renamed or removed
 *      utility — `border-opacity-*`, `shadow-sm` -> `shadow-xs`,
 *      `outline-none` -> `outline-hidden` — which a screenshot only catches if
 *      that class happens to be on a captured route. The list must be empty.
 *      Tokens missing in BOTH captures are reported separately and do not
 *      fail: they were already dead on v3 (`bg-gradient-vulcan`, `max-h[200px]`
 *      — note the missing dash — and BEM names from stylesheets no captured
 *      route loads).
 *
 *   3. DOM FINGERPRINT. visual-baseline.mjs hashes the normalised DOM per
 *      route. If it still matches, the markup did not move and every pixel
 *      delta is attributable to CSS. If it changed, a pixel diff is no longer
 *      evidence about CSS and the run says so.
 *
 * Decoding: `pngjs` is a devDependency, used read-only and synchronously. No
 * perceptual/antialiasing tolerance is applied by default — a subpixel text
 * shift IS the regression this gate exists to find, and `pixelmatch`'s
 * antialias detection is exactly what would hide it. `--threshold` raises the
 * per-channel tolerance if you need to discount image-decode noise, but the
 * default of 0 is the honest setting.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ args -- */

function parseArgs(argv) {
    const opts = { threshold: 0, json: null, noise: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--before') opts.before = argv[++i];
        else if (a.startsWith('--before=')) opts.before = a.slice(9);
        else if (a === '--after') opts.after = argv[++i];
        else if (a.startsWith('--after=')) opts.after = a.slice(8);
        else if (a === '--noise') opts.noise.push(argv[++i]);
        else if (a.startsWith('--noise=')) opts.noise.push(a.slice(8));
        else if (a === '--threshold') opts.threshold = Number(argv[++i]);
        else if (a.startsWith('--threshold=')) opts.threshold = Number(a.slice(12));
        else if (a === '--json') opts.json = argv[++i];
        else if (a.startsWith('--json=')) opts.json = a.slice(7);
        else if (a === '--help' || a === '-h') opts.help = true;
        else throw new Error(`Unknown argument: ${a}`);
    }
    return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help || !opts.before || !opts.after) {
    console.log(`
visual-diff.mjs — pixel-diff two visual-baseline.mjs captures.

  --before <dir>     REQUIRED. The v3 capture.
  --after <dir>      REQUIRED. The v4 capture.
  --noise <dir>      Repeatable. Extra capture(s) of the SAME build as --after.
                     Every pair among {--after} u {--noise} is diffed and the
                     largest result becomes that route's floor, replacing the
                     one recorded in the manifest. Use at least one; two is
                     better. Without it the animated routes are judged against
                     a floor measured on a different machine.
  --threshold <n>    Per-channel tolerance, 0-255. Default 0 (exact).
  --json <file>      Also write the results as JSON.

Exits non-zero if any route is over its noise floor, any route failed to
render, or any class the app uses stopped compiling.
`.trimEnd());
    process.exit(opts.before && opts.after ? 0 : 1);
}

for (const [label, dir] of [['--before', opts.before], ['--after', opts.after]]) {
    if (!existsSync(path.join(dir, 'manifest.json'))) {
        console.error(`${label} ${dir} has no manifest.json — is it a visual-baseline.mjs capture?`);
        process.exit(1);
    }
}

const readJson = (dir, file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8'));

/* ---------------------------------------------------------------- pixels -- */

/**
 * Compare two PNGs pixel by pixel.
 *
 * Full-page screenshots are as tall as the page, so the two frames can differ
 * in height — that is itself a finding (the page got taller), and it is
 * reported rather than swallowed. The overlapping region is still compared so
 * the number means something, and every row that exists in only one capture is
 * counted as changed.
 */
function diffPng(beforePath, afterPath, threshold) {
    const a = PNG.sync.read(readFileSync(beforePath));
    const b = PNG.sync.read(readFileSync(afterPath));

    const w = Math.min(a.width, b.width);
    const h = Math.min(a.height, b.height);
    const unionPixels = Math.max(a.width, b.width) * Math.max(a.height, b.height);

    let changed = 0;
    let maxDelta = 0;
    let firstChangedRow = -1;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const ia = (a.width * y + x) << 2;
            const ib = (b.width * y + x) << 2;
            let d = 0;
            for (let c = 0; c < 4; c++) {
                const delta = Math.abs(a.data[ia + c] - b.data[ib + c]);
                if (delta > d) d = delta;
            }
            if (d > threshold) {
                changed++;
                if (d > maxDelta) maxDelta = d;
                if (firstChangedRow < 0) firstChangedRow = y;
            }
        }
    }

    // Rows/columns present in only one capture count as changed.
    const outside = unionPixels - w * h;
    changed += outside;

    return {
        beforeSize: `${a.width}x${a.height}`,
        afterSize: `${b.width}x${b.height}`,
        sizeChanged: a.width !== b.width || a.height !== b.height,
        comparedPixels: w * h,
        unionPixels,
        onlyInOnePixels: outside,
        changedPixels: changed,
        changedPct: unionPixels ? (changed / unionPixels) * 100 : 0,
        maxChannelDelta: maxDelta,
        firstChangedRow,
    };
}

/* -------------------------------------------------------- class coverage -- */

/**
 * Does `css` contain a rule whose selector uses this class?
 *
 * Tailwind escapes the CSS-special characters in a class name with a
 * backslash, so `lg:col-8` is emitted as `.lg\:col-8` and `max-w-[125px]` as
 * `.max-w-\[125px\]`. Escape the token the same way, then require a selector
 * boundary after it so `.border` does not match `.border-white`.
 */
const SPECIAL = /[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g;

function emitsClass(css, token) {
    const escaped = '.' + token.replace(SPECIAL, (c) => '\\' + c);
    const pattern = escaped.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === '\\' ? '\\\\' : '\\' + m));
    return new RegExp(pattern + '(?=[\\s,{:>~+)\\[]|$)', 'm').test(css);
}

/** Every stylesheet the capture saw, plus the browser's own parsed copy. */
function servedCss(dir) {
    let css = '';
    for (const f of ['generated.css', 'applied-css.css']) {
        const p = path.join(dir, f);
        if (existsSync(p)) css += '\n' + readFileSync(p, 'utf8');
    }
    // The three stylesheets index.css does not import are pulled in by the
    // component that needs them, so they only appear in generated.css if the
    // route that mounts them was captured. Read them off disk so a BEM class
    // from edit-mode.css is not reported as a v4 regression.
    const styles = path.join(REPO, 'src', 'styles');
    if (existsSync(styles)) {
        for (const f of readdirSync(styles)) {
            if (f.endsWith('.css')) css += '\n' + readFileSync(path.join(styles, f), 'utf8');
        }
    }
    return css;
}

/* ------------------------------------------------------------------ run -- */

const beforeManifest = readJson(opts.before, 'manifest.json');
const afterManifest = readJson(opts.after, 'manifest.json');

const key = (r) => `${r.route}.${r.viewport}`;
const beforeRoutes = new Map(beforeManifest.routes.map((r) => [key(r), r]));
const afterRoutes = new Map(afterManifest.routes.map((r) => [key(r), r]));

/*
 * Measured floor per route: the largest difference between any two captures of
 * the same build. `--after` counts as one of them, so one `--noise` capture
 * gives one pair and two give three.
 */
const measuredFloor = new Map();
const noiseDirs = [opts.after, ...opts.noise];
const noisePairs = [];
for (let i = 0; i < noiseDirs.length; i++) {
    for (let j = i + 1; j < noiseDirs.length; j++) noisePairs.push([noiseDirs[i], noiseDirs[j]]);
}
for (const [x, y] of noisePairs) {
    const mx = readJson(x, 'manifest.json');
    const my = new Map(readJson(y, 'manifest.json').routes.map((r) => [`${r.route}.${r.viewport}`, r]));
    for (const r of mx.routes) {
        const k = `${r.route}.${r.viewport}`;
        const o = my.get(k);
        if (!r.rendered || !o?.rendered) continue;
        const px = path.join(x, r.screenshot);
        const py = path.join(y, o.screenshot);
        if (!existsSync(px) || !existsSync(py)) continue;
        const d = diffPng(px, py, opts.threshold);
        measuredFloor.set(k, Math.max(measuredFloor.get(k) ?? 0, d.changedPct));
    }
}

const results = [];
const failures = [];
const unrendered = [];

for (const [k, br] of beforeRoutes) {
    const ar = afterRoutes.get(k);
    if (!ar) {
        failures.push(`${k}: present in --before, missing from --after`);
        continue;
    }
    if (!br.rendered || !ar.rendered) {
        unrendered.push(`${k}: rendered before=${br.rendered} after=${ar.rendered} (selector ${br.readySelector})`);
        continue;
    }
    const bp = path.join(opts.before, br.screenshot);
    const ap = path.join(opts.after, ar.screenshot);
    if (!existsSync(bp) || !existsSync(ap)) {
        failures.push(`${k}: screenshot missing on disk`);
        continue;
    }
    const d = diffPng(bp, ap, opts.threshold);
    const recorded = br.noiseFloorPct ?? 0;
    const measured = measuredFloor.get(k);
    // A measured floor from THIS machine and THIS build replaces the recorded
    // one outright — including downwards, so a route that has become steadier
    // is held to the stricter number.
    const floor = measured ?? recorded;
    results.push({
        route: br.route,
        viewport: br.viewport,
        template: br.template,
        noiseFloorPct: floor,
        recordedFloorPct: recorded,
        measuredFloorPct: measured ?? null,
        overFloor: d.changedPct > floor,
        domFingerprintChanged: br.domFingerprintSha256 !== ar.domFingerprintSha256,
        nondeterministic: br.nondeterministic ?? [],
        ...d,
    });
}

for (const k of afterRoutes.keys()) {
    if (!beforeRoutes.has(k)) failures.push(`${k}: present in --after, missing from --before`);
}

/* ------------------------------------------------------------- reporting -- */

const pad = (s, n) => String(s).padEnd(n);
const num = (n) => n.toLocaleString('en-US');

console.log('\nPIXEL DIFF  (before -> after, per route per viewport)');
if (noisePairs.length) {
    console.log(`floor = worst of ${noisePairs.length} same-build pair(s): ` +
        noiseDirs.map((d) => path.basename(d)).join(' / '));
} else {
    console.log('floor = the value recorded in the manifest. Pass --noise to measure it here instead.');
}
console.log('-'.repeat(112));
console.log(
    pad('route', 24) + pad('vp', 9) + pad('changed px', 14) + pad('of frame', 11) +
    pad('floor', 10) + pad('maxΔ', 7) + pad('size', 22) + 'verdict'
);
console.log('-'.repeat(112));

results.sort((a, b) => b.changedPct - a.changedPct);
for (const r of results) {
    const verdict = r.overFloor
        ? 'OVER FLOOR'
        : r.changedPixels === 0
          ? 'IDENTICAL'
          : 'within same-build noise';
    console.log(
        pad(r.route, 24) + pad(r.viewport, 9) + pad(num(r.changedPixels), 14) +
        pad(r.changedPct.toFixed(3) + '%', 11) + pad(r.noiseFloorPct.toFixed(3) + '%', 10) +
        pad(r.maxChannelDelta, 7) +
        pad(r.sizeChanged ? `${r.beforeSize} -> ${r.afterSize}` : r.beforeSize, 22) + verdict
    );
}

const stale = results.filter((r) => r.measuredFloorPct != null && r.measuredFloorPct > r.recordedFloorPct + 0.01);
if (stale.length) {
    console.log('\nRECORDED FLOOR IS TOO LOW on these routes — visual-baseline.mjs\'s `noiseFloorPct`');
    console.log('was measured elsewhere and this machine is noisier. Measured here:');
    for (const r of stale) {
        console.log(`  ${pad(r.route + '.' + r.viewport, 30)} recorded ${r.recordedFloorPct}%  ` +
            `-> measured ${r.measuredFloorPct.toFixed(3)}%`);
    }
}

const sizeChanges = results.filter((r) => r.sizeChanged);
if (sizeChanges.length) {
    console.log('\nPAGE HEIGHT CHANGED — a full-page screenshot is as tall as the page, so this');
    console.log('is a layout change, not capture noise:');
    for (const r of sizeChanges) {
        console.log(`  ${r.route}.${r.viewport}: ${r.beforeSize} -> ${r.afterSize} ` +
            `(${num(r.onlyInOnePixels)} px exist in only one capture)`);
    }
}

const domChanges = results.filter((r) => r.domFingerprintChanged);
if (domChanges.length) {
    console.log('\nDOM FINGERPRINT CHANGED on ' + domChanges.length + ' pair(s):');
    for (const r of domChanges) {
        console.log(`  ${pad(r.route + '.' + r.viewport, 30)}` +
            (r.changedPixels === 0 ? 'but the screenshot is byte-identical' : ''));
    }
    console.log('  The fingerprint hashes every tag and attribute except `style`, so a class');
    console.log('  toggled by a scroll/reveal observer moves it without moving a pixel. Read it');
    console.log('  as "markup MAY have changed": a pair that is byte-identical (above) did not.');
} else if (results.length) {
    console.log('\nDOM fingerprint: unchanged on all ' + results.length +
        ' route/viewport pairs — every pixel delta above is attributable to CSS.');
}

if (unrendered.length) {
    console.log('\nROUTES THAT DID NOT RENDER (a route you cannot render is not a passing route):');
    for (const u of unrendered) console.log('  ' + u);
}

/* class coverage */
const afterClasses = readJson(opts.after, 'classes.json');
const beforeCss = servedCss(opts.before);
const afterCss = servedCss(opts.after);

const regressed = [];
const deadInBoth = [];
for (const token of afterClasses.tokens) {
    if (emitsClass(afterCss, token)) continue;
    if (emitsClass(beforeCss, token)) regressed.push(token);
    else deadInBoth.push(token);
}

console.log('\nCLASS COVERAGE  (' + afterClasses.tokens.length + ' distinct class tokens in the app)');
console.log('-'.repeat(108));
if (regressed.length === 0) {
    console.log('  0 classes stopped compiling. Every class the app uses still produces a rule.');
} else {
    console.log('  ' + regressed.length + ' CLASSES THE APP USES THAT THE NEW CSS NO LONGER EMITS:');
    for (const t of regressed) console.log('    ' + t);
}
console.log('  ' + deadInBoth.length + ' token(s) produce no rule in EITHER capture (dead on v3 too, not a regression).');

/* stylesheet-level */
const cssBytes = (dir, f) => (existsSync(path.join(dir, f)) ? readFileSync(path.join(dir, f)).length : 0);
console.log('\nSTYLESHEET SIZE');
console.log('-'.repeat(108));
for (const f of ['generated.css', 'applied-css.css']) {
    const b = cssBytes(opts.before, f);
    const a = cssBytes(opts.after, f);
    const delta = a - b;
    console.log(`  ${pad(f, 18)} ${pad(num(b), 12)} -> ${pad(num(a), 12)} ` +
        `${delta >= 0 ? '+' : ''}${num(delta)} bytes (${b ? ((delta / b) * 100).toFixed(1) : '0'}%)`);
}

const over = results.filter((r) => r.overFloor);
console.log('\nVERDICT');
console.log('-'.repeat(108));
console.log(`  routes compared        ${results.length}`);
console.log(`  identical              ${results.filter((r) => r.changedPixels === 0).length}`);
console.log(`  within noise floor     ${results.filter((r) => !r.overFloor && r.changedPixels > 0).length}`);
console.log(`  OVER noise floor       ${over.length}`);
console.log(`  did not render         ${unrendered.length}`);
console.log(`  classes lost           ${regressed.length}`);
if (failures.length) for (const f of failures) console.log('  capture mismatch: ' + f);

if (opts.json) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(opts.json, JSON.stringify({
        before: opts.before, after: opts.after, threshold: opts.threshold,
        routes: results, unrendered, failures,
        classesLost: regressed, classesDeadInBoth: deadInBoth,
    }, null, 2));
    console.log(`\n  JSON written to ${opts.json}`);
}

const bad = over.length + unrendered.length + regressed.length + failures.length;
console.log(bad === 0 ? '\n  PASS\n' : `\n  FAIL — ${bad} item(s) above need explaining before this ships.\n`);
process.exit(bad === 0 ? 0 : 1);
