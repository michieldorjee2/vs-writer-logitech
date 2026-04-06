import { useState, useEffect, useCallback, useRef } from 'react';
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
    const previewToken = params.get('preview_token');

    // Store the latest token (may be refreshed by CMS events)
    const tokenRef = useRef(previewToken);
    tokenRef.current = previewToken;

    const load = useCallback(async (overrideToken?: string) => {
        if (!key) {
            setState({ data: null, isLoading: false, error: 'Missing key parameter' });
            return;
        }

        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const qs = new URLSearchParams({ key });
            if (ver) qs.set('ver', ver);
            if (loc) qs.set('loc', loc);

            // Use override token (from contentSaved event) or the URL token
            const token = overrideToken || tokenRef.current;
            if (token) qs.set('preview_token', token);

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

    // Listen for CMS SaaS live preview events
    useEffect(() => {
        // 1. Named custom event: optimizely:cms:contentSaved (per SaaS docs)
        //    Includes fresh previewToken and previewUrl
        function handleContentSaved(event: Event) {
            const detail = (event as CustomEvent).detail;
            if (detail?.previewToken) {
                tokenRef.current = detail.previewToken;
            }
            setTimeout(() => load(detail?.previewToken), 300);
        }

        // 2. Fallback: generic postMessage for older CMS versions
        function handleMessage(event: MessageEvent) {
            const data = event.data;
            if (!data) return;

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
                // Extract fresh token if available in the message
                const freshToken = typeof data === 'object' ? data.previewToken : null;
                if (freshToken) tokenRef.current = freshToken;
                setTimeout(() => load(freshToken || undefined), 500);
            }
        }

        window.addEventListener('optimizely:cms:contentSaved', handleContentSaved);
        window.addEventListener('message', handleMessage);

        return () => {
            window.removeEventListener('optimizely:cms:contentSaved', handleContentSaved);
            window.removeEventListener('message', handleMessage);
        };
    }, [load]);

    return state;
}

/** Returns true when ctx=edit (CMS editor mode with property overlays) */
export function useIsEditMode(): boolean {
    const [searchParams] = (typeof window !== 'undefined'
        ? [new URLSearchParams(window.location.search)]
        : [new URLSearchParams()]);
    return searchParams.get('ctx') === 'edit';
}
