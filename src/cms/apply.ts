/// <reference types="node" />
/**
 * Idempotent apply for the Visual Builder content model.
 *
 *   npx tsx src/cms/apply.ts --dry-run    # read-only plan
 *   npx tsx src/cms/apply.ts              # reconcile
 *
 * For every discovered content type, display template, experience and blueprint: read first,
 * create when absent, merge-PATCH when present, leave alone when already correct. Re-POSTing
 * an existing key is a 409, so there is no blind POST anywhere in this file.
 *
 * Safety rails, in the order they fire:
 *
 *   1. FROZEN_CONTENT_TYPES is a hard-coded denylist, asserted intact at startup. Nothing in
 *      this script will create, patch or blueprint against those four keys. Two of them carry
 *      thousands of live pages, and a property change on an existing type takes ~40 minutes to
 *      propagate into Graph — during which a selection on a field Graph does not know fails
 *      the ENTIRE query with `data: null`. One such drift 404'd 2,676 published pages.
 *   2. An `elementEnabled` definition is validated against the element-legal property shapes
 *      BEFORE any request, so an illegal shape is a local failure rather than a 400.
 *   3. Nothing is ever deleted. A property that disappears from a definition is reported, not
 *      removed: merge-patch would need an explicit null, and that is a human decision.
 *   4. With nothing to reconcile, the script makes ZERO API calls — it does not even
 *      authenticate.
 */

import { pathToFileURL } from 'node:url'

import {
  blueprintKeyFor,
  createBlueprint,
  createContentType,
  createPropertyGroup,
  describeError,
  getBlueprint,
  getContentType,
  listDisplayTemplates,
  listPropertyGroups,
  patchBlueprintComposition,
  patchContentType,
  upsertDisplayTemplate,
  type Blueprint,
  type CmsContentType,
  type CompositionNode,
} from './client'
import {
  storedDisplayTemplateProjection,
  toCmsDisplayTemplateBody,
  type CmsDisplayTemplate,
  type RepoDisplayTemplate,
} from './display-template-transform'
import {
  discoverBlueprintsNode,
  discoverComponentsNode,
  discoverExperiencesNode,
  discoverLayoutTemplatesNode,
  discoverSectionsNode,
  type BlueprintEntry,
  type ComponentEntry,
  type ExperienceEntry,
  type SectionEntry,
} from './registry'
import {
  isElementEnabled,
  referencedGroups,
  validateContentType,
  validateElementProperties,
  type ContentTypeDefinition,
} from './property-builders'

// ---------------------------------------------------------------------------
// The denylist
// ---------------------------------------------------------------------------

/**
 * NEVER TOUCHED. Not created, not patched, not used as a blueprint's contentType.
 *
 *   CompetitorComparisonPage  67 props, 2,695 live pages
 *   PersonPage                62 props,    14 live pages
 *   RetailCustomerPage        38 props,    10 live pages
 *   FinServPage               22 props,     4 live pages
 */
export const FROZEN_CONTENT_TYPES: readonly string[] = Object.freeze([
  'CompetitorComparisonPage',
  'PersonPage',
  'RetailCustomerPage',
  'FinServPage',
])

/**
 * Assert the denylist is exactly what it is supposed to be. A refactor that widens, reorders
 * or empties it fails the run instead of quietly letting a write through.
 */
export function assertDenylistIntact(): void {
  const expected = [
    'CompetitorComparisonPage',
    'PersonPage',
    'RetailCustomerPage',
    'FinServPage',
  ]
  const actual = [...FROZEN_CONTENT_TYPES].sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((k, i) => k !== wanted[i])) {
    throw new Error(
      `FROZEN_CONTENT_TYPES has been altered. Expected exactly [${expected.join(', ')}], ` +
        `found [${FROZEN_CONTENT_TYPES.join(', ')}]. Refusing to run.`
    )
  }
  if (!Object.isFrozen(FROZEN_CONTENT_TYPES)) {
    throw new Error('FROZEN_CONTENT_TYPES is not frozen. Refusing to run.')
  }
}

