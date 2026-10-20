import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BuildView from './components/BuildView';

/*
 * The build view's entry (build.html). The server names the build on #root;
 * the dev server serves build.html bare, so there it comes from ?build=&route=.
 */
const root = document.getElementById('root')!;
const params = new URLSearchParams(window.location.search);
const buildId = root.dataset.build || params.get('build') || '';
const route = root.dataset.route || params.get('route') || '';

createRoot(root).render(
  <StrictMode>
    <BuildView buildId={buildId} route={route} />
  </StrictMode>,
);
