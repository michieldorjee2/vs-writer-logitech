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

export interface CompetitorComparisonPage {
    _metadata: {
        key: string;
        url: { default: string; hierarchical: string };
        published: string;
    };
    PageTitle: string;
    MetaDescription: string;
    CanonicalUrl: { default: string } | null;
    HeroSection: {
        Eyebrow: string | null;
        Headline: RichText | null;
        Subheadline: string | null;
        PrimaryCtaText: string | null;
        PrimaryCtaUrl: { default: string } | null;
    } | null;
    LogoBar: {
        Heading: string | null;
        Logos: ImageRef[];
    } | null;
    FeatureSection: {
        Headline: RichText | null;
        Features: Array<{
            Title: string;
            Description: RichText | null;
        }>;
    } | null;
    ComparisonTable: {
        OurLabel: string;
        CompetitorLabel: string;
        Rows: Array<{
            Category: string;
            OurValue: RichText | null;
            OurHighlight: boolean;
            CompetitorValue: RichText | null;
            CompetitorHighlight: boolean;
        }>;
    } | null;
    AnalystSection: {
        SectionHeading: RichText | null;
        Quote: string;
        AnalystSource: string;
        CtaText: string | null;
        CtaUrl: { default: string } | null;
    } | null;
    Testimonials: TestimonialRef[] | null;
    FaqSection: {
        key: string | null;
        item: {
            __typename?: string;
            _json?: unknown;
        } | null;
    } | null;
    PromoCard: {
        Eyebrow: string | null;
        Heading: string;
        Description: string | null;
        CtaText: string | null;
        CtaUrl: { default: string } | null;
    } | null;
    ClosingCta: {
        Headline: RichText | null;
        Subheadline: string | null;
        PrimaryCtaText: string | null;
        PrimaryCtaUrl: { default: string } | null;
    } | null;
}
