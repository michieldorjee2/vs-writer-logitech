import { useState, useEffect, useCallback } from 'react';
import type { PreviewContent } from '../lib/graph-types';

interface PreviewContentState {
    data: PreviewContent | null;
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

    const load = useCallback(async () => {
        if (!key) {
            setState({ data: null, isLoading: false, error: 'Missing key parameter' });
            return;
        }

        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const qs = new URLSearchParams({ key });
            if (ver) qs.set('ver', ver);
            if (loc) qs.set('loc', loc);

            const res = await fetch(`/api/preview?${qs}`);

            if (!res.ok) {
                throw new Error(res.status === 404 ? 'Content not found' : `Failed to load (${res.status})`);
            }

            const content: PreviewContent = await res.json();
            setState({ data: content, isLoading: false, error: null });
        } catch (err) {
            setState({ data: null, isLoading: false, error: (err as Error).message });
        }
    }, [key, ver, loc]);

    // Initial load
    useEffect(() => {
        load();
    }, [load]);

    // Listen for CMS editor content-saved messages to re-fetch
    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            // Optimizely CMS SaaS sends postMessage events when content is updated
            // The message data varies but typically includes contentSaved-type events
            const data = event.data;
            if (!data) return;

            // Handle both string and object message formats from CMS editor
            const isContentUpdate =
                (typeof data === 'string' && (
                    data.includes('contentSaved') ||
                    data.includes('contentPublished')
                )) ||
                (typeof data === 'object' && (
                    data.type === 'beta/contentSaved' ||
                    data.type === 'contentSaved' ||
                    data.type === 'beta/contentPublished' ||
                    data.type === 'contentPublished' ||
                    data.action === 'updated' ||
                    data.action === 'saved'
                ));

            if (isContentUpdate) {
                // Re-fetch preview content after a short delay to allow Graph to update
                setTimeout(() => load(), 500);
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [load]);

    return state;
}
