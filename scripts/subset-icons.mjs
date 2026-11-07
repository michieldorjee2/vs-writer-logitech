#!/usr/bin/env node
/**
 * The Material Symbols Rounded icon font, cut down to the icons this site draws.
 *
 * The whole variable font (node_modules/material-symbols/material-symbols-rounded.woff2) is
 * 5,415,984 bytes: every one of its ~3,900 icons in every weight, fill, grade and optical size.
 * Every page that draws a single icon downloaded all of it: measured 6 Nov 2026, it was 85% of
 * an account page's 6.3 MB. The site draws about a hundred of them.
 *
 *   node scripts/subset-icons.mjs           # rescan src, fetch the subset from Google Fonts, write both files
 *   node scripts/subset-icons.mjs --check   # offline: every icon name src can draw is in the subset (npm run check)
 *
 * What it writes, beside src/styles/material-symbols/rounded.css (which `material-symbols/rounded.css`
 * resolves to; see vite.config.ts):
 *   src/styles/material-symbols/icons.json           the names in the subset, sorted
 *   src/styles/material-symbols/rounded-subset.woff2  the font: those icons, all four axes kept
 *   src/styles/material-symbols/extra-names.json      icon names Google has that the package's list lacks
 *
 * Which names: every string in src (tests aside) that is a Material Symbols name, in a file that
 * draws icons at all (MaterialIcon, material-symbols, an `icon` field). Generous on purpose: a
 * word that is also an icon name ('title', 'height') costs a kilobyte or so; a missing icon
 * draws its name as text. Plus the three www.css draws by codepoint (CODEPOINT_ICONS). A name
 * that only comes from the CMS (IconElement's `Icon` field) cannot be known here: for those,
 * src/lib/icon-font.ts loads the whole font when a page draws a name outside this list.
 *
 * The subset is Google Fonts' own (`icon_names=`), the same family the npm package packs, with
 * every axis range kept so `font-variation-settings` (FILL, wght, GRAD, opsz) behaves as before.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/styles/material-symbols');
const LIST = path.join(OUT_DIR, 'icons.json');
const FONT = path.join(OUT_DIR, 'rounded-subset.woff2');
const CHECK = process.argv.includes('--check');

/** www.css draws these by codepoint (`[data-table-icon]::before { content: '\e5ca' }`), not by name. */
const CODEPOINT_ICONS = ['check', 'close', 'emergency_home'];

/*
 * Every name the font knows. The package's own list (index.d.ts) is not all of them — 'insights',
 * drawn on every agent platform page, is missing from it — so a run also reads Google's list for
 * the variable font and keeps the names the package lacks in extra-names.json, for `--check`,
 * which reads no network.
 */
const EXTRA = path.join(OUT_DIR, 'extra-names.json');
const CODEPOINTS =
  'https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints';
const packaged = new Set(
  readFileSync(path.join(ROOT, 'node_modules/material-symbols/index.d.ts'), 'utf8')
    .match(/"[a-z0-9_]+"/g)
    .map((s) => s.slice(1, -1)),
);
let extra;
if (CHECK) {
  extra = existsSync(EXTRA) ? JSON.parse(readFileSync(EXTRA, 'utf8')) : [];
} else {
  const res = await fetch(CODEPOINTS);
  if (!res.ok) throw new Error(`Google's codepoints list answered ${res.status}`);
  const google = (await res.text()).split('\n').map((l) => l.trim().split(/\s+/)[0]).filter((n) => /^[a-z0-9_]+$/.test(n ?? ''));
  if (google.length < 3000) throw new Error(`Google's codepoints list has only ${google.length} names`);
  extra = [...new Set(google.filter((n) => !packaged.has(n)))].sort();
}
const known = new Set([...packaged, ...extra]);

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** A file that draws icons at all. */
const DRAWS_ICONS = /MaterialIcon|material-symbols|\bicon\b|Icon\b/i;
/** Quoted strings and JSX text: `'bolt'`, `"bolt"`, `` `bolt` ``, `>bolt<`. */
const LITERAL = /'([a-z0-9_]+)'|"([a-z0-9_]+)"|`([a-z0-9_]+)`|>\s*([a-z0-9_]+)\s*</g;

function namesInSource() {
  const names = new Set(CODEPOINT_ICONS);
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    const text = readFileSync(file, 'utf8');
    if (!DRAWS_ICONS.test(text)) continue;
    for (const m of text.matchAll(LITERAL)) {
      const word = m[1] || m[2] || m[3] || m[4];
      if (known.has(word)) names.add(word);
    }
  }
  return [...names].sort();
}

const names = namesInSource();

if (CHECK) {
  const listed = new Set(existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : []);
  const missing = names.filter((n) => !listed.has(n));
  if (!existsSync(FONT)) missing.unshift('(the font file itself)');
  if (missing.length) {
    console.error(`✗ icon subset: src draws ${missing.length} icon(s) the subset font lacks: ${missing.join(', ')}`);
    console.error('  Run `node scripts/subset-icons.mjs` and commit src/styles/material-symbols/.');
    process.exit(1);
  }
  console.log(`✓ icon subset: all ${names.length} icon names src can draw are in rounded-subset.woff2`);
  process.exit(0);
}

// A current Chrome's user agent: Google Fonts answers older or unknown ones with TTF, not WOFF2.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const css = await (
  await fetch(
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200' +
      `&icon_names=${names.join(',')}&display=block`,
    { headers: { 'User-Agent': UA } },
  )
).text();
const fontUrl = /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('woff2'\)/.exec(css)?.[1];
if (!fontUrl) throw new Error(`Google Fonts sent no woff2 for the subset:\n${css.slice(0, 500)}`);
const font = Buffer.from(await (await fetch(fontUrl, { headers: { 'User-Agent': UA } })).arrayBuffer());
if (font.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('Google Fonts sent something that is not a woff2');

writeFileSync(FONT, font);
writeFileSync(LIST, `${JSON.stringify(names, null, 2)}\n`);
writeFileSync(EXTRA, `${JSON.stringify(extra)}\n`);
const full = statSync(path.join(ROOT, 'node_modules/material-symbols/material-symbols-rounded.woff2')).size;
console.log(
  `✓ ${names.length} icons, ${font.length.toLocaleString()} bytes (the whole font: ${full.toLocaleString()}),` +
    ` sha256 ${createHash('sha256').update(font).digest('hex').slice(0, 12)}`,
);
