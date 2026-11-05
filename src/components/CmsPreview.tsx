import { lazy, Suspense, useEffect, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PreviewComponent } from '@optimizely/cms-sdk/react/client';
import { usePreviewContent } from '../hooks/usePreviewContent';
import { useHeadMeta } from '../hooks/useHeadMeta';
import type { CompetitorComparisonPage, PersonPage as PersonPageData, PreviewBlock } from '../lib/graph-types';
import { agentPlatformHead } from '../www/agent-platform/content';
import { accountTemplateOf } from '../www/account-template';
import { CmsEditProvider } from '../www/cms-edit';
import type { Experience } from './VisualBuilderPage';

/**
 * `/preview` — the CMS's preview of a draft. The Showcase application in the CMS sends every page,
 * experience, section and component here (its preview URL format is
 * `{host}/preview?key={key}&ver={version}&loc={locale}&ctx={context}`, plus `preview_token`).
 *
 * It draws what the live address draws, from the same content (/api/preview):
 *   - an account page: the template its pitch calls for (src/www/account-template.ts)
 *   - a person page: the www person page (src/www/PersonPage.tsx)
 *   - an offer page: the www offer design; any other experience: its composition (ExperienceBody)
 *   - one of the few legacy blocks still in the CMS: BlockPreview
 *
 * Editing goes through Optimizely's CMS SDK (@optimizely/cms-sdk):
 *   - the CMS's communication injector, loaded from the CMS instance, connects this frame to the
 *     editor;
 *   - `PreviewComponent` hears each save, waits until the CMS says the draft is ready, and hands
 *     over the new preview URL: a new token or version is routed to (the draft is fetched again),
 *     the same URL is re-fetched in place, with no full reload either way;
 *   - in `ctx=edit`, the pages carry the SDK's `data-epi-edit` / `data-epi-block-id` hooks
 *     (src/www/cms-edit.tsx), which the editor outlines and opens.
 */

/** The CMS instance the editor runs on. Its scripts and media are served from here. */
const CMS_URL = (() => {
    const fromEnv = import.meta.env.VITE_CMS_URL as string | undefined;
    const url = fromEnv && /^https:\/\/[a-z0-9.-]+$/i.test(fromEnv.replace(/\/+$/, '')) ? fromEnv : 'https://app-opti01saas4uc99t001.cms.optimizely.com';
    return url.replace(/\/+$/, '');
})();
const INJECTOR_ID = 'opti-cms-injector';

const AccountRoute = lazy(() => import('../www/AccountRoute'));
const PersonPage = lazy(() => import('../www/PersonPage'));
const ExperienceBody = lazy(() => import('./VisualBuilderPage').then((m) => ({ default: m.ExperienceBody })));
const BlockPreview = lazy(() => import('./BlockPreview'));

const EXPERIENCE_TYPES = new Set(['ABMExperience', 'PersonExperience']);

function Spinner() {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-optimizely-blue" />
        </div>
    );
}

/**
 * The CMS sizes its preview frame to the page's height, so the page must not size itself by the
 * frame's: with this on <html>, the www design lays out for a 900 px window (src/www/www.css).
 */
function useFixedWindowHeight() {
    useLayoutEffect(() => {
        document.documentElement.setAttribute('data-cms-preview', '');
        return () => document.documentElement.removeAttribute('data-cms-preview');
    }, []);
}

/** The CMS's script that connects this frame to the editor (on-page editing, save messages). */
function useCommunicationInjector() {
    useEffect(() => {
        if (document.getElementById(INJECTOR_ID)) return;
        const script = document.createElement('script');
        script.id = INJECTOR_ID;
        script.src = `${CMS_URL}/util/javascript/communicationinjector.js`;
        script.async = true;
        document.head.appendChild(script);
    }, []);
}

export default function CmsPreview() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { data, isLoading, isRefreshing, error, reload } = usePreviewContent(searchParams);
    const editing = searchParams.get('ctx') === 'edit';
    useFixedWindowHeight();
    useCommunicationInjector();

    const isAccountPage = data?.__typename === 'CompetitorComparisonPage';
    const headPage = useMemo(() => {
        if (!isAccountPage) return null;
        const page = data as CompetitorComparisonPage;
        return accountTemplateOf(page) === 'agent-platform' ? agentPlatformHead(page) : page;
    }, [data, isAccountPage]);
    useHeadMeta(headPage);

    /*
     * The SDK hands over the draft's new preview URL. Only its path and query are used, on this
     * origin: the CMS names its primary host (showcase.optimizely.com), and a preview deployment
     * of this site must keep showing its own build, not move the editor's frame to production.
     */
    const onNavigate = (url: string, isSameUrl: boolean) => {
        if (isSameUrl) return reload();
        let next: URL;
        try {
            next = new URL(url, window.location.origin);
        } catch {
            return reload();
        }
        const target = `${next.pathname}${next.search}`;
        if (target === `${window.location.pathname}${window.location.search}`) return reload();
        navigate(target, { replace: true });
    };

    let body;
    if (isLoading) body = <Spinner />;
    else if (error || !data) {
        body = (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
                <h1 className="text-4xl font-medium text-white">Preview unavailable</h1>
                <p className="max-w-md text-lg text-gray-400">{error || 'Content not found'}</p>
            </div>
        );
    } else if (isAccountPage) {
        body = <AccountRoute page={data as CompetitorComparisonPage} search={searchParams.toString()} />;
    } else if ((data.__typename as string) === 'PersonPage') {
        body = <PersonPage page={data as unknown as PersonPageData} />;
    } else if (EXPERIENCE_TYPES.has(String(data.__typename))) {
        body = <ExperienceBody experience={data as unknown as Experience} preview={editing} />;
    } else {
        body = <BlockPreview block={data as PreviewBlock} />;
    }

    return (
        <CmsEditProvider editing={editing}>
            <PreviewComponent onNavigate={onNavigate} busy={isRefreshing} cmsUrl={CMS_URL}>
                <div className="cms-preview-busy" role="status">
                    Updating preview…
                </div>
            </PreviewComponent>
            <Suspense fallback={<Spinner />}>{body}</Suspense>
        </CmsEditProvider>
    );
}
