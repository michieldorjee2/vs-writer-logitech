/**
 * Starts the app (hydration, the router) once the view transition the page arrived by is over.
 *
 * The server's HTML is the whole page, so it can wait. Started during the morph, React Router's
 * first `history.replaceState` and the hydration around it cancelled the incoming transition
 * whenever they landed in its first frames: about half the openings from the search page jumped
 * instead of moving (measured 6 Nov 2026). src/lib/view-transitions-boot.js, in the <head>, sets
 * `window.__vtSettled`: settled when the transition finishes, or at once when there is none.
 *
 * It doesn't wait when there is nothing to watch: a browser without cross-document view
 * transitions (no boot promise), a prerendered page (it should be ready before it is shown), a tab
 * in the background. And never longer than `maxWait`.
 */
export function afterViewTransition(start: () => void, maxWait = 2500): void {
  const settled = (window as { __vtSettled?: Promise<unknown> }).__vtSettled;
  const prerendering = (document as { prerendering?: boolean }).prerendering === true;
  if (!settled || prerendering || document.visibilityState !== 'visible') {
    start();
    return;
  }
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    start();
  };
  settled.then(go, go);
  window.setTimeout(go, maxWait);
}
