/**
 * Finding Activity mode's elements on the live page again (src/components/ActivityMode.tsx).
 * Kept apart from the component so the checks can run it against a page.
 */
import type { PathSegment } from './page-activity';

/** Walks ODP's path from its anchor (the nearest element with an id) down to the element. */
export function resolveElement(segments: PathSegment[], root: Document = document): Element | null {
  const [anchor, ...rest] = segments;
  let el: Element | null = anchor?.id ? root.getElementById(anchor.id) : null;
  for (const seg of rest) {
    if (!el) return null;
    if (seg.id) {
      el = root.getElementById(seg.id);
      continue;
    }
    const kids = Array.from(el.children);
    const byNth = seg.nth ? kids[seg.nth - 1] : undefined;
    if (byNth && byNth.tagName.toLowerCase() === seg.tag) {
      el = byNth;
      continue;
    }
    let cands = kids.filter((k) => k.tagName.toLowerCase() === seg.tag);
    if (cands.length > 1 && seg.classes.length) {
      const exact = cands.filter((k) => seg.classes.every((c) => k.classList.contains(c)));
      if (exact.length) cands = exact;
    }
    el = cands[0] ?? null;
  }
  return el;
}

/** The visible words of a button, as the tracking hook sends them. */
export function buttonWords(el: Element): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"], .material-symbols-outlined, .material-icons, .sr-only, svg').forEach((n) => n.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

