/**
 * `BlankSection` — a PATCH, not a creation.
 *
 * This type ALREADY EXISTS on the Showcase instance with zero properties (the contract doc's
 * inventory lists it: `_section`, `BlankSection`, 0 props, "bare default"). Nothing here
 * declares a property, and nothing here should ever declare one: sections in this model are
 * pure containers. Every word of copy on a Limitless page lives in an element node inside a
 * column, which is what makes a pruned item visible in the composition tree instead of
 * invisible inside an array property.
 *
 * So the only thing this file asks for is `compositionBehaviors: ['sectionEnabled']`, the flag
 * that makes the type placeable as a top-level band holding rows and columns. A content type
 * without it cannot appear in a Visual Builder composition at all — the behaviours are the
 * gate, and exactly two values exist (`sectionEnabled`, `elementEnabled`).
 *
 * WHY THE DEFINITION IS DELIBERATELY THIN. `apply.ts` sends only the keys a definition
 * actually declares, and it reads before it writes:
 *
 *   - `properties: {}` is a no-op against a type with no properties, so the merge-patch adds
 *     nothing and removes nothing. (It could not remove anything even if it wanted to: a
 *     merge-patch needs an explicit `null` per property, and `apply.ts` never emits one.)
 *   - `displayName` and `description` are ABSENT on purpose. They are the two keys that would
 *     rename a type the CMS ships and that other content may already point at. Omitting them
 *     keeps the reconcile to the one field this file is about, and keeps the diff readable:
 *     if the run says `patched`, the only thing that changed is the behaviour flag.
 *
 * That is also why this is a `Partial`-flavoured cast rather than a plain
 * `ContentTypeDefinition`: the interface requires `displayName`, and supplying one here would
 * quietly re-title an existing type on the first run.
 *
 * NOTE ON DISCOVERY: `registry.ts` globs the component folders, `experiences/*.ts` and
 * `blueprints/*.ts`. It does NOT glob `sections/`, so `apply.ts` cannot see this file yet.
 * Until the registry gains a `sections/` path, the `sectionEnabled` flag has to be applied
 * another way — and it must be applied BEFORE a blueprint composition referencing
 * `BlankSection` is instantiated onto a page.
 */

import type { CmsPropertyLike, CompositionBehavior, ContentTypeDefinition } from '../property-builders'

/** The shape actually sent: no `displayName`, no `description`. */
interface ContentTypePatch {
  key: string
  baseType: ContentTypeDefinition['baseType']
  compositionBehaviors: CompositionBehavior[]
  properties: Record<string, CmsPropertyLike>
}

const blankSection: ContentTypePatch = {
  key: 'BlankSection',
  baseType: '_section',
  compositionBehaviors: ['sectionEnabled'],
  properties: {},
}

export default blankSection as unknown as ContentTypeDefinition
