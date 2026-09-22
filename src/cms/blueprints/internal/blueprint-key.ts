/**
 * `blueprintKeyFor(id)` — the deterministic blueprint key, in a form both runtimes can use.
 *
 * The CMS accepts a supplied blueprint key but demands GUID/UUID formatting, so the key is
 * `md5(blueprintId)` rendered as 32 hex characters. Same id, same key, forever: blueprint
 * creation becomes idempotent and no lookup is needed to find one again.
 *
 * WHY MD5 IS REIMPLEMENTED HERE RATHER THAN IMPORTED. `client.ts` already exports an
 * identical `blueprintKeyFor`, built on `node:crypto`. A blueprint module cannot import it:
 * `registry.ts` discovers blueprints with `import.meta.glob('./blueprints/*.ts', {eager:
 * true})`, which means every blueprint file is evaluated inside the Vite browser bundle, and
 * `client.ts` pulls in `node:crypto` and the filesystem. Importing it would drag the CMA
 * client — credentials reader included — into the client graph to compute one hash.
 *
 * So this module is pure: no node, no vite, no I/O, no dependencies. It is byte-for-byte
 * interchangeable with `client.ts`'s version, which is asserted by
 * `blueprint-key.test.ts` against `node:crypto` for the four real blueprint ids.
 *
 * MD5 is used because the key only needs to be a stable, well-distributed 128-bit name for a
 * short ASCII string. It is not a security boundary: the ids are public, the collision
 * question is "do two of our own four ids collide", and a rename is meant to produce a
 * different blueprint.
 *
 * It lives under `internal/` because `registry.ts` treats every file directly inside
 * `blueprints/` as a blueprint module and demands a default-exported blueprint from it. A
 * single-level glob does not descend, so a helper is only safe one directory down.
 */

/** Per-round left-rotation amounts (RFC 1321, 3.4). */
const SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
  14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
  21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

/** `K[i] = floor(abs(sin(i + 1)) * 2^32)` — the sine table, computed rather than pasted. */
const K = (() => {
  const table = new Uint32Array(64)
  for (let i = 0; i < 64; i += 1) {
    table[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)
  }
  return table
})()

const INITIAL = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]

/** UTF-8 encode without TextEncoder, which is absent in some SSR/edge sandboxes. */
function utf8Bytes(input: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        const point = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
        bytes.push(
          0xf0 | (point >> 18),
          0x80 | ((point >> 12) & 0x3f),
          0x80 | ((point >> 6) & 0x3f),
          0x80 | (point & 0x3f)
        )
        i += 1
      } else {
        // A lone high surrogate. Encode it as-is rather than throwing; the result still
        // matches what Buffer.from(s, 'utf8') produces for the same broken input.
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return bytes
}

function rotateLeft(value: number, by: number): number {
  return ((value << by) | (value >>> (32 - by))) >>> 0
}

function hexLittleEndian(word: number): string {
  let out = ''
  for (let byte = 0; byte < 4; byte += 1) {
    out += ((word >>> (byte * 8)) & 0xff).toString(16).padStart(2, '0')
  }
  return out
}

/** MD5 of a UTF-8 string, as 32 lowercase hex characters. */
export function md5Hex(input: string): string {
  const bytes = utf8Bytes(input)
  const bitLength = bytes.length * 8

  // Pad: 0x80, then zeros to 56 mod 64, then the length as a 64-bit little-endian integer.
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  const low = bitLength >>> 0
  // `bitLength` is a double, so the high word is derived by division rather than by a shift,
  // which would wrap at 32 bits.
  const high = Math.floor(bitLength / 4294967296) >>> 0
  for (let byte = 0; byte < 4; byte += 1) bytes.push((low >>> (byte * 8)) & 0xff)
  for (let byte = 0; byte < 4; byte += 1) bytes.push((high >>> (byte * 8)) & 0xff)

  const state = [...INITIAL]
  const block = new Uint32Array(16)

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let word = 0; word < 16; word += 1) {
      const at = offset + word * 4
      block[word] =
        (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
    }

    let [a, b, c, d] = state

    for (let i = 0; i < 64; i += 1) {
      let mixed: number
      let index: number
      if (i < 16) {
        mixed = (b & c) | (~b & d)
        index = i
      } else if (i < 32) {
        mixed = (d & b) | (~d & c)
        index = (5 * i + 1) % 16
      } else if (i < 48) {
        mixed = b ^ c ^ d
        index = (3 * i + 5) % 16
      } else {
        mixed = c ^ (b | ~d)
        index = (7 * i) % 16
      }

      const sum = (mixed + a + K[i] + block[index]) >>> 0
      a = d
      d = c
      c = b
      b = (b + rotateLeft(sum, SHIFTS[i])) >>> 0
    }

    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
  }

  return state.map(hexLittleEndian).join('')
}

/**
 * The CMS key for a blueprint id. Identical to `client.ts`'s `blueprintKeyFor`, and safe to
 * call from a module that the browser bundle evaluates.
 */
export function blueprintKeyFor(blueprintId: string): string {
  return md5Hex(blueprintId)
}
