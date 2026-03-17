import { useState, useEffect } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';

interface PageContentState {
    data: CompetitorComparisonPage | null;
    isLoading: boolean;
    error: string | null;
}

function consumeSSRData(): CompetitorComparisonPage | null {
    if (typeof window === 'undefined') return null;
    const data = (window as any).__SSR_DATA__ as CompetitorComparisonPage | undefined;
    if (data) {
        delete (window as any).__SSR_DATA__;
        return data;
    }
    return null;
}

export function usePageContent(slug: string): PageContentState {
    const [ssrData] = useState(consumeSSRData);

    const [state, setState] = useState<PageContentState>({
        data: ssrData,
        isLoading: !ssrData,
        error: null,
    });

    useEffect(() => {
        // If we got SSR data, skip the fetch
        if (ssrData) return;

        let cancelled = false;

        async function load() {
            setState({ data: null, isLoading: true, error: null });

            try {
                // Strip leading/trailing slashes for a clean slug
                const cleanSlug = slug.replace(/^\/|\/$/g, '');
                const res = await fetch(`/api/content?slug=${encodeURIComponent(cleanSlug)}`);

                if (!res.ok) {
                    throw new Error(res.status === 404 ? 'Page not found' : `Failed to load (${res.status})`);
                }

                const page: CompetitorComparisonPage = await res.json();
                if (!cancelled) {
                    setState({ data: page, isLoading: false, error: null });
                }
            } catch (err) {
                if (!cancelled) {
                    setState({ data: null, isLoading: false, error: (err as Error).message });
                }
            }
        }

        load();
        return () => { cancelled = true; };
    }, [slug, ssrData]);

    return state;
}
