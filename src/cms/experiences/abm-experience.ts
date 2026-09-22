/**
 * `ABMExperience` — the account page, as an experience.
 *
 * This replaces `CompetitorComparisonPage` FOR NEW PAGES. The 2,695 pages already on that
 * type are not migrated by creating this one: `CompetitorComparisonPage` is frozen (it is on
 * `apply.ts`'s denylist and will never be created, patched or blueprinted), and it keeps
 * serving every page written before this type existed.
 *
 * THE POINT OF THE TYPE IS WHAT IT DOES NOT CARRY. `CompetitorComparisonPage` holds 67
 * properties, and about sixty of them are copy: `headline`, `subheadline`, `intelHeadline`,
 * `roiTitle`, `challengeHeadline`, `stickyCTAText`, `painPoints[]`, `comparisonTableRows[]`,
 * and so on. Every one of those moves into the composition as an element node, so this type
 * carries only what is true of the PAGE rather than of a section of it: which account it is
 * for, how it is branded, what the search engines should see, and where it came from.
 *
 * Three consequences worth stating, because each one is a thing the flat type could not do:
 *
 *   1. A withheld section is visible. On the flat type a missing comparison table and a
 *      deliberately suppressed one are indistinguishable — both are a null field. In a
 *      composition the section is simply absent from the tree, and `componentPlan` says why.
 *   2. A section can repeat. `comparisonTableRows` was one array with one meaning; a
 *      composition can hold two comparison tables, or five stat pills and then three more,
 *      without a schema change.
 *   3. An editor can reorder the page. Section order on the flat type was hard-coded in the
 *      renderer. Here it is data, and Visual Builder edits it.
 *
 * NO `richText` ANYWHERE. `format: 'richText'` cannot be created through the API on any
 * baseType or behaviour, so body copy is a bare long `string`. That is also the safer fit for
 * generated prose: a `richText` property validates its payload as HTML, and a bare `<6` or a
 * stray `<headline>` in a generated sentence would fail the whole write.
 *
 * NOTHING IS `required`. The CMS's enforcement of `required` on a create was never measured
 * against this instance, and a page is written in two steps — create the content item, then
 * PATCH the composition onto its version. A required property that the first step cannot yet
 * satisfy would turn a two-step write into a 400. The match key is enforced by the writer
 * (Phase 3 refuses to mint a page without a `salesforceAccountID`), not by the schema.
 *
 * ROUTING. `/{companySlug}/` — the account page is the parent, and a `PersonExperience` for
 * someone at that account is its child at `/{companySlug}/{personSlug}/`.
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
const BRAND = 'Brand'
const SEO = 'SEO'
const PROVENANCE = 'Provenance'

const contentType: ContentTypeDefinition = {
  key: 'ABMExperience',
  displayName: 'ABM Experience',
  description:
    'A Visual Builder account page. Page-level identity, branding, meta and provenance only — ' +
    'every line of copy lives in the composition as an element node.',
  baseType: '_experience',
  properties: sequence({
    // ---- Identity: who the page is for ------------------------------------
    salesforceAccountID: shortString('Salesforce account ID', {
      description:
        'The Salesforce account id this page was written for, `001`-prefixed. THE MATCH KEY: ' +
        'the decision engine, the CRM, the nightly refresh and every report join on it, so a ' +
        'page without one cannot be attributed to an account and cannot be found again by the ' +
        'job that refreshes it. A slug is a URL, not an identity — two accounts can share a ' +
        'company name, and a company can be renamed.',
      group: IDENTITY,
    }),
    companySlug: shortString('Company slug', {
      description:
        'The URL segment for the account, e.g. `siemens-energy`. The page lives at ' +
        '`/{companySlug}/` and every person page for the account hangs beneath it.',
      group: IDENTITY,
    }),
    companyName: shortString('Company name', {
      description: 'The account name as the customer writes it, used in headings and the title.',
      group: IDENTITY,
    }),

    // ---- Brand: how the page dresses itself -------------------------------
    brandDomain: shortString('Brand domain', {
      description:
        "The customer's own domain, e.g. `siemens-energy.com`. Used to source a logo and to " +
        'frame the screenshot the challenge section argues against.',
      group: BRAND,
    }),
    brandAccentColor: shortString('Brand accent colour', {
      description:
        "The customer's accent colour as a CSS colour, e.g. `#009999`. One value: it tints the " +
        'hero, the rules and the markers so the page reads as being about them rather than about us.',
      group: BRAND,
    }),
    customerLogo: url('Customer logo', {
      description:
        "An absolute URL to the customer's logo. A `url` property rather than a content " +
        'reference on purpose — a reference is a 400 on an element and an unnecessary ' +
        'indirection here, since the asset is fetched, not managed.',
      group: BRAND,
    }),
    competitorName: shortString('Competitor name', {
      description:
        'The incumbent this page displaces, when there is one. EMPTY IS MEANINGFUL: the ' +
        'use-case blueprint names no competitor at all, and a page that names one it has no ' +
        'confirmed signal for is the mistake this field exists to make visible.',
      group: BRAND,
    }),

    // ---- SEO --------------------------------------------------------------
    PageTitle: shortString('Page title', {
      description: 'The `<title>`, e.g. `Siemens Energy — Optimizely`.',
      group: SEO,
    }),
    MetaDescription: longString('Meta description', {
      description:
        'The meta description. A bare long `string`: generated copy overruns any cap worth ' +
        'setting, and a `maxLength` that rejects the write is worse than a long description.',
      group: SEO,
    }),
    noIndex: boolean('No index', {
      description:
        'Keep the page out of search results. An account page names a real company and often ' +
        'a real named individual, so the writer sets this rather than relying on a default — ' +
        'the CMS stores no property defaults.',
      group: SEO,
    }),

    // ---- Provenance: the decision record ----------------------------------
    componentPlan: longString('Component plan', {
      description:
        'THE DECISION RECORD, as JSON: `{rung, fit, resolvedAt, components: [{componentId, ' +
        'include, variant, why}]}`. It answers "which sections does this page show, in which ' +
        'variant, and why" — including the sections deliberately WITHHELD, which is the case ' +
        'the pilot got wrong and which no amount of field-sniffing can see. A string and not ' +
        'typed fields because it is a machine record with a different author and a different ' +
        'lifecycle from the copy: the engine rewrites it wholesale on every re-resolve, ' +
        'nothing renders it directly, and its schema moves with the engine rather than with ' +
        'the CMS. Modelling it as properties would mean a content-type migration every time ' +
        'the ladder learns a new field, on a type that takes ~40 minutes to reach Graph.',
      group: PROVENANCE,
    }),
    template: shortString('Template', {
      description:
        'Which blueprint produced this page: `abm-takeout`, `use-case-default` or ' +
        '`comparison`. Recorded because the composition alone cannot say what the page was ' +
        'MEANT to be once an editor has moved a section.',
      group: PROVENANCE,
    }),
    generatedAt: shortString('Generated at', {
      description:
        'When the page was last written, ISO 8601. A `shortString` rather than a `dateTime` so ' +
        'it round-trips byte-identically with the flat type it replaces, whose `generatedAt` ' +
        'is a string.',
      group: PROVENANCE,
    }),
    generatedBy: shortString('Generated by', {
      description:
        'What wrote it — the agent or workflow name, and its version. The first question asked ' +
        'of a page that came out wrong.',
      group: PROVENANCE,
    }),
  }),
}

export default contentType
