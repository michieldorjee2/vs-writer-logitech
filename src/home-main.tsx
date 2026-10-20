import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import SearchHome from './components/SearchHome';
import { randomScene, sceneById } from './lib/home-scenes';
import { registerOfflineWorker } from './lib/home-offline';

/*
 * The search page's entry (home.html, served at /search). In production the
 * server has already drawn the page with the photograph it picked, and says
 * which on #root; hydrate that. The dev server sends an empty root, so pick
 * one here and render.
 */
const root = document.getElementById('root')!;
const served = sceneById(root.dataset.scene);
const app = (
  <StrictMode>
    <SearchHome scene={served ?? randomScene()} />
  </StrictMode>
);

if (served && root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);

if (import.meta.env.PROD) registerOfflineWorker();
