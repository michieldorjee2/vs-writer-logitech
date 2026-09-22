/**
 * Element-legal CMS property builders.
 *
 * Every builder here emits one of the EIGHT property shapes that the CMS accepts on a
 * content type declaring `compositionBehaviors: ['elementEnabled']`. The list was measured
 * against the live Showcase instance and is recorded in
 * `mcp-optimizely-cms/docs/cms-visual-builder-api.md`:
 *
 *   1. `string`                        bare, long text  (NO `format` key)
 *   2. `string` + `shortString`        single-line text
 *   3. `string` + `selectOne`          + an `enum` array of {value, displayName}
 *   4. `array` of `{type:'string'}`    + optional `maxItems`
 *   5. `boolean`
 *   6. `integer`
 *   7. `url`
 *   8. `dateTime`
 *
 * Everything else — component arrays, content references, single components — is a 400 on an
 * element: `The property 'X' is not allowed when content type has ElementEnabled.`
 *
 * `format: 'richText'` CANNOT BE CREATED through the API at all, on any baseType or
 * behaviour. `richText()` below throws so nobody reintroduces it by habit. Body copy is a
 * bare long `string`.
 *
 * This module is pure: no node, no vite, no I/O. Component folders import from here.
 */

/** The CMS fills this when a property omits `group`. */
export const DEFAULT_GROUP = 'Information'

/** sortOrder convention for authored properties: 10, 20, 30, … */
export const SORT_ORDER_STEP = 10

/** A property name shorter than this is rejected by the API. */
export const MIN_PROPERTY_NAME_LENGTH = 2

/**
 * A CONTENT TYPE's `description` is capped here:
 * `The content type description must be a string with a maximum length of '255'.`
 * (`field: Description`, `code: InvalidModel`).
 *
 * A PROPERTY's `description` is NOT capped — a 300-character one was measured accepted at 201.
 * The limit applies only to the type-level field.
 */
export const MAX_CONTENT_TYPE_DESCRIPTION_LENGTH = 255

export type ElementPropertyType =
  | 'string'
  | 'array'
  | 'boolean'
  | 'integer'
  | 'url'
  | 'dateTime'

/** The only two formats that can be WRITTEN. `richText` and `html` cannot. */
export type ElementPropertyFormat = 'shortString' | 'selectOne'

export interface CmsEnumEntry {
  value: string
  displayName: string
}

/** An element-legal property. */
export interface CmsProperty {
  type: ElementPropertyType
  format?: ElementPropertyFormat
  displayName: string
  description?: string
  required?: boolean
  maxLength?: number
  enum?: CmsEnumEntry[]
  items?: { type: 'string' }
  maxItems?: number
  group: string
  sortOrder: number
}

/**
 * A property on a `sectionEnabled` type, where component arrays and content references ARE
 * allowed. Sections and experiences may use this; elements may not.
 */
export interface SectionProperty {
  type: string
  format?: string
  displayName: string
  description?: string
  required?: boolean
  maxLength?: number
  enum?: CmsEnumEntry[]
  items?: { type: string; contentType?: string; allowedTypes?: string[] }
  maxItems?: number
  contentType?: string
  allowedTypes?: string[]
  restrictedTypes?: string[]
  group?: string
  sortOrder?: number
}

export type CmsPropertyLike = CmsProperty | SectionProperty

export type CmsBaseType =
  | '_component'
  | '_section'
  | '_experience'
  | '_page'
  | '_image'
  | '_media'
  | '_video'
  | '_folder'

/** Exactly two values are supported. Input is case-insensitive; it normalises to camelCase. */
export type CompositionBehavior = 'elementEnabled' | 'sectionEnabled'

/** What a component folder's `content-type.ts` default-exports. */
export interface ContentTypeDefinition {
  key: string
  displayName: string
  description?: string
  baseType: CmsBaseType
  compositionBehaviors?: CompositionBehavior[]
  properties: Record<string, CmsPropertyLike>
}

// ---------------------------------------------------------------------------
// Builder options
// ---------------------------------------------------------------------------

export interface BaseOptions {
  description?: string
  required?: boolean
  /** Editor grouping. Defaults to 'Information'. */
  group?: string
  /** Defaults to 0; `sequence()` renumbers 0s in steps of 10. */
  sortOrder?: number
}

export interface StringOptions extends BaseOptions {
  maxLength?: number
}

export interface ArrayOptions extends BaseOptions {
  maxItems?: number
}

export type SelectValues = ReadonlyArray<string | CmsEnumEntry>

function base(displayName: string, opts: BaseOptions): Pick<
  CmsProperty,
  'displayName' | 'description' | 'required' | 'group' | 'sortOrder'
> {
  const out: Pick<
    CmsProperty,
    'displayName' | 'description' | 'required' | 'group' | 'sortOrder'
  > = {
    displayName,
    group: opts.group ?? DEFAULT_GROUP,
    sortOrder: opts.sortOrder ?? 0,
  }
  if (opts.description !== undefined) out.description = opts.description
  if (opts.required !== undefined) out.required = opts.required
  return out
}