export function isFrozen(key: string | undefined): boolean {
  return Boolean(key) && FROZEN_CONTENT_TYPES.includes(key as string)
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

type Action = 'created' | 'patched' | 'unchanged' | 'failed' | 'planned' | 'refused'

interface Row {
  kind:
    | 'property-group'
    | 'content-type'
    | 'section'
    | 'display-template'
    | 'experience'
    | 'blueprint'
  key: string
  action: Action
  detail: string
}

const rows: Row[] = []

function record(kind: Row['kind'], key: string, action: Action, detail = ''): void {
  rows.push({ kind, key, action, detail })
}

function printTable(): void {
  const header: Row = { kind: 'KIND' as Row['kind'], key: 'KEY', action: 'ACTION' as Action, detail: 'DETAIL' }
  const all = [header, ...rows]
  const wKind = Math.max(...all.map((r) => r.kind.length))
  const wKey = Math.max(...all.map((r) => r.key.length))
  const wAction = Math.max(...all.map((r) => r.action.length))

  const line = (r: Row) =>
    `${r.kind.padEnd(wKind)}  ${r.key.padEnd(wKey)}  ${r.action.padEnd(wAction)}  ${r.detail}`.trimEnd()

  console.log('')
  console.log(line(header))
  console.log(`${'-'.repeat(wKind)}  ${'-'.repeat(wKey)}  ${'-'.repeat(wAction)}  ${'-'.repeat(6)}`)
  if (rows.length === 0) {
    console.log('(nothing discovered)')
  }
  for (const r of rows) console.log(line(r))

  const counts: Record<Action, number> = {
    created: 0,
    patched: 0,
    unchanged: 0,
    failed: 0,
    planned: 0,
    refused: 0,
  }
  for (const r of rows) counts[r.action] += 1

  console.log('')
  console.log(
    `created ${counts.created}  patched ${counts.patched}  unchanged ${counts.unchanged}  ` +
      `planned ${counts.planned}  refused ${counts.refused}  failed ${counts.failed}`
  )
}

function failureCount(): number {
  return rows.filter((r) => r.action === 'failed' || r.action === 'refused').length
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Is `desired` already fully represented in `actual`? Merge-patch only ever adds or replaces,
 * so a desired state that is a deep subset of the remote state needs no request at all.
 * Arrays must match element for element (order matters for `enum` and `compositionBehaviors`).
 */
export function isDeepSubset(desired: unknown, actual: unknown): boolean {
  if (desired === actual) return true
  if (desired === null || desired === undefined) return actual === null || actual === undefined
  if (Array.isArray(desired)) {
    if (!Array.isArray(actual) || actual.length !== desired.length) return false
    return desired.every((v, i) => isDeepSubset(v, actual[i]))
  }
  if (typeof desired === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false
    const a = actual as Record<string, unknown>
    return Object.entries(desired as Record<string, unknown>).every(([k, v]) =>
      isDeepSubset(v, a[k])
    )
  }
  return false
}

/** The keys that make up a content type's desired state. `key` is in the URL, not the body. */
const PATCHABLE_CONTENT_TYPE_KEYS = [
  'displayName',
  'description',
  'baseType',
  'compositionBehaviors',
  'properties',
] as const

function desiredContentTypeBody(def: ContentTypeDefinition): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of PATCHABLE_CONTENT_TYPE_KEYS) {
    const value = (def as unknown as Record<string, unknown>)[k]
    if (value !== undefined) out[k] = value
  }
  return out
}

/** Properties present remotely that the local definition no longer declares. */
function orphanedProperties(def: ContentTypeDefinition, remote: CmsContentType): string[] {
  const local = new Set(Object.keys(def.properties ?? {}))
  return Object.keys(remote.properties ?? {}).filter((k) => !local.has(k))
}

// ---------------------------------------------------------------------------
// Reconcilers
// ---------------------------------------------------------------------------

interface Options {
  dryRun: boolean
  /**
   * The property groups known to exist after the property-group phase. A definition that
   * references a group outside this set fails locally rather than taking an
   * `InvalidPropertyGroup` 400. `null` when the phase could not establish the set at all
   * (a failed LIST, or a dry run), in which case the check is skipped rather than guessed.
   */
  knownGroups?: Set<string> | null
}

