/**
 * The search page gets the page a rep is about to open ready before they open it
 * (src/components/SearchHome.tsx, `useWarmPage`).
 *
 * The row the pointer rests on, or the arrow keys or the search box have made the active one,
 * is the page most likely opened next. A moment after the rep settles on it (or at once, on a
 * mouse press) its page is:
 *   - prerendered, where the browser has Speculation Rules (Chrome, Edge): fetched, drawn and
 *     hydrated out of sight, so the click shows it at once. The view transition into it still
 *     runs: a prerendered page gets `pagereveal` when it is shown.
 *   - requested once, elsewhere (Safari, Firefox): the browser does not keep the response, but
 *     the edge cache now holds it, so the click's own request is a hit instead of a render.
 * The rows are <button>s that call location.assign, not links, so Speculation Rules' document
 * rules cannot find them: this writes a list rule with the one or two addresses instead, and
 * replaces it as the rep moves on (Chrome drops a prerender no rule names any more).
 *
 * Safe to run early. Only signed-in Optimizely people reach /search, and their browsers carry the
 * staff mark (src/lib/staff-marker.ts): a page they load sends nothing to ODP and has the
 * Optimizely snippet opted out (index.html), and useOdpTracking records no visit. What the booth
 * rail reads on load (/api/auth/me, page activity, share links) are GETs. Nothing a page does
 * while it loads writes anything.
 */
import { useEffect, useRef } from 'react';

/** A search page row, as much of it as says which page it opens. */
export type PageRow = {
  kind: string;
  item?: { kind: 'company'; entry: { slug: string } } | { kind: 'person'; person: { slug: string } };
};

/**
 * The address SearchHome's `open()` sends a row to: `/${slug}?search=1`. Keep the two the same:
 * a prerendered page is shown only for exactly the address it was made for. Rows that open a new
 * tab (offers, builds) or ask Mark for a page have none.
 */
export function pageHrefOf(row: PageRow | null | undefined): string | null {
  if (row?.kind !== 'item' || !row.item) return null;
  const slug = row.item.kind === 'company' ? row.item.entry.slug : row.item.person.slug;
  return slug ? `/${slug}?search=1` : null;
}

/** How long a row stays the active one before its page is made ready: past a pointer sweeping across the list. */
export const SETTLE_MS = 120;
/** Prerendered at once, at most: the last two rows settled on. */
export const KEEP = 2;

type Doc = Pick<Document, 'createElement' | 'head'>;

/** What has been asked for, per page (a module: one search page per document). */
const state = { rules: null as HTMLScriptElement | null, prerendering: [] as string[], requested: new Set<string>() };

export function canPrerender(): boolean {
  return typeof HTMLScriptElement !== 'undefined' && typeof HTMLScriptElement.supports === 'function' && HTMLScriptElement.supports('speculationrules');
}

/** The Speculation Rules list for `hrefs`, as the <script type="speculationrules"> text. */
export function prerenderRules(hrefs: string[]): string {
  return JSON.stringify({ prerender: [{ source: 'list', urls: hrefs }] });
}

/** Get the page at `href` ready: prerendered where the browser can, otherwise requested once to warm the edge cache. */
export function warmPage(href: string, doc: Doc = document, prerender = canPrerender()): void {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  if (prerender) {
    if (state.prerendering[0] === href) return;
    state.prerendering = [href, ...state.prerendering.filter((h) => h !== href)].slice(0, KEEP);
    const rules = doc.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = prerenderRules(state.prerendering);
    // The new list first, then the old one out: an address on both is never left unnamed, so its prerender carries on.
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
 * rep to do one of those, so a search page merely opened makes nothing ready.
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
  state.prerendering = [];
  state.requested.clear();
}
