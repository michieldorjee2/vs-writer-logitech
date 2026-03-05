import { lazy, Suspense } from 'react';
import parse from 'html-react-parser';
import HeroGradient from './HeroGradient/hero-gradient.component';
import { Button } from './Button/button-block.component';
import LogoGrid from './LogoGrid/logo-grid.component';
import type { CompetitorComparisonPage } from '../lib/graph-types';

const ComparisonTable = lazy(() => import('./ComparisonTable/comparison-table.component'));
const QuoteList = lazy(() => import('./QuoteList/quote-list.component'));
const Accordion = lazy(() => import('./Accordion/accordion.component'));
const HighlightSection = lazy(() => import('./Highlight/highlight.component'));
const GridOverlay = lazy(() => import('./GridOverlay/_grid-overlay'));

// --- Data mappers ---

/**
 * Graph rich text comes as <p>…</p>. Promote to the given heading tag
 * and style <em> with the brand blue color (matching the hardcoded original).
 */
function richTextAsTag(html: string, tag: 'h1' | 'h2' | 'p' = 'p'): string {
    return html
        .replace(/<p>/g, `<${tag}>`)
        .replace(/<\/p>/g, `</${tag}>`)
        .replace(/<em>/g, '<em class="not-italic text-optimizely-blue">');
}

/** Strip wrapping <p> tags and extract inner text */
function stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent?.trim() ?? '';
}

/** Parse a rich-text html value into a boolean or string for the comparison table */
function parseComparisonValue(html: string): boolean | string {
    const text = stripHtml(html).toLowerCase();
    if (text === 'yes' || text === '✓' || text === 'true') return true;
    if (text === 'no' || text === '✗' || text === 'false' || text === '') return false;
    // Return the original text (capitalized) for "Limited", "Partial", etc.
    return stripHtml(html);
}

function mapComparisonRows(page: CompetitorComparisonPage) {
    return page.ComparisonTable.Rows.map((row) => ({
        feature: row.Category,
        opal: parseComparisonValue(row.OurValue.html),
        writer: parseComparisonValue(row.CompetitorValue.html),
    }));
}

const quoteThemes = ['blue', 'light-blue', 'purple', 'green', 'orange'] as const;
const quoteMarkColors: Record<string, string> = {
    blue: '#194BFF',
    'light-blue': '#00CCFF',
    purple: '#9E4AFF',
    green: '#3be081',
    orange: '#ff8110',
};

function mapTestimonials(page: CompetitorComparisonPage) {
    return page.Testimonials.map((t, i) => ({
        quote: t.Quote,
        spokesperson: t.AuthorName,
        jobTitle: t.AuthorTitle ?? '',
        company: '',
        gradientColor: '',
        quoteMarksColor: quoteMarkColors[quoteThemes[i % quoteThemes.length]],
        theme: quoteThemes[i % quoteThemes.length],
        size: 'default' as const,
        quotesLength: page.Testimonials.length,
        index: i,
    }));
}

function mapFaqItems(page: CompetitorComparisonPage) {
    const items = page.FaqSection?.item?.Items;
    if (!items || items.length === 0) return null;
    return items.map((item) => ({
        title: item.Heading,
        defaultOpen: item.OpenedByDefault,
        children: <div className="rte">{parse(item.MainContent.html)}</div>,
    }));
}

function mapLogoMedia(page: CompetitorComparisonPage) {
    const logos = page.LogoBar?.Logos;
    if (!logos || logos.length === 0) return null;
    return logos
        .filter((l) => l.item != null)
        .map((l) => ({
            asset: {
                type: 'image' as const,
                assetAttributes: {
                    url: l.item!._metadata.url.default,
                    alt: l.item!._metadata.displayName ?? '',
                },
            },
        }));
}

// --- Default fallback logos (same as original hardcoded page) ---
const fallbackLogos = [
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/f58ea35175bd4e25bf399e36d284d6f9/logo_salesforce_white_100x300.svg', alt: 'Salesforce' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/854ad08b9a5642f1bbda87fdfe6b81d4/nike-logo-icon_light.svg', alt: 'Nike' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/638fd78be5cc45978c7d8b42bf0d31eb/zoom-logo-white.svg', alt: 'Zoom' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/04dd25ba79f04298a76e1fb50742a117/shell-logo-light.svg', alt: 'Shell' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/71dcdc4b907a414ba7057d2624c2883b/dolby-logo-white.svg', alt: 'Dolby' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/c3fc7cbd589947cbb8579ce42d6bf8ec/logo_new-era_white_100x300.svg', alt: 'NEW ERA' } } },
];

// --- Page Component ---

interface Props {
    page: CompetitorComparisonPage;
}

