/**
 * The page's clicks, in the browser: which clicks are the page's (isPageClick, for the tracking
 * hook), and finding a clicked element again (resolveElement, for the report's per-element clicks,
 * not drawn by the Report card at the moment). Kept apart from components so the checks can run
 * them against a stand-in page.
 */
import type { PathSegment } from './page-activity';

/** Everything the booth tools draw over the page (FloatingSidebar and its modes). */
export const BOOTH_CHROME =
  '.booth-rail, .booth-rail-mini, .activity-view, .xray-fixed-layer, .xray-overlay, .edit-overlay, .edit-fixed-layer, .edit-popup, .edit-landed-toast, .edit-working-modal, .employee-link-alert';
/** The page a visitor reads: the www page's root (src/www/ui.tsx, WwwPage). The sticky bar is inside it. */
export const PAGE_ROOT = '.www-page';

/**
 * A click on the page itself: inside the page's root, or on one of its named CTAs that live outside
 * it (the connect panel is portaled to <body>; its tiles carry data-cta). Never the booth rail or
 * its modes, and nothing else drawn over the page (a dialog's close button, a browser extension).
 */
export function isPageClick(target: Element): boolean {
  if (target.closest(BOOTH_CHROME)) return false;
  return Boolean(target.closest(PAGE_ROOT) || target.closest('[data-cta]'));
}

/**
 * Walks ODP's path from its anchor (the nearest element with an id) down to the element.
 *
 * Strict on purpose: every step must have the tag and every class ODP recorded for it (classes
 * the page toggles were already dropped, src/lib/page-activity.ts). A click recorded on an older
 * layout of the page (the template changed on 2 Nov 2026) can line up by position with something
 * unrelated today; it is not found, rather than drawn on the wrong element.
 */
export function resolveElement(segments: PathSegment[], root: Document = document): Element | null {
  const [anchor, ...rest] = segments;
  let el: Element | null = anchor?.id ? root.getElementById(anchor.id) : null;
  const fits = (k: Element, seg: PathSegment) => k.tagName.toLowerCase() === seg.tag && seg.classes.every((c) => k.classList.contains(c));
  for (const seg of rest) {
    if (!el) return null;
    if (seg.id) {
      el = root.getElementById(seg.id);
      if (el && !fits(el, seg)) return null;
      continue;
    }
    const kids = Array.from(el.children);
    if (seg.nth) {
      const k = kids[seg.nth - 1];
      el = k && fits(k, seg) ? k : null;
      continue;
    }
    el = kids.find((k) => fits(k, seg)) ?? null;
  }
  return el;
}

/** The visible words of a button, as the tracking hook sends them. */
export function buttonWords(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"], .material-symbols-outlined, .material-icons, .sr-only, svg').forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

