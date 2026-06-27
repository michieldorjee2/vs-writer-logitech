/**
 * In-place edit animation: mutate the REAL page element so the visitor
 * sees the actual H1 (or stat, stakeholder, etc.) get struck through and
 * rewritten — not a card off to the side. This is an optimistic preview
 * of the change the agent is committing via update_page; once the CMS
 * republishes we reload and the real content takes over.
 */

import type { EditKind } from './opal-edit-stream';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type InplaceAction = 'replace' | 'remove' | 'add';

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

/** Text edit (replace/remove a phrase) directly on the real copy. */
async function animateText(
  els: Element[],
  action: InplaceAction,
  oldText: string | undefined,
  newText: string | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  // Tier 1: `old` lives in a single text node → strike just that substring.
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

  // Tier 2: text split across child spans (hero H1, GSAP) → whole element.
  const whole = findWholeElement(els, oldText || '');
  if (whole) {
    await animateWholeElement(whole, action, newText, signal);
    return true;
  }
  return false;
}

/** Swap an image (screenshot / logo) in place with a cross-fade. */
async function animateImage(
  els: Element[],
  newUrl: string | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!newUrl) return false;
  let img: HTMLImageElement | null = null;
  for (const el of els) {
    if (el.tagName === 'IMG') { img = el as HTMLImageElement; break; }
    const q = el.querySelector('img');
    if (q) { img = q; break; }
  }
  if (!img) return false;
  scrollTo(img);
  await sleep(450);
  if (signal?.aborted) return true;
  img.style.transition = 'opacity .45s ease, filter .45s ease';
  img.style.opacity = '0.2';
  img.style.filter = 'blur(4px)';
  await new Promise<void>((res) => {
    const pre = new Image();
    pre.onload = () => res();
    pre.onerror = () => res();
    pre.src = newUrl;
    setTimeout(res, 4000);
  });
  if (signal?.aborted) return true;
  img.src = newUrl;
  await sleep(80);
  img.style.opacity = '1';
  img.style.filter = 'none';
  await sleep(500);
  return true;
}

/** The non-empty text nodes of an element, in document order. */
function textNodesIn(el: Element): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (((n as Text).nodeValue || '').trim()) out.push(n as Text);
  }
  return out;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/** Add a card/row to an array section by cloning the last sibling and
 *  typing the new item's content into it. */
async function animateAddCard(
  els: Element[],
  newText: string | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  const template = els[els.length - 1] as HTMLElement | undefined;
  if (!template || !newText) return false;

  const clone = template.cloneNode(true) as HTMLElement;
  const slots = textNodesIn(clone);
  if (!slots.length) return false;
  const originals = slots.map((s) => (s.nodeValue || '').trim());
  slots.forEach((s) => { s.nodeValue = ''; });

  template.parentNode!.insertBefore(clone, template.nextSibling);
  scrollTo(clone);
  // grow-in
  clone.style.opacity = '0';
  clone.style.transform = 'translateY(8px) scale(0.98)';
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  clone.offsetHeight; // reflow
  clone.style.transition = 'opacity .4s ease, transform .4s ease';
  clone.style.opacity = '1';
  clone.style.transform = 'none';
  await sleep(420);
  if (signal?.aborted) return true;

  // "Name — Role" → fill name/role; first short slot is an initials/avatar.
  const parts = newText.split(/\s*[—–|]\s*| - /).map((p) => p.trim()).filter(Boolean);
  const name = parts[0] || newText;
  const rest = parts.slice(1);

  const isAvatar = originals[0] !== undefined && originals[0].length <= 3 && slots.length >= 2;
  if (isAvatar) {
    slots[0].nodeValue = initialsOf(name);
    await typeIntoNode(slots[1], name, signal);
    if (slots[2] && rest.length) await typeIntoNode(slots[2], rest.join(' — '), signal);
  } else {
    // type the full label into the longest original slot; fill a 2nd if present
    let primary = 0;
    for (let i = 1; i < originals.length; i++) if (originals[i].length > originals[primary].length) primary = i;
    await typeIntoNode(slots[primary], rest.length ? name : newText, signal);
    if (rest.length) {
      const second = slots.findIndex((_, i) => i !== primary);
      if (second >= 0) await typeIntoNode(slots[second], rest.join(' — '), signal);
    }
  }
  return true;
}

async function typeIntoNode(node: Text, text: string, signal?: AbortSignal): Promise<void> {
  node.nodeValue = '';
  const step = Math.max(14, 1000 / 52);
  for (let i = 0; i < text.length; i++) {
    if (signal?.aborted) { node.nodeValue = text; return; }
    node.nodeValue = text.slice(0, i + 1);
    await sleep(step);
  }
}

/** Remove a card/row whose text matches `old`. */
async function animateRemoveCard(
  els: Element[],
  oldText: string | undefined,
  signal?: AbortSignal,
): Promise<boolean> {
  const need = norm(oldText || '');
  if (!need) return false;
  let target: HTMLElement | null = null;
  for (const el of els) {
    if (norm((el as HTMLElement).textContent || '').includes(need)) { target = el as HTMLElement; break; }
  }
  if (!target) return false;
  scrollTo(target);
  await sleep(450);
  if (signal?.aborted) return true;
  target.classList.add('live-inplace-block', 'is-struck');
  await sleep(620);
  target.style.overflow = 'hidden';
  target.style.transition = 'opacity .45s ease, transform .45s ease, max-height .5s ease, margin .5s ease, padding .5s ease';
  target.style.maxHeight = target.scrollHeight + 'px';
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  target.offsetHeight;
  target.style.opacity = '0';
  target.style.transform = 'scale(0.97)';
  target.style.maxHeight = '0px';
  target.style.margin = '0';
  target.style.padding = '0';
  await sleep(520);
  target.remove();
  return true;
}

export interface InplaceEdit {
  kind: EditKind;
  old?: string;
  new?: string;
  newUrl?: string;
}

/**
 * Animate one edit directly on the page, dispatching by kind. Returns
 * false if it couldn't locate a target (caller falls back to the card).
 * `skipped` edits should not be passed here (nothing to apply on-page).
 */
export async function animateSectionEdit(
  els: Element[],
  edit: InplaceEdit,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!els.length) return false;
  switch (edit.kind) {
    case 'image':
      return animateImage(els, edit.newUrl, signal);
    case 'item-add':
      return animateAddCard(els, edit.new, signal);
    case 'item-remove':
      return animateRemoveCard(els, edit.old, signal);
    case 'color':
      return false; // no meaningful in-place animation → show via card
    case 'text':
    default:
      return animateText(els, edit.new ? 'replace' : 'remove', edit.old, edit.new, signal);
  }
}
