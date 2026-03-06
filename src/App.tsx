import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { usePageContent } from './hooks/usePageContent';
import DynamicComparisonPage from './components/DynamicComparisonPage';

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

function PageLoader() {
    const { '*': slug } = useParams();
    const { data, isLoading, error } = usePageContent(slug || '');

    // Update document title and meta description from Graph content
    useEffect(() => {
        if (data) {
            document.title = data.PageTitle;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.setAttribute('content', data.MetaDescription);
        }
    }, [data]);

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

    return <DynamicComparisonPage page={data} />;
}

function App() {
    return (
        <BrowserRouter>
            <main>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    {/* Dynamic catch-all: any slug resolves to Graph content */}
                    <Route path="/*" element={<PageLoader />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
