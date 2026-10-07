/**
 * Optimizely Graph's response envelope, typed only as far as this repo's readers go.
 *
 * Every Graph read here used to be `(json as any)?.data?.X?.items` — repeated in
 * server/ssr-handler.tsx, api/content.ts, api/preview.ts, api/edit-status.ts and the
 * Vite dev proxy. The trust it encodes is the same everywhere: that Graph returned the
 * shape the query selected. `npm run check:graph` is what makes that trust reasonable
 * (it sends every shipped query to the live schema), so it is stated once, here.
 *
 * Pure — no DOM, no Node — so the browser bundle, the serverless functions and
 * vite.config.ts can all import it.
 */
export interface GraphResponse<T = unknown> {
  data?: Record<string, { items?: T[] | null; total?: number | null } | null> | null;
  errors?: Array<{ message?: string }> | null;
}

/** The `items` under one root field of a Graph response, typed as the caller's query selects them. */
export function graphItems<T>(json: unknown, root: string): T[] | null | undefined {
  return (json as GraphResponse<T> | null | undefined)?.data?.[root]?.items;
}
