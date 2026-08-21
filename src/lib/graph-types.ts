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
        /* Engagement fields, sourced from Salesforce by the account_page
           agent. All optional — pages written before these existed simply
           render the card as it always looked. */
        EngagementTier?: EngagementTier | null;
        EngagementNote?: string | null;
        /** Set once a person page exists; the card links to
         *  /{companySlug}/{PersonSlug} when present. */
        PersonSlug?: string | null;
        CrmContactId?: string | null;
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

    // X-ray sales overlay — per-section data-source annotations.
    // When the CMS doesn't return entries, the component falls back to a
    // built-in default list keyed by the section id (see xray-defaults.ts).
    xraySections?: Array<{
        SectionId: string;
        Title?: string | null;
        Tools?: string[] | null;
        Sources?: string[] | null;
        Notes?: string | null;
    }> | null;
}

// ============================================================================
// RetailCustomerPage — Maison Aurelle showcase template
// ============================================================================

export type RetailRegister = 'minimal' | 'archive' | 'discovery' | 'atelier' | 'family';
export type AppointmentVariant = 'named_appointment' | 'intro_appointment' | 'walk_in';

export interface RetailHeroBlock {
    imageUrl?: { default: string } | null;
    imageDirection?: string | null;
    line1: string;
    line2?: string | null;
}

export interface HeldForYouItem {
    name: string;
    descriptor: string;
    priceCents?: number | null;
    priceVisibility?: 'always' | 'on_hover' | 'hidden';
    imageUrl?: { default: string } | null;
    imageDirection?: string | null;
}

export interface HeldForYouBlock {
    header?: string | null;
    items: HeldForYouItem[];
    dynamic?: boolean;
}

export interface SetAsideItem {
    name: string;
    descriptor: string;
    privateProvenance?: string | null;
    imageUrl?: { default: string } | null;
}

export interface SetAsideBlock {
    items: SetAsideItem[];
    primaryAction?: string | null;
    secondaryAction?: string | null;
    dynamic?: boolean;
}

export interface AtelierNoteBlock {
    title?: string | null;
    body: string;
    cta?: string | null;
    imageUrl?: { default: string } | null;
    imageDirection?: string | null;
}

export interface SmallInvitationBlock {
    itemName: string;
    line: string;
    cta?: string | null;
    imageUrl?: { default: string } | null;
    itemImageUrl?: { default: string } | null;
    imageDirection?: string | null;
}

export interface AppointmentBlock {
    variant: AppointmentVariant;
    boutique?: string | null;
    stylistName?: string | null;
    slotPhrase?: string | null;
    slots?: string[] | null;
    primaryAction?: string | null;
    secondaryAction?: string | null;
    dynamic?: boolean;
}

// ----- per-customer components (added 2026-05-12) ------------------------

export interface RetailLetterBlock {
    dateLine?: string | null;
    greeting: string;
    paragraphs: string[];
    signoff?: string | null;
}

export interface RetailPolaroid {
    /** Graph returns ContentUrl as { default: "..." }. Code that consumes
     * a polaroid should call resolveUrl(p.imageUrl) for portability. */
    imageUrl: string | { default: string };
    caption: string;
    rotate?: number | null;
}

export interface RetailWornAnchor {
    name: string;
    qualifier?: string | null;
    season?: string | null;
    ownedImageUrl?: string | { default: string } | null;
    pairedName?: string | null;
    pairedQualifier?: string | null;
    pairedImageUrl?: string | { default: string } | null;
    pairedPriceLabel?: string | null;
}

export interface OpalQuestion {
    question: string;
    answer: string;
}

export interface CareTimelineEntry {
    itemName: string;
    kind?: string | null;
    dueLine?: string | null;
    status?: string | null;
    note?: string | null;
    maker?: string | null;
    imageUrl?: string | { default: string } | null;
}