async function reconcileContentType(
  kind: 'content-type' | 'section' | 'experience',
  def: ContentTypeDefinition,
  opts: Options
): Promise<void> {
  const key = def.key

  if (isFrozen(key)) {
    record(kind, key, 'refused', 'frozen content type — never written by this script')
    return
  }

  const typeProblems = validateContentType(def)
  if (opts.knownGroups) {
    const unknown = referencedGroups(def).filter((g) => !opts.knownGroups!.has(g))
    if (unknown.length > 0) {
      typeProblems.push(
        `references property group(s) that do not exist and could not be created: ` +
          `${unknown.join(', ')}. An unknown group fails the whole content type.`
      )
    }
  }
  if (typeProblems.length > 0) {
    record(kind, key, 'failed', typeProblems.join(' | '))
    return
  }

  if (isElementEnabled(def)) {
    const problems = validateElementProperties(def.properties, key)
    if (problems.length > 0) {
      record(kind, key, 'failed', problems.join(' | '))
      return
    }
  }

  const existing = await getContentType(key)

  if (existing.status === 404) {
    if (opts.dryRun) {
      record(kind, key, 'planned', 'create')
      return
    }
    const created = await createContentType(def)
    if (created.ok) record(kind, key, 'created', def.baseType)
    else record(kind, key, 'failed', `POST ${created.status}: ${describeError(created.error)}`)
    return
  }

  if (!existing.ok) {
    record(kind, key, 'failed', `GET ${existing.status}: ${describeError(existing.error)}`)
    return
  }

  const remote = existing.body as CmsContentType
  const desired = desiredContentTypeBody(def)
  const orphans = orphanedProperties(def, remote)
  const orphanNote = orphans.length
    ? ` (${orphans.length} remote-only property kept: ${orphans.join(', ')})`
    : ''

  if (isDeepSubset(desired, remote)) {
    record(kind, key, 'unchanged', `already matches${orphanNote}`)
    return
  }

  if (opts.dryRun) {
    record(kind, key, 'planned', `patch${orphanNote}`)
    return
  }

  const patched = await patchContentType(key, desired as Partial<ContentTypeDefinition>)
  if (patched.ok) {
    record(
      kind,
      key,
      'patched',
      `merge-patch applied${orphanNote} — Graph takes ~40 min to catch up`
    )
  } else {
    record(kind, key, 'failed', `PATCH ${patched.status}: ${describeError(patched.error)}`)
  }
}

/**
 * Provision every property group the authored definitions reference. A property whose `group`
 * names a group that does not exist fails the WHOLE content type with
 * `The property group 'X' does not match an existing group.` (`code: InvalidPropertyGroup`) —
 * so this runs BEFORE the content-type phase, not alongside it.
 *
 * Groups are created, never renamed and never deleted: an existing group is left exactly as
 * it is, because other content types on the instance already point at it.
 *
 * Returns the set of groups that are now known to exist, so a content type referencing a group
 * this phase could not provision fails locally instead of taking a 400.
 */
async function reconcilePropertyGroups(
  wanted: Map<string, string[]>,
  opts: Options
): Promise<Set<string>> {
  if (wanted.size === 0) return new Set()

  const live = await listPropertyGroups()
  if (!live.ok) {
    record(
      'property-group',
      '(list)',
      'failed',
      `GET ${live.status}: ${describeError(live.error)} — cannot tell which groups exist`
    )
    return new Set()
  }

  const existing = new Set<string>()
  let maxSortOrder = 0
  for (const group of live.body?.items ?? []) {
    if (!group?.key) continue
    existing.add(group.key)
    maxSortOrder = Math.max(maxSortOrder, group.sortOrder ?? 0)
  }

  // Sorted so the sortOrder a group gets does not depend on folder iteration order.
  for (const key of [...wanted.keys()].sort()) {
    const users = wanted.get(key) ?? []
    const note = `referenced by ${users.length} type(s): ${users.slice(0, 3).join(', ')}${
      users.length > 3 ? ', …' : ''
    }`

    if (existing.has(key)) {
      record('property-group', key, 'unchanged', `already exists; ${note}`)
      continue
    }
    if (opts.dryRun) {
      record('property-group', key, 'planned', `create; ${note}`)
      continue
    }

    maxSortOrder += 10
    const created = await createPropertyGroup({
      key,
      displayName: humanizeGroupKey(key),
      sortOrder: maxSortOrder,
    })
    if (created.ok) {
      existing.add(key)
      record('property-group', key, 'created', note)
    } else {
      record(
        'property-group',
        key,
        'failed',
        `POST ${created.status}: ${describeError(created.error)}`
      )
    }
  }

  return existing
}

