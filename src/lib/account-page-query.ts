/**
 * The account page (CompetitorComparisonPage) as every renderer reads it: one field list for the
 * live address (api/content.ts, server/ssr-handler.tsx) and the CMS preview of a draft
 * (api/preview.ts), so the preview can never draw a page the live address would not.
 *
 * A selection on one field Graph does not know fails the WHOLE query, and every page 404s. Check
 * the registered type before adding a field, and run `npm run check:graph` (it reads this file).
 */
const ACCOUNT_PAGE_FIELDS = `
    _metadata { key url { default hierarchical } published lastModified }
    PageTitle MetaDescription
    eyebrow headline subheadline cta link { default }
    comparisonHeadline
    comparisonTableRows { Category OurValue CompetitorValue }
    analystHeadline analystQuote analystSource analystCTA analystCTALink { default }
    promoEyebrow promoHeading promoDescription promoCTA promoCTALink { default }
    endHeadline endSubheadline endCTA endCTALink { default }
    testimonial1 testimonial1JobTitle testimonial1Company
    testimonial2 testimonial2JobTitle testimonial2Company
    customerLogo brandDomain intelEyebrow intelHeadline competitorName
    challengeHeadline challengeScreenshotUrl { default } challengeScreenshotAlt challengeBrowserUrl
    comparisonDescription logoWallCustomerSlot
    roiTitle roiDescription roiProjectionValue roiProjectionLabel roiProjectionDetail
    migrationTitle migrationDescription stickyCTAText
    ctaTitle ctaDescription ctaButtonText modalScheduleUrl { default }
    footerTagline footerLegal
    intelStats { Value Label }
    stakeholders { Initials Name Role LinkedInUrl { default } AvatarColor PersonSlug }
    techStack { Name ColorTag }
    investments { Name IsPrimary }
    newsItems { Date Headline Url { default } }
    painPoints { Title Description }
    roiCards { Metric Unit Label CitationText }
    timelinePhases { Title Description MarkerColor }
    teamMembers { Initials Name Role Email }
    footerLinks { Text Url { default } }
    analystCards { Badge Source Category Url { default } }
`;

/** The page at a route: `/heineken/`. */
export const ACCOUNT_PAGE_QUERY = `
query GetPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
${ACCOUNT_PAGE_FIELDS}
    }
  }
}
`;

/**
 * One version of a page by its key, as the CMS previews a draft. With the editor's preview token
 * Graph returns that draft; with the site's key, only what is published.
 */
export const ACCOUNT_PAGE_PREVIEW_QUERY = `
query GetPagePreview($key: String!, $ver: String, $loc: [Locales]) {
  CompetitorComparisonPage(
    where: { _metadata: { key: { eq: $key }, version: { eq: $ver } } }
    locale: $loc
  ) {
    items {
${ACCOUNT_PAGE_FIELDS}
    }
  }
}
`;

/**
 * What the CTA ping (api/cta-ping.ts) reads of the page at a route: enough to name the account
 * (src/lib/page-identity.ts deriveCustomerName) and our team on it. Nothing the visitor sends
 * decides who is messaged; this does.
 */
export const ACCOUNT_TEAM_QUERY = `
query GetPageTeam($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { url { default hierarchical } }
      eyebrow intelHeadline
      teamMembers { Initials Name Role Email }
    }
  }
}
`;
