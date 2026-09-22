/// <reference types="node" />
/**
 * A small CMA client for Node scripts. NODE ONLY — it reads the filesystem and is never
 * imported by the browser bundle. Run it under tsx (`npx tsx src/cms/apply.ts`).
 *
 * Every endpoint and verb below was measured against the live Showcase instance and is
 * recorded in mcp-optimizely-cms/docs/cms-visual-builder-api.md. In particular:
 *
 *   - `/preview3/contenttypes`                    GET / POST, PATCH per key (PUT is 405)
 *   - `/preview3/displaytemplates`                GET
 *   - `/preview3/experimental/blueprints`         GET / POST, PATCH per key (PUT is 405)
 *   - `/preview3/blueprints` and
 *     `/preview3/experimental/displaytemplates`   404 — wrong prefixes, do not use
 *
 * Two behaviours are not negotiable:
 *
 *   1. A browser User-Agent. Cloudflare error 1010 blocks default client UAs on this host.
 *   2. Read before write. Re-POSTing an existing key is a 409, so every create is preceded by
 *      a GET. There is no blind POST anywhere in this file.
 *
 * Credentials come from mcp-optimizely-cms/.env.local (OPTIMIZELY_CMS_CLIENT_ID /
 * OPTIMIZELY_CMS_CLIENT_SECRET). They are never logged, never echoed into an error message
 * and never written to another file.
 */

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

import type { ContentTypeDefinition } from './property-builders'
import type { CmsDisplayTemplate } from './display-template-transform'

export type { ContentTypeDefinition } from './property-builders'
export type { CmsDisplayTemplate } from './display-template-transform'

export const CMS_API_BASE = 'https://api.cms.optimizely.com'

/** Where the credentials live. Override with OPTIMIZELY_CMS_ENV_FILE. */
export const DEFAULT_ENV_FILE = '/Users/michiel.dorjee/Claude/mcp-optimizely-cms/.env.local'

/**
 * Cloudflare 1010 rejects the default fetch/undici User-Agent on api.cms.optimizely.com.
 * A browser UA is required on every call, including the token call.
 */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