/** `SEO_Settings` -> `SEO Settings`. Only ever used for a group this script creates. */
function humanizeGroupKey(key: string): string {
  return key.replace(/_+/g, ' ').trim()
}

async function reconcileDisplayTemplate(
  template: RepoDisplayTemplate,
  /**
   * The remote templates by key, from the one cheap LIST call. `null` when the LIST failed —
   * the upsert then probes per key rather than POSTing blind.
   */
  remoteByKey: Map<string, CmsDisplayTemplate> | null,
  opts: Options
): Promise<void> {
  const key = template.key

  if (isFrozen(template.contentType)) {
    record('display-template', key, 'refused', `targets frozen type ${template.contentType}`)
    return
  }

  // `measuredKeysOnly`: a setting's `description` and `required` are accepted and then
  // discarded by the CMS, so sending them would guarantee a diff that never converges.
  const body = toCmsDisplayTemplateBody(template, { measuredKeysOnly: true })
  const remote = remoteByKey?.get(key)
  const exists = remoteByKey ? remoteByKey.has(key) : undefined

  // The LIST call already returned every template in full, so an unchanged template costs
  // zero further requests rather than a blind re-PATCH on every run.
  if (remote && isDeepSubset(storedDisplayTemplateProjection(body), remote)) {
    record(
      'display-template',
      key,
      'unchanged',
      `${Object.keys(body.settings).length} setting(s) already match`
    )
    return
  }

  if (opts.dryRun) {
    record('display-template', key, 'planned', exists === true ? 'patch' : 'create')
    return
  }

  const result = await upsertDisplayTemplate(body, { exists })
  if (result.ok) {
    record(
      'display-template',
      key,
      result.action,
      `${Object.keys(body.settings).length} setting(s); defaults stay repo-side`
    )
  } else {
    record(
      'display-template',
      key,
      'failed',
      `${result.action === 'created' ? 'POST' : 'PATCH'} ${result.status}: ${describeError(result.error)}`
    )
  }
}

async function reconcileBlueprint(entry: BlueprintEntry, opts: Options): Promise<void> {
  const def = entry.blueprint
  const label = def?.blueprintId ?? entry.file

  if (entry.problems.length > 0) {
    record('blueprint', label, 'failed', entry.problems.join(' | '))
    return
  }
  if (isFrozen(def.contentType)) {
    record('blueprint', label, 'refused', `targets frozen type ${def.contentType}`)
    return
  }

  const key = blueprintKeyFor(def.blueprintId)
  const existing = await getBlueprint(key)

  if (existing.status === 404) {
    if (opts.dryRun) {
      record('blueprint', label, 'planned', `create ${key}`)
      return
    }
    const created = await createBlueprint({
      contentType: def.contentType,
      displayName: def.displayName,
      key,
    })
    if (!created.ok) {
      record('blueprint', label, 'failed', `POST ${created.status}: ${describeError(created.error)}`)
      return
    }
    if (!def.composition) {
      record('blueprint', label, 'created', `${key} (no composition)`)
      return
    }
    const composed = await patchCompositionWithRetry(key, def.composition)
    if (composed.ok) record('blueprint', label, 'created', `${key} + composition`)
    else
      record(
        'blueprint',
        label,
        'failed',
        `created ${key} but composition PATCH ${composed.status}: ${describeError(composed.error)}`
      )
    return
  }

  if (!existing.ok) {
    record('blueprint', label, 'failed', `GET ${existing.status}: ${describeError(existing.error)}`)
    return
  }

  if (!def.composition) {
    record('blueprint', label, 'unchanged', `${key} exists, no composition authored`)
    return
  }

  const remote = existing.body as Blueprint
  // The API strips node ids and injects its own displayName onto the root, so compare the
  // authored skeleton as a subset of what came back rather than expecting equality.
  if (isDeepSubset(stripRootDisplayName(def.composition), remote.content?.composition)) {
    record('blueprint', label, 'unchanged', `${key} composition already matches`)
    return
  }

  if (opts.dryRun) {
    record('blueprint', label, 'planned', `patch composition on ${key}`)
    return
  }

  const composed = await patchCompositionWithRetry(key, def.composition)
  if (composed.ok) record('blueprint', label, 'patched', `${key} composition`)
  else
    record(
      'blueprint',
      label,
      'failed',
      `PATCH ${composed.status}: ${describeError(composed.error)}`
    )
}

