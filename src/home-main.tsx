import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import SearchHome from './components/SearchHome';
import { randomScene, sceneById } from './lib/home-scenes';
import { registerOfflineWorker } from './lib/home-offline';
import type { ShownOffer } from './lib/offer-looks';

/*
 * The search page's entry (home.html, served at /search). In production the
 * server has already drawn the page with the photograph it picked, and the
 * offer it is run as when there is one, and says which on #root; hydrate
 * that. The dev server sends an empty root, so pick one here and render (the
 * page then reads the offer itself).
 */
const root = document.getElementById('root')!;
const served = sceneById(root.dataset.scene);
let offer: ShownOffer | null = null;
try {
  offer = root.dataset.offer ? (JSON.parse(root.dataset.offer) as ShownOffer) : null;
} catch {
  offer = null;
}
// Dev only: ?scene=river|red-rock|mountain, to look at one photograph on purpose.
const asked = import.meta.env.DEV ? sceneById(new URLSearchParams(window.location.search).get('scene')) : undefined;
const app = (
  <StrictMode>
    <SearchHome scene={served ?? asked ?? randomScene()} offer={offer} />
  </StrictMode>
);

if (served && root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);

if (import.meta.env.PROD) registerOfflineWorker();
