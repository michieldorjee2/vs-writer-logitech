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
import { readFileSync, existsSync } from 'node:fs';

const ENDPOINT = 'https://cg.optimizely.com/content/v2';
const FILES = ['api/content.ts', 'api/preview.ts', 'server/ssr-handler.tsx'];

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

// Every `const NAME_QUERY = ` … ` ` template literal. Queries assembled at
// runtime (the retail probe-then-extend builder) are skipped by design: they
// only ever include fields introspected from the live schema.
function queries(file) {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/const (\w*QUERY) = `([\s\S]*?)`;/g)]
    .map(([, name, query]) => ({ name, query }))
    .filter(({ query }) => !query.includes('${'));
}

const key = authKey();
let failed = 0;

for (const file of FILES) {
  for (const { name, query } of queries(file)) {
    const res = await fetch(`${ENDPOINT}?auth=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Variables every query in this repo takes, supersets are ignored.
      body: JSON.stringify({
        query,
        variables: { slug: '/__schema_check__/', key: '__schema_check__', ver: null, loc: null },
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
