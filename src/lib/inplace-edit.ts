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

  const hit = findHit(els, oldText || '');
  if (!hit) return false;

  scrollTo(hit.host);
  await sleep(450);
  if (signal?.aborted) return true;

  // Split [before][match][after] and wrap the match so we can animate it.
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

  // replace: type the new text in after the struck old, then drop the old.
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