/**
 * PATCH a freshly created blueprint's composition, retrying a 404.
 *
 * A blueprint's POST is not immediately followed by a readable resource: in a measured run of
 * four creates, three composition PATCHes landed and one came back 404 on a key the POST had
 * just returned 201 for. That is read-after-write lag, not a bad key — the same PATCH
 * succeeds a moment later — so a 404 here is retried and only a 404 that survives every
 * attempt is reported.
 *
 * Only 404 is retried. A 400 is a shape problem and will 400 again forever.
 */
async function patchCompositionWithRetry(
  key: string,
  composition: CompositionNode,
  attempts = 4
): Promise<Awaited<ReturnType<typeof patchBlueprintComposition>>> {
  let last = await patchBlueprintComposition(key, composition)
  for (let attempt = 1; attempt < attempts && last.status === 404; attempt += 1) {
    await sleep(attempt * 500)
    last = await patchBlueprintComposition(key, composition)
  }
  return last
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** A blueprint injects its own displayName onto the root composition node on read-back. */
function stripRootDisplayName(node: CompositionNode): CompositionNode {
  const copy: CompositionNode = { ...node }
  delete copy.displayName
  return copy
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Options {
  const dryRun = argv.includes('--dry-run') || argv.includes('-n')
  const unknown = argv.filter((a) => a.startsWith('-') && a !== '--dry-run' && a !== '-n')
  if (unknown.length > 0) {
    throw new Error(`Unknown flag(s): ${unknown.join(', ')}. Usage: apply.ts [--dry-run]`)
  }
  return { dryRun }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const opts = parseArgs(argv)
  assertDenylistIntact()

  const [components, experiences, sections, layoutTemplates, blueprints] = await Promise.all([
    discoverComponentsNode(),
    discoverExperiencesNode(),
    discoverSectionsNode(),
    discoverLayoutTemplatesNode(),
    discoverBlueprintsNode(),
  ])

  // Nine agents author component folders in parallel, so a collided key is a real risk and a
  // silent double-write is the worst way to find out about one.
  const templates: RepoDisplayTemplate[] = []
  const templateOwner = new Map<string, string>()
  const contentTypeOwner = new Map<string, string>()
  const usableComponents: ComponentEntry[] = []

  for (const component of components) {
    if (component.problems.length > 0) {
      record('content-type', component.key, 'failed', component.problems.join(' | '))
      continue
    }

    const firstOwner = contentTypeOwner.get(component.key)
    if (firstOwner) {
      record(
        'content-type',
        component.key,
        'failed',
        `duplicate content type key — declared by both ${firstOwner}/ and ${component.dir}/`
      )
      continue
    }
    contentTypeOwner.set(component.key, component.dir)
    usableComponents.push(component)

    for (const template of component.displayTemplates) {
      const owner = templateOwner.get(template.key)
      if (owner) {
        record(
          'display-template',
          template.key,
          'failed',
          `duplicate display template key — declared by both ${owner}/ and ${component.dir}/`
        )
        continue
      }
      templateOwner.set(template.key, component.dir)
      templates.push(template)
    }
  }

  // The section types the CMS already ships (`BlankSection`) are patched, not created — and
  // they must carry `sectionEnabled` BEFORE any blueprint composition referencing them is
  // written, which is why they reconcile in the content-type phase below.
  const usableSections: SectionEntry[] = []
  for (const section of sections) {
    if (section.problems.length > 0) {
      record('section', section.key, 'failed', section.problems.join(' | '))
      continue
    }
    const firstOwner = contentTypeOwner.get(section.key)
    if (firstOwner) {
      record(
        'section',
        section.key,
        'failed',
        `duplicate content type key — also declared by ${firstOwner}/`
      )
      continue
    }
    contentTypeOwner.set(section.key, `sections/${section.file}`)
    usableSections.push(section)
  }

  // Templates that belong to no component folder: the BlankSection template and the row /
  // column layout templates. They go through the same collision check and the same upsert.
  let layoutTemplateCount = 0
  for (const entry of layoutTemplates) {
    if (entry.problems.length > 0) {
      record('display-template', entry.file, 'failed', entry.problems.join(' | '))
      continue
    }
    for (const template of entry.templates) {
      const owner = templateOwner.get(template.key)
      if (owner) {
        record(
          'display-template',
          template.key,
          'failed',
          `duplicate display template key — declared by both ${owner}/ and ${entry.file}`
        )
        continue
      }
      templateOwner.set(template.key, entry.file)
      templates.push(template)
      layoutTemplateCount += 1
    }
  }

  const usableExperiences: ExperienceEntry[] = []
  for (const experience of experiences) {
    if (experience.problems.length > 0) {
      record('experience', experience.key, 'failed', experience.problems.join(' | '))
      continue
    }
    usableExperiences.push(experience)
  }

  // Every property group the authored definitions reference, and who references it. These
  // must exist before ANY content type is written: one unknown group fails the whole type.
  const wantedGroups = new Map<string, string[]>()
  for (const def of [
    ...usableComponents.map((c) => c.contentType),
    ...usableSections.map((s) => s.contentType),
    ...usableExperiences.map((e) => e.contentType),
  ]) {
    for (const group of referencedGroups(def)) {
      const users = wantedGroups.get(group) ?? []
      users.push(def.key)
      wantedGroups.set(group, users)
    }
  }

  const workCount =
    usableComponents.length +
    usableSections.length +
    usableExperiences.length +
    templates.length +
    blueprints.length

  console.log(
    `cms apply${opts.dryRun ? ' (dry run — no writes)' : ''}: ` +
      `${components.length} component folder(s), ${sections.length} section patch(es), ` +
      `${experiences.length} experience(s), ` +
      `${templates.length} display template(s) (${templates.length - layoutTemplateCount} ` +
      `component + ${layoutTemplateCount} layout/section), ${blueprints.length} blueprint(s), ` +
      `${wantedGroups.size} property group(s) referenced`
  )
  console.log(
    `frozen types never touched: ${FROZEN_CONTENT_TYPES.join(', ')}`
  )

  if (workCount === 0) {
    console.log('nothing to reconcile — no API calls made, not even authentication.')
    printTable()
    return failureCount() > 0 ? 1 : 0
  }

  // Phase order is load-bearing:
  //   property groups -> content types (+ sections, experiences) -> display templates -> blueprints
  // A display template 400s with InvalidContentType when its target type does not exist, and a
  // blueprint 400s the same way when its experience type does not.
  const knownGroups = await reconcilePropertyGroups(wantedGroups, opts)
  const typeOpts: Options = {
    ...opts,
    // A dry run creates nothing, so the set it would see is not the set the real run gets.
    knownGroups: opts.dryRun ? null : knownGroups.size > 0 ? knownGroups : null,
  }

  for (const component of usableComponents) {
    await reconcileContentType('content-type', component.contentType, typeOpts)
  }
  for (const section of usableSections) {
    await reconcileContentType('section', section.contentType, typeOpts)
  }
  for (const experience of usableExperiences) {
    await reconcileContentType('experience', experience.contentType, typeOpts)
  }

  if (templates.length > 0) {
    const remoteByKey = new Map<string, CmsDisplayTemplate>()
    const list = await listDisplayTemplates()
    if (list.ok) {
      for (const t of list.body?.items ?? []) if (t?.key) remoteByKey.set(t.key, t)
    } else {
      console.warn(
        `warning: could not list display templates (${list.status}: ${describeError(list.error)}) — ` +
          `falling back to a per-key probe.`
      )
    }
    for (const template of templates) {
      await reconcileDisplayTemplate(template, list.ok ? remoteByKey : null, opts)
    }
  }

  for (const blueprint of blueprints) {
    await reconcileBlueprint(blueprint, opts)
  }

  printTable()
  return failureCount() > 0 ? 1 : 0
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((err) => {
      console.error(`cms apply failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    })
}
