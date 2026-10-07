import { lazy, Suspense } from 'react';
import HeroGradient from './HeroGradient/hero-gradient.component';
import { Button } from './Button/button-block.component';
import LogoGrid from './LogoGrid/logo-grid.component';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import { mapComparisonRows } from '../lib/content-mappers';
import { useOdpTracking } from '../hooks/useOdpTracking';

const ComparisonTable = lazy(() => import('./ComparisonTable/comparison-table.component'));
const QuoteList = lazy(() => import('./QuoteList/quote-list.component'));
const HighlightSection = lazy(() => import('./Highlight/highlight.component'));

const quoteThemes = ['blue', 'light-blue', 'purple', 'green', 'orange'] as const;
const quoteMarkColors: Record<string, string> = {
    blue: '#ABFF44',
    'light-blue': '#91DBDA',
    purple: '#FF99B6',
    green: '#3AB533',
    orange: '#ff8110',
};

function mapTestimonials(page: CompetitorComparisonPage) {
    const testimonials: Array<{
        quote: string;
        spokesperson: string;
        jobTitle: string;
        company: string;
    }> = [];

    if (page.testimonial1) {
        testimonials.push({
            quote: page.testimonial1,
            spokesperson: page.testimonial1JobTitle ?? '',
            jobTitle: page.testimonial1Company ?? '',
            company: '',
        });
    }
    if (page.testimonial2) {
        testimonials.push({
            quote: page.testimonial2,
            spokesperson: page.testimonial2JobTitle ?? '',
            jobTitle: page.testimonial2Company ?? '',
            company: '',
        });
    }


    return testimonials.map((t, i) => ({
        ...t,
        gradientColor: '',
        quoteMarksColor: quoteMarkColors[quoteThemes[i % quoteThemes.length]],
        theme: quoteThemes[i % quoteThemes.length],
        size: 'default' as const,
        quotesLength: testimonials.length,
        index: i,
    }));
}

// --- Default fallback logos ---
const fallbackLogos = [
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/f58ea35175bd4e25bf399e36d284d6f9/logo_salesforce_white_100x300.svg', alt: 'Salesforce' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/854ad08b9a5642f1bbda87fdfe6b81d4/nike-logo-icon_light.svg', alt: 'Nike' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/638fd78be5cc45978c7d8b42bf0d31eb/zoom-logo-white.svg', alt: 'Zoom' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/04dd25ba79f04298a76e1fb50742a117/shell-logo-light.svg', alt: 'Shell' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/71dcdc4b907a414ba7057d2624c2883b/dolby-logo-white.svg', alt: 'Dolby' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: 'https://www.optimizely.com/contentassets/c3fc7cbd589947cbb8579ce42d6bf8ec/logo_new-era_white_100x300.svg', alt: 'NEW ERA' } } },
];

interface Props {
    page: CompetitorComparisonPage;
}

const DynamicComparisonPage = ({ page }: Props) => {
    useOdpTracking('comparison');

    const comparisonRows = page.comparisonTableRows ? mapComparisonRows(page.comparisonTableRows) : [];
    const testimonials = mapTestimonials(page);

    return (
        <Suspense fallback={null}>
          <div className="cmp-takeout">
            {/* ========== SECTION 1: Hero ========== */}
            {page.headline && (
                <HeroGradient id="hero">
                    <img src="/optimizely-logo.svg" alt="Optimizely" className="mb-8 h-9" />
                    {page.eyebrow && <p className="t-overline mb-4">{page.eyebrow}</p>}
                    <div className="rte mb-6"><h1>{page.headline}</h1></div>
                    {page.subheadline && (
                        <p className="mb-8 text-xl text-fir-n4">{page.subheadline}</p>
                    )}
                    {page.cta && page.link?.default && (
                        <Button href={page.link.default} buttonStyle="primary" icon="arrowRight">
                            {page.cta}
                        </Button>
                    )}
                </HeroGradient>
            )}

            {/* ========== SECTION 2: Logo Grid ========== */}
            <section id="logos" className="outer-padding py-12">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <p className="mb-6 text-center text-sm uppercase tracking-[0.16em] font-roboto-mono text-lime/80">
                                Trusted by leading brands
                            </p>
                            <LogoGrid nonLogos={false} logoMedia={fallbackLogos} />
                        </div>
                    </div>
                </div>
            </section>


            {/* ========== SECTION 3: Comparison Table ========== */}
            {comparisonRows.length > 0 && (
                <section id="comparison" className="outer-padding py-16 lg:py-24">
                    <div className="container">
                        <div className="row">
                            <div className="col-12 lg:col-10 lg:offset-1">
                                {page.comparisonHeadline && (
                                    <h2 className="mb-8 text-center text-4xl font-display font-semibold text-cream">
                                        {page.comparisonHeadline}
                                    </h2>
                                )}
                                <ComparisonTable
                                    rows={comparisonRows}
                                    opalLabel="Optimizely"
                                    writerLabel="Competitor"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ========== SECTION 4: Analyst Recognition ========== */}
            {page.analystQuote && (
                <HighlightSection id="analyst">
                    {page.analystHeadline && (
                        <div className="rte mb-4"><h3>{page.analystHeadline}</h3></div>
                    )}
                    <p className="t-subtitle mb-6">{page.analystQuote}</p>
                    {page.analystSource && (
                        <p className="mb-6 text-sm font-roboto-mono text-fir-n6">&mdash; {page.analystSource}</p>
                    )}
                    {page.analystCTA && page.analystCTALink?.default && (
                        <Button href={page.analystCTALink.default} buttonStyle="secondary" icon="arrowRight">
                            {page.analystCTA}
                        </Button>
                    )}
                </HighlightSection>
            )}

            {/* ========== SECTION 5: Testimonials ========== */}
            {testimonials.length > 0 && (
                <section id="testimonials" className="outer-padding py-16 lg:py-24">
                    <QuoteList quotes={testimonials} />
                </section>
            )}


            {/* ========== SECTION 6: Promo Card ========== */}
            {page.promoHeading && (
                <section id="promo" className="outer-padding py-16 lg:py-24">
                    <div className="container">
                        <div className="row">
                            <div className="col-12 lg:col-8 lg:offset-2">
                                <div className="gf-card relative overflow-hidden p-8 lg:p-12">
                                    {page.promoEyebrow && <p className="t-overline mb-4">{page.promoEyebrow}</p>}
                                    <h2 className="mb-4 text-3xl font-display font-semibold text-cream">{page.promoHeading}</h2>
                                    {page.promoDescription && (
                                        <p className="mb-6 text-lg text-fir-n4">{page.promoDescription}</p>
                                    )}
                                    {page.promoCTA && page.promoCTALink?.default && (
                                        <Button href={page.promoCTALink.default} buttonStyle="emphasized" icon="arrowRight">
                                            {page.promoCTA}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ========== SECTION 7: Final CTA ========== */}
            {page.endHeadline && (
                <HighlightSection id="final-cta">
                    <div className="rte mb-4"><h2>{page.endHeadline}</h2></div>
                    {page.endSubheadline && (
                        <p className="t-subtitle mb-8">{page.endSubheadline}</p>
                    )}
                    {page.endCTA && page.endCTALink?.default && (
                        <Button href={page.endCTALink.default} buttonStyle="primary" icon="arrowRight">
                            {page.endCTA}
                        </Button>
                    )}
                </HighlightSection>
            )}
          </div>
        </Suspense>
    );
};

export default DynamicComparisonPage;
