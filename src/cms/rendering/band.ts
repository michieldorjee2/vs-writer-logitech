/**
 * Whether a section is a dark or a light band, from its own `backgroundColor` display setting.
 *
 * Elements render independently and cannot see their section, and `BlankSection` only sets a
 * foreground for `dark_forest`. So each section wrapper carries `data-band="dark"|"light"` and
 * elements adapt with a `[[data-band=dark]_&]:` variant rather than guessing.
 *
 * This lives in its own module because there are TWO section renderers: the client one in
 * `visual-builder.tsx` and a static-import twin in `server/ssr-handler.tsx` (esbuild cannot
 * run Vite's `import.meta.glob`). React keeps server-rendered attributes through hydration, so
 * if only one of them set `data-band` the served page would lose it. Both import this.
 */

import { DARK_BACKGROUNDS as DARK_BANDS } from '../layout-prod'
// prod's `darkSectionBackgroundColors`: dark_forest, dark_green, mid_dark_green, light_dark_green,
// dark_pink, dark_blue.

export function bandOf(settings: unknown): 'dark' | 'light' {
  const list = Array.isArray(settings) ? (settings as Array<{ key?: string; value?: string }>) : []
  const bg = list.find((s) => s?.key === 'backgroundColor')?.value
  return bg && DARK_BANDS.has(bg) ? 'dark' : 'light'
}
