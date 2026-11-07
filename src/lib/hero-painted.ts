/**
 * Resolves once the hero image, the page's largest paint, has had its first frame (src/App.tsx
 * waits on it before loading a page renderer's chunk).
 *
 * The page is server-rendered, so nothing needs the renderer to paint; loading it only puts work
 * on the main thread. Started before the hero has painted, that work (fetching, evaluating and
 * hydrating the renderer, ~600 ms of script on a throttled phone) holds the hero's paint behind
 * it. Measured 6 Nov 2026, preview against preview: once the chunk order stopped making the
 * renderer wait for framer-motion, mobile LCP went from 3.6 s to 6.6 s on an account page while
 * the offer page, still waiting for framer-motion, stayed at 3.6 s. React keeps the server's HTML
 * behind the Suspense boundary meanwhile, exactly as it did while the chunk was on its way.
 *
 * At once when there is nothing to wait for: no hero image, a prerendered page (it hydrates before
 * it is shown, and draws no frames until then), a tab in the background. Never longer than maxWait.
 */
let painted: Promise<void> | null = null;

export function heroPainted(maxWait = 1500): Promise<void> {
  painted ??= new Promise<void>((resolve) => {
    const img = typeof document === 'undefined' ? null : document.querySelector<HTMLImageElement>('.www-hero__img');
    const prerendering = typeof document !== 'undefined' && (document as Document & { prerendering?: boolean }).prerendering === true;
    if (!img || prerendering || document.visibilityState !== 'visible') {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    // A frame after the image is in: by then the browser has painted it.
    const afterFrame = () => requestAnimationFrame(() => window.setTimeout(finish, 0));
    if (img.complete) afterFrame();
    else {
      img.addEventListener('load', afterFrame, { once: true });
      img.addEventListener('error', finish, { once: true });
    }
    window.setTimeout(finish, maxWait);
  });
  return painted;
}

/** For the checks: forget the answer, so the next call looks at the page again. */
export function resetHeroPainted(): void {
  painted = null;
}
