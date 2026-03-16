import { useState, useEffect } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';

interface PreviewContentState {
    data: CompetitorComparisonPage | null;
    isLoading: boolean;
    error: string | null;
}

export function usePreviewContent(params: URLSearchParams): PreviewContentState {
    const [state, setState] = useState<PreviewContentState>({
        data: null,
        isLoading: true,
        error: null,
    });

    const key = params.get('key');
    const ver = params.get('ver');
    const loc = params.get('loc');

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!key) {
                setState({ data: null, isLoading: false, error: 'Missing key parameter' });
                return;
            }

            setState({ data: null, isLoading: true, error: null });

            try {
                const qs = new URLSearchParams({ key });
                if (ver) qs.set('ver', ver);
                if (loc) qs.set('loc', loc);

                const res = await fetch(`/api/preview?${qs}`);

                if (!res.ok) {
                    throw new Error(res.status === 404 ? 'Content not found' : `Failed to load (${res.status})`);
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
    }, [key, ver, loc]);

    return state;
}
