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
        Headline: RichText;
        Subheadline: string | null;
        PrimaryCtaText: string;
        PrimaryCtaUrl: { default: string };
        BackgroundStyle: string | null;
    };
    LogoBar: {
        Heading: string | null;
        Logos: ImageRef[];
    } | null;
    FeatureSection: {
        Headline: RichText;
        Features: Array<{
            Title: string;
            Description: RichText;
            Icon?: ImageRef | null;
        }>;
    } | null;
    ComparisonTable: {
        OurLabel: string;
        CompetitorLabel: string;
        Rows: Array<{
            Category: string;
            OurValue: RichText;
            OurHighlight: boolean;
            CompetitorValue: RichText;
            CompetitorHighlight: boolean;
        }>;
    };
    AnalystSection: {
        SectionHeading: RichText | null;
        Quote: string;
        AnalystSource: string;
        CtaText: string | null;
        CtaUrl: { default: string } | null;
    } | null;
    Testimonials: Array<{
        Quote: string;
        AuthorName: string;
        AuthorTitle: string | null;
    }>;
    FaqSection: {
        key: string | null;
        item: {
            Heading?: string | null;
            Items?: Array<{
                Heading: string;
                MainContent: RichText;
                OpenedByDefault: boolean;
            }>;
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
        Headline: RichText;
        Subheadline: string | null;
        PrimaryCtaText: string;
        PrimaryCtaUrl: { default: string };
        BackgroundStyle: string | null;
    };
}