// ---------------------------------------------------------------------------
// The eight legal shapes
// ---------------------------------------------------------------------------

/** Single-line text. `string` + `format: 'shortString'`. */
export function shortString(displayName: string, opts: StringOptions = {}): CmsProperty {
  const prop: CmsProperty = { type: 'string', format: 'shortString', ...base(displayName, opts) }
  if (opts.maxLength !== undefined) prop.maxLength = opts.maxLength
  return prop
}

/**
 * Long text / body copy. A bare `string` with NO `format` key — this is the replacement for
 * `richText`, which cannot be created through the API.
 */
export function longString(displayName: string, opts: StringOptions = {}): CmsProperty {
  const prop: CmsProperty = { type: 'string', ...base(displayName, opts) }
  if (opts.maxLength !== undefined) prop.maxLength = opts.maxLength
  return prop
}

/** A single-choice dropdown. `string` + `format: 'selectOne'` + an `enum` array. */
export function selectOne(
  displayName: string,
  values: SelectValues,
  opts: BaseOptions = {}
): CmsProperty {
  if (!values || values.length === 0) {
    throw new Error(
      `selectOne('${displayName}') needs at least one enum value — ` +
        `format 'selectOne' without a non-empty 'enum' array is rejected.`
    )
  }
  const entries: CmsEnumEntry[] = values.map((v) =>
    typeof v === 'string' ? { value: v, displayName: humanize(v) } : { ...v }
  )
  return {
    type: 'string',
    format: 'selectOne',
    enum: entries,
    ...base(displayName, opts),
  }
}

/** A list of plain strings. `array` of `{type:'string'}`, optionally capped by `maxItems`. */
export function stringArray(displayName: string, opts: ArrayOptions = {}): CmsProperty {
  const prop: CmsProperty = {
    type: 'array',
    items: { type: 'string' },
    ...base(displayName, opts),
  }
  if (opts.maxItems !== undefined) prop.maxItems = opts.maxItems
  return prop
}

/** An absolute URL. */
export function url(displayName: string, opts: BaseOptions = {}): CmsProperty {
  return { type: 'url', ...base(displayName, opts) }
}

/** An ISO date-time. */
export function dateTime(displayName: string, opts: BaseOptions = {}): CmsProperty {
  return { type: 'dateTime', ...base(displayName, opts) }
}

/** A checkbox. */
export function boolean(displayName: string, opts: BaseOptions = {}): CmsProperty {
  return { type: 'boolean', ...base(displayName, opts) }
}

/** A whole number. */
export function integer(displayName: string, opts: BaseOptions = {}): CmsProperty {
  return { type: 'integer', ...base(displayName, opts) }
}

/**
 * NOT AVAILABLE. `format: 'richText'` cannot be created through the CMS API — it is rejected
 * on every surface (`/preview3`, `/v1`), every baseType and both composition behaviours with
 * `The property format 'richText' does not match an existing format.`
 *
 * Use {@link longString} for body copy.
 */
