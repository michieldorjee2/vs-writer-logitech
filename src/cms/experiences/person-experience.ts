/**
 * `PersonExperience` — the person page, as an experience.
 *
 * Replaces `PersonPage` for new pages. `PersonPage` (62 properties, 14 live pages) is frozen
 * on `apply.ts`'s denylist and keeps serving the pages already written against it.
 *
 * A person page is a child of an account page: `/{companySlug}/{personSlug}/`. That is not
 * decoration — the hierarchy is what lets a stakeholder card on the account page link to
 * "their page" by appending a slug, and it is how the person page inherits the account's
 * screenshot and branding at resolve time. So this type carries the PARENT's identity
 * (`companySlug`, `companyName`) as well as the person's, rather than reading it through the
 * tree: a Graph query for one page should not need a second query to know whose account it
 * belongs to.
 *
 * Like `ABMExperience`, it carries no copy. Everything the page says — the hero, the
 * scorecard of what a seat like theirs is measured on, the peer proof, the closing ask —
 * lives in the composition as element nodes.
 *
 * Nothing is `required`, for the same reason as on `ABMExperience`: a page is created and
 * then composed, and a required property the create cannot satisfy turns a two-step write
 * into a 400.
 *
 * NO `richText`. Body copy is a bare long `string`; the format cannot be created through the
 * API at all.
 */

import {
  boolean,
  longString,
  sequence,
  shortString,
  url,
  type ContentTypeDefinition,
} from '../property-builders'

const IDENTITY = 'Identity'
const PERSON = 'Person'
const BRAND = 'Brand'
const SEO = 'SEO'
const PROVENANCE = 'Provenance'

const contentType: ContentTypeDefinition = {
  key: 'PersonExperience',
  displayName: 'Person Experience',
  description:
    'A Visual Builder page written to one named individual at an account. A child of that ' +
    "account's ABM Experience at `/{companySlug}/{personSlug}/`. Identity, branding, meta and " +
    'provenance only — the copy lives in the composition.',
  baseType: '_experience',
  properties: sequence({
    // ---- Identity ---------------------------------------------------------
    crmContactId: shortString('CRM contact ID', {
      description:
        'The Salesforce contact or lead id this page was written for — `003`-prefixed for a ' +
        'contact, `00Q` for a lead. The match key back to the CRM. ' +
        'NOT FILTERABLE IN GRAPH: no `where` clause can select on it, so a caller looking for ' +
        "the page belonging to a contact LISTS the person pages and matches in memory. That is " +
        'cheap at the current scale (tens of pages) and it is the reason this field is safe to ' +
        'add without a Graph migration — a filter nobody writes cannot drift.',
      group: IDENTITY,
    }),
    companySlug: shortString('Company slug', {
      description:
        "The parent account's URL segment. The page is routed at `/{companySlug}/{personSlug}/`, " +
        "as a child of that account's page.",
      group: IDENTITY,
    }),
    personSlug: shortString('Person slug', {
      description:
        'The URL segment for this person, e.g. `anna-lindqvist`. The second half of the route.',
      group: IDENTITY,
    }),
    companyName: shortString('Company name', {
      description: 'The account name, carried so a single-page query knows whose account this is.',
      group: IDENTITY,
    }),

    // ---- The person -------------------------------------------------------
    personName: shortString('Person name', {
      description: 'Their name as they write it.',
      group: PERSON,
    }),
    personTitle: shortString('Person title', {
      description:
        'Their job title, verbatim from the CRM or from LinkedIn. Verbatim matters: the page ' +
        'argues to the SEAT, and a third of real titles match no archetype, so the title is ' +
        'kept as written rather than normalised into a role.',
      group: PERSON,
    }),
    personInitials: shortString('Person initials', {
      description: 'One or two letters for the avatar when there is no photograph.',
      group: PERSON,
    }),
    personAvatarColor: shortString('Person avatar colour', {
      description: 'The avatar background as a CSS colour, so a generated avatar is stable.',
      group: PERSON,
    }),
    personLinkedIn: url('Person LinkedIn URL', {
      description: 'Their LinkedIn profile URL, when one is known.',
      group: PERSON,
    }),

    // ---- Brand ------------------------------------------------------------
    brandAccentColor: shortString('Brand accent colour', {
      description:
        "The account's accent colour as a CSS colour. Inherited from the parent account page " +
        'at resolve time so the two pages read as one piece of work.',
      group: BRAND,
    }),
    customerLogo: url('Customer logo', {
      description:
        "An absolute URL to the account's logo. Named `customerLogo` to match `ABMExperience` " +
        'rather than the legacy `PersonPage.companyLogo`: one name for one thing across both ' +
        'experience types means the page writer has one mapping, not two.',
      group: BRAND,
    }),

    // ---- SEO --------------------------------------------------------------
    PageTitle: shortString('Page title', {
      description: 'The `<title>`, e.g. `Anna Lindqvist — Optimizely`.',
      group: SEO,
    }),
    MetaDescription: longString('Meta description', {
      description: 'The meta description. A bare long `string` — generated copy overruns any cap.',
      group: SEO,
    }),
    noIndex: boolean('No index', {
      description:
        'Keep the page out of search results. A person page names a real individual and quotes ' +
        'their engagement history, so the writer sets this to true as a matter of course. The ' +
        'CMS stores no property defaults, so "defaults to noindex" is a rule the writer keeps, ' +
        'not something the schema can promise.',
      group: SEO,
    }),

    // ---- Provenance -------------------------------------------------------
    componentPlan: longString('Component plan', {
      description:
        'The decision record, as JSON: `{rung, fit, resolvedAt, components: [{componentId, ' +
        'include, variant, why}]}`. A string and not typed fields because it is a machine ' +
        'record with a different author and lifecycle from the copy — the engine rewrites it ' +
        'wholesale on every re-resolve, and its schema moves with the engine rather than with ' +
        'the CMS.',
      group: PROVENANCE,
    }),
    template: shortString('Template', {
      description: 'Which blueprint produced this page — `person` today.',
      group: PROVENANCE,
    }),
    generatedAt: shortString('Generated at', {
      description:
        'When the page was last written, ISO 8601. A `shortString` rather than a `dateTime` to ' +
        'round-trip with the flat type it replaces.',
      group: PROVENANCE,
    }),
    generatedBy: shortString('Generated by', {
      description: 'What wrote it — the agent or workflow name, and its version.',
      group: PROVENANCE,
    }),
  }),
}

export default contentType
