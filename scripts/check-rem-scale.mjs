#!/usr/bin/env node
/**
 * Guard against the rem-scale mismatch: a bare arbitrary rem value in a Tailwind class name,
 * written inside src/cms/components/ or src/vendor/.
 *
 * WHY THIS EXISTS. `tailwind.base-font-size.cjs` sets `html { font-size: 10px }` and
 * rescales every NAMED step of the default Tailwind scale (spacing, height, width, fontSize,
 * ...) by 16/10, so a themed utility (`p-3`, `min-h-10`, `w-12`) renders the same pixels a
 * 16px-root author intended. It cannot touch a raw arbitrary value written inside a
 * component — Tailwind treats `[3rem_1fr]` as opaque CSS and emits it byte-for-byte — so
 * that literal `3rem` renders at this app's 10px-root 30px instead of the 48px a 16px-root
 * author means. Measured on abm-stakeholder-element's header band: 218px intended, 143px
 * rendered, with the name and role text clipped inside it. See tailwind.config.js's
 * rem-scale-mismatch comment for the full story and the fix (`theme(spacing.N)`, or a plain
 * non-arbitrary scale utility where one exists).
 *
 * This check is what keeps that fix from being a one-time hand-edit: it fails the moment
 * anyone — a person, or the next `sync-opticom.mjs` pull from upstream — writes a new bare
 * arbitrary rem literal in either directory, before it ships as a silently 0.625x-scaled
 * card.
 *
 * WHAT COUNTS AS A VIOLATION
 *   - Any arbitrary Tailwind value — `utility-[...]`, including a variant chain like
 *     `sm:grid-cols-[...]` or `group-last:bottom-[...]` — whose bracket contains a bare
 *     `<number>rem` token. Always a violation: there is no rem-unit arbitrary value in this
 *     app's component code that should render at a literal 16px-root pixel size, because the
 *     whole app (themed utilities and now these arbitrary ones alike) is authored against
 *     the rescaled root. Fix: `theme(spacing.N)` for the equivalent default-Tailwind step
 *     (see tailwind.config.js for the exact steps this app has used and, where the default
 *     scale had a gap, added), or a plain non-arbitrary utility (`min-w-48`) where one exists.
 *   - Any arbitrary Tailwind value whose bracket contains a bare `<number>em` token, UNLESS
 *     the utility is `tracking-`, `leading-` or `indent-` (letter-spacing, line-height,
 *     text-indent). Those three are deliberately EXEMPT: `em` there is relative to the
 *     element's own font-size, which the rescaled fontSize scale already renders correctly,
 *     so a further root-level rescale would be wrong, not missing. An `em` arbitrary value on
 *     any OTHER utility (a width, a height, a gap, ...) is not exempt — it is a real length
 *     and needs the same fix as a `rem` one.
 *
 * A bracket with no digit-adjacent rem/em — `[counter-increment:abm-friction]`,
 * `[state=open]`, `[16/10]` — is not a length and is never flagged.
 *
 * Usage:  npm run check:rem-scale
 * Not part of `npm run build` — see check:graph and check:render for the same convention.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['src/cms/components', 'src/vendor'];
const EXTS = new Set(['.ts', '.tsx']);
const EM_EXEMPT_UTILITIES = new Set(['tracking', 'leading', 'indent']);

/** Every `<utility-chain>-[<bracket contents>]` token in a file, with its 1-based line. */
const TOKEN_RE = /([a-zA-Z][\w:-]*)-\[((?:[^[\]]|\[[^\]]*\])*)\]/g;
// Arbitrary-value brackets use `_` for a literal space (`grid-rows-[3rem_1fr]`), and `_` is a
// \w character, so a plain `\b` after the unit does not end at "3rem_": it needs its own
// negative lookahead that treats a following letter or digit (but not `_`) as "this wasn't a
// bare unit after all" (e.g. `3remainder` should not match, `3rem_1fr` should).
const REM_RE = /\d(?:\.\d+)?rem(?![a-zA-Z0-9])/;
const EM_RE = /\d(?:\.\d+)?em(?![a-zA-Z0-9])/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__stories') continue;
      walk(p, out);
    } else if (EXTS.has(extname(entry))) {
      out.push(p);
    }
  }
  return out;
}

/** Strips the variant chain (`sm:`, `group-last:`, ...) to the bare utility name. */
function bareUtility(chain) {
  const parts = chain.split(':');
  return parts[parts.length - 1];
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

let violations = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(TOKEN_RE)) {
      const [full, chain, bracket] = m;
      const utility = bareUtility(chain);

      if (REM_RE.test(bracket)) {
        violations.push({ file, line: lineNumberAt(text, m.index), token: full, reason: 'arbitrary rem value' });
        continue;
      }

      if (EM_RE.test(bracket) && !EM_EXEMPT_UTILITIES.has(utility)) {
        violations.push({
          file,
          line: lineNumberAt(text, m.index),
          token: full,
          reason: `arbitrary em value on non-exempt utility "${utility}" (exempt: ${[...EM_EXEMPT_UTILITIES].join(', ')})`,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`check:rem-scale — ${violations.length} arbitrary rem/em value(s) found:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.token}`);
    console.error(`    ${v.reason}`);
  }
  console.error(
    '\nReplace each with `theme(spacing.N)` (the default-Tailwind step the literal would be ' +
      'at a 16px root — see tailwind.config.js\'s rem-scale-mismatch comment) or a plain ' +
      'non-arbitrary scale utility. Do not hand-multiply the number by 1.6.',
  );
  process.exit(1);
}

console.log(`check:rem-scale — clean (${ROOTS.join(', ')})`);