export interface RetailCustomerPage {
    _metadata: {
        key: string;
        url: { default: string; hierarchical: string };
        published?: string | null;
    };
    template: 'retail';
    PageTitle: string;
    MetaDescription: string;
    CanonicalUrl?: { default: string } | null;
    customerSlug: string;
    customerDisplayName?: string | null;
    register: RetailRegister;
    monthStamp?: string | null;
    // Personalization scaffolding (per customer)
    primaryCity?: string | null;
    neighborhood?: string | null;
    stylistName?: string | null;
    stylistBoutique?: string | null;
    initials?: string | null;
    personalHeroLine1?: string | null;
    personalHeroLine2?: string | null;
    // Editorial copy
    editorialIntro?: string | null;
    stylistNoteBody?: string | null;
    stylistNoteSignedBy?: string | null;
    closingReflection?: string | null;
    // Composed components
    hero?: RetailHeroBlock | null;
    letter?: RetailLetterBlock | null;
    polaroids?: RetailPolaroid[] | null;
    heldForYou?: HeldForYouBlock | null;
    setAside?: SetAsideBlock | null;
    atelierNote?: AtelierNoteBlock | null;
    smallInvitation?: SmallInvitationBlock | null;
    appointment?: AppointmentBlock | null;
    wornLabel?: string | null;
    wornAnchors?: RetailWornAnchor[] | null;
    questions?: OpalQuestion[] | null;
    careLabel?: string | null;
    careTimeline?: CareTimelineEntry[] | null;
    makerNote?: string | null;
    footerLine?: string | null;
    deviceDegraded?: boolean;
    generatedAt?: string;
    generatedBy?: string;
    canvasVersion?: number;
}

// ============================================================================
// FinServPage — Meridian Bank financial-services template
// ============================================================================

/** Which audience the page is personalized for. B2B → "book a meeting",
 *  B2C → "open an account online". Drives CTA + profile-callout register. */
export type FinServAudience = 'b2b' | 'b2c';

export interface FinServCTA {
    label: string;
    href: string;
    /** Optional reassurance line (e.g. "No phone call required"). */
    note?: string | null;
}

export interface FinServHeroBlock {
    /** Personalized eyebrow — "For Carlos Freeman". */
    eyebrow?: string | null;
    headline: string;
    subhead?: string | null;
    cta?: FinServCTA | null;
    /** Reassurance chips under the CTA (e.g. "FDIC insured", "Opens in 3 min"). */
    highlights?: string[] | null;
}

export interface FinServScenarioBlock {
    label?: string | null;
    title: string;
    paragraphs: string[];
    /** Emphasised line pulled out of the narrative. */
    pullLine?: string | null;
}

export interface FinServProblem {
    title: string;
    description: string;
    /** Optional figure shown above the title (e.g. "4.6%", "11 days"). */
    stat?: string | null;
}

export interface FinServProblemsBlock {
    label?: string | null;
    heading?: string | null;
    items: FinServProblem[];
}

export interface FinServStep {
    title: string;
    description: string;
}

export interface FinServHowItWorksBlock {
    label?: string | null;
    heading?: string | null;
    steps: FinServStep[];
}

export interface FinServProfileBlock {
    quote: string;
    attribution?: string | null;
    role?: string | null;
    company?: string | null;
    /** Initials for the avatar chip (e.g. "C.F."). */
    initials?: string | null;
}

export interface FinServFooterBlock {
    legal?: string | null;
    /** Trust badges — "FDIC Member", "Equal Housing Lender", … */
    badges?: string[] | null;
}

export interface FinServStat {
    value: string;
    label: string;
}

/** A selectable account in the B2C savings-application modal. */
export interface FinServSavingsProduct {
    id?: string | null;
    name: string;
    apy: string;
    benefit: string;
}

export interface FinServSavingsConfig {
    products: FinServSavingsProduct[];
    defaultDeposit?: string | null;
}

/** B2B "book a meeting" modal config. */
export interface FinServMeetingConfig {
    contactName?: string | null;
    company?: string | null;
    slots?: string[] | null;
}

