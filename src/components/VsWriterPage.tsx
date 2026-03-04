import HeroGradient from './HeroGradient/hero-gradient.component';
import { Button } from './Button/button-block.component';
import LogoGrid from './LogoGrid/logo-grid.component';
import ComparisonTable from './ComparisonTable/comparison-table.component';
import QuoteList from './QuoteList/quote-list.component';
import Accordion from './Accordion/accordion.component';
import HighlightSection from './Highlight/highlight.component';
import GridOverlay from './GridOverlay/_grid-overlay';

// --- Comparison Table Data ---
const comparisonRows = [
    { feature: 'Embedded AI across CMS, commerce, and experimentation', opal: true, writer: false },
    { feature: 'Multi-product content orchestration (gaming, video, productivity)', opal: true, writer: false },
    { feature: 'AI-powered A/B testing and personalization', opal: true, writer: false },
    { feature: 'Enterprise DAM and PIM integration', opal: true, writer: 'Limited' as string },
    { feature: 'Full content supply chain management', opal: true, writer: false },
    { feature: 'AI content generation', opal: true, writer: true },
    { feature: 'Brand voice and tone guardrails', opal: true, writer: true },
    { feature: 'Multilingual content at scale (50+ markets)', opal: true, writer: 'Partial' as string },
    { feature: 'Warehouse-native analytics', opal: true, writer: false },
    { feature: 'Ecommerce product content optimization', opal: true, writer: false },
    { feature: 'Headless and composable architecture', opal: true, writer: false },
    { feature: 'FedRAMP-ready security and compliance', opal: true, writer: 'Partial' as string },
];

// --- Testimonial Data ---
const testimonials = [
    {
        quote: "Since switching to Optimizely, we've cut campaign launch time by 60%. Our gaming and productivity teams finally share one content platform instead of fighting over separate tools.",
        spokesperson: 'Sarah Chen',
        jobTitle: 'VP of Digital Marketing',
        company: 'Global Tech Hardware Co.',
        gradientColor: '',
        quoteMarksColor: '#194BFF',
        theme: 'blue' as const,
        size: 'default' as const,
        quotesLength: 3,
        index: 0,
    },
    {
        quote: "Writer helped us generate copy, but Optimizely Opal lets us generate, test, personalize, and publish \u2014 all in one workflow. The ROI difference is night and day.",
        spokesperson: 'Marcus Rivera',
        jobTitle: 'Director of Content Operations',
        company: 'Enterprise Electronics Inc.',
        gradientColor: '',
        quoteMarksColor: '#00CCFF',
        theme: 'light-blue' as const,
        size: 'default' as const,
        quotesLength: 3,
        index: 1,
    },
    {
        quote: "We needed AI that understood our 12 product lines across 50 markets. Opal's experimentation engine alone paid for itself in the first quarter.",
        spokesperson: 'Lisa Johansson',
        jobTitle: 'Head of Global Ecommerce',
        company: 'Nordic Peripherals Group',
        gradientColor: '',
        quoteMarksColor: '#9E4AFF',
        theme: 'purple' as const,
        size: 'default' as const,
        quotesLength: 3,
        index: 2,
    },
];

