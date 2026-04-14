import { useEffect, useRef } from 'react';

/**
 * ODP tracking hook for VS Writer pages.
 *
 * Sends events to /api/odp-event which proxies them to the ODP Events API.
 * Tracks: page view, section visibility, CTA clicks, engagement on exit.
 */

/** Sections tracked on DynamicComparisonPage */
const COMPARISON_SECTIONS = [
  'hero', 'logos', 'features', 'comparison', 'analyst', 'testimonials', 'faq', 'promo', 'final-cta',
];

/** Sections tracked on ABMHyperPage */
const ABM_SECTIONS = [
  'hero', 'intel', 'challenge', 'comparison', 'proof', 'roi', 'migration', 'cta',
];

/** Get or create a anonymous visitor ID persisted in localStorage */
function getVuid(): string {
  const key = 'odp_vuid';
  let vuid = localStorage.getItem(key);
  if (!vuid) {
    vuid = 'vuid-' + crypto.randomUUID();
    localStorage.setItem(key, vuid);
  }
  return vuid;
}

/** Fire-and-forget: send an ODP event via the server-side proxy */
function odpEvent(type: string, action: string, data: Record<string, string | number>) {
  const vuid = getVuid();
  const event = {
    type,
    action,
    identifiers: { vuid },
    data: { ...data, url: window.location.href },
  };

  // Use sendBeacon for exit events, fetch for everything else
  if (action === 'engagement') {
    navigator.sendBeacon('/api/odp-event', JSON.stringify({ events: [event] }));
  } else {
    fetch('/api/odp-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      keepalive: true,
    }).catch(() => {});
  }
}

export function useOdpTracking(pageType: 'comparison' | 'abm', slug?: string) {
  const viewedSections = useRef(new Set<string>());
  const startTime = useRef(Date.now());
  const maxScrollPct = useRef(0);
  const engagementSent = useRef(false);

  useEffect(() => {
    // Reset on mount (SPA navigation)
    viewedSections.current.clear();
    startTime.current = Date.now();
    maxScrollPct.current = 0;
    engagementSent.current = false;

    const pageSlug = slug || window.location.pathname;

    // ── Page view ──────────────────────────────────────────────────
    odpEvent('vswriter', 'pageview', {
      page_type: pageType,
      slug: pageSlug,
    });

    // ── Section visibility ─────────────────────────────────────────
    const sectionIds = pageType === 'abm' ? ABM_SECTIONS : COMPARISON_SECTIONS;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          if (!id || viewedSections.current.has(id)) return;
          viewedSections.current.add(id);
          odpEvent('vswriter', 'navigation', { section: id });
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

      // Any CTA button (primary, secondary, emphasized)
      const btn = target.closest('a[class*="btn"], button[class*="btn"]') as HTMLElement | null;
      if (btn) {
        const label = btn.textContent?.trim() || '';
        const href = (btn as HTMLAnchorElement).href || '';
        odpEvent('vswriter', 'click', { element: 'cta', label, href });
        return;
      }

      // Comparison table tab
      const tab = target.closest('[data-product]') as HTMLElement | null;
      if (tab) {
        odpEvent('vswriter', 'click', {
          element: 'comparison_tab',
          tab: tab.dataset.product || tab.textContent?.trim() || '',
        });
        return;
      }

      // FAQ accordion item
      const faqTrigger = target.closest('[class*="accordion"]') as HTMLElement | null;
      if (faqTrigger) {
        const title = faqTrigger.textContent?.trim().slice(0, 80) || '';
        odpEvent('vswriter', 'click', { element: 'faq', title });
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
      odpEvent('vswriter', 'engagement', {
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
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', updateScroll);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', sendEngagement);
    };
  }, [pageType, slug]);
}
