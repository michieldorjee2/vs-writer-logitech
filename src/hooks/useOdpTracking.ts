import { useEffect, useRef } from 'react';
import { inCmsPreview } from '../lib/cms-preview';
import { isPageClick } from '../lib/activity-dom';
import { ctaLabel, normalizeVuid } from '../lib/page-activity';
import { isStaffBrowser } from '../lib/staff-marker';

/**
 * ODP tracking for the account page, either template.
 *
 * Uses the ODP client SDK (loaded in index.html as zaius-min.js).
 * Tracks: page view, section visibility, CTA clicks, engagement on exit.
 *
 * Never for a signed-in Optimizely person: their browser carries the staff mark
 * (src/lib/staff-marker.ts), index.html does not load the SDK, and this hook sends nothing.
 */

declare global {
  interface Window {
    zaius: {
      event: (name: string, props?: Record<string, string | number>) => void;
      /** The visitor id, once the SDK has loaded. */
      VUID?: string;
      [key: string]: unknown;
    };
  }
}

/**
 * The connect buttons ("Arrange a session"), by id, and where each sits on the page. The ids are
 * set in src/www/AgentPlatformPage.tsx and src/www/ui.tsx (StickyCta).
 */
const CONNECT_POSITIONS: Record<string, string> = {
  'hero-connect-btn': 'hero',
  'sticky-connect-btn': 'sticky',
  'cta-connect-btn': 'close',
};

/** A button's words without its icon: Material icons render their name as text ("bolt"). */
function visibleLabel(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return ctaLabel(aria);
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"], .material-symbols-outlined, .material-icons, .sr-only, svg').forEach((n) => n.remove());
  return ctaLabel(clone.textContent);
}

/**
 * Tells the site which ODP visitor opened this page (api/page-visit.ts), so the booth's Report can ask
 * ODP for their events: ODP cannot list a page's visitors itself. Waits for the SDK to assign the
 * visitor id, up to ten seconds; a visit without one is simply not indexed.
 */