const DynamicComparisonPage = ({ page }: Props) => {
    const hero = page.HeroSection;
    const logoMedia = mapLogoMedia(page) ?? fallbackLogos;
    const comparisonRows = mapComparisonRows(page);
    const testimonials = mapTestimonials(page);
    const faqItems = mapFaqItems(page);
    const analyst = page.AnalystSection;
    const promo = page.PromoCard;
    const closing = page.ClosingCta;
    const features = page.FeatureSection;

    return (
        <Suspense fallback={null}>
            {/* ========== SECTION 1: Hero ========== */}
            <HeroGradient>
                {hero.Eyebrow && <p className="t-overline mb-4">{hero.Eyebrow}</p>}
                <div className="rte mb-6">{parse(richTextAsTag(hero.Headline.html, 'h1'))}</div>
                {hero.Subheadline && (
                    <p className="mb-8 text-xl text-gray-300">{hero.Subheadline}</p>
                )}
                <Button href={hero.PrimaryCtaUrl.default} buttonStyle="primary" icon="arrowRight">
                    {hero.PrimaryCtaText}
                </Button>
            </HeroGradient>

            {/* ========== SECTION 2: Logo Grid ========== */}
            <section className="outer-padding py-12">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            {page.LogoBar?.Heading && (
                                <p className="mb-6 text-center text-sm uppercase tracking-widest text-gray-400">
                                    {page.LogoBar.Heading}
                                </p>
                            )}
                            <LogoGrid nonLogos={false} logoMedia={logoMedia} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 3: Value Proposition / Features ========== */}
            {features && (
                <section className="outer-padding relative py-16 lg:py-24">
                    <GridOverlay opacity={0} highlightOpacity={0.08} fade />
                    <div className="container relative z-10">
                        <div className="row">
                            <div className="col-12 lg:col-8 lg:offset-2">
                                <div className="rte mb-8">{parse(richTextAsTag(features.Headline.html, 'h2'))}</div>
                                <div className="grid gap-6 md:grid-cols-2">
                                    {features.Features.map((feat, i) => (
                                        <div key={i} className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-6">
                                            <h3 className="mb-2 text-xl font-medium text-white">{feat.Title}</h3>
                                            <div className="rte text-base text-gray-300">{parse(feat.Description.html)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ========== SECTION 4: Comparison Table ========== */}
            <section className="outer-padding py-16 lg:py-24">
                <div className="container">
                    <div className="row">
                        <div className="col-12 lg:col-10 lg:offset-1">
                            <h2 className="mb-3 text-center text-4xl font-medium text-white">
                                Side-by-side: {page.ComparisonTable.OurLabel} vs {page.ComparisonTable.CompetitorLabel}
                            </h2>
                            <ComparisonTable
                                rows={comparisonRows}
                                opalLabel={page.ComparisonTable.OurLabel}
                                writerLabel={page.ComparisonTable.CompetitorLabel}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 5: Analyst Recognition ========== */}
            {analyst && (
                <HighlightSection>
                    {analyst.SectionHeading && (
                        <div className="rte mb-4">{parse(richTextAsTag(analyst.SectionHeading.html, 'h2'))}</div>
                    )}
                    <p className="t-subtitle mb-6">{analyst.Quote}</p>
                    {analyst.AnalystSource && (
                        <p className="mb-6 text-sm text-gray-400">&mdash; {analyst.AnalystSource}</p>
                    )}
                    {analyst.CtaText && analyst.CtaUrl && (
                        <Button href={analyst.CtaUrl.default} buttonStyle="secondary" icon="arrowRight">
                            {analyst.CtaText}
                        </Button>
                    )}
                </HighlightSection>
            )}

            {/* ========== SECTION 6: Testimonials ========== */}
            {testimonials.length > 0 && (
                <section className="outer-padding py-16 lg:py-24">
                    <QuoteList quotes={testimonials} />
                </section>
            )}

            {/* ========== SECTION 7: FAQ ========== */}
            {faqItems && faqItems.length > 0 && (
                <section className="outer-padding py-16 lg:py-24">
                    <div className="container">
                        <div className="row">
                            <div className="col-12 lg:col-8 lg:offset-2">
                                {page.FaqSection?.item?.Heading && (
                                    <h2 className="mb-8 text-center text-4xl font-medium text-white">
                                        {page.FaqSection.item.Heading}
                                    </h2>
                                )}
                                <Accordion accordionItems={faqItems} backgroundStyle={true} />
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ========== SECTION 8: Promo Card ========== */}
            {promo && (
                <section className="outer-padding py-16 lg:py-24">
                    <div className="container">
                        <div className="row">
                            <div className="col-12 lg:col-8 lg:offset-2">
                                <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-8 lg:p-12">
                                    {promo.Eyebrow && <p className="t-overline mb-4">{promo.Eyebrow}</p>}
                                    <h2 className="mb-4 text-3xl font-medium text-white">{promo.Heading}</h2>
                                    {promo.Description && (
                                        <p className="mb-6 text-lg text-gray-300">{promo.Description}</p>
                                    )}
                                    {promo.CtaText && promo.CtaUrl && (
                                        <Button href={promo.CtaUrl.default} buttonStyle="emphasized" icon="arrowRight">
                                            {promo.CtaText}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ========== SECTION 9: Final CTA ========== */}
            <HighlightSection>
                <div className="rte mb-4">{parse(richTextAsTag(closing.Headline.html, 'h2'))}</div>
                {closing.Subheadline && (
                    <p className="t-subtitle mb-8">{closing.Subheadline}</p>
                )}
                <Button href={closing.PrimaryCtaUrl.default} buttonStyle="primary" icon="arrowRight">
                    {closing.PrimaryCtaText}
                </Button>
            </HighlightSection>
        </Suspense>
    );
};

export default DynamicComparisonPage;
