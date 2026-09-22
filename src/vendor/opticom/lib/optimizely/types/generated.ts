/**
 * SHIM — not vendored. See UPSTREAM.md.
 *
 * Upstream this path is GraphQL-codegen output: `codegen.yaml` introspects the live Graph
 * schema and emits one type per content type, with `_IContent` as the union of all of them.
 * The generated file is not in the OptimizelyHeadless zip (it is gitignored and rebuilt on
 * `npm run codegen`), so the four vendored modules that import from it — `types/experience`,
 * `types/typeUtils`, `section/blank-section`, `element/icon-element` — would not resolve.
 *
 * This declares only the members those four actually reference, hand-written against the
 * Showcase Graph shape. It is deliberately thin: the Showcase catalogue is the 27 Visual
 * Builder types in `src/cms/components/`, not optimizely.com's ~90, so generating the real
 * thing here would mostly emit types nothing renders.
 *
 * ONE KNOWN DEGRADATION. Upstream's `_IContent` is a discriminated UNION, which makes
 * `ExtractContent<T>` in `typeUtils.ts` narrow to a single member. Here it is one open
 * interface, so `ExtractContent` collapses to `_IContent` and `castContent()` still guards
 * correctly at runtime but returns a widened type. Nothing in the render chain depends on
 * that narrowing; a renderer that wants a precise shape should import its own props
 * interface from its `types.ts`, which is the convention RENDERER-SPEC.md sets anyway.
 */

/** Graph's `IContentMetadata`, as the `ContentMetaData` fragment selects it. */
export interface _IContentMetadata {
  key?: string | null
  version?: string | null
  displayName?: string | null
  published?: string | null
  variation?: string | null
  lastModified?: string | null
  url?: {
    default?: string | null
    type?: string | null
    hierarchical?: string | null
    graph?: string | null
  } | null
}

/**
 * The Graph interface every content item implements. Open by design — a renderer receives
 * whatever its own fragment selected, and reads it through its own props interface.
 */
export interface _IContent {
  __typename?: string
  _metadata?: _IContentMetadata | null
  _modified?: string | null
  [field: string]: unknown
}

/** `_experience` base type. The composition itself is typed in `types/experience.ts`. */
export interface BlankExperience extends _IContent {
  __typename?: string
  Heading?: string | null
  Introduction?: string | null
}

/** `_section` base type. Carries no properties of its own on Showcase — only displaySettings. */
export interface BlankSection extends _IContent {
  __typename?: string
}

/** Upstream `IconElement`. Vendored via `components/element/icon-element`. */
export interface IconElement extends _IContent {
  __typename?: string
  Icon?: string | null
  AltText?: string | null
}
