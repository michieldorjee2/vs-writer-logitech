/**
 * One Graph read, bounded, and asked once more if it stalls. Shared by the server render
 * (server/ssr-handler.tsx), the client's content read (api/content.ts) and the CMS preview
 * (api/preview.ts).
 *
 * A read that stalls (6 Nov 2026: a connection that never sent headers) held its caller until
 * undici gave up at 300 s, the function's own limit; asked again, on a new connection, it usually
 * answers at once. So: 4 s, then once more with 8 s. A second stall throws the TimeoutError, which
 * each caller answers as it answers any Graph failure (an error, never cached). Any other failure
 * throws at once, as before. Reads only: safe to repeat.
 *
 * The signal covers the body too, so a response that sends headers and then stalls is bounded
 * the same way.
 */
export const GRAPH_TIMEOUT_MS = 4000;

export type GraphAnswer = { res: Response; json: unknown };

/** The operation's name, for logs: `query WhichPage(…)` → `WhichPage`. Never the variables or the URL (it carries the key). */
export function graphOp(query: string): string {
  return /query\s+(\w+)/.exec(query)?.[1] ?? 'anonymous';
}

function post(url: string, init: RequestInit, timeoutMs: number): Promise<GraphAnswer> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).then(async (res) => ({ res, json: await res.json() }));
}

/** POST a Graph query (`init` without a signal): see above. */
export async function postGraphRead(url: string, init: RequestInit, op: string): Promise<GraphAnswer> {
  try {
    return await post(url, init, GRAPH_TIMEOUT_MS);
  } catch (err) {
    if (!(err instanceof Error && err.name === 'TimeoutError')) throw err;
    console.warn(`[graph] ${op} stalled; asking once more`);
    return post(url, init, GRAPH_TIMEOUT_MS * 2);
  }
}
