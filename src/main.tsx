import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')!;

if (root.innerHTML.trim().length > 0) {
  // Server-rendered HTML present — hydrate instead of full render
  hydrateRoot(root, <StrictMode><App /></StrictMode>);
} else {
  // SPA mode (home page, preview, or dev without SSR)
  createRoot(root).render(<StrictMode><App /></StrictMode>);
}
