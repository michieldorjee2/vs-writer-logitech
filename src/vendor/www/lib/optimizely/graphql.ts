/**
 * SHIM (ours). Upstream's graphql.ts is gql.tada typed against a generated Graph schema
 * (`graphql-env`, gitignored, absent from any checkout). The www-design pages never run these
 * fragments: they map Showcase content onto component props directly. So `graphql()` returns
 * its source string and `readFragment()` is the identity, which is exactly what gql.tada does
 * at runtime for unmasked data.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type FragmentOf<_T> = Record<string, any>
export type ResultOf<_T> = Record<string, any>
export type VariablesOf<_T> = Record<string, any>

export function graphql(source: string, _fragments?: unknown[]): string {
  return source
}

export function readFragment<T = any>(_fragment: unknown, data: T): T {
  return data
}
