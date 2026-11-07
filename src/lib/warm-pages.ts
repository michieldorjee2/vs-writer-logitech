/**
 * The search page fetches the page a rep is about to open before they open it
 * (src/components/SearchHome.tsx, `useWarmPage`).
 *
 * The row the pointer rests on, or the arrow keys or the search box have made the active one,
 * is the page most likely opened next. A moment after the rep settles on it (or at once, on a
 * mouse press) its page is:
 *   - prefetched, where the browser has Speculation Rules (Chrome, Edge): the HTML is fetched and
 *     held, and the click's navigation uses it, so the page starts drawing at once.
 *   - requested once, elsewhere (Safari, Firefox): the browser does not keep the response, but
 *     the edge cache now holds it, so the click's own request is a hit instead of a render.
 * The rows are <button>s that call location.assign, not links, so Speculation Rules' document
 * rules cannot find them: this writes a list rule with the one or two addresses instead, and
 * replaces it as the rep moves on.
 *
 * Prefetched, never prerendered. A prerendered page runs before the click, and the view
 * transition from the search page needs the page's start for itself: the booth rail's room is
 * made as the page is revealed, before the rail mounts (src/lib/view-transitions-boot.js), and
 * the app hydrates only once the morph is over (src/lib/after-view-transition.ts), because
 * hydration landing in the morph cancelled it (#46). A prerender has mounted its rail before it
 * is revealed, and one shown while still starting would hydrate during the morph. Chrome also
 * turns prerendering off under test automation, so no check could ever watch that path. The
 * fetch is where the time was (the document's TTFB from the click, 778 ms to 4 ms locally on
 * 6 Nov 2026); the rest of the page draws during the morph.
 *
 * Fetches only GET a page's HTML, with the rep's cookies (same-origin): nothing runs, nothing is
 * recorded.
 */
import { useEffect, useRef } from 'react';

/** A search page row, as much of it as says which page it opens. */
export type PageRow = {
  kind: string;
  item?: { kind: 'company'; entry: { slug: string } } | { kind: 'person'; person: { slug: string } };
  page?: { route: string };
};

/**
 * The address SearchHome sends a row to in the same tab: a company or person row to
 * `/${slug}?search=1` (`open()`), an offer row to its own route (`pick()`). Keep them the same: a
 * prefetched page is used only for exactly the address it was fetched for. Rows that open a new
 * tab (builds) or ask Mark for a page have none.
 */
export function pageHrefOf(row: PageRow | null | undefined): string | null {
  if (row?.kind === 'offer' && row.page?.route) return `/${row.page.route.replace(/^\/+/, '')}`;
  if (row?.kind !== 'item' || !row.item) return null;
  const slug = row.item.kind === 'company' ? row.item.entry.slug : row.item.person.slug;
  return slug ? `/${slug}?search=1` : null;
}

/** How long a row stays the active one before its page is fetched: past a pointer sweeping across the list. */
export const SETTLE_MS = 120;
/** Prefetched at once, at most: the last two rows settled on. */
export const KEEP = 2;

type Doc = Pick<Document, 'createElement' | 'head'>;

/** What has been asked for, per page (a module: one search page per document). */
const state = { rules: null as HTMLScriptElement | null, prefetching: [] as string[], requested: new Set<string>() };

export function canSpeculate(): boolean {
  return typeof HTMLScriptElement !== 'undefined' && typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('speculationrules');
}

/** The Speculation Rules list for `hrefs`, as the <script type="speculationrules"> text. Prefetch only (see above). */
export function prefetchRules(hrefs: string[]): string {
  return JSON.stringify({ prefetch: [{ source: 'list', urls: hrefs }] });
}

/** Get the page at `href` ready: prefetched where the browser can, otherwise requested once to warm the edge cache. */
export function warmPage(href: string, doc: Doc = document, speculate = canSpeculate()): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  if (speculate) {
    if (state.prefetching[0] === href) return;
    state.prefetching = [href, ...state.prefetching.filter((h) => h !== href)].slice(0, KEEP);
    const rules = doc.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = prefetchRules(state.prefetching);
    // The new list first, then the old one out: an address on both is never left unnamed, so its fetch carries on.
    doc.head.append(rules);
    state.rules?.remove();
    state.rules = rules;
    return;
  }
  if (state.requested.has(href)) return;
  state.requested.add(href);
  fetch(href, { credentials: 'same-origin', priority: 'low' } as RequestInit)
    .then((res) => res.arrayBuffer())
    .catch(() => state.requested.delete(href));
}

/**
 * Get the active row's page ready once the rep settles on it. `row` is SearchHome's active row
 * (`navRows[activeIdx]`), which a hovered row, the arrow keys and typing all move. Waits for the
 * rep to do one of those, so a search page merely opened fetches nothing.
 */
export function useWarmPage(row: PageRow | null | undefined): void {
  const href = pageHrefOf(row);
  const latest = useRef<string | null>(href);
  useEffect(() => {
    latest.current = href;
  }, [href]);

  useEffect(() => {
    let timer = 0;
    const soon = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (latest.current && document.visibilityState === 'visible') warmPage(latest.current);
      }, ms);
    };
    const onRow = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.sh-row')) return;
      // A touch has made no row active before it lands; the row it lands on opens at once anyway.
      if (event.pointerType === 'touch') return;
      soon(event.type === 'pointerdown' ? 0 : SETTLE_MS);
    };
    const onKey = () => soon(SETTLE_MS);
    document.addEventListener('pointerover', onRow, { passive: true });
    document.addEventListener('pointerdown', onRow, { capture: true, passive: true });
    document.addEventListener('keydown', onKey, { capture: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerover', onRow);
      document.removeEventListener('pointerdown', onRow, { capture: true });
      document.removeEventListener('keydown', onKey, { capture: true });
    };
  }, []);
}

/** For the checks: forget what was asked for. */
export function resetWarmPages(): void {
  state.rules = null;
  state.prefetching = [];
  state.requested.clear();
}
