import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { usePageContent } from './hooks/usePageContent';
import { usePreviewContent } from './hooks/usePreviewContent';
import { useHeadMeta } from './hooks/useHeadMeta';
import SearchPage from './components/SearchPage';
import type { CompetitorComparisonPage, PreviewBlock } from './lib/graph-types';
import { includes, resolveComponentPlan } from './lib/limitless/component-plan';

/*
 * Lazy-load the heavy page renderers. ABMHyperPage pulls in gsap +
 * ScrollTrigger + the ABM CSS bundle; DynamicComparisonPage pulls
 * framer-motion transitively. None of that should ship on the
 * /search booth path. Suspense fallbacks match the existing spinner.
 */
const DynamicComparisonPage = lazy(() => import('./components/DynamicComparisonPage'));
const ABMHyperPage = lazy(() => import('./components/ABMHyperPage'));
const RetailCustomerPage = lazy(() => import('./components/RetailCustomerPage'));
const FinServPage = lazy(() => import('./components/FinServPage'));
const PersonPage = lazy(() => import('./components/PersonPage'));
const BlockPreview = lazy(() => import('./components/BlockPreview'));
/*
 * Limitless ladder preview — see docs/architecture.md and
 * src/components/LimitlessPlanPreview.tsx. Renders DynamicComparisonPage
 * (reused, unmodified) from a Plan instead of Graph content.
 */
const LimitlessPlanPreview = lazy(() => import('./components/LimitlessPlanPreview'));
/*
 * The use-case renderer — a third shape over CompetitorComparisonPage,
 * alongside ABMHyperPage (takeout) and DynamicComparisonPage (plain). Driven
 * by a component plan rather than by which fields are populated; see
 * src/lib/limitless/component-plan.ts.
 */
const UseCasePage = lazy(() => import('./components/UseCasePage'));
const UseCasePreview = lazy(() => import('./components/UseCasePreview'));
/*
 * Booth-only sales sidebar. Gated on `?search=1` in the URL — visitors
 * arriving through any normal channel never even download this chunk
 * (the X-ray overlay + scan animation + xray-defaults all sit behind
 * this lazy boundary).
 */
const FloatingSidebar = lazy(() => import('./components/FloatingSidebar'));

function RouteSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-optimizely-blue" />
        </div>
    );
}

function isABMPage(page: CompetitorComparisonPage): boolean {
    return !!(page.intelEyebrow || page.customerLogo);
}

function isRetailPage(page: any): boolean {
    return page?.template === 'retail' || !!page?.customerSlug;
}

function isFinServPage(page: any): boolean {
    return page?.template === 'finserv' || page?.__template === 'finserv';
}

function isPersonPage(page: any): boolean {
    return page?.template === 'person' || page?.__template === 'person';
}

/** Turn a slug like "vs-writer-ai-logitech" into "Logitech" */
function extractCompanyName(slug: string): string {
    const stripped = slug
        .replace(/^vs-writer-ai-/, '')
        .replace(/^vs-writer-/, '')
        .replace(/-/g, ' ');
    return stripped
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function NotFound({ slug }: { slug: string }) {
    const companyName = extractCompanyName(slug);

    // Fire-and-forget: track the miss server-side
    useEffect(() => {
        if (slug) {
            fetch('/api/track-miss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: slug.replace(/^\/|\/$/g, '') }),
            }).catch(() => {});
        }
    }, [slug]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
            <h1 className="text-4xl font-medium text-white">
                We're not quite ready for {companyName} yet
            </h1>
            <p className="max-w-md text-lg text-gray-400">
                We don't have a comparison page for this company yet, but we're
                working on it — check back soon!
            </p>
        </div>
    );
}

function HomePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
            <h1 className="text-4xl font-medium text-white">Page not found</h1>
            <p className="max-w-md text-lg text-gray-400">
                The page you're looking for doesn't exist.
            </p>
        </div>
    );
}

/*
 * Pick the renderer for a page.
 *
 * Was a five-deep nested ternary inline in PageLoader; flattened to early
 * returns when a sixth arm was added, with the order and props unchanged so
 * every existing page resolves to exactly the renderer it did before.
 *
 * The use-case arm is the one dispatch test here that is NOT a field sniff: the
 * three above it guess a template from which fields happen to be populated,
 * while this one reads the page's own component plan. It sits ahead of
 * isABMPage because a use-case page also carries intelEyebrow, which is half of
 * what isABMPage tests for.
 *
 * It cannot fire yet. `componentPlan` is not a registered field and is not in
 * PAGE_QUERY, so resolveComponentPlan() falls through to a derived plan, whose
 * use-case-matrix predicate is `() => false`. That is correct rather than
 * inert: no page written before the field existed should be reinterpreted as a
 * use-case page. Register the field, add it to the query, and every page the
 * decision engine writes takes this branch with no further code change.
 */
