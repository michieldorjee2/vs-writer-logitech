export const COMPETITOR_PAGE_QUERY = `
query GetCompetitorComparisonPage($slug: String!) {
  CompetitorComparisonPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata {
        key
        url { default hierarchical }
        published
      }
      PageTitle
      MetaDescription
      CanonicalUrl { default }
      HeroSection {
        Eyebrow
        Headline { html }
        Subheadline
        PrimaryCtaText
        PrimaryCtaUrl { default }
        BackgroundStyle
      }
      LogoBar {
        Heading
        Logos {
          key
          item {
            ... on ImageMedia {
              _metadata { url { default } displayName }
            }
          }
        }
      }
      FeatureSection {
        Headline { html }
        Features {
          Title
          Description { html }
        }
      }
      ComparisonTable {
        OurLabel
        CompetitorLabel
        Rows {
          Category
          OurValue { html }
          OurHighlight
          CompetitorValue { html }
          CompetitorHighlight
        }
      }
      AnalystSection {
        SectionHeading { html }
        Quote
        AnalystSource
        CtaText
        CtaUrl { default }
      }
      Testimonials {
        ... on TestimonialBlock {
          Quote
          AuthorName
          AuthorTitle
        }
      }
      FaqSection {
        key
        item {
          ... on AccordionBlock {
            Heading
            Items {
              ... on AccordionEntryBlock {
                Heading
                MainContent { html }
                OpenedByDefault
              }
            }
          }
        }
      }
      PromoCard {
        Eyebrow
        Heading
        Description
        CtaText
        CtaUrl { default }
      }
      ClosingCta {
        Headline { html }
        Subheadline
        PrimaryCtaText
        PrimaryCtaUrl { default }
        BackgroundStyle
      }
    }
  }
}
`;

export const ALL_PAGES_QUERY = `
query GetAllCompetitorPages {
  CompetitorComparisonPage(locale: en) {
    items {
      _metadata {
        key
        url { default hierarchical }
      }
    }
  }
}
`;