export interface FinServPage {
    _metadata: {
        key: string;
        url: { default: string; hierarchical: string };
        published?: string | null;
    };
    template: 'finserv';
    PageTitle: string;
    MetaDescription: string;
    CanonicalUrl?: { default: string } | null;
    /** Institution brand — "Meridian Bank". */
    brand: string;
    /** Wordmark tagline shown in header / footer. */
    tagline?: string | null;
    audience: FinServAudience;
    /** Flat slug used for routing + demo lookup. */
    targetSlug: string;
    /** Person the page is personalized for ("Carlos Freeman" / "Jordan Miller"). */
    targetName?: string | null;
    /** Header bar CTA. */
    headerCta?: FinServCTA | null;
    /** Brightstream nav links shown in the sticky header. */
    navLinks?: string[] | null;
    /** Full-bleed hero background image (photographic, Brightstream identity). */
    heroImageUrl?: string | null;
    /** Hero trust stats row ("2M+ customers", "$45B AUM", …). */
    stats?: FinServStat[] | null;
    /** B2C: drives the multi-step savings-application modal. */
    savings?: FinServSavingsConfig | null;
    /** B2B: drives the "book a meeting" modal. */
    meeting?: FinServMeetingConfig | null;
    // Composed blocks
    hero: FinServHeroBlock;
    scenario?: FinServScenarioBlock | null;
    problems?: FinServProblemsBlock | null;
    howItWorks?: FinServHowItWorksBlock | null;
    profile?: FinServProfileBlock | null;
    footer?: FinServFooterBlock | null;
    generatedAt?: string;
    generatedBy?: string;
}

// ============================================================================
// PersonPage — 1:1 page for one named buyer at a target account.
// Lives as a child of that account's CompetitorComparisonPage:
//   /{companySlug}/{personSlug}
// ============================================================================

/** How far into a relationship this person already is, per Salesforce.
 *  `key`     — named on an open opportunity, or an identified champion.
 *  `engaged` — real logged activity in the last 6 months.
 *  `known`   — appears in CRM or research, no recent activity.
 *  The tier decides whether the page continues a conversation or opens one. */
export type EngagementTier = 'key' | 'engaged' | 'known';

export interface PersonTouchpoint {
    Date: string | null;
    Kind: 'meeting' | 'call' | 'email' | 'demo' | 'event' | null;
    Summary: string | null;
    OptimizelyPerson: string | null;
}

export interface PersonRemitPoint {
    Title: string | null;
    Description: string | null;
    Metric: string | null;
}

export interface PersonPeerProof {
    Quote: string | null;
    PersonName: string | null;
    PersonTitle: string | null;
    Company: string | null;
    SourceUrl: { default: string } | string | null;
}

export interface PersonTeamMember {
    Initials: string | null;
    Name: string | null;
    Role: string | null;
    Email: string | null;
    AvatarColor: string | null;
    AlreadyMet: boolean | null;
}

export interface PersonPage {
    _metadata: {
        key: string;
        url: { default: string; hierarchical: string };
        published?: string | null;
    };
    template?: string | null;
    __template?: string | null;

    companySlug: string | null;
    companyName: string | null;
    personSlug: string | null;
    crmContactId?: string | null;

    PageTitle?: string | null;
    MetaDescription?: string | null;
    /** Person pages name a real individual, so they default to noindex. */
    noIndex?: boolean | null;

    personName: string | null;
    personTitle: string | null;
    personInitials: string | null;
    personLinkedIn?: { default: string } | string | null;
    personAvatarColor?: string | null;
    companyLogo?: { default: string } | string | null;
    brandAccentColor?: string | null;

    heroEyebrow?: string | null;
    heroHeadline?: string | null;
    heroSubheadline?: string | null;
    heroCtaText?: string | null;
    heroCtaUrl?: { default: string } | string | null;

    engagementTier?: EngagementTier | null;
    engagementHeadline?: string | null;
    engagementSummary?: string | null;
    touchpoints?: PersonTouchpoint[] | null;
    openOpportunityName?: string | null;
    openOpportunityStage?: string | null;
    openOpportunityDetail?: string | null;

    remitHeadline?: string | null;
    remitIntro?: string | null;
    remitPoints?: PersonRemitPoint[] | null;

    peerProofHeadline?: string | null;
    peerProof?: PersonPeerProof[] | null;

    teamHeadline?: string | null;
    team?: PersonTeamMember[] | null;

    ctaTitle?: string | null;
    ctaBody?: string | null;
    ctaButtonText?: string | null;
    meetingUrl?: { default: string } | string | null;
    footerLine?: string | null;

    generatedAt?: string | null;
    generatedBy?: string | null;
}

/** Normalize ContentUrl-or-string into a plain string. Graph returns
 *  `{ default: "..." }` for url-typed properties; demo content uses bare
 *  strings. Components consume strings only via this helper. */
export function resolveUrl(u: string | { default: string } | null | undefined): string | null {
  if (!u) return null;
  if (typeof u === "string") return u;
  return u.default || null;
}