export function richText(displayName = '<unnamed>'): never {
  throw new Error(
    `richText('${displayName}') is not creatable. format: 'richText' is rejected by the CMS API ` +
      `on every surface and every composition behaviour — see the "richText cannot be created ` +
      `through the API" section of mcp-optimizely-cms/docs/cms-visual-builder-api.md. ` +
      `Use longString() for body copy; it also survives generated prose containing '<' characters, ` +
      `which a richText property would reject as malformed HTML.`
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renumber a properties map in steps of 10, in declaration order. Any property that set an
 * explicit non-zero `sortOrder` keeps it.
 */
export function sequence<T extends Record<string, CmsProperty>>(props: T): T {
  let next = SORT_ORDER_STEP
  for (const name of Object.keys(props)) {
    const prop = props[name]
    if (!prop.sortOrder) {
      prop.sortOrder = next
    }
    next = Math.max(next, prop.sortOrder) + SORT_ORDER_STEP
  }
  return props
}

function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const LEGAL_TYPES = new Set<string>([
  'string',
  'array',
  'boolean',
  'integer',
  'url',
  'dateTime',
])

const BANNED_FORMATS = new Set<string>([
  'richText',
  'richtext',
  'RichText',
  'html',
  'Html',
  'HTML',
  'xhtml',
  'XhtmlString',
  'longString',
])

const SECTION_ONLY_KEYS = ['contentType', 'allowedTypes', 'restrictedTypes'] as const

/**
 * Collect every reason a properties map would be rejected on an `elementEnabled` type.
 * Returns an empty array when the map is legal. Used by `apply.ts` to fail before a write
 * rather than after a 400.
 */
export function validateElementProperties(
  properties: Record<string, unknown> | undefined,
  label = 'content type'
): string[] {
  const problems: string[] = []
  if (!properties) return problems

  for (const [name, raw] of Object.entries(properties)) {
    const where = `${label}.${name}`

    if (name.length < MIN_PROPERTY_NAME_LENGTH) {
      problems.push(
        `${where}: property name must be at least ${MIN_PROPERTY_NAME_LENGTH} characters.`
      )
    }
    if (!raw || typeof raw !== 'object') {
      problems.push(`${where}: property must be an object.`)
      continue
    }

    const prop = raw as Record<string, unknown>
    const type = prop.type
    const format = prop.format

    if (typeof type !== 'string' || !LEGAL_TYPES.has(type)) {
      problems.push(
        `${where}: type '${String(type)}' is not element-legal. ` +
          `Allowed: string, array, boolean, integer, url, dateTime.`
      )
    }

    if (format !== undefined) {
      if (typeof format !== 'string' || BANNED_FORMATS.has(format)) {
        problems.push(
          `${where}: format '${String(format)}' cannot be written through the API. ` +
            `Use a bare string (no format key) for long text.`
        )
      } else if (format !== 'shortString' && format !== 'selectOne') {
        problems.push(
          `${where}: format '${format}' is not element-legal. Allowed: shortString, selectOne.`
        )
      } else if (type !== 'string') {
        problems.push(`${where}: format '${format}' is only valid on type 'string'.`)
      }
    }

    if (format === 'selectOne') {
      if (!Array.isArray(prop.enum) || prop.enum.length === 0) {
        problems.push(`${where}: format 'selectOne' needs a non-empty 'enum' array.`)
      }
    } else if (prop.enum !== undefined) {
      problems.push(`${where}: 'enum' is only valid with format 'selectOne'.`)
    }

    if (type === 'array') {
      const items = prop.items as Record<string, unknown> | undefined
      if (!items || items.type !== 'string') {
        problems.push(
          `${where}: an element array may only hold items of {type:'string'} — ` +
            `component and content arrays are rejected on elementEnabled types. ` +
            `Explode the list into one element node per item instead.`
        )
      }
    } else if (prop.items !== undefined) {
      problems.push(`${where}: 'items' is only valid on type 'array'.`)
    }

    for (const key of SECTION_ONLY_KEYS) {
      if (prop[key] !== undefined) {
        problems.push(
          `${where}: '${key}' makes this a content/component reference, which is rejected ` +
            `on elementEnabled types. Flatten it to scalars.`
        )
      }
    }
  }

  return problems
}

/**
 * Collect every reason a content type would be rejected regardless of its composition
 * behaviour. Returns an empty array when the definition is acceptable.
 *
 * Both rules were found by 400-probe and are NOT in the contract doc:
 *
 *   1. `description` is capped at 255 characters.
 *   2. Every property `group` must name a group that already exists — `apply.ts` provisions
 *      the missing ones before the content-type phase, so this only reports an EMPTY group
 *      string, which names nothing and would fail the whole type.
 */
export function validateContentType(def: ContentTypeDefinition | undefined): string[] {
  const problems: string[] = []
  if (!def) return problems

  const description = def.description ?? ''
  if (description.length > MAX_CONTENT_TYPE_DESCRIPTION_LENGTH) {
    problems.push(
      `description is ${description.length} characters; the API caps a content type ` +
        `description at ${MAX_CONTENT_TYPE_DESCRIPTION_LENGTH}. Property descriptions are ` +
        `not capped, so move the detail onto a property.`
    )
  }

  for (const [name, raw] of Object.entries(def.properties ?? {})) {
    if (!raw || typeof raw !== 'object') continue
    const group = (raw as { group?: unknown }).group
    if (group !== undefined && (typeof group !== 'string' || group.trim() === '')) {
      problems.push(
        `${name}: 'group' must be a non-empty string naming a property group — ` +
          `an unknown group fails the whole content type with InvalidPropertyGroup.`
      )
    }
  }

  return problems
}

/** Every property group a definition references, in declaration order, de-duplicated. */
export function referencedGroups(def: ContentTypeDefinition | undefined): string[] {
  const out: string[] = []
  for (const raw of Object.values(def?.properties ?? {})) {
    if (!raw || typeof raw !== 'object') continue
    const group = (raw as { group?: unknown }).group
    if (typeof group === 'string' && group.trim() !== '' && !out.includes(group)) {
      out.push(group)
    }
  }
  return out
}

/** Throwing form of {@link validateElementProperties}. */
export function assertElementLegal(
  properties: Record<string, unknown> | undefined,
  label = 'content type'
): void {
  const problems = validateElementProperties(properties, label)
  if (problems.length > 0) {
    throw new Error(
      `${problems.length} element-legality problem(s):\n  - ${problems.join('\n  - ')}`
    )
  }
}

/** True when this definition is placeable inside a column. */
export function isElementEnabled(def: ContentTypeDefinition | undefined): boolean {
  return Boolean(
    def?.compositionBehaviors?.some((b) => String(b).toLowerCase() === 'elementenabled')
  )
}
