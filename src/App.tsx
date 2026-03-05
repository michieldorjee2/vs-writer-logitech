import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom';
import { usePageContent } from './hooks/usePageContent';
import DynamicComparisonPage from './components/DynamicComparisonPage';

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
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-medium text-white">Page not found</h1>
                <p className="text-lg text-gray-400">The page you're looking for doesn't exist.</p>
            </div>
        );
    }

    return <DynamicComparisonPage page={data} />;
}

function App() {
    return (
        <BrowserRouter>
            <main>
                <Routes>
                    {/* Default redirect to the first known page */}
                    <Route path="/" element={<Navigate to="/vs-writer-ai-logitech" replace />} />
                    {/* Dynamic catch-all: any slug resolves to Graph content */}
                    <Route path="/*" element={<PageLoader />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
