/**
 * In-place edit animation: mutate the REAL page element so the visitor
 * sees the actual H1 (or stat, stakeholder, etc.) get struck through and
 * rewritten — not a card off to the side. This is an optimistic preview
 * of the change the agent is committing via update_page; once the CMS
 * republishes we reload and the real content takes over.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type InplaceAction = 'replace' | 'remove' | 'add';

/** Find the first text node (across the section's elements) that contains
 *  `needle`. Tolerant of whitespace differences between CMS copy and DOM. */
function findHit(
  els: Element[],
  needleRaw: string,
): { node: Text; index: number; length: number; host: HTMLElement } | null {
  const needle = needleRaw.trim();
  if (!needle) return null;
  const tolerant = new RegExp(
    needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
  );
  for (const el of els) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      const v = t.nodeValue || '';
      let idx = v.indexOf(needle);
      let len = needle.length;
      if (idx < 0) {
        const m = tolerant.exec(v);
        if (m) {
          idx = m.index;
          len = m[0].length;
        }
      }
      if (idx >= 0) return { node: t, index: idx, length: len, host: el as HTMLElement };
    }
  }
  return null;
}

async function typeInto(span: HTMLElement, text: string, signal?: AbortSignal): Promise<void> {
  const caret = document.createElement('span');
  caret.className = 'live-inplace__caret';
  span.textContent = '';
  span.appendChild(caret);
  const step = Math.max(14, 1000 / 52);
  for (let i = 0; i < text.length; i++) {
    if (signal?.aborted) break;
    caret.insertAdjacentText('beforebegin', text[i]);
    await sleep(step);
  }
  caret.remove();
  if (signal?.aborted) span.textContent = text;
}

function scrollTo(el: HTMLElement) {
  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    el.scrollIntoView();
  }
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** Whole-element fallback: find the element whose full text (across child
 *  spans / GSAP char-splits) is essentially the `old` copy. Used for the
 *  hero H1, which renders as two `.hero__title-line` spans so its text
 *  never lives in one node. Requires `old` to cover most of the element so
 *  we never nuke a big container for a small substring edit. */
function findWholeElement(els: Element[], oldRaw: string): HTMLElement | null {
  const needC = norm(oldRaw);
  const needD = oldRaw.replace(/\s+/g, '').toLowerCase(); // whitespace-stripped
  if (!needC) return null;
  let best: { el: HTMLElement; cov: number } | null = null;
  for (const el of els) {
    const raw = (el as HTMLElement).textContent || '';
    const txtC = norm(raw);
    const txtD = raw.replace(/\s+/g, '').toLowerCase();
    let cov = 0;
    // Collapsed-whitespace match first; then whitespace-stripped, which
    // catches span splits that drop the inter-word space (the hero H1
    // renders "<span>First</span><span>rest…</span>" with no gap node).
    if (txtC.includes(needC)) cov = needC.length / Math.max(1, txtC.length);
    else if (needD && txtD.includes(needD)) cov = needD.length / Math.max(1, txtD.length);
    if (cov >= 0.5 && (!best || cov > best.cov)) best = { el: el as HTMLElement, cov };
  }
  return best?.el ?? null;
}

async function animateWholeElement(
  el: HTMLElement,
  action: InplaceAction,
  newText: string | undefined,
  signal?: AbortSignal,
): Promise<void> {
  scrollTo(el);
  await sleep(450);
  if (signal?.aborted) return;

  el.classList.add('live-inplace-block');
  await sleep(80);
  el.classList.add('is-struck');
  await sleep(700);

  if (action === 'remove') {
    el.classList.add('is-gone');
    await sleep(420);
    el.textContent = '';
    return;
  }

  // replace: clear the (possibly span-split) contents and retype in place.
  el.classList.remove('is-struck');
  el.replaceChildren();
  const newSpan = document.createElement('span');
  newSpan.className = 'live-inplace live-inplace--new';
  el.appendChild(newSpan);
  await typeInto(newSpan, newText || '', signal);
}

/**
 * Animate one edit directly on the page. Returns whether it could locate
 * a target (false → caller should fall back to the off-page card).
 */
export async function animateSectionEdit(
  els: Element[],
  action: InplaceAction,
  oldText: string | undefined,
  newText: string | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!els.length) return false;

  if (action === 'add') {
    const host = els[0] as HTMLElement;
    scrollTo(host);
    await sleep(450);
    if (signal?.aborted) return true;
    const wrap = document.createElement('span');
    wrap.className = 'live-inplace live-inplace--add';
    host.appendChild(document.createTextNode(' '));
    host.appendChild(wrap);
    await typeInto(wrap, newText || '', signal);
    return true;
  }

  // Tier 1: the `old` text lives in a single text node → strike just that
  // substring, preserving surrounding copy (best for partial edits).
  const hit = findHit(els, oldText || '');
  if (hit) {
    scrollTo(hit.host);
    await sleep(450);
    if (signal?.aborted) return true;

    const matchNode = hit.node.splitText(hit.index);
    matchNode.splitText(hit.length);
    const oldSpan = document.createElement('span');
    oldSpan.className = 'live-inplace live-inplace--old';
    matchNode.parentNode!.insertBefore(oldSpan, matchNode);
    oldSpan.appendChild(matchNode);

    await sleep(80);
    oldSpan.classList.add('is-struck');
    await sleep(640);

    if (action === 'remove') {
      oldSpan.classList.add('is-gone');
      await sleep(420);
      oldSpan.remove();
      return true;
    }

    const newSpan = document.createElement('span');
    newSpan.className = 'live-inplace live-inplace--new';
    oldSpan.parentNode!.insertBefore(newSpan, oldSpan.nextSibling);
    await typeInto(newSpan, newText || '', signal);
    await sleep(280);
    oldSpan.classList.add('is-gone');
    await sleep(360);
    oldSpan.remove();
    return true;
  }

  // Tier 2: text split across child spans (hero H1, GSAP) → animate the
  // whole element.
  const whole = findWholeElement(els, oldText || '');
  if (whole) {
    await animateWholeElement(whole, action, newText, signal);
    return true;
  }

  return false;
}
