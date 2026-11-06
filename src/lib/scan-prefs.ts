/*
 * The badge scanner's one setting, kept per browser: whether it takes a badge's
 * photo by itself once one is held up (BadgeLanyard's "Detect badges
 * automatically"), or only when the rep presses Scan. On unless turned off;
 * storage that is empty or refuses (a private window) leaves it on.
 */
const KEY = 'showcase-badge-auto-detect';

export function readAutoDetect(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeAutoDetect(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, 'off');
  } catch {
    /* Not kept: it is on again next time. */
  }
}
