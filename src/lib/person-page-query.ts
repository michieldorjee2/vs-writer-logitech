/**
 * The person page (PersonPage, the 1:1 buyer page at `/<company>/<person>/`) as every renderer
 * reads it: one field list for the live address (api/content.ts, server/ssr-handler.tsx) and the
 * CMS preview of a draft (api/preview.ts), so the preview never draws a page the address would not.
 *
 * Only what the page shows (src/www/person-content.ts PERSON_FIELDS): the fields it never shows, the
 * Salesforce ones above all (the contact id, the open opportunity, the touchpoint log, the
 * engagement tier, who has met them), are not fetched, so they are in neither the page's source
 * nor /api/content. Quotes from our own conversations are dropped on the server (publicPersonPage).
 *
 * A selection on one field Graph does not know fails the WHOLE query and every person page 404s.
 * Check the registered type before adding a field, and run `npm run check:graph` (it reads this file).
 */
const PERSON_PAGE_FIELDS = `
    _metadata { key url { default hierarchical } published lastModified }
    template
    PageTitle MetaDescription noIndex
    companySlug companyName personSlug
    personName personTitle
    personLinkedIn { default }
    companyLogo { default }
    heroEyebrow heroHeadline heroSubheadline heroCtaText
    remitHeadline
    remitPoints { Title Description Metric }
    roleFrame
    noteBody noteSignedBy noteSignedByRole noteSignedByInitials noteDate
    provenance { Register Text SourceLabel SourceUrl { default } }
    scorecardHeadline
    scorecard { Measure WhyHard WhatChanges Metric }
    solutionsHeadline solutionsIntro
    solutions { Product Headline Body WhyFirst }
    keyNumberValue keyNumberPrefix keyNumberSuffix keyNumberLabel keyNumberDetail
    keyNumberCitationUrl { default }
    peerProofHeadline
    peerProof { Quote PersonName PersonTitle Company SourceUrl { default } }
    teamHeadline
    team { Initials Name Role Email AvatarColor }
    ctaTitle ctaBody ctaButtonText meetingUrl { default }
    footerLine
`;

/** The page at a route: `/logitech/ben-yu/`. */
export const PERSON_PAGE_QUERY = `
query GetPersonPage($slug: String!) {
  PersonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
${PERSON_PAGE_FIELDS}
    }
  }
}
`;

/** One version of a page by its key, as the CMS previews a draft (with the editor's preview token). */
export const PERSON_PAGE_PREVIEW_QUERY = `
query GetPersonPagePreview($key: String!, $ver: String, $loc: [Locales]) {
  PersonPage(
    where: { _metadata: { key: { eq: $key }, version: { eq: $ver } } }
    locale: $loc
  ) {
    items {
${PERSON_PAGE_FIELDS}
    }
  }
}
`;

/**
 * What the CTA ping (api/cta-ping.ts) reads of a person page: who it is for, the account, and our
 * team on it. Nothing the visitor sends decides who is messaged; this does.
 */
export const PERSON_TEAM_QUERY = `
query GetPersonPageTeam($slug: String!) {
  PersonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { url { default hierarchical } }
      companyName personName
      team { Initials Name Role Email }
    }
  }
}
`;