function renderPageBody(data: CompetitorComparisonPage, editMode: boolean) {
    if (isPersonPage(data)) return <PersonPage page={data as any} editMode={editMode} />;
    if (isRetailPage(data)) return <RetailCustomerPage page={data as any} />;
    if (isFinServPage(data)) return <FinServPage page={data as any} />;
    // Resolved once and reused, rather than once to test and once to pass down.
    const plan = resolveComponentPlan(data as any);
    if (includes(plan, 'use-case-matrix')) return <UseCasePage page={data as any} plan={plan} />;
    if (isABMPage(data)) return <ABMHyperPage page={data} />;
    return <DynamicComparisonPage page={data} />;
}

function PageLoader() {
    const { '*': slug } = useParams();
    const [searchParams] = useSearchParams();
    const { data, isLoading, error } = usePageContent(slug || '');

    // Inject title, meta description, canonical, and JSON-LD
    useHeadMeta(data);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-optimizely-blue" />
            </div>
        );
    }

    if (error || !data) {
        return <NotFound slug={slug || ''} />;
    }

    // The whole sales sidebar (back-to-search + X-ray) is booth-only.
    // Only mount it when we know the visitor came in via /search.
    const fromSearch = searchParams.has('search');

    return (
        <Suspense fallback={<RouteSpinner />}>
            {renderPageBody(data, searchParams.get('ctx') === 'edit')}
            {fromSearch && !isRetailPage(data) && !isFinServPage(data) && (
                <FloatingSidebar
                    page={data}
                    variant={isPersonPage(data) ? 'person' : isABMPage(data) ? 'abm' : 'dynamic'}
                />
            )}
        </Suspense>
    );
}

const CMS_URL = import.meta.env.VITE_CMS_URL || '';

function PreviewLoader() {
    const [searchParams] = useSearchParams();
    const { data, isLoading, error } = usePreviewContent(searchParams);

    // Only inject head meta for full page previews
    const isPage = data?.__typename === 'CompetitorComparisonPage' || (data && !data.__typename);
    useHeadMeta(isPage ? (data as CompetitorComparisonPage) : null);

    // Load the CMS communication injector script dynamically
    // (JSX <script> tags don't execute in React)
    useEffect(() => {
        if (!CMS_URL) return;
        const scriptId = 'opti-cms-injector';
        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `${CMS_URL}/util/javascript/communicationinjector.js`;
        script.async = true;
        document.head.appendChild(script);

        return () => {
            const el = document.getElementById(scriptId);
            if (el) el.remove();
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-optimizely-blue" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
                <h1 className="text-4xl font-medium text-white">Preview unavailable</h1>
                <p className="max-w-md text-lg text-gray-400">{error || 'Content not found'}</p>
            </div>
        );
    }

    const isEditMode = searchParams.get('ctx') === 'edit';

    // Dispatch: full page vs individual block
    const body = (data.__typename === 'CompetitorComparisonPage' || !data.__typename)
        ? (isABMPage(data as CompetitorComparisonPage)
            ? <ABMHyperPage page={data as CompetitorComparisonPage} editMode={isEditMode} />
            : <DynamicComparisonPage page={data as CompetitorComparisonPage} />)
        : <BlockPreview block={data as PreviewBlock} />;

    return <Suspense fallback={<RouteSpinner />}>{body}</Suspense>;
}

function App() {
    return (
        <BrowserRouter>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/preview" element={<PreviewLoader />} />
                    {/* Limitless ladder preview — added ahead of the catch-all so it
                        intercepts only its own prefix; PageLoader's shape-sniffed
                        dispatch below is untouched. See LimitlessPlanPreview.tsx. */}
                    <Route
                        element={
                            <Suspense fallback={<RouteSpinner />}>
                                <LimitlessPlanPreview />
                            </Suspense>
                        }
                        path="/limitless-preview/:accountId"
                    />
                    {/* Use-case template preview. With no account id it renders
                        the Siemens fixture against its own plan; with one, the
                        SAME content is re-rendered against a plan Aldus
                        resolves live. See UseCasePreview.tsx. */}
                    <Route
                        element={
                            <Suspense fallback={<RouteSpinner />}>
                                <UseCasePreview />
                            </Suspense>
                        }
                        path="/use-case-preview"
                    />
                    <Route
                        element={
                            <Suspense fallback={<RouteSpinner />}>
                                <UseCasePreview />
                            </Suspense>
                        }
                        path="/use-case-preview/:accountId"
                    />
                    {/* Dynamic catch-all: any slug resolves to Graph content */}
                    <Route path="/*" element={<PageLoader />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
