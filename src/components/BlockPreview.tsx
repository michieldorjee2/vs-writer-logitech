import { lazy, Suspense } from 'react';
import parse from 'html-react-parser';
import HeroGradient from './HeroGradient/hero-gradient.component';
import { Button } from './Button/button-block.component';
import LogoGrid from './LogoGrid/logo-grid.component';
import { richTextAsTag, mapComparisonRows } from '../lib/content-mappers';
import type {
    PreviewBlock,
    HeroSectionBlock,
    LogoBarBlock,
    FeatureSectionBlock,
    ComparisonTableBlock,
    AnalystSectionBlock,
    StandaloneTestimonialBlock,
    PromoCardBlock,
    ClosingCtaBlock,
    ImageRef,
} from '../lib/graph-types';

const ComparisonTable = lazy(() => import('./ComparisonTable/comparison-table.component'));
const HighlightSection = lazy(() => import('./Highlight/highlight.component'));
const GridOverlay = lazy(() => import('./GridOverlay/_grid-overlay'));

// --- Logo mapper (shared with DynamicComparisonPage) ---

function mapLogos(logos: ImageRef[]) {
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

// --- Individual block renderers ---

function HeroPreview({ block }: { block: HeroSectionBlock }) {
    return (
        <HeroGradient>
            {block.Eyebrow && <p className="t-overline mb-4">{block.Eyebrow}</p>}
            {block.Headline?.html && (
                <div className="rte mb-6">{parse(richTextAsTag(block.Headline.html, 'h1'))}</div>
            )}
            {block.Subheadline && (
                <p className="mb-8 text-xl text-gray-300">{block.Subheadline}</p>
            )}
            {block.PrimaryCtaText && block.PrimaryCtaUrl?.default && (
                <Button href={block.PrimaryCtaUrl.default} buttonStyle="primary" icon="arrowRight">
                    {block.PrimaryCtaText}
                </Button>
            )}
        </HeroGradient>
    );
}

function LogoBarPreview({ block }: { block: LogoBarBlock }) {
    const logos = block.Logos?.length ? mapLogos(block.Logos) : [];
    return (
        <section className="outer-padding py-12">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        {block.Heading && (
                            <p className="mb-6 text-center text-sm uppercase tracking-widest text-gray-400">
                                {block.Heading}
                            </p>
                        )}
                        {logos.length > 0 && <LogoGrid nonLogos={false} logoMedia={logos} />}
                    </div>
                </div>
            </div>
        </section>
    );
}

function FeatureSectionPreview({ block }: { block: FeatureSectionBlock }) {
    if (!block.Headline?.html || !block.Features?.length) return null;
    return (
        <section className="outer-padding relative py-16 lg:py-24">
            <GridOverlay opacity={0} highlightOpacity={0.08} fade />
            <div className="container relative z-10">
                <div className="row">
                    <div className="col-12 lg:col-8 lg:offset-2">
                        <div className="rte mb-8">{parse(richTextAsTag(block.Headline.html, 'h2'))}</div>
                        <div className="grid gap-6 md:grid-cols-2">
                            {block.Features.map((feat, i) => (
                                <div key={i} className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-6">
                                    <h3 className="mb-2 text-xl font-medium text-white">{feat.Title}</h3>
                                    {feat.Description?.html && (
                                        <div className="rte text-base text-gray-300">{parse(feat.Description.html)}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function ComparisonTablePreview({ block }: { block: ComparisonTableBlock }) {
    const rows = mapComparisonRows(block.Rows ?? []);
    if (!rows.length) return null;
    return (
        <section className="outer-padding py-16 lg:py-24">
            <div className="container">
                <div className="row">
                    <div className="col-12 lg:col-10 lg:offset-1">
                        <h2 className="mb-3 text-center text-4xl font-medium text-white">
                            Side-by-side: {block.OurLabel} vs {block.CompetitorLabel}
                        </h2>
                        <ComparisonTable
                            rows={rows}
                            opalLabel={block.OurLabel}
                            writerLabel={block.CompetitorLabel}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function AnalystPreview({ block }: { block: AnalystSectionBlock }) {
    if (!block.Quote) return null;
    return (
        <HighlightSection>
            {block.SectionHeading?.html && (
                <div className="rte mb-4">{parse(richTextAsTag(block.SectionHeading.html, 'h2'))}</div>
            )}
            <p className="t-subtitle mb-6">{block.Quote}</p>
            {block.AnalystSource && (
                <p className="mb-6 text-sm text-gray-400">&mdash; {block.AnalystSource}</p>
            )}
            {block.CtaText && block.CtaUrl?.default && (
                <Button href={block.CtaUrl.default} buttonStyle="secondary" icon="arrowRight">
                    {block.CtaText}
                </Button>
            )}
        </HighlightSection>
    );
}

function TestimonialPreview({ block }: { block: StandaloneTestimonialBlock }) {
    return (
        <section className="outer-padding py-16 lg:py-24">
            <div className="container">
                <div className="row">
                    <div className="col-12 lg:col-8 lg:offset-2">
                        <blockquote className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-8">
                            <p className="mb-4 text-xl italic text-white">&ldquo;{block.Quote}&rdquo;</p>
                            <footer className="text-sm text-gray-400">
                                &mdash; {block.AuthorName}
                                {block.AuthorTitle && <>, {block.AuthorTitle}</>}
                            </footer>
                        </blockquote>
                    </div>
                </div>
            </div>
        </section>
    );
}

function PromoCardPreview({ block }: { block: PromoCardBlock }) {
    return (
        <section className="outer-padding py-16 lg:py-24">
            <div className="container">
                <div className="row">
                    <div className="col-12 lg:col-8 lg:offset-2">
                        <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-8 lg:p-12">
                            {block.Eyebrow && <p className="t-overline mb-4">{block.Eyebrow}</p>}
                            <h2 className="mb-4 text-3xl font-medium text-white">{block.Heading}</h2>
                            {block.Description && (
                                <p className="mb-6 text-lg text-gray-300">{block.Description}</p>
                            )}
                            {block.CtaText && block.CtaUrl?.default && (
                                <Button href={block.CtaUrl.default} buttonStyle="emphasized" icon="arrowRight">
                                    {block.CtaText}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function ClosingCtaPreview({ block }: { block: ClosingCtaBlock }) {
    if (!block.Headline?.html) return null;
    return (
        <HighlightSection>
            <div className="rte mb-4">{parse(richTextAsTag(block.Headline.html, 'h2'))}</div>
            {block.Subheadline && (
                <p className="t-subtitle mb-8">{block.Subheadline}</p>
            )}
            {block.PrimaryCtaText && block.PrimaryCtaUrl?.default && (
                <Button href={block.PrimaryCtaUrl.default} buttonStyle="primary" icon="arrowRight">
                    {block.PrimaryCtaText}
                </Button>
            )}
        </HighlightSection>
    );
}

// --- Main BlockPreview component ---

interface Props {
    block: PreviewBlock;
}

export default function BlockPreview({ block }: Props) {
    return (
        <Suspense fallback={null}>
            {renderBlock(block)}
        </Suspense>
    );
}

function renderBlock(block: PreviewBlock) {
    switch (block.__typename) {
        case 'HeroSectionBlock':
            return <HeroPreview block={block} />;
        case 'LogoBarBlock':
            return <LogoBarPreview block={block} />;
        case 'FeatureSectionBlock':
            return <FeatureSectionPreview block={block} />;
        case 'ComparisonTableBlock':
            return <ComparisonTablePreview block={block} />;
        case 'AnalystSectionBlock':
            return <AnalystPreview block={block} />;
        case 'TestimonialBlock':
            return <TestimonialPreview block={block} />;
        case 'PromoCardBlock':
            return <PromoCardPreview block={block} />;
        case 'ClosingCtaBlock':
            return <ClosingCtaPreview block={block} />;
        default:
            return (
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
                    <h1 className="text-2xl font-medium text-white">Block preview</h1>
                    <p className="text-gray-400">
                        Preview not available for type: {(block as any).__typename}
                    </p>
                </div>
            );
    }
}
