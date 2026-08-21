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

// ============================================================================
// RetailCustomerPage — Maison Aurelle showcase template
// ============================================================================

export const RETAIL_PAGE_QUERY = `
query GetRetailPage($slug: String!) {
  RetailCustomerPage(
    where: { _metadata: { url: { hierarchical: { eq: $slug } } } }
    locale: en
  ) {
    items {
      _metadata { key url { default hierarchical } published }
      template
      PageTitle MetaDescription CanonicalUrl { default }
      customerSlug customerDisplayName register monthStamp
      primaryCity neighborhood stylistName stylistBoutique
      initials personalHeroLine1 personalHeroLine2
      editorialIntro stylistNoteBody stylistNoteSignedBy closingReflection
      hero {
        imageUrl { default }
        imageDirection
        line1
        line2
      }
      letter {
        dateLine
        greeting
        paragraphs
        signoff
      }
      polaroids {
        imageUrl { default }
        caption
        rotate
      }
      heldForYou {
        header
        dynamic
        items {
          name descriptor priceCents priceVisibility
          imageUrl { default }
          imageDirection
        }
      }
      setAside {
        primaryAction secondaryAction dynamic
        items {
          name descriptor privateProvenance
          imageUrl { default }
        }
      }
      atelierNote {
        title body cta
        imageUrl { default }
        imageDirection
      }
      smallInvitation {
        itemName line cta
        imageUrl { default }
        imageDirection
      }
      appointment {
        variant boutique stylistName slotPhrase slots
        primaryAction secondaryAction dynamic
      }
      wornLabel
      wornAnchors {
        name qualifier season ownedImageUrl { default }
        pairedName pairedQualifier pairedImageUrl { default } pairedPriceLabel
      }
      questions {
        question answer
      }
      careLabel
      careTimeline {
        itemName kind dueLine status note maker
        imageUrl { default }
      }
      makerNote
      footerLine
      deviceDegraded generatedAt generatedBy canvasVersion
    }
  }
}
`;
