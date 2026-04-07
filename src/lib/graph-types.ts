export interface RichText {
    html: string;
}

export interface ImageRef {
    key: string;
    item: {
        _metadata: {
            url: { default: string };
            displayName?: string;
        };
    } | null;
}

export interface TestimonialRef {
    key: string;
    item: {
        Quote: string;
        AuthorName: string;
        AuthorTitle: string | null;
    } | null;
}

// --- Standalone block types (for block-level preview) ---

export interface HeroSectionBlock {
    __typename: 'HeroSectionBlock';
    _metadata: { key: string; url: { default: string } };
    Eyebrow: string | null;
    Headline: RichText | null;
    Subheadline: string | null;
    PrimaryCtaText: string | null;
    PrimaryCtaUrl: { default: string } | null;
}

export interface LogoBarBlock {
    __typename: 'LogoBarBlock';
    _metadata: { key: string; url: { default: string } };
    Heading: string | null;
    Logos: ImageRef[];
}

export interface FeatureSectionBlock {
    __typename: 'FeatureSectionBlock';
    _metadata: { key: string; url: { default: string } };
    Headline: RichText | null;
    Features: Array<{ Title: string; Description: RichText | null }>;
}

export interface ComparisonTableBlock {
    __typename: 'ComparisonTableBlock';
    _metadata: { key: string; url: { default: string } };
    OurLabel: string;
    CompetitorLabel: string;
    Rows: Array<{
        Category: string;
        OurValue: string | null;
        OurHighlight: boolean | null;
        CompetitorValue: string | null;
        CompetitorHighlight: boolean | null;
    }>;
}

export interface AnalystSectionBlock {
    __typename: 'AnalystSectionBlock';
    _metadata: { key: string; url: { default: string } };
    SectionHeading: RichText | null;
    Quote: string;
    AnalystSource: string;
    CtaText: string | null;
    CtaUrl: { default: string } | null;
}

export interface StandaloneTestimonialBlock {
    __typename: 'TestimonialBlock';
    _metadata: { key: string; url: { default: string } };
    Quote: string;
    AuthorName: string;
    AuthorTitle: string | null;
}

export interface PromoCardBlock {
    __typename: 'PromoCardBlock';
    _metadata: { key: string; url: { default: string } };
    Eyebrow: string | null;
    Heading: string;
    Description: string | null;
    CtaText: string | null;
    CtaUrl: { default: string } | null;
}

export interface ClosingCtaBlock {
    __typename: 'ClosingCtaBlock';
    _metadata: { key: string; url: { default: string } };
    Headline: RichText | null;
    Subheadline: string | null;
    PrimaryCtaText: string | null;
    PrimaryCtaUrl: { default: string } | null;
}

export type PreviewBlock =
    | HeroSectionBlock
    | LogoBarBlock
    | FeatureSectionBlock
    | ComparisonTableBlock
    | AnalystSectionBlock
    | StandaloneTestimonialBlock
    | PromoCardBlock
    | ClosingCtaBlock;

export type PreviewContent = CompetitorComparisonPage | PreviewBlock;

// --- Comparison row (flat on the page type) ---

export interface ComparisonRow {
    Category: string;
    OurValue: string | null;
    OurHighlight: boolean | null;
    CompetitorValue: string | null;
    CompetitorHighlight: boolean | null;
}

// --- Page type (flat content model) ---

export interface CompetitorComparisonPage {
    __typename?: 'CompetitorComparisonPage';
    _metadata: {
        key: string;
        url: { default: string; hierarchical: string };
        published: string;
    };
    PageTitle: string;
    MetaDescription: string;
    CanonicalUrl: { default: string } | null;

    // Hero section (flat fields)
    eyebrow: string | null;
    headline: string | null;
    subheadline: string | null;
    cta: string | null;
    link: { default: string } | null;

    // Comparison table (flat fields)
    comparisonHeadline: string | null;
    comparisonTableRows: ComparisonRow[] | null;

    // Analyst section (flat fields)
    analystHeadline: string | null;
    analystQuote: string | null;
    analystSource: string | null;
    analystCTA: string | null;
    analystCTALink: { default: string } | null;

    // Promo card (flat fields)
    promoEyebrow: string | null;
    promoHeading: string | null;
    promoDescription: string | null;
    promoCTA: string | null;
    promoCTALink: { default: string } | null;

    // Closing CTA (flat fields)
    endHeadline: string | null;
    endSubheadline: string | null;
    endCTA: string | null;
    endCTALink: { default: string } | null;

    // Testimonials (flat fields)
    testimonial1: string | null;
    testimonial1JobTitle: string | null;
    testimonial1Company: string | null;
    testimonial2: string | null;
    testimonial2JobTitle: string | null;
    testimonial2Company: string | null;

    // Logos (single content reference)
    Logos: { _metadata: { url: { default: string }; displayName?: string } } | null;

    // Feature section (still block-based)
    FeatureSection: {
        Headline: RichText | null;
        Features: Array<{
            Title: string;
            Description: RichText | null;
        }>;
    } | null;

    // FAQ section (still block-based list)
    FaqSection: Array<{
        _metadata?: { key: string };
        __typename?: string;
        _json?: unknown;
    }> | null;

    // ABM Hyper fields
    customerLogo: string | null;
    brandDomain: string | null;
    brandAccentColor: string | null;
    intelEyebrow: string | null;
    intelHeadline: string | null;
    competitorName: string | null;
    challengeHeadline: string | null;
    challengeScreenshotUrl: { default: string } | null;
    challengeScreenshotAlt: string | null;
    challengeBrowserUrl: string | null;
    comparisonDescription: string | null;
    logoWallCustomerSlot: string | null;
    roiTitle: string | null;
    roiDescription: string | null;
    roiProjectionValue: string | null;
    roiProjectionLabel: string | null;
    roiProjectionDetail: string | null;
    migrationTitle: string | null;
    migrationDescription: string | null;
    stickyCTAText: string | null;
    ctaTitle: string | null;
    ctaDescription: string | null;
    ctaButtonText: string | null;
    modalScheduleUrl: { default: string } | null;
    footerTagline: string | null;
    footerLegal: string | null;

    // ABM arrays
    intelStats: Array<{ Value: string; Label: string }> | null;
    stakeholders: Array<{
        Initials: string;
        Name: string;
        Role: string;
        LinkedInUrl: { default: string | null } | null;
        AvatarColor: string | null;
    }> | null;
    techStack: Array<{ Name: string; ColorTag: string | null }> | null;
    investments: Array<{ Name: string; IsPrimary: boolean | null }> | null;
    newsItems: Array<{
        Date: string;
        Headline: string;
        Url: { default: string | null } | null;
    }> | null;
    painPoints: Array<{ Title: string; Description: string }> | null;
    roiCards: Array<{
        Metric: string;
        Unit: string;
        Label: string;
        CitationText: string | null;
    }> | null;
    timelinePhases: Array<{
        Weeks: string;
        Title: string;
        Description: string;
        MarkerColor: string | null;
    }> | null;
    teamMembers: Array<{
        Initials: string;
        Name: string;
        Role: string;
        Email: string | null;
    }> | null;
    footerLinks: Array<{
        Text: string;
        Url: { default: string } | null;
    }> | null;
    analystCards: Array<{
        Badge: string;
        Source: string;
        Category: string;
        Url: { default: string | null } | null;
    }> | null;

    // Legacy block fields (may be empty objects from old content)
    Testimonials?: TestimonialRef[] | null;
}
