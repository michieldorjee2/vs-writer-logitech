/** SSR stub — requestAnimationFrame loop is a no-op on the server. */
export default function useRafLoop(_callback: () => void, _initiallyActive?: boolean) {
  const noop = () => {};
  return [noop, noop, () => false] as const;
}