function recordVisit(page: string, signal: { cancelled: boolean }) {
  let tries = 0;
  const attempt = () => {
    if (signal.cancelled) return;
    const vuid = normalizeVuid(window.zaius?.VUID);
    if (!vuid) {
      if (++tries < 20) window.setTimeout(attempt, 500);
      return;
    }
    fetch('/api/page-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, vuid }),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  };
  attempt();
}

/**
 * The account page's scenes by their ids, both templates (src/www/AgentPlatformPage.tsx and
 * src/www/AccountPage.tsx). An id not on the page is a no-op: getElementById returns null.
 */
const ABM_SECTIONS = [
  'hero', 'who', 'intel', 'signals', 'language', 'usecases', 'challenge', 'comparison', 'proof',
  'analysts', 'promo', 'roi', 'migration', 'cta',
];

/** Send an ODP event via the client SDK (queued if SDK still loading) */
function odpEvent(eventType: string, action: string, data?: Record<string, string | number>) {
  try {
    // An editor looking at a draft in the CMS is not a visit.
    if (typeof window !== 'undefined' && window.zaius && !inCmsPreview()) {
      window.zaius.event(eventType, { action, ...data });
    }
  } catch {
    // Silently ignore — SDK may not be loaded yet
  }
}

export function useOdpTracking(pageType: 'abm', slug?: string) {
  const viewedSections = useRef(new Set<string>());
  // Set on mount by the effect below, before anything reads it. Date.now() here
  // would run on every render for a value that is thrown away (react-hooks/purity).
  const startTime = useRef(0);
  const maxScrollPct = useRef(0);
  const engagementSent = useRef(false);

  useEffect(() => {
    // A signed-in Optimizely person is never tracked: no events, no visit recorded.
    if (isStaffBrowser()) return;
    // Reset on mount (SPA navigation)
    viewedSections.current.clear();
    startTime.current = Date.now();
    maxScrollPct.current = 0;
    engagementSent.current = false;

    const pageSlug = slug || window.location.pathname;

    // ── Page view ──────────────────────────────────────────────────
    odpEvent('pageview', 'pageview', {
      page_type: pageType,
      slug: pageSlug,
    });
    const visit = { cancelled: false };
    if (!inCmsPreview()) recordVisit(pageSlug, visit);

    // ── Section visibility ─────────────────────────────────────────
    const sectionIds = ABM_SECTIONS;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          if (!id || viewedSections.current.has(id)) return;
          viewedSections.current.add(id);
          odpEvent('navigation', 'section_view', { section: id });
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.3 },
    );

    // Defer to next frame so React has rendered the sections
    const raf = requestAnimationFrame(() => {
      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    });

    // ── Click tracking (event delegation) ──────────────────────────
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Only the page's own clicks: not the booth rail or its modes, nor anything else over the page.
      if (!(target instanceof Element) || !isPageClick(target)) return;

      // A CTA: the connect buttons and the connect panel's tiles by name (data-cta), any other
      // button on the page by its class. `cta_type` and `position` say which one; the Report counts them.
      const btn = target.closest('[data-cta], a[class*="btn"], button[class*="btn"]') as HTMLElement | null;
      if (btn) {
        const type = btn.dataset.cta || (CONNECT_POSITIONS[btn.id] ? 'connect' : 'cta');
        const position = btn.dataset.ctaPosition || CONNECT_POSITIONS[btn.id] || '';
        const section = btn.closest('section[id]')?.id || '';
        const href = (btn as HTMLAnchorElement).href || '';
        odpEvent('click', 'cta_click', {
          element: type,
          cta_type: type,
          // A contact tile holds a person's name and address; the click is enough.
          label: type === 'contact' ? 'Contact' : visibleLabel(btn),
          href,
          ...(position ? { position } : {}),
          ...(section ? { section } : {}),
        });
        return;
      }

      // Comparison table tab
      const tab = target.closest('[data-product]') as HTMLElement | null;
      if (tab) {
        odpEvent('click', 'tab_click', {
          element: 'comparison_tab',
          tab: tab.dataset.product || tab.textContent?.trim() || '',
        });
        return;
      }

      // FAQ accordion item.
      //
      // Sent as `label`, NOT `title`: `title` is ODP's own page-title field
      // ("The title of the page from which the event was sent"), so sending the
      // FAQ question under that name overwrote the page title on the event row
      // — corrupting the one field that identifies which account page a visit
      // belongs to. `label` is already the registered field for "visible text
      // of the clicked element" and `element` distinguishes faq from cta.
      const faqTrigger = target.closest('[class*="accordion"]') as HTMLElement | null;
      if (faqTrigger) {
        const label = faqTrigger.textContent?.trim().slice(0, 80) || '';
        odpEvent('click', 'faq_click', { element: 'faq', label });
      }
    }

    document.addEventListener('click', handleClick);

    // ── Scroll depth ───────────────────────────────────────────────
    function updateScroll() {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH > 0) {
        maxScrollPct.current = Math.max(
          maxScrollPct.current,
          Math.round((window.scrollY / docH) * 100),
        );
      }
    }

    window.addEventListener('scroll', updateScroll, { passive: true });

    // ── Engagement summary on exit ─────────────────────────────────
    function sendEngagement() {
      if (engagementSent.current) return;
      engagementSent.current = true;
      updateScroll();
      odpEvent('engagement', 'page_exit', {
        page_type: pageType,
        slug: pageSlug,
        time_on_page_sec: Math.round((Date.now() - startTime.current) / 1000),
        max_scroll_pct: maxScrollPct.current,
        sections_viewed: Array.from(viewedSections.current).join(','),
      });
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') sendEngagement();
    }

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', sendEngagement);

    // ── Cleanup ────────────────────────────────────────────────────
    return () => {
      visit.cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', updateScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', sendEngagement);
    };
  }, [pageType, slug]);
}
