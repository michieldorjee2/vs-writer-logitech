/**
 * How the server render (server/ssr-handler.tsx) finds which page an address is, in one Graph
 * request instead of seven. Checked by scripts/check-perf.ts.
 *
 * An address can be a person, retail, fin-serv or account page, each at `/<slug>/` or
 * `/en/<slug>/`. Asking each type in turn cost an account page (2,676 of the site's pages) seven
 * Graph round trips, six of them before its own: 360-450 ms of an uncached response on 6 Nov 2026. Asking them
 * all at once in parallel was quicker but sent Graph bursts of eight requests per render, and
 * bursts stall: measured from a laptop, 7 of 80 requests in bursts of 8 never answered (0 of 20
 * one at a time). So the render asks ONE question first — which of these has a page? — and then
 * reads that one page: two requests, one after the other, on one connection.
 */

export type PageKind = 'person' | 'retail' | 'finserv' | 'account';
export type Candidate = { kind: PageKind; slug: string };

/** Each kind's Graph content type. */
export const GRAPH_TYPES: Record<PageKind, string> = {
  person: 'PersonPage',
  retail: 'RetailCustomerPage',
  finserv: 'FinServPage',
  account: 'CompetitorComparisonPage',
};

/**
 * The one question: every candidate as an aliased field (`c0`, `c1`, …), each selecting only
 * `_metadata { key }`. Every content type has that field, so unlike a page's full selection this
 * query cannot fail on a field the schema dropped (the failure that once 404'd every account
 * page). A type Graph does not have still fails it: leave out a type that is not registered.
 */
export function whichPageQuery(candidates: Candidate[]): { query: string; variables: Record<string, string> } {
  const slugs = [...new Set(candidates.map((c) => c.slug))];
  const fields = candidates.map(
    (c, i) =>
      `c${i}: ${GRAPH_TYPES[c.kind]}(where: { _metadata: { url: { hierarchical: { eq: $s${slugs.indexOf(c.slug)} } } } }, locale: en) { items { _metadata { key } } }`,
  );
  return {
    query: `query WhichPage(${slugs.map((_, i) => `$s${i}: String!`).join(', ')}) {\n  ${fields.join('\n  ')}\n}`,
    variables: Object.fromEntries(slugs.map((s, i) => [`s${i}`, s])),
  };
}

type WhichAnswer = { data?: Record<string, { items?: unknown[] | null } | null> | null; errors?: unknown[] } | null | undefined;

/**
 * The answer read in the candidates' order: the first that has a page, as the one-by-one reads
 * would have found it; null when none has. Throws when Graph answered with errors, so the caller
 * can fall back to asking one by one rather than call every page missing.
 */
export function firstCandidateFound(candidates: Candidate[], answer: unknown): Candidate | null {
  const json = answer as WhichAnswer;
  if (json?.errors?.length || !json?.data) throw new Error('Graph did not answer which page this is');
  const i = candidates.findIndex((_, n) => (json.data?.[`c${n}`]?.items?.length ?? 0) > 0);
  return i >= 0 ? candidates[i] : null;
}

/**
 * A read started now and awaited later (after the build lookup, say). Its failure waits for the
 * await too, and is never an unhandled rejection when the response goes out without it.
 */
export function startRead<T>(read: Promise<T>): () => Promise<T> {
  const settled = read.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return async () => {
    const result = await settled;
    if (!result.ok) throw result.error;
    return result.value;
  };
}
