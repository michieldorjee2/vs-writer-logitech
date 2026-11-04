import { useState, useEffect, useCallback } from 'react';
import type { PreviewContent } from '../lib/graph-types';

interface PreviewContentState {
    data: PreviewContent | null;
    isLoading: boolean;
    error: string | null;
    /** A later draft is loading while the current one stays on screen. */
    isRefreshing: boolean;
    /** Fetch the same draft again (the CMS saved it and the preview token is unchanged). */
    reload: () => void;
}

/** What one fetch answered, and for which request (key, version, locale, token, attempt). */
interface Loaded {
    request: string;
    data: PreviewContent | null;
    error: string | null;
}

/**
 * The draft the CMS is previewing: `key`, `ver`, `loc` and the editor's `preview_token` from the
 * preview URL, resolved by /api/preview into the same content the live address renders.
 *
 * Saves are not watched here: the CMS SDK's PreviewComponent (CmsPreview.tsx) waits for each save
 * to be ready, then either routes to the new preview URL (a new token or version: new params, so
 * this fetches again) or calls `reload`. What is on screen stays up while the next draft loads,
 * and a failed refresh keeps it rather than blanking the editor's view.
 */
export function usePreviewContent(params: URLSearchParams): PreviewContentState {
    const [attempt, setAttempt] = useState(0);
    const reload = useCallback(() => setAttempt((n) => n + 1), []);
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    const key = params.get('key');
    const ver = params.get('ver');
    const loc = params.get('loc');
    const token = params.get('preview_token');
    const request = key ? JSON.stringify([key, ver, loc, token, attempt]) : null;

    useEffect(() => {
        if (!key || !request) return;
        const ac = new AbortController();
        const qs = new URLSearchParams({ key });
        if (ver) qs.set('ver', ver);
        if (loc) qs.set('loc', loc);
        if (token) qs.set('preview_token', token);

        fetch(`/api/preview?${qs}`, { signal: ac.signal, cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error(res.status === 404 ? 'Content not found' : `Failed to load (${res.status})`);
                const content: PreviewContent = await res.json();
                setLoaded({ request, data: content, error: null });
            })
            .catch((err: Error) => {
                if (ac.signal.aborted) return;
                setLoaded((prev) => (prev?.data ? { ...prev, request } : { request, data: null, error: err.message }));
            });
        return () => ac.abort();
    }, [key, ver, loc, token, request]);

    if (!key) return { data: null, isLoading: false, isRefreshing: false, error: 'Missing key parameter', reload };
    const settled = loaded?.request === request;
    const data = loaded?.data ?? null;
    return {
        data,
        isLoading: !data && !settled,
        isRefreshing: !!data && !settled,
        error: settled && loaded ? loaded.error : null,
        reload,
    };
}
