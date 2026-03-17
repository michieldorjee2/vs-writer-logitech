/** SSR stub — returns a static viewport size so components render their default layout. */
export default function useWindowSize() {
  return { width: 1280, height: 800 };
}