export const PATHS = {
  token: '/oauth/token',
  contentTypes: '/preview3/contenttypes',
  /**
   * Not in the contract doc, found by 400-probe: a property's `group` must name a group that
   * ALREADY EXISTS (`The property group 'X' does not match an existing group.`,
   * `code: InvalidPropertyGroup`) — so an authored group has to be provisioned first.
   * Measured: GET 200 (26 groups), POST 201, DELETE 200.
   */
  propertyGroups: '/preview3/propertygroups',
  displayTemplates: '/preview3/displaytemplates',
  blueprints: '/preview3/experimental/blueprints',
  /** `PATCH /preview3/experimental/content/{key}/versions/{versionId}` */
  contentVersion: (key: string, versionId: string) =>
    `/preview3/experimental/content/${encodeURIComponent(key)}/versions/${encodeURIComponent(versionId)}`,
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CmsFieldError {
  field?: string
  message?: string
  code?: string
}

export interface CmsErrorBody {
  title?: string
  code?: string
  status?: number
  detail?: string
  errors?: CmsFieldError[]
  /** The raw response text, for anything the shape above does not cover. */
  raw?: string
}

export interface RawResponse {
  status: number
  ok: boolean
  /** Parsed JSON when the response was JSON, the raw text otherwise, null when empty. */
  body: unknown
}

export interface Result<T> {
  status: number
  ok: boolean
  body: T | null
  error: CmsErrorBody | null
}

export type UpsertAction = 'created' | 'patched'

export interface UpsertResult<T> extends Result<T> {
  action: UpsertAction
}

export interface CmsContentType extends ContentTypeDefinition {
  created?: string
  createdBy?: string
  lastModified?: string
  lastModifiedBy?: string
  source?: string
  usage?: unknown
}

export interface ListResult<T> {
  items: T[]
  totalItemCount?: number
  pageIndex?: number
  pageSize?: number
}

/**
 * A node's display settings.
 *
 * MEASURED SHAPE, and it is not the obvious one. `displaySettings` is NOT a flat
 * `Record<string, string>` — it is an object carrying the template key alongside a nested
 * `settings` map:
 *
 * ```json
 * "displaySettings": {
 *   "displayTemplate": "RowDisplayTemplate",
 *   "settings": { "displayMode": "grid" }
 * }
 * ```
 *
 * Three things were measured on the live instance and every one of them bites:
 *
 *  1. `displayTemplate` is REQUIRED whenever `displaySettings` is present —
 *     `The DisplayTemplate field is required.` at
 *     `Content.Composition.Nodes[n].DisplaySettings.DisplayTemplate`. A node-level sibling
 *     (`displayTemplateKey` or `displayTemplate` next to `nodeType`) does NOT satisfy it.
 *     Omitting `displaySettings` entirely is fine, so a node with nothing to say can leave
 *     it out.
 *  2. Settings written as siblings of `displayTemplate` instead of inside `settings` are
 *     **silently dropped** — the PATCH returns 200 and reads back `"settings": {}`. There is
 *     no error to catch, so this one can only be caught by reading the composition back.
 *  3. Values inside `settings` are validated against the named display template's choices:
 *     `Display setting value 'default' does not exist for setting 'displayMode' on display
 *     template with key 'RowDisplayTemplate'.` So the template has to exist, and be correct,
 *     before any composition referencing it is written.
 *
 * An array form (`[{displayTemplate, settings}]`) is rejected outright:
 * `nodes[0].displaySettings: The value did not match the expected type.`
 */
export interface NodeDisplaySettings {
  /** The display template key. Required whenever `displaySettings` is present at all. */
  displayTemplate: string
  /** Setting key -> chosen value. Values are validated against the template's choices. */
  settings: Record<string, string>
}

/**
 * A composition node. Hierarchy is Experience -> Section -> Row -> Column -> Component.
 * The root is `nodeType: 'experience'` / `layoutType: 'outline'`; a section is
 * `layoutType: 'grid'`. Sections and components carry `component: {contentType, properties}`;
 * rows and columns carry only `displaySettings` and `nodes`.
 *
 * The API strips every node `id` on read-back, and an empty column round-trips as
 * `{"nodeType":"column"}` — an ABSENT `nodes` key, not `nodes: []`. Readers must tolerate both.
 *
 * A `component` node whose content type has a REQUIRED property cannot be placed with empty
 * properties: `Property 'Stat value' is required.` at
 * `Composition.Nodes[…].Component.Properties.StatValue`. A blueprint skeleton therefore places
 * sections, rows and columns, and leaves element nodes to be minted at instantiation time with
 * their copy already in hand.
 */
export interface CompositionNode {
  nodeType: 'experience' | 'section' | 'row' | 'column' | 'component'
  layoutType?: 'outline' | 'grid' | string
  key?: string
  displayName?: string
  displaySettings?: NodeDisplaySettings
  component?: {
    contentType: string
    properties?: Record<string, unknown>
  }
  nodes?: CompositionNode[]
  /** Never authored: the API mints/strips ids. Present only on some read paths. */
  id?: string
}

export interface Blueprint {
  key: string
  displayName: string
  contentType: string
  lastModified?: string
  lastModifiedBy?: string
  content?: {
    properties?: Record<string, unknown>
    composition?: CompositionNode
  }
}

export interface CreateBlueprintInput {
  contentType: string
  displayName: string
  /** Optional, but if supplied must be GUID-formatted. `blueprintKeyFor()` makes one. */
  key?: string
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

interface Credentials {
  clientId: string
  clientSecret: string
}

let credentials: Credentials | null = null

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
    const eq = withoutExport.indexOf('=')
    if (eq <= 0) continue
    const key = withoutExport.slice(0, eq).trim()
    let value = withoutExport.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/** The file credentials are read from. Safe to print — it is a path, not a secret. */
export function credentialFile(): string {
  return process.env.OPTIMIZELY_CMS_ENV_FILE || DEFAULT_ENV_FILE
}

/**
 * Resolve credentials: the ambient environment first, then the env file. Returns the values
 * to the caller in-process only; nothing here logs, formats or persists them.
 */
export async function loadCredentials(): Promise<Credentials> {
  if (credentials) return credentials

  let clientId = process.env.OPTIMIZELY_CMS_CLIENT_ID || ''
  let clientSecret = process.env.OPTIMIZELY_CMS_CLIENT_SECRET || ''

  if (!clientId || !clientSecret) {
    const file = credentialFile()
    let text: string
    try {
      text = await readFile(file, 'utf8')
    } catch (err) {
      throw new Error(
        `Could not read CMS credentials from ${file} ` +
          `(${err instanceof Error ? err.message : String(err)}). ` +
          `Set OPTIMIZELY_CMS_ENV_FILE to point at a file holding ` +
          `OPTIMIZELY_CMS_CLIENT_ID and OPTIMIZELY_CMS_CLIENT_SECRET.`
      )
    }
    const parsed = parseDotEnv(text)
    clientId = clientId || parsed.OPTIMIZELY_CMS_CLIENT_ID || ''
    clientSecret = clientSecret || parsed.OPTIMIZELY_CMS_CLIENT_SECRET || ''
    if (!clientId || !clientSecret) {
      const missing = [
        clientId ? null : 'OPTIMIZELY_CMS_CLIENT_ID',
        clientSecret ? null : 'OPTIMIZELY_CMS_CLIENT_SECRET',
      ]
        .filter(Boolean)
        .join(', ')
      throw new Error(`${file} is missing ${missing}.`)
    }
  }

  credentials = { clientId, clientSecret }
  return credentials
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

interface CachedToken {
  value: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

/** Refresh a little early so a long apply run never races the expiry. */
const TOKEN_SKEW_MS = 60_000

/** Drop the cached token. The next `token()` fetches a fresh one. */
export function resetToken(): void {
  cachedToken = null
}

/**
 * A bearer token for the CMA, cached in-process and refreshed when it is within
 * TOKEN_SKEW_MS of expiry. `POST /oauth/token`, `grant_type=client_credentials`.
 */
export async function token(opts: { force?: boolean } = {}): Promise<string> {
  const now = Date.now()
  if (!opts.force && cachedToken && now < cachedToken.expiresAt) {
    return cachedToken.value
  }

  const { clientId, clientSecret } = await loadCredentials()
  const form = new URLSearchParams()
  form.set('grant_type', 'client_credentials')
  form.set('client_id', clientId)
  form.set('client_secret', clientSecret)

  const response = await fetch(`${CMS_API_BASE}${PATHS.token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': BROWSER_USER_AGENT,
    },
    body: form.toString(),
  })

  if (!response.ok) {
    // Deliberately does NOT include the request body — that holds the client secret.
    throw new Error(
      `CMS token request failed: ${response.status} ${response.statusText}. ` +
        `Check the credentials in ${credentialFile()}.`
    )
  }

  const payload = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!payload.access_token) {
    throw new Error('CMS token response contained no access_token.')
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: now + Math.max(0, (payload.expires_in ?? 3600) * 1000 - TOKEN_SKEW_MS),
  }
  return cachedToken.value
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface RequestInitOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Send `Content-Type: application/merge-patch+json`. Required for every PATCH. */
  mergePatch?: boolean
  headers?: Record<string, string>
  /** Internal: prevents the 401 refresh from recursing. */
  _retried?: boolean
}

/**
 * One CMA call. Never throws on a non-2xx — the status comes back for the caller to act on,
 * because a 404 (create it) and a 409 (it already exists) are both normal control flow here.
 */
export async function req(path: string, init: RequestInitOptions = {}): Promise<RawResponse> {
  const method = init.method ?? 'GET'
  const bearer = await token()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${bearer}`,
    Accept: 'application/json',
    'User-Agent': BROWSER_USER_AGENT,
    ...init.headers,
  }
  if (init.body !== undefined) {
    headers['Content-Type'] = init.mergePatch
      ? 'application/merge-patch+json'
      : 'application/json'
  }

  const response = await fetch(`${CMS_API_BASE}${path}`, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  // A token can expire mid-run on a long apply. Refresh once and retry.
  if (response.status === 401 && !init._retried) {
    resetToken()
    return req(path, { ...init, _retried: true })
  }

  const text = await response.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  return { status: response.status, ok: response.ok, body }
}

function asResult<T>(raw: RawResponse): Result<T> {
  if (raw.ok) {
    return { status: raw.status, ok: true, body: raw.body as T, error: null }
  }
  return { status: raw.status, ok: false, body: null, error: toErrorBody(raw) }
}

function toErrorBody(raw: RawResponse): CmsErrorBody {
  if (raw.body && typeof raw.body === 'object') {
    const obj = raw.body as CmsErrorBody
    return { ...obj, status: obj.status ?? raw.status }
  }
  return { status: raw.status, raw: typeof raw.body === 'string' ? raw.body : undefined }
}

/**
 * A one-line rendering of a CMS error. A 400 with several problems returns
 * `title: "The provided model contained multiple issues."` plus a per-field `errors` array —
 * the useful text is in `errors[].field`, not the prose, so field names lead here.
 */
export function describeError(error: CmsErrorBody | null): string {
  if (!error) return ''
  const parts: string[] = []
  if (error.errors?.length) {
    parts.push(
      error.errors
        .map((e) => [e.field, e.message].filter(Boolean).join(': '))
        .filter(Boolean)
        .join(' | ')
    )
  }
  if (!parts.length && error.title) parts.push(error.title)
  if (!parts.length && error.detail) parts.push(error.detail)
  if (!parts.length && error.raw) parts.push(error.raw.slice(0, 300))
  if (error.code) parts.push(`(${error.code})`)
  return parts.join(' ') || `HTTP ${error.status ?? '?'}`
}

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

export async function getContentType(key: string): Promise<Result<CmsContentType>> {
  return asResult<CmsContentType>(
    await req(`${PATHS.contentTypes}/${encodeURIComponent(key)}`)
  )
}

export async function listContentTypes(
  opts: { baseType?: string; pageSize?: number; pageIndex?: number } = {}
): Promise<Result<ListResult<CmsContentType>>> {
  const query = new URLSearchParams()
  if (opts.baseType) query.set('baseType', opts.baseType)
  if (opts.pageSize !== undefined) query.set('pageSize', String(opts.pageSize))
  if (opts.pageIndex !== undefined) query.set('pageIndex', String(opts.pageIndex))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const raw = await req(`${PATHS.contentTypes}${suffix}`)
  return asResult<ListResult<CmsContentType>>(normalizeList(raw))
}

/** Create a content type. POST only after a GET proved it absent — a re-POST is 409. */
export async function createContentType(
  definition: ContentTypeDefinition
): Promise<Result<CmsContentType>> {
  return asResult<CmsContentType>(
    await req(PATHS.contentTypes, { method: 'POST', body: definition })
  )
}

/** Update a content type. PATCH with merge-patch semantics; PUT is a 405 on this surface. */
export async function patchContentType(
  key: string,
  patch: Partial<ContentTypeDefinition>
): Promise<Result<CmsContentType>> {
  return asResult<CmsContentType>(
    await req(`${PATHS.contentTypes}/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: patch,
      mergePatch: true,
    })
  )
}

// ---------------------------------------------------------------------------
// Property groups
// ---------------------------------------------------------------------------

/**
 * An editor grouping for properties. `source: '_system'` marks the four the CMS ships
 * (`Information`, `Scheduling`, `Shortcut`, `Categories`, `Advanced`, `DynamicBlocks`).
 */
export interface PropertyGroup {
  key: string
  displayName?: string
  sortOrder?: number
  source?: string
  created?: string
  createdBy?: string
  lastModified?: string
  lastModifiedBy?: string
}

export async function listPropertyGroups(): Promise<Result<ListResult<PropertyGroup>>> {
  const raw = await req(`${PATHS.propertyGroups}?pageSize=200`)
  return asResult<ListResult<PropertyGroup>>(normalizeList(raw))
}

/**
 * Create a property group. Measured 201. A property whose `group` names a group that does not
 * exist fails the WHOLE content type create with `InvalidPropertyGroup`, so every group an
 * authored definition references has to exist before the content-type phase runs.
 */
export async function createPropertyGroup(
  group: PropertyGroup
): Promise<Result<PropertyGroup>> {
  return asResult<PropertyGroup>(
    await req(PATHS.propertyGroups, { method: 'POST', body: group })
  )
}

// ---------------------------------------------------------------------------
// Display templates
// ---------------------------------------------------------------------------

export async function listDisplayTemplates(): Promise<Result<ListResult<CmsDisplayTemplate>>> {
  const raw = await req(PATHS.displayTemplates)
  return asResult<ListResult<CmsDisplayTemplate>>(normalizeList(raw))
}

export async function getDisplayTemplate(key: string): Promise<Result<CmsDisplayTemplate>> {
  return asResult<CmsDisplayTemplate>(
    await req(`${PATHS.displayTemplates}/${encodeURIComponent(key)}`)
  )
}

/**
 * Create-or-patch a display template.
 *
 * NOTE: the contract doc measured `GET /preview3/displaytemplates` only; the write verbs for
 * this surface are NOT in the measured contract. This helper therefore reports whatever the
 * API says verbatim rather than assuming success, and callers pass `exists` from the cheap
 * LIST call so no unmeasured per-key GET is needed.
 */
export async function upsertDisplayTemplate(
  template: CmsDisplayTemplate,
  opts: { exists?: boolean } = {}
): Promise<UpsertResult<CmsDisplayTemplate>> {
  let exists = opts.exists
  if (exists === undefined) {
    const probe = await getDisplayTemplate(template.key)
    exists = probe.ok
  }

  if (exists) {
    const patched = await req(`${PATHS.displayTemplates}/${encodeURIComponent(template.key)}`, {
      method: 'PATCH',
      body: template,
      mergePatch: true,
    })
    return { ...asResult<CmsDisplayTemplate>(patched), action: 'patched' }
  }

  const created = await req(PATHS.displayTemplates, { method: 'POST', body: template })
  return { ...asResult<CmsDisplayTemplate>(created), action: 'created' }
}

// ---------------------------------------------------------------------------
// Blueprints
// ---------------------------------------------------------------------------

export async function listBlueprints(): Promise<Result<ListResult<Blueprint>>> {
  const raw = await req(PATHS.blueprints)
  return asResult<ListResult<Blueprint>>(normalizeList(raw))
}

export async function getBlueprint(key: string): Promise<Result<Blueprint>> {
  return asResult<Blueprint>(await req(`${PATHS.blueprints}/${encodeURIComponent(key)}`))
}

/**
 * Create a blueprint — a composition skeleton scoped to one content type.
 *
 * Required: `contentType` (must exist, else `code: InvalidContentType`) and `displayName`
 * (else `field: DisplayName`). `key` is optional but, when supplied, must be GUID-formatted;
 * a supplied key is honoured, which is what makes creation idempotent.
 */
export async function createBlueprint(input: CreateBlueprintInput): Promise<Result<Blueprint>> {
  return asResult<Blueprint>(await req(PATHS.blueprints, { method: 'POST', body: input }))
}

/**
 * Write a blueprint's composition skeleton. The tree goes under `content.composition` and the
 * verb is PATCH with merge-patch (PUT is a 405).
 *
 * The API strips every node `id` on read-back, so a blueprint stores the skeleton WITHOUT
 * ids: node ids are ours to mint when the blueprint is instantiated onto a page, as
 * `uuidv5(pageKey + slotId + index)` so a re-render is a merge and not a replacement.
 */
export async function patchBlueprintComposition(
  key: string,
  composition: CompositionNode
): Promise<Result<Blueprint>> {
  return asResult<Blueprint>(
    await req(`${PATHS.blueprints}/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: { content: { composition } },
      mergePatch: true,
    })
  )
}

/**
 * A stable GUID-formatted blueprint key derived from a human-readable id. Same id, same key,
 * forever — which turns blueprint creation into an idempotent operation and removes every
 * lookup.
 */
export function blueprintKeyFor(blueprintId: string): string {
  return createHash('md5').update(blueprintId, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// Compositions on a page version
// ---------------------------------------------------------------------------

/**
 * `PATCH /preview3/experimental/content/{key}/versions/{versionId}` with merge-patch and a
 * body of `{composition: …}`. Phase 2 uses this; nothing in Phase 0 calls it.
 */
export async function patchContentComposition(
  key: string,
  versionId: string,
  composition: CompositionNode
): Promise<Result<unknown>> {
  return asResult<unknown>(
    await req(PATHS.contentVersion(key, versionId), {
      method: 'PATCH',
      body: { composition },
      mergePatch: true,
    })
  )
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The `/preview3` list endpoints return `{items, totalItemCount}`; the `/v1` ones return the
 * same data without `totalItemCount`, and a bare array shows up on some surfaces. Normalise
 * all three into `{items, totalItemCount?}`.
 */
function normalizeList(raw: RawResponse): RawResponse {
  if (!raw.ok) return raw
  if (Array.isArray(raw.body)) {
    return { ...raw, body: { items: raw.body, totalItemCount: raw.body.length } }
  }
  if (raw.body && typeof raw.body === 'object') {
    const obj = raw.body as { items?: unknown }
    if (!Array.isArray(obj.items)) {
      return { ...raw, body: { ...obj, items: [] } }
    }
  }
  return raw
}
