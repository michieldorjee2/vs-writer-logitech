/**
 * The Visual Builder read surface: the two experience queries, and the one normalisation
 * every caller of them needs.
 *
 * THE WRITE SHAPE AND THE READ SHAPE ARE DIFFERENT, and this file is the read one. The CMA
 * takes `node.component.contentType` + `node.nodes[]`; Graph returns a union —
 * `CompositionComponentNode` carries `component`, `CompositionStructureNode` carries `nodes`
 * — and upstream's `BlankExperience.graphql` aliases the three structure levels as
 * `rows` / `columns` / `elements`. That aliasing is what `src/cms/rendering/visual-builder.tsx`
 * walks, so it is reproduced here exactly.
 *
 * ONE COPY OF EACH QUERY, TWO CALLERS. `api/content.ts` serves them in production and
 * `vite.config.ts`'s dev proxy serves them locally. An earlier pair of queries in this repo
 * lived in both files as two copies that drifted apart: `vite.config.ts`'s `PAGE_QUERY` went on
 * selecting `CanonicalUrl`, `FeatureSection`, `OurHighlight` and `Weeks` — four fields the live
 * schema had dropped, the same four that 404'd 2,676 account pages — for weeks after
 * `api/content.ts` stopped. Two copies of a query is the defect, not a style preference.
 *
 * A SELECTION ON A FIELD GRAPH DOES NOT KNOW FAILS THE WHOLE QUERY: `data: null`, no partial
 * result. So these are separate operations from `PAGE_QUERY` and friends rather than fields
 * added to them, and `npm run check:graph` validates them against the live schema — it
 * resolves the `${…}` interpolations below before sending, so a fragment is checked too.
 *
 * Every field selected here was read off the live Showcase schema by introspection on
 * 2026-09-22 (`ABMExperience`, `PersonExperience` and the 27 element content types). Do not
 * add a field without checking it there first.
 */

/**
 * Every element content type a blueprint can place, as one inline-fragment set on
 * `_IComponent` — the interface `CompositionComponentNode.component` is typed as.
 *
 * `url`-shaped properties come back as a `ContentUrl` object and MUST be selected as
 * `{ default }`; the renderers want a string, which is what `normalizeExperienceItem()` below
 * turns them into. Upstream's `StatBlockFragment` aliases `StatDescription: Description`; ours
 * selects the CMS property name and lets the renderer read either, because `stat-block`'s
 * props declare both.
 */
export const COMPOSITION_ELEMENT_FRAGMENT = `
fragment CompositionElement on _IComponent {
  __typename
  ... on AbmAnalystCardElement { Badge Source Category Url { default } }
  ... on AbmChallengeShotElement { Headline ScreenshotUrl { default } ScreenshotAlt BrowserUrl }
  ... on AbmClosingCtaElement { Title Description ButtonText ScheduleUrl { default } }
  ... on AbmComparisonRowElement { Category OurValue OurDetail CompetitorValue CompetitorDetail }
  ... on AbmFrictionPointElement { Title Description }
  ... on FaqItemElement { Question Answer }
  ... on AbmNavRailElement { RailLines }
  ... on AbmNewsItemElement { NewsDate Headline Url { default } }
  ... on AbmRoiCardElement { Metric Unit Label CitationText }
  ... on AbmStakeholderElement {
    Name Role Initials AvatarColor EngagementTier EngagementNote PersonSlug CrmContactId
    LinkedInUrl { default }
  }
  ... on AbmStickyCtaElement { Text Url { default } }
  ... on AbmTeamMemberElement { Initials Name Role Email }
  ... on AbmTechStackItemElement { Name ColorTag }
  ... on AbmThesisElement { Headline Body Quote Attribution }
  ... on AbmTimelinePhaseElement { Title Description MarkerColor }
  ... on AbmUseCaseLaneElement { Lane Need Solution Outcome }
  ... on BlockquoteBlock { Quote AuthorName AuthorTitle }
  ... on ButtonBlock { ButtonText ButtonUrl { default } Variant }
  ... on CalloutBlock { CalloutType CalloutHeading CalloutText }
  ... on CardCustomerBlock {
    Headline Body ImageUrl { default } ImageAlt ResourceType Duration CompanyName
    CompanyLogoUrl { default } ResourceUrl { default }
  }
  ... on CardCustomerQuoteBlock {
    QuoteText Attribution ResourceType Duration CompanyName
    CompanyLogoUrl { default } ResourceUrl { default }
  }
  ... on CardPressBlock {
    Headline Body PublishDate CompanyName CompanyLogoUrl { default } ResourceUrl { default }
  }
  ... on ImageDisplayElement { ImageUrl { default } AltText Caption }
  ... on LinkItemElement { Label Url { default } }
  ... on SpacerBlock { SpaceDefault SpaceMd SpaceLg SpaceXl }
  ... on StackedHeadingElement { Text HeadingLevel }
  ... on StatBlock { StatValue Description }
  ... on TextContentElement { MainBody }
}
`;

