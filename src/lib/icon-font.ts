/**
 * The whole Material Symbols Rounded font, for the rare page that draws an icon the subset lacks.
 *
 * Pages load a subset of the icon font: the icons src draws (src/styles/material-symbols, made by
 * scripts/subset-icons.mjs). A name only the CMS knows (IconElement's `Icon` field) cannot be in
 * it, and would draw as its name in letters. So this watches the page's icons, and the first time
 * one is a name outside the subset, it declares the package's whole font (5.4 MB) under the same
 * family. Being declared last, that face is the one the browser uses from then on (CSS Fonts:
 * of matching @font-face rules, the last wins), so the icon draws as it always did. A page that
 * only draws known icons never downloads it.
 */
import wholeFontUrl from 'material-symbols/material-symbols-rounded.woff2?url';
import subsetIcons from '../styles/material-symbols/icons.json';

const IN_SUBSET = new Set<string>(subsetIcons);
const ICON = '.material-symbols-rounded';

let wholeFont = false;

function loadWholeFont(): void {
  if (wholeFont) return;
  wholeFont = true;
  const style = document.createElement('style');
  style.dataset.iconFont = 'whole';
  style.textContent =
    '@font-face{font-family:"Material Symbols Rounded";font-style:normal;font-weight:100 700;' +
    `font-display:block;src:url("${wholeFontUrl}") format("woff2")}`;
  document.head.appendChild(style);
}

/** The first icon on the page the subset does not have, if any. */
export function iconOutsideSubset(root: ParentNode): string | null {
  for (const el of root.querySelectorAll(ICON)) {
    const name = el.textContent?.trim();
    if (name && !IN_SUBSET.has(name)) return name;
  }
  return null;
}

/** Watch the page's icons for one the subset lacks. Once, in the browser. */
export function watchIconFont(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || wholeFont) return;
  let queued = false;
  const check = () => {
    queued = false;
    if (iconOutsideSubset(document) === null) return;
    loadWholeFont();
    observer.disconnect();
  };
  // Icons drawn later (a modal, the booth rail, a client-rendered block) are checked as they come.
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    window.setTimeout(check, 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  check();
}
