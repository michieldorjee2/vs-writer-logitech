import { graphql, type ResultOf } from '../../../lib/optimizely/graphql'

// PortraitTextQuoteCardBlock is a SCOPED block that lives only inside the
// parent CarouselPortraitTextSection's Items array. The parent constructs
// props directly via JSX (forwarding the cardColor variant), so this uses
// the hybrid pattern: the colocated graphql() Fragment is exported for any
// template that wants to compose it via gql.tada, while Props are derived
// via ResultOf so callers can hand-construct without __typename.
export const PortraitTextQuoteCardBlockFragment = graphql(`
  fragment PortraitTextQuoteCardBlockFragment on PortraitTextQuoteCardBlock {
    __typename
    Badge
    Quote
    AuthorName
    AuthorTitle
    CompanyRef: Company {
      key
    }
  }
`)

export type CardColor =
  | 'lfgreen'
  | 'grass'
  | 'goodtogo'
  | 'primary_3'
  | 'tertiary_4'
  | 'ltblue'
  | 'ltpink'

export type PortraitTextQuoteCardBlockProps = ResultOf<
  typeof PortraitTextQuoteCardBlockFragment
> & {
  cardColor?: CardColor
  preview?: boolean
  locale?: string
}
