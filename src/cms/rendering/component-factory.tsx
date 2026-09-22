/**
 * The dispatch: a Graph `__typename` in, a rendered component out.
 *
 * This is the port of upstream's `lib/optimizely/rendering/content-area/component.tsx`. That
 * file routes on the type NAME and nothing else:
 *
 *   contains 'Element'                      -> the Element registry
 *   contains 'Section' or 'ContainerData'   -> the Section registry
 *   anything else                           -> the Block registry
 *
 * Order matters and is preserved: 'Element' is tested first, so a hypothetical
 * `HeroSectionElement` lands in the Element lane, which is what upstream does.
 *
 * WHY THE LANE STILL MATTERS HERE, given our 27 renderers live in one folder. The lane is
 * what decides where a type we do NOT render goes, and there are real types in that
 * position: `BlankSection` is drawn by upstream's own vendored section renderer, and
 * `IconElement` by its element renderer. Both arrive over Graph with no repo folder of their
 * own. So the naming convention is load-bearing, not decorative, and `laneReport()` below
 * exists so "does this type dispatch where I think it does?" is a function call rather than
 * a reading of this comment.
 *
 * Lookup order is repo-first, then the vendored lane registry. A repo folder named after a
 * type therefore overrides optimizely.com's renderer for it — which is how `BlankSection`
 * would be taken over later without touching `src/vendor/`.
 */
import VendoredBlock from '@/lib/optimizely/rendering/content-area/block'
import VendoredElement from '@/lib/optimizely/rendering/content-area/element'
import VendoredSection from '@/lib/optimizely/rendering/content-area/section'
import { registeredTypeNames, rendererFor, type RendererProps } from './registry'

export type Lane = 'element' | 'section' | 'block'

export interface ComponentFactoryProps {
  typeName?: string
  props: RendererProps
}

/**
 * Upstream's name test, verbatim in behaviour. A pure function of the string, so a type's
 * lane is decided identically at author time, at render time and in `laneReport()`.
 */
export function laneFor(typeName: string): Lane {
  if (typeName.includes('Element')) return 'element'
  if (typeName.includes('Section') || typeName.includes('ContainerData')) return 'section'
  return 'block'
}

/**
 * The vendored registries, one per lane. Each is a `blocksMapperFactory` closure over
 * `src/vendor/opticom/components/<lane>/*` — upstream's own components, discovered by the
 * same glob upstream uses. `block/` is empty here (we ship none of optimizely.com's ~60
 * block renderers), `section/` holds `blank-section`, `element/` holds `icon-element`.
 */
const VENDORED: Record<Lane, (args: { typeName: string; props: RendererProps }) => React.ReactNode> = {
  element: VendoredElement as never,
  section: VendoredSection as never,
  block: VendoredBlock as never,
}

function Component({ typeName, props }: ComponentFactoryProps) {
  if (!typeName) return null

  const Repo = rendererFor(typeName)
  if (Repo) return <Repo {...props} />

  const lane = VENDORED[laneFor(typeName)]
  return <>{lane({ typeName, props })}</>
}

export default Component

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

export interface LaneAssignment {
  typeName: string
  lane: Lane
  /** 'repo' when a `src/cms/components/<kebab>/index.tsx` draws it, else 'vendored'. */
  source: 'repo' | 'vendored'
}

/**
 * Where every type this repo knows about would dispatch. Feed it extra names — the content
 * type keys from `src/cms/registry.ts`, say — to check a type that has no renderer yet.
 *
 * This is the verification handle for the naming convention: a Block-lane type whose key
 * happens to contain 'Element' is a silent misroute at runtime and an obvious row here.
 */
export function laneReport(extraTypeNames: string[] = []): LaneAssignment[] {
  const repo = new Set(registeredTypeNames())
  const names = [...new Set([...repo, ...extraTypeNames])].sort()
  return names.map((typeName) => ({
    typeName,
    lane: laneFor(typeName),
    source: repo.has(typeName) ? 'repo' : 'vendored',
  }))
}