// --- FAQ Data ---
const faqItems = [
    {
        title: 'We already use Writer AI at Logitech \u2014 why switch?',
        defaultOpen: true,
        children: (
            <div>
                <p className="mb-4">Writer is a capable AI writing assistant, but it operates in isolation from your content delivery, experimentation, and commerce workflows. Here's what changes with Opal:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Your gaming, video collaboration, and productivity teams get a unified content platform \u2014 no more siloed tools</li>
                    <li>AI-generated content feeds directly into A/B tests and personalization \u2014 no manual handoff</li>
                    <li>Opal connects natively to your DAM, PIM, and ecommerce stack, so product launches move faster</li>
                    <li>You get measurable ROI through built-in experimentation, not just content output metrics</li>
                </ul>
            </div>
        ),
    },
    {
        title: 'Is Opal just another AI writing tool with a different name?',
        defaultOpen: false,
        children: (
            <div>
                <p className="mb-4">Not at all. While Writer focuses on AI content generation, Opal is an AI orchestration layer across your entire digital experience stack:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Content creation</strong> \u2014 yes, Opal generates on-brand copy, but it also manages the full content supply chain from ideation to publishing</li>
                    <li><strong>Experimentation</strong> \u2014 Opal runs AI-powered A/B tests to optimize every piece of content for conversion</li>
                    <li><strong>Personalization</strong> \u2014 deliver different product messaging to gamers vs. enterprise IT buyers vs. home office users automatically</li>
                    <li><strong>Commerce</strong> \u2014 optimize product descriptions, search results, and recommendations across your entire catalog</li>
                </ul>
            </div>
        ),
    },
    {
        title: 'How long does migration take, and will our team need to relearn everything?',
        defaultOpen: false,
        children: (
            <div>
                <p className="mb-4">Optimizely has migrated hundreds of enterprise teams from standalone AI tools. For a company like Logitech:</p>
                <ul className="list-disc pl-6 space-y-2">
                    <li>Typical migration timeline is 6\u20138 weeks, with parallel running so there's zero downtime</li>
                    <li>Opal's interface is designed for marketers \u2014 your content team will be productive in days, not months</li>
                    <li>Free access to Opal University, a 5-day AI training course customized for your workflows</li>
                    <li>Dedicated customer success team for enterprise onboarding, including brand voice configuration for each product line</li>
                </ul>
            </div>
        ),
    },
];

// --- Logo Grid Data (local SVGs in /public/logos/) ---
const logoMedia = [
    { asset: { type: 'image' as const, assetAttributes: { url: '/vs-writer-logitech/logos/salesforce.svg', alt: 'Salesforce' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: '/vs-writer-logitech/logos/nike.svg', alt: 'Nike' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: '/vs-writer-logitech/logos/zoom.svg', alt: 'Zoom' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: '/vs-writer-logitech/logos/dolby.svg', alt: 'Dolby' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: '/vs-writer-logitech/logos/shell.svg', alt: 'Shell' } } },
    { asset: { type: 'image' as const, assetAttributes: { url: '/vs-writer-logitech/logos/newera.svg', alt: 'New Era' } } },
];

