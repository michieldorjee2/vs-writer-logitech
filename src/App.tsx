import { lazy, Suspense, useEffect, useMemo, useSyncExternalStore } from 'react';
import { BrowserRouter, Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { usePageContent } from './hooks/usePageContent';
import { useHeadMeta } from './hooks/useHeadMeta';
import type { CompetitorComparisonPage } from './lib/graph-types';
import { agentPlatformHead } from './www/agent-platform/content';
import { accountTemplateOf } from './www/account-template';
import { SHARE_PARAM, shareCodeOf } from './lib/share-links';
import { watchIconFont } from './lib/icon-font';
import type {
    FinServPage as FinServPageData,
    PersonPage as PersonPageData,
    RetailCustomerPage as RetailPageData,
} from './lib/graph-types';

/*
 * Lazy-load the page renderers, so the /search booth path downloads none of them.
 * Suspense fallbacks match the existing spinner.
 */
const RetailCustomerPage = lazy(() => import('./components/RetailCustomerPage'));
const FinServPage = lazy(() => import('./components/FinServPage'));
const PersonPage = lazy(() => import('./www/PersonPage'));
/*
 * Booth-only sales sidebar. Gated on `?search=1` in the URL — visitors
 * arriving through any normal channel never even download this chunk
 * (the X-ray overlay + scan animation + xray-defaults all sit behind
 * this lazy boundary).
 */
const FloatingSidebar = lazy(() => import('./components/FloatingSidebar'));
/* A personal link's note (?p=<code>), over the page before it is read. Its own chunk: most visits never load it. */
const InviteNote = lazy(() => import('./components/InviteNote'));
/*
 * Visual Builder experiences — /vb/:slug. Lazy for the same reason as the renderers above:
 * it pulls the whole vendored opticom render chain plus one chunk per component renderer,
 * and no account page should download a byte of it.
 */
const VisualBuilderPage = lazy(() => import('./components/VisualBuilderPage'));
/* Every account page, in the template its own pitch calls for (src/www/account-template.ts). See src/www. */
const AccountRoute = lazy(() => import('./www/AccountRoute'));
/* The CMS's preview of a page, an offer or a block (?key=…&ver=…&ctx=edit). See CmsPreview.tsx. */
const CmsPreview = lazy(() => import('./components/CmsPreview'));

/* Pages load the icon font's subset; an icon outside it (a CMS-only name) brings in the whole font. */
watchIconFont();

function RouteSpinner() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-optimizely-blue" />
        </div>
    );
}

/*
 * The client receives whichever page type the slug resolved to, typed loosely as
 * CompetitorComparisonPage by usePageContent. These read the tags each type carries and,
 * as type predicates, narrow `data` for the renderer that owns it.
 */
type Tagged = { template?: unknown; __template?: unknown; customerSlug?: unknown } | null | undefined;

function isRetailPage(page: unknown): page is RetailPageData {
    const p = page as Tagged;
    return p?.template === 'retail' || !!p?.customerSlug;
}

function isFinServPage(page: unknown): page is FinServPageData {
    const p = page as Tagged;
    return p?.template === 'finserv' || p?.__template === 'finserv';
}

function isPersonPage(page: unknown): page is PersonPageData {
    const p = page as Tagged;
    return p?.template === 'person' || p?.__template === 'person';
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
 * Pick the renderer for a page: person, retail and fin-serv pages by their tag, every account
 * page the agent platform template. Mirrored in server/ssr-handler.tsx's dispatch.
 */
function renderPageBody(data: CompetitorComparisonPage, search: string) {
    if (isPersonPage(data)) return <PersonPage page={data} />;
    if (isRetailPage(data)) return <RetailCustomerPage page={data} />;
    if (isFinServPage(data)) return <FinServPage page={data} />;
    return <AccountRoute page={data} search={search} />;
}

/*
 * False during the server render AND during hydration, true from the first render after.
 *
 * React reads `getServerSnapshot` while hydrating, so anything gated on this renders exactly
 * what the server rendered — then React re-renders with `getSnapshot` once hydration is done.
 * The documented pattern for client-only content; nothing to subscribe to, hence the no-op.
 */
const noopSubscribe = () => () => {};
function useHydrated(): boolean {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function PageLoader() {
    const { '*': slug } = useParams();
    const [searchParams] = useSearchParams();
    const { data, isLoading, error } = usePageContent(slug || '');
    const hydrated = useHydrated();

    // Inject title, meta description, canonical, and JSON-LD. The agent platform template
    // replaces the stored title and description (they name the competitor), exactly as the
    // server does, so the head does not change on hydration.
    const headPage = useMemo(
        () => (data && !isPersonPage(data) && !isRetailPage(data) && !isFinServPage(data) && accountTemplateOf(data) === 'agent-platform' ? agentPlatformHead(data) : data),
        [data],
    );
    useHeadMeta(headPage);

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
    // Only mount it when we know the visitor came in via /search — and only after
    // hydration: the server never renders it, so drawing it in the hydration pass put a
    // node where the server HTML had none and failed hydration for every booth visit.
    const fromSearch = hydrated && searchParams.has('search');
    // A personal link (src/lib/share-links.ts): never with the booth tools, never on retail or fin-serv.
    const shareCode = hydrated && !fromSearch && !isRetailPage(data) && !isFinServPage(data) ? shareCodeOf(searchParams.get(SHARE_PARAM)) : null;

    return (
        // server/ssr-handler.tsx's renderPageRoute() reproduces this exact shape — including
        // the second slot — because useId() counts a children array. Change one, change both.
        <Suspense fallback={<RouteSpinner />}>
            {renderPageBody(data, searchParams.toString())}
            {fromSearch && !isRetailPage(data) && !isFinServPage(data) ? (
                <FloatingSidebar page={data} variant={isPersonPage(data) ? 'person' : 'abm'} />
            ) : shareCode ? (
                // Its own boundary: loading the note never swaps the page for the spinner.
                <Suspense fallback={null}>
                    <InviteNote code={shareCode} />
                </Suspense>
            ) : null}
        </Suspense>
    );
}

function App() {
    return (
        <BrowserRouter>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route
                        element={
                            <Suspense fallback={<RouteSpinner />}>
                                <CmsPreview />
                            </Suspense>
                        }
                        path="/preview"
                    />
                    {/* Visual Builder experiences. Ahead of the catch-all, and on its own
                        prefix so it cannot collide with the 2,695 single-segment company
                        slugs PageLoader serves. See VisualBuilderPage.tsx. */}
                    <Route
                        element={
                            <Suspense fallback={<RouteSpinner />}>
                                <VisualBuilderPage />
                            </Suspense>
                        }
                        path="/vb/:slug"
                    />
                    {/* Dynamic catch-all: any slug resolves to Graph content */}
                    <Route path="/*" element={<PageLoader />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
