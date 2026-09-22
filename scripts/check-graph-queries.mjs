#!/usr/bin/env node
/**
 * Validate every GraphQL query this site ships against the live Optimizely Graph
 * schema.
 *
 * Why this exists: GraphQL fails the *entire* query on one unknown field. When
 * the showcase CMS content model went flat (a4a6fe7) the queries kept selecting
 * six fields from the old nested-block model — CanonicalUrl, FeatureSection,
 * FaqSection, OurHighlight, CompetitorHighlight, Weeks. They returned null for
 * months because Graph still advertised the legacy names; the day its schema
 * refreshed, every one of the 2,676 account pages started serving the SPA shell
 * and a client-side NotFound. Nothing logged, nothing failed to build.
 *
 * This sends each query to Graph with a throwaway slug and reports any field
 * that no longer resolves. It is deliberately NOT part of `npm run build` — a
 * deploy should not depend on a network round trip — so run it after touching a
 * query, and when a page 404s that should not.
 *
 * Usage:  npm run check:graph            (needs GRAPH_AUTH_KEY, or .env.local)
 *
 * Not scanned: src/lib/graph-query.ts and api/_lib/fetch-content.ts. Both still
 * hold the pre-flat nested-block queries and nothing imports either of them.
 * They would fail this check for the same reason; delete them rather than fix
 * them.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const ENDPOINT = 'https://cg.optimizely.com/content/v2';
const FILES = [
  'api/content.ts',
  'api/preview.ts',
  'server/ssr-handler.tsx',
  // The Visual Builder experience queries. They live in one module because api/content.ts
  // and vite.config.ts both serve them, so scanning the module covers both callers.
  'src/lib/experience-queries.ts',
  // The dev server's own copies of PAGE_QUERY and PREVIEW_QUERY. Missing from this list is
  // exactly how they were free to drift from api/content.ts's fixed versions and still ship:
  // `check:graph` was green while `npm run dev` 400'd on every page. See the comment at the
  // top of vite.config.ts.
  'vite.config.ts',
];

function authKey() {
  if (process.env.GRAPH_AUTH_KEY) return process.env.GRAPH_AUTH_KEY;
  if (existsSync('.env.local')) {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = /^GRAPH_AUTH_KEY=(.*)$/.exec(line.trim());
      if (m) return m[1].trim().replace(/^"|"$/g, '');
    }
  }
  console.error('GRAPH_AUTH_KEY is not set and .env.local does not carry it.');
  process.exit(2);
}

// Every `const NAME = ` … ` ` template literal in a file, exported or not.
const TEMPLATE_CONSTS = /(?:export\s+)?const (\w+)\s*=\s*`([\s\S]*?)`;?\n/g;

/**
 * Resolve `${OTHER_CONST}` references against the other template literals in the same file.
 *
 * A composition query is ~120 lines of which 30 are a fragment shared with a second query,
 * so the experience queries are assembled from three consts. Sending the unresolved text
 * would be sending nothing; skipping it, as this script used to, would mean the two queries
 * that actually carry the Visual Builder pages are the two the check does not cover.
 *
 * Only plain `${IDENT}` is substituted — an expression is still a runtime-assembled query
 * and still skipped, which keeps the retail probe-then-extend builder out of scope. The loop
 * is bounded so a const that references itself cannot hang the check.
 */
function resolveInterpolations(text, consts) {
  let out = text;
  for (let depth = 0; depth < 8 && out.includes('${'); depth++) {
    const next = out.replace(/\$\{\s*(\w+)\s*\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(consts, name) ? consts[name] : match,
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

// Every `const NAME_QUERY = ` … ` ` template literal, with sibling consts substituted in.
// Queries still holding a `${…}` after that are assembled at runtime and skipped by design:
// they only ever include fields introspected from the live schema.
function queries(file) {
  const src = readFileSync(file, 'utf8');
  const consts = Object.fromEntries(
    [...src.matchAll(TEMPLATE_CONSTS)].map(([, name, body]) => [name, body]),
  );
  return Object.entries(consts)
    .filter(([name]) => name.endsWith('QUERY'))
    .map(([name, body]) => ({ name, query: resolveInterpolations(body, consts) }))
    .filter(({ query }) => !query.includes('${'));
}

/**
 * Every Visual Builder component type must appear in the composition fragment.
 *
 * A type the fragment does not name is not a query error and not a Graph error. The node
 * comes back as `{"__typename": "_Component"}` with none of its fields, the factory finds no
 * renderer for `_Component`, and that element renders as NOTHING — on a page whose other
 * twelve bands are perfect. It cost an hour on the first sample page: `TextContentElement`
 * was the one type of twenty-seven missing from the fragment, and the four body-copy nodes
 * it drew were simply absent. There is no error anywhere to find that by.
 *
 * So the check is structural: the component folders are the source of truth for what can be
 * placed, and every one of their content type keys has to be named in the fragment.
 */
function checkFragmentCoverage() {
  const dir = 'src/cms/components';
  if (!existsSync(dir)) return 0;

  const source = readFileSync('src/lib/experience-queries.ts', 'utf8');
  const missing = [];
  for (const folder of readdirSync(dir)) {
    const file = `${dir}/${folder}/content-type.ts`;
    if (!existsSync(file)) continue;
    const contentTypeKey = /key:\s*'([^']+)'/.exec(readFileSync(file, 'utf8'))?.[1];
    if (!contentTypeKey) continue;
    if (!new RegExp(`\\.\\.\\. on ${contentTypeKey}\\b`).test(source)) missing.push(contentTypeKey);
  }

  if (missing.length === 0) {
    console.log('ok    src/lib/experience-queries.ts → every component type is in the fragment');
    return 0;
  }
  console.error(
    `FAIL  src/lib/experience-queries.ts → ${missing.length} component type(s) missing from ` +
      `CompositionElement: ${missing.join(', ')}`,
  );
  console.error('        Each renders as an EMPTY element node — no error, no fields, no output.');
  return 1;
}

const key = authKey();
let failed = checkFragmentCoverage();

for (const file of FILES) {
  for (const { name, query } of queries(file)) {
    const res = await fetch(`${ENDPOINT}?auth=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Variables every query in this repo takes, supersets are ignored — a query that
      // doesn't declare a given name simply never looks it up. `limit`/`skip` cover
      // vite.config.ts's SEARCH_INDEX_QUERY, the one shipped query pagination-shaped rather
      // than slug/key-shaped.
      body: JSON.stringify({
        query,
        variables: {
          slug: '/__schema_check__/',
          key: '__schema_check__',
          ver: null,
          loc: null,
          limit: 1,
          skip: 0,
        },
      }),
    });
    const json = await res.json();
    if (json?.code === 'AUTHENTICATION_ERROR') {
      console.error('GRAPH_AUTH_KEY was rejected by Graph.');
      process.exit(2);
    }
    if (json?.errors?.length) {
      failed++;
      console.error(`FAIL  ${file} → ${name}`);
      for (const e of json.errors) console.error(`        ${e.message}`);
    } else {
      console.log(`ok    ${file} → ${name}`);
    }
  }
}

if (failed) {
  console.error(
    `\n${failed} of the shipped queries no longer match the Graph schema. ` +
      'Every page served by one of them will 404 until the selection is fixed.',
  );
  process.exit(1);
}
console.log('\nAll shipped queries match the live Graph schema.');
