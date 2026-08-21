/**
 * Clamp a customer's brand accent colour so it stays legible on the deep-fir
 * (#08251a) background of the rebranded showcase.
 *
 * We keep the customer's HUE (their identity) but lift very dark/low-contrast
 * colours toward a brighter tint so they "pop" on green instead of muddying
 * into the background. Invalid/empty input falls back to brand lime.
 */

const LIME = '#abff44';

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Returns a fir-legible version of the given accent. Keeps hue; raises
 * lightness into [0.56, 0.82] and floors saturation so washed-out darks still
 * carry colour. Returns lime when the input is missing/unparseable.
 */
export function readableAccentOnFir(hex: string | null | undefined): string {
  if (!hex) return LIME;
  const rgb = hexToRgb(hex);
  if (!rgb) return LIME;
  let [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  l = Math.min(0.82, Math.max(0.56, l));
  if (s > 0.05) s = Math.max(0.45, s); // keep colours vivid, leave true grays alone
  return hslToHex(h, s, l);
}