/**
 * The composition tree, `experience > section > row > column > element`, with the structure
 * levels aliased the way the renderer reads them.
 *
 * `displaySettings` is selected at every level and comes back as an ARRAY of `{key, value}` —
 * it is written nested (`{displayTemplate, settings: {…}}`) and read flat, which is why
 * `parseDisplaySettings` exists and why no component should ever index into it as an object.
 *
 * A component placed directly on the experience (no section) is legal in Visual Builder, so
 * the top level also inlines `CompositionComponentNode`. No blueprint writes one today.
 */
const COMPOSITION_SELECTION = `
      composition {
        key nodeType displayName
        nodes {
          nodeType key displayName
          displaySettings { key value }
          ... on CompositionComponentNode { component { ...CompositionElement } }
          ... on CompositionStructureNode {
            section: component { __typename }
            rows: nodes {
              ... on CompositionStructureNode {
                nodeType key displayName
                displaySettings { key value }
                columns: nodes {
                  ... on CompositionStructureNode {
                    nodeType key displayName
                    displaySettings { key value }
                    elements: nodes {
                      nodeType key displayName
                      displaySettings { key value }
                      ... on CompositionComponentNode { component { ...CompositionElement } }
                    }
                  }
                }
              }
            }
          }
        }
      }
`;

/** The account page. Page-level properties only — every line of copy is in the composition. */
export const ABM_EXPERIENCE_QUERY = `
query GetABMExperience($slug: String!) {
  ABMExperience(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      salesforceAccountID companySlug companyName
      brandDomain brandAccentColor customerLogo { default } competitorName
      PageTitle MetaDescription noIndex
      componentPlan template generatedAt generatedBy
${COMPOSITION_SELECTION}
    }
  }
}
${COMPOSITION_ELEMENT_FRAGMENT}
`;

/** The person page. Same composition, a different identity block. */
export const PERSON_EXPERIENCE_QUERY = `
query GetPersonExperience($slug: String!) {
  PersonExperience(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      companySlug companyName personSlug personName personTitle personInitials
      personAvatarColor personLinkedIn { default } crmContactId
      brandAccentColor customerLogo { default }
      PageTitle MetaDescription noIndex
      componentPlan template generatedAt generatedBy
${COMPOSITION_SELECTION}
    }
  }
}
${COMPOSITION_ELEMENT_FRAGMENT}
`;

/** `__typename` -> the query that fetches it, in dispatch order. */
export const EXPERIENCE_QUERIES: Array<{ typeName: string; query: string; template: string }> = [
  { typeName: 'ABMExperience', query: ABM_EXPERIENCE_QUERY, template: 'abm-experience' },
  { typeName: 'PersonExperience', query: PERSON_EXPERIENCE_QUERY, template: 'person-experience' },
];

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * What the CMS calls a section, Graph calls `_Section`.
 *
 * A section node is written as `component: { contentType: 'BlankSection' }` and read back as
 * `section { __typename }` — and the typename Graph answers with is `_Section`, the interface
 * default, not `BlankSection`. Measured on the live endpoint; the section component is stored
 * inline on the node rather than as an instance of the content type, so Graph has no concrete
 * type to name.
 *
 * Nothing renders `_Section`: `component-factory.tsx` routes it to the Section lane (the name
 * contains 'Section'), the lane's registry is keyed on folder names — `blank-section` ->
 * `BlankSection` — and the miss returns null, which silently blanks EVERY band of the page.
 * So the name is repaired here, in the data layer, rather than by teaching the render chain a
 * Graph quirk.
 */
const SECTION_TYPENAME_ALIASES: Record<string, string> = {
  _Section: 'BlankSection',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A `url` property arrives as `{ default: 'https://…' }`; every renderer's props declare a
 * plain string. Collapse an object whose ONLY key is `default` to that value.
 *
 * The single-key test is what keeps `_metadata.url` intact — it selects `default` AND
 * `hierarchical`, so it is two keys and survives. `_metadata` is skipped outright anyway.
 */
function flattenContentUrls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(flattenContentUrls);
  if (!isPlainObject(value)) return value;

  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === 'default') {
    const inner = value.default;
    return typeof inner === 'string' || inner === null ? inner ?? undefined : inner;
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = key === '_metadata' ? child : flattenContentUrls(child);
  }
  return out;
}

/**
 * One Graph experience item, ready for `VisualBuilderExperience`.
 *
 * Two repairs, both of which are the difference between a page that renders and a page that
 * renders nothing: the `_Section` typename, and `ContentUrl` objects where a renderer wants a
 * string. Both are done once, server-side, so the dev proxy and the deployed function hand
 * the browser the same JSON.
 */
export function normalizeExperienceItem<T>(item: T): T {
  const normalized = flattenContentUrls(item);
  if (!isPlainObject(normalized)) return normalized as T;

  const composition = normalized.composition;
  if (isPlainObject(composition) && Array.isArray(composition.nodes)) {
    for (const node of composition.nodes) {
      if (!isPlainObject(node)) continue;
      const section = node.section;
      if (!isPlainObject(section)) continue;
      const typeName = section.__typename;
      if (typeof typeName === 'string' && SECTION_TYPENAME_ALIASES[typeName]) {
        section.__typename = SECTION_TYPENAME_ALIASES[typeName];
      }
    }
  }

  return normalized as T;
}
