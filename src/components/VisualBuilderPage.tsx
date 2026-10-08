import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import VisualBuilderExperience from '../cms/rendering/visual-builder';
import type { SafeVisualBuilderExperience } from '@/lib/optimizely/types/experience';

/**
 * `/vb/:slug` — one Visual Builder experience, drawn from its composition.
 *
 * WHY ITS OWN ROUTE AND NOT THE CATCH-ALL. `/*` is `PageLoader`, which serves the 2,695
 * pages on the flat content types and picks a renderer by sniffing which fields happen to be
 * populated. An experience has none of those fields, so it would fall through every arm of
 * that dispatch to `DynamicComparisonPage` and render an empty shell. A prefix route cannot
 * collide with it: react-router matches `/vb/:slug` ahead of `/*` because it is the more
 * specific pattern, and no legacy page's slug begins with `vb/` (they are all single-segment
 * company slugs).
 *
 * The fetch asks `/api/content?kind=experience`, a branch that exists in both the deployed
 * function and the dev proxy and that runs a SEPARATE Graph operation from `PAGE_QUERY`. The
 * page-level properties on an experience are identity, branding, meta and provenance only —
 * every line of copy is an element node inside `composition`, which is what the wrapper below
 * walks.
 */

type Experience = SafeVisualBuilderExperience & Record<string, unknown>;

interface ExperienceState {
  data: Experience | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Take the experience server/ssr-handler.tsx embedded, once. The first render has to draw
 * exactly what the server drew, or hydration fails — and this hook used to ignore the
 * embedded copy, render a spinner where the server had rendered the page, fail hydration
 * (#418), throw the server HTML away and fetch the same experience again.
 */
function consumeSSRExperience(): Experience | null {
  if (typeof window === 'undefined' || !window.__SSR_DATA__) return null;
  const data = window.__SSR_DATA__ as Experience;
  delete window.__SSR_DATA__;
  return data;
}

function useExperience(slug: string): ExperienceState {
  // Keyed to the slug it was rendered for: an in-app navigation to another /vb/ page must
  // fetch, not keep showing the one the server embedded.
  const [ssr] = useState(() => ({ slug, data: consumeSSRExperience() }));
  const [state, setState] = useState<ExperienceState>({
    data: ssr.data,
    isLoading: !ssr.data,
    error: null,
  });

  useEffect(() => {
    if (ssr.data && slug === ssr.slug) return;
    let cancelled = false;

    async function load() {
      setState({ data: null, isLoading: true, error: null });
      try {
        const cleanSlug = slug.replace(/^\/|\/$/g, '');
        const res = await fetch(
          `/api/content?kind=experience&slug=${encodeURIComponent(cleanSlug)}`,
        );
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? 'Experience not found' : `Failed to load (${res.status})`,
          );
        }
        const page = await res.json();
        if (!cancelled) setState({ data: page, isLoading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({ data: null, isLoading: false, error: (err as Error).message });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, ssr]);

  return state;
}

/**
 * Title and description, set directly rather than through `useHeadMeta`.
 *
 * `useHeadMeta` takes a `CompetitorComparisonPage` and also writes canonical + JSON-LD for a
 * comparison page, which an experience is not. An experience carries `noIndex` for a reason —
 * these pages name a real company and often a named individual — so the robots tag is set
 * here too rather than left to the response header alone.
 */
function useExperienceHead(page: Record<string, unknown> | null) {
  useEffect(() => {
    if (!page) return;

    const title = typeof page.PageTitle === 'string' ? page.PageTitle : null;
    const previousTitle = document.title;
    if (title) document.title = title;

    const meta: HTMLMetaElement[] = [];
    const setMeta = (name: string, content: string) => {
      const el = document.createElement('meta');
      el.setAttribute('name', name);
      el.setAttribute('content', content);
      document.head.appendChild(el);
      meta.push(el);
    };

    if (typeof page.MetaDescription === 'string' && page.MetaDescription) {
      setMeta('description', page.MetaDescription);
    }
    if (page.noIndex !== false) setMeta('robots', 'noindex, nofollow');

    return () => {
      document.title = previousTitle;
      for (const el of meta) el.remove();
    };
  }, [page]);
}

export default function VisualBuilderPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { data, isLoading, error } = useExperience(slug || '');

  useExperienceHead(data);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-t-optimizely-blue h-8 w-8 animate-spin rounded-full border-2 border-gray-300" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-medium text-white">No experience at /vb/{slug}</h1>
        <p className="max-w-md text-lg text-gray-400">
          {error || 'This slug does not resolve to an ABMExperience or PersonExperience.'}
        </p>
      </div>
    );
  }

  return (
    /*
     * `vb-experience` is the capture's ready selector (scripts/visual-baseline.mjs) as well
     * as the page root: a route with no distinguishing selector screenshots its own spinner.
     *
     * `text-secondary-darkfir` IS LOAD-BEARING, not decoration. This app's global rule is
     * `body { background:#08251a; color:#eff6e9 }` — it is a dark-themed site — while every
     * vendored opticom component is written for optimizely.com, whose body colour is the
     * browser default black. A component that colours itself `text-current/70` (the news
     * item, the analyst card, the timeline rule) therefore inherits near-WHITE and vanishes
     * on the white and light_gray bands this blueprint uses for two thirds of the page. The
     * dark bands are unaffected: `BlankSection` puts `text-white` on the band itself, which
     * is more specific than this inherited default. Setting it here keeps the fix inside the
     * one route — `body` belongs to 2,695 pages that want the light-on-dark default.
     */
    <div className="vb-experience bg-primary-1 text-secondary-darkfir flex min-h-screen w-full flex-col">
      <VisualBuilderExperience
        experience={data}
        locale="en"
        preview={searchParams.get('ctx') === 'edit'}
      />
    </div>
  );
}
