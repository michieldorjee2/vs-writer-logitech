/**
 * The renderer registry: content type key -> the React component that draws it.
 *
 * This is the Phase 1 half of `src/cms/registry.ts`. That module discovers the *model* —
 * content types, display templates, sections, experiences, blueprints — and runs under two
 * runtimes, because `apply.ts` consumes it from plain Node under tsx. This one discovers the
 * *renderers*, runs only in the browser, and is deliberately kept out of `apply.ts`'s import
 * graph so that pushing a content model never pulls React.
 *
 * ONE FOLDER, NOT THREE. Upstream splits its catalogue across `components/block`,
 * `components/element` and `components/section`, and `content-area/{block,element,section}
 * .tsx` each build a registry over their own directory. Our 27 Visual Builder types live in
 * a single `src/cms/components/`, keyed by content type, because the CMS makes no such
 * distinction — `compositionBehaviors` does, and it has exactly two values. The lane split
 * still exists in `component-factory.tsx`, where it decides what happens to a type we do
 * NOT render; see the note there on why the naming convention is load-bearing.
 *
 * LAZY, NOT EAGER. `{ eager: false }` (the default) hands back a map of import THUNKS, so
 * Vite emits one chunk per renderer and a page downloads only the components its composition
 * actually places. Eager discovery would inline all 27 into the entry chunk. The cost is that
 * every renderer is a `React.lazy`, which needs a Suspense boundary — `next/dynamic` carried
 * one, `React.lazy` does not — so each is wrapped once here rather than at every call site.
 *
 * `import.meta.glob` is a BUILD-TIME transform, not a runtime function: Vite rewrites the
 * call into a static import map, and outside Vite the property does not exist. Hence the
 * try/catch, exactly as in `src/cms/registry.ts`. Do not "fix" it by testing
 * `typeof import.meta.glob === 'function'` — after the transform that test is false in the
 * browser too, and the registry would come back empty.
 */
import { Suspense, createElement, lazy, type ComponentType } from 'react'
import { kebabToPascalCase } from '@/lib/optimizely/rendering/content-area/utils'

/**
 * What a renderer receives. The scalars of its content type, plus the two props every
 * component in this model takes. `RENDERER-SPEC.md` is the contract; this is its loose
 * runtime form, because the factory dispatches on a string and cannot know the shape.
 */
export type RendererProps = Record<string, unknown>

export type Renderer = ComponentType<RendererProps>

type RendererModule = { default: Renderer }

const NO_MODULES: Record<string, () => Promise<unknown>> = {}

function globRenderers(): Record<string, () => Promise<unknown>> {
  try {
    return import.meta.glob('../components/*/index.tsx')
  } catch {
    return NO_MODULES
  }
}

/** True when this module is running inside Vite, i.e. the glob resolved. */
export function viteDiscoveryAvailable(): boolean {
  return globRenderers() !== NO_MODULES
}

/** `../components/stat-block/index.tsx` -> `stat-block` */
function folderOf(modulePath: string): string {
  const parts = modulePath.split('/').filter(Boolean)
  return parts[parts.length - 2] ?? modulePath
}

/**
 * Wrap one lazily-imported renderer so it can be rendered anywhere, including inside a tree
 * that has no Suspense boundary of its own. `fallback={null}` rather than a skeleton: a
 * composed page is a stack of independent bands, and a spinner per band would flash more
 * than it would inform.
 */
function suspend(typeName: string, load: () => Promise<unknown>): Renderer {
  const Loaded = lazy(load as () => Promise<RendererModule>)

  function LazyRenderer(props: RendererProps) {
    return createElement(Suspense, { fallback: null }, createElement(Loaded, props))
  }
  LazyRenderer.displayName = `Lazy(${typeName})`

  return LazyRenderer
}

function build(): Record<string, Renderer> {
  const modules = globRenderers()
  if (modules === NO_MODULES) return {}

  const out: Record<string, Renderer> = {}
  for (const [modulePath, load] of Object.entries(modules)) {
    // The folder name is the kebab-case of the content type key — `registry.ts` fails a
    // folder where that is not true, so the two cannot drift apart and this round-trip is safe.
    const typeName = kebabToPascalCase(folderOf(modulePath))
    out[typeName] = suspend(typeName, load)
  }
  return out
}

/**
 * `ContentTypeKey` -> renderer, for every folder in `src/cms/components/` that has an
 * `index.tsx`. Built once at module load; the glob is static, so this cannot change at
 * runtime.
 */
export const repoRenderers: Record<string, Renderer> = build()

/** The renderer for a Graph `__typename`, or undefined when this repo does not draw it. */
export function rendererFor(typeName: string | undefined): Renderer | undefined {
  if (!typeName) return undefined
  return repoRenderers[typeName]
}

/** Every content type this repo can draw, sorted. Empty until the renderers land. */
export function registeredTypeNames(): string[] {
  return Object.keys(repoRenderers).sort()
}