const VsWriterPage = () => {
    return (
        <>
            {/* ========== SECTION 1: Hero ========== */}
            <HeroGradient>
                <h1 className="mb-6">
                    Optimizely Opal: The smarter AI alternative to Writer for <em className="not-italic text-optimizely-blue">Logitech</em>
                </h1>
                <p className="mb-8 text-xl text-gray-300">
                    Writer generates content. Opal orchestrates your entire digital experience \u2014 from AI-powered content creation to experimentation, personalization, and commerce \u2014 all in one platform built for multi-product enterprises.
                </p>
                <Button href="#demo" buttonStyle="primary" icon="arrowRight">
                    See Opal in action
                </Button>
            </HeroGradient>

            {/* ========== SECTION 2: Logo Grid ========== */}
            <section className="outer-padding py-12">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <p className="mb-6 text-center text-sm uppercase tracking-widest text-gray-400">
                                Trusted by leading technology enterprises
                            </p>
                            <LogoGrid nonLogos={false} logoMedia={logoMedia} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 3: Value Proposition ========== */}
            <section className="outer-padding relative py-16 lg:py-24">
                <GridOverlay opacity={0} highlightOpacity={0.08} fade />
                <div className="container relative z-10">
                    <div className="row">
                        <div className="col-12 lg:col-8 lg:offset-2">
                            <h2 className="mb-4 text-4xl font-medium leading-tight text-white lg:text-5xl">
                                Opal does what Writer <em className="not-italic text-optimizely-blue">can't</em>: drives full-funnel performance for Logitech
                            </h2>
                            <p className="mb-8 text-xl text-gray-300">
                                Managing content for gaming mice, webcams, video conferencing solutions, and enterprise collaboration tools requires more than an AI copywriter. Logitech needs an AI platform that understands its full digital ecosystem.
                            </p>
                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-6">
                                    <h3 className="mb-2 text-xl font-medium text-white">Unified Multi-Product Content</h3>
                                    <p className="text-base text-gray-300">One AI platform for Logi G (gaming), Logitech for Business, and consumer lines \u2014 with brand guardrails per product family.</p>
                                </div>
                                <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-6">
                                    <h3 className="mb-2 text-xl font-medium text-white">AI-Powered Experimentation</h3>
                                    <p className="text-base text-gray-300">Don't just create content \u2014 test it. Opal runs automatic A/B tests on product pages, landing pages, and campaigns.</p>
                                </div>
                                <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-6">
                                    <h3 className="mb-2 text-xl font-medium text-white">Commerce-Native Intelligence</h3>
                                    <p className="text-base text-gray-300">Optimize product descriptions, search results, and recommendations across Logitech's entire catalog in real time.</p>
                                </div>
                                <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-6">
                                    <h3 className="mb-2 text-xl font-medium text-white">50+ Market Localization</h3>
                                    <p className="text-base text-gray-300">AI-driven translation and localization that maintains brand voice across every market Logitech operates in.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 4: Comparison Table ========== */}
            <section className="outer-padding py-16 lg:py-24">
                <div className="container">
                    <div className="row">
                        <div className="col-12 lg:col-10 lg:offset-1">
                            <h2 className="mb-3 text-center text-4xl font-medium text-white">
                                Side-by-side: Opal vs Writer
                            </h2>
                            <p className="mb-10 text-center text-lg text-gray-300">
                                See how Optimizely Opal compares to Writer AI across the capabilities that matter most to Logitech.
                            </p>
                            <ComparisonTable rows={comparisonRows} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 5: Analyst Recognition ========== */}
            <HighlightSection>
                <h2 className="mb-4">
                    Recognized by Gartner as a <em className="not-italic text-optimizely-blue">Leader</em>
                </h2>
                <p className="t-subtitle mb-6">
                    Optimizely named a Leader in the 2025 Gartner Magic Quadrant for Digital Experience Platforms \u2014 for the strength of its AI orchestration, composable architecture, and enterprise-grade security.
                </p>
                <Button href="#report" buttonStyle="secondary" icon="arrowRight">
                    Download the full report
                </Button>
            </HighlightSection>

            {/* ========== SECTION 6: Testimonials ========== */}
            <section className="outer-padding py-16 lg:py-24">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <h2 className="mb-2 text-center text-4xl font-medium text-white">
                                What enterprise teams are saying
                            </h2>
                            <p className="mb-8 text-center text-lg text-gray-300">
                                Companies like Logitech are replacing standalone AI tools with Optimizely Opal.
                            </p>
                        </div>
                    </div>
                </div>
                <QuoteList quotes={testimonials} />
            </section>

            {/* ========== SECTION 7: FAQ ========== */}
            <section className="outer-padding py-16 lg:py-24">
                <div className="container">
                    <div className="row">
                        <div className="col-12 lg:col-8 lg:offset-2">
                            <h2 className="mb-8 text-center text-4xl font-medium text-white">
                                Frequently asked questions
                            </h2>
                            <Accordion accordionItems={faqItems} backgroundStyle={true} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 8: Education CTA ========== */}
            <section className="outer-padding py-16 lg:py-24">
                <div className="container">
                    <div className="row">
                        <div className="col-12 lg:col-8 lg:offset-2">
                            <div className="rounded-lg border border-vulcan-85 bg-vulcan-95 p-8 lg:p-12">
                                <p className="t-overline mb-4">Free training</p>
                                <h2 className="mb-4 text-3xl font-medium text-white">
                                    Optimizely Opal University
                                </h2>
                                <p className="mb-6 text-lg text-gray-300">
                                    Get your Logitech marketing team up to speed with our free 5-day AI course. Learn how to save 10+ hours per week by building custom AI agents for product launches, campaign optimization, and content localization.
                                </p>
                                <Button href="#university" buttonStyle="emphasized" icon="arrowRight">
                                    Enroll your team for free
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========== SECTION 9: Final CTA ========== */}
            <HighlightSection>
                <h2 className="mb-4">
                    Logitech doesn't need another AI writing tool. It needs <em className="not-italic text-optimizely-blue">AI orchestration</em>.
                </h2>
                <p className="t-subtitle mb-8">
                    Move beyond content generation. Unify your content, experimentation, personalization, and commerce under one AI-powered platform.
                </p>
                <Button href="#demo" buttonStyle="primary" icon="arrowRight">
                    See Opal in action
                </Button>
            </HighlightSection>
        </>
    );
};

export default VsWriterPage;
