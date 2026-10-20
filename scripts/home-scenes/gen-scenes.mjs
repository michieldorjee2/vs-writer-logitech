/**
 * Cuts the search page's scene photographs into what src/lib/home-scenes.ts serves:
 * an AVIF ladder (WebP for browsers without AVIF) of the whole frame, a 3:4 slice
 * from its middle for portrait screens, and a 24px preview (printed to
 * <outDir>/../scenes-manifest.json, with each scene's aspect, for home-scenes.ts).
 *
 * sharp is not a dependency of this app: point SHARP_PATH at any installed copy, e.g.
 *   SHARP_PATH=/path/to/node_modules/sharp node scripts/home-scenes/gen-scenes.mjs <dir with river.jpg …> public/home/scenes/v2
 * New photographs go in a new version folder (v2, …): the files are served immutable.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require(process.env.SHARP_PATH || 'sharp');
} catch {
  console.error('sharp is not installed here: set SHARP_PATH to an installed copy (see the top of this file).');
  process.exit(1);
}

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const SCENES = ['river', 'red-rock', 'mountain'];
const WIDE = [640, 960, 1280, 1600, 1920, 2400, 2880];
const TALL = [480, 720, 1080, 1440, 1800];
const TALL_ASPECT = 3 / 4;
// WebP is only for browsers without AVIF, so it gets a short ladder.
const WEBP = { wide: [960, 1600, 2400], tall: [720, 1440] };

const manifest = {};
for (const id of SCENES) {
  const input = join(src, `${id}.jpg`);
  const meta = await sharp(input).metadata();
  // Portrait: the full height, centred, 3:4.
  const cropW = Math.round(meta.height * TALL_ASPECT);
  const crop = { left: Math.round((meta.width - cropW) / 2), top: 0, width: cropW, height: meta.height };
  const jobs = [];
  const bytes = {};
  for (const [kind, widths, base] of [
    ['wide', WIDE, () => sharp(input)],
    ['tall', TALL, () => sharp(input).extract(crop)],
  ]) {
    for (const w of widths) {
      for (const fmt of WEBP[kind].includes(w) ? ['avif', 'webp'] : ['avif']) {
        const file = `${id}-${kind}-${w}.${fmt}`;
        const pipe = base().resize({ width: w, withoutEnlargement: true });
        const encoded = fmt === 'avif' ? pipe.avif({ quality: 36, effort: 7, chromaSubsampling: '4:2:0' }) : pipe.webp({ quality: 62, effort: 6 });
        jobs.push(encoded.toFile(join(out, file)).then(() => (bytes[file] = statSync(join(out, file)).size)));
      }
    }
  }
  await Promise.all(jobs);
  const lqip = await sharp(input).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
  manifest[id] = {
    aspect: +(meta.width / meta.height).toFixed(4),
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
    bytes,
  };
  console.log(id, meta.width, 'x', meta.height, '| files', Object.keys(bytes).length, '| total', Math.round(Object.values(bytes).reduce((a, b) => a + b, 0) / 1024), 'KB');
}
writeFileSync(join(out, '..', 'scenes-manifest.json'), JSON.stringify(manifest, null, 1));
