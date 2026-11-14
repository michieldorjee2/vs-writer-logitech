/**
 * What the Teams photo route (api/page-photo.ts) reads of a page to know who is on it: the page's own
 * key (so a CMS publish or delete of it empties its photos from the edge cache too) and the people it
 * draws, and nothing else. An offer page's hosts are read with the offer page query
 * (src/lib/experience-queries.ts), which is the one the page itself is drawn from.
 *
 * Their own operations, not fields on the page queries: a selection on a field Graph does not know
 * fails the WHOLE query, so a change here must never be able to take a page down. `npm run check:graph`
 * validates them against the live schema.
 */

/** An account page: `teamMembers`, Optimizely's people on it. */
export const PAGE_PHOTOS_ACCOUNT_QUERY = `
query GetPagePhotosAccount($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key }
      teamMembers { Name Role Email }
    }
  }
}
`;

/** A person page: `team`, Optimizely's people on it. */
export const PAGE_PHOTOS_PERSON_QUERY = `
query GetPagePhotosPerson($slug: String!) {
  PersonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key }
      team { Name Role Email }
    }
  }
}
`;
