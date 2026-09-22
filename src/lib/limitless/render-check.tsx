/**
 * Does the use-case renderer survive the server, and does the plan actually
 * gate what reaches the HTML?
 *
 * Two things this guards, both of which would be silent failures in production:
 *
 * 1. **SSR safety.** UseCasePage is rendered by `server/ssr-handler.tsx`
 *    DIRECTLY, with no `.server.tsx` twin — it lazy-loads nothing and its only
 *    hook does all its work inside useEffect. That is a standing claim about a
 *    file other people will edit, and if it stops being true every published
 *    use-case page 500s. Nothing else in the build would catch it: `tsc`
 *    type-checks fine and the Vite build never calls renderToString.
 *
 * 2. **The plan gates the output.** The whole design rests on a withheld
 *    component not reaching the page. This asserts it against the HTML string
 *    rather than trusting the JSX, because a stray `&&` would still compile.
 *
 * Same reason `npm run check:graph` exists (commit 9091988): the failure it
 * prevents already happened once, in production, with nothing in the log.
 *
 * Run: `npm run check:render`. Lives under src/ so `tsc -b` type-checks it;
 * nothing in the app imports it, so it never ships.
 */
import { renderToString } from 'react-dom/server';

import UseCasePage from '../../components/UseCasePage';
import { derivePlan, includes, type ComponentPlan } from './component-plan';
import { SIEMENS_USE_CASE_PAGE, SIEMENS_USE_CASE_PLAN } from './siemens-fixture';

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

// The Vercel node runtime has no `window`. If the renderer ever touches one at
// module scope or during render, this is where it shows up.
check('no window global', typeof (globalThis as { window?: unknown }).window === 'undefined');

const html = renderToString(<UseCasePage page={SIEMENS_USE_CASE_PAGE} plan={SIEMENS_USE_CASE_PLAN} />);
check('renders the fixture without throwing', html.length > 0, `${html.length} bytes`);

const PRESENT: Array<[string, string]> = [
  ['hero headline', 'Complex engineering requires'],
  ['extruded phrase', 'uc-extrude'],
  ['emphasis in the subhead', 'uc-em'],
  ['all three lanes', 'Agent Orchestration'],
  ['use-cases anchor', 'id="use-cases"'],
  ['why-now thesis', 'Industrial velocity is dictated'],
  ['quote attributed to the argument, not a person', 'The argument this page makes'],
  ['fourth friction point', 'Partner portals remain disconnected silos'],
  ['account executive', 'mike.martiny@optimizely.com'],
  ['rail nav anchor', 'href="#gaps"'],
];
for (const [label, needle] of PRESENT) check(label, html.includes(needle));

// The sections the plan withheld. These are the assertions that matter: a
// use-case page that leaks a comparison table names a competitor it has no
// evidence for, which is the pilot's failure.
const ABSENT: Array<[string, string]> = [
  ['no comparison section', 'id="comparison"'],
  ['no ROI section', 'id="roi"'],
  ['no migration section', 'id="migration"'],
  ['no decision panel unless asked for', 'uc-plan'],
];
for (const [label, needle] of ABSENT) check(label, !html.includes(needle));

// Every one of the 2,695 legacy pages resolves to a derived plan. It must not
// route here — and if something ever routes it here anyway, it must degrade
// rather than throw.
const derived = derivePlan(SIEMENS_USE_CASE_PAGE);
check('a derived plan does not include the use-case matrix', !includes(derived, 'use-case-matrix'));
const derivedHtml = renderToString(<UseCasePage page={SIEMENS_USE_CASE_PAGE} plan={derived} />);
check('renders a derived plan without throwing', derivedHtml.length > 0, `${derivedHtml.length} bytes`);
check('a derived plan omits the matrix from the HTML', !derivedHtml.includes('id="use-cases"'));

// A public render path must not depend on the content being well-formed.
const emptyPlan: ComponentPlan = { source: 'fixture', entries: [] };
const emptyPage = {
  _metadata: { key: 'x', url: { default: '/', hierarchical: '/' }, published: '' },
} as unknown as typeof SIEMENS_USE_CASE_PAGE;
check('renders an empty page without throwing', renderToString(<UseCasePage page={emptyPage} plan={emptyPlan} />).length > 0);

// Throwing rather than process.exit(): this file lives under src/ so `tsc -b`
// type-checks it, and the app project has browser libs only — `process` is not
// in scope. An uncaught throw exits non-zero just the same.
if (failures > 0) throw new Error(`${failures} render check(s) failed.`);
console.log('\nAll checks passed — SSR-safe, and the plan gates what reaches the HTML.');
