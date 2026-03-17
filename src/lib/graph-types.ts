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

    // Legacy block fields (may be empty objects from old content)
    Testimonials?: TestimonialRef[] | null;
}
