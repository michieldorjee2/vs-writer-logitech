/**
 * Reads the server render starts together (server/ssr-handler.tsx). Checked by scripts/check-perf.ts.
 */

/**
 * Reads already in flight, answered in the order given: the first one that found something,
 * once every read before it came back empty. So the answer is the one the reads would give one
 * after another, in the time of the slowest rather than the sum. A read that fails fails the
 * whole only where it would have one after another (every read before it empty); a later
 * read's failure, once an earlier one has answered, is dropped rather than left unhandled.
 */
export async function firstFound<T>(reads: Array<Promise<T | null>>): Promise<T | null> {
  const settled = reads.map((read) =>
    read.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  );
  for (const next of settled) {
    const read = await next;
    if (!read.ok) throw read.error;
    if (read.value) return read.value;
  }
  return null;
}

/**
 * A read started now and awaited later (after the build lookup, say). Its failure waits for the
 * await too, and is never an unhandled rejection when the response goes out without it.
 */
export function startRead<T>(read: Promise<T>): () => Promise<T> {
  const settled = read.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return async () => {
    const result = await settled;
    if (!result.ok) throw result.error;
    return result.value;
  };
}
