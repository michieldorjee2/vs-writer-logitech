/** SSR stub — useMeasure returns a no-op ref and zero bounds. */
import { useRef } from 'react';

export default function useMeasure() {
  const ref = useRef(null);
  return [ref, { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }] as const;
}
