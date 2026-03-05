import { useState, useEffect } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';

interface PageContentState {
    data: CompetitorComparisonPage | null;
    isLoading: boolean;
    error: string | null;
}

export function usePageContent(slug: string): PageContentState {
    const [state, setState] = useState<PageContentState>({
        data: null,
        isLoading: true,
        error: null,
    });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setState({ data: null, isLoading: true, error: null });

            try {
                // Normalize slug: ensure leading/trailing slashes
                const normalizedSlug = `/${slug.replace(/^\/|\/$/g, '')}/`;
                const res = await fetch(`/api/content${normalizedSlug}`);

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
    }, [slug]);

    return state;
}
