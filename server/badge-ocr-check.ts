/**
 * Reads the made-up badges in server/fixtures/badges with the browser's own reader:
 * Tesseract (the same version, model and settings as src/lib/badge-read-device.ts,
 * here in Node) and src/lib/badge-ocr.ts's sorting into a card. Prints each badge's
 * read beside the truth, and fails under the bar set below.
 *
 *   npm run check:badge-ocr        # ~1 s a badge; no network
 *
 * Redraw the badges with `python3 scripts/make-badge-fixtures.py`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { createWorker, OEM } from 'tesseract.js';
import { cardFromLines, linesOfBlocks, OCR_PARAMETERS, readablePixels, readScale } from '../src/lib/badge-ocr';

const DIR = 'server/fixtures/badges';
type Truth = { name: string; title: string; company: string; domain?: string };
const truth = JSON.parse(readFileSync(join(DIR, 'truth.json'), 'utf-8')) as Record<string, Truth>;
/*
 * The bar: of 16 badges, how many must come back right, field by field. Two names are known
 * misses, both Tesseract's English model and not the sorting: "Østergaard" reads "Ostergaard"
 * (no Ø in the model), and the marker-pen "Dana" on the hello sticker reads "Pana". The rep
 * fixes a line on the card in one tap. A change that loses any other field fails here.
 */
const BAR = { name: 14, company: 16, title: 16 };

const same = (a: string, b: string) => a.toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, ' ').trim() === b.toLowerCase().replace(/[^\p{L}\p{N}&]+/gu, ' ').trim();

const worker = await createWorker('eng', OEM.LSTM_ONLY, {
  langPath: join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0_best_int'),
  cacheMethod: 'none',
  gzip: true,
});
await worker.setParameters(OCR_PARAMETERS as never);

const right = { name: 0, company: 0, title: 0 };
let slowest = 0;
const files = readdirSync(DIR).filter((f) => f.endsWith('.jpg')).sort();
for (const file of files) {
  const slug = file.replace(/\.jpg$/, '');
  const want = truth[slug];
  const img = sharp(join(DIR, file));
  const { width = 1, height = 1 } = await img.metadata();
  const scale = readScale(width, height);
  // As badge-read-device.ts draws it: scaled, then readablePixels.
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const raw = await img.resize(w, h).ensureAlpha().raw().toBuffer();
  readablePixels(raw);
  const png = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const started = Date.now();
  const { data } = await worker.recognize(png, {}, { blocks: true, text: false });
  slowest = Math.max(slowest, Date.now() - started);
  const card = cardFromLines(linesOfBlocks(data.blocks as never));
  const got = { name: card?.name ?? '', title: card?.title ?? '', company: card?.company ?? '' };
  const marks = (['name', 'title', 'company'] as const).map((k) => {
    const ok = same(got[k], want[k]);
    if (ok) right[k]++;
    return `${ok ? '✓' : '✗'} ${k}: ${JSON.stringify(got[k])}${ok ? '' : ` (want ${JSON.stringify(want[k])})`}`;
  });
  const domainNote = want.domain ? ` · domain ${card?.domain === want.domain ? '✓' : `✗ ${JSON.stringify(card?.domain)}`}` : '';
  console.log(`${slug}\n   ${marks.join('\n   ')}${domainNote}`);
  if (process.env.OCR_LINES) for (const l of linesOfBlocks(data.blocks as never)) console.log(`      · ${Math.round(l.confidence)} h${l.height} ${JSON.stringify(l.text)}`);
}
await worker.terminate();

const n = files.length;
console.log(`\nnames ${right.name}/${n} · titles ${right.title}/${n} · companies ${right.company}/${n} · slowest read ${slowest} ms`);
const short = (Object.keys(BAR) as Array<keyof typeof BAR>).filter((k) => right[k] < BAR[k]);
if (short.length) {
  console.log(`below the bar: ${short.map((k) => `${k} ${right[k]} < ${BAR[k]}`).join(', ')}`);
  process.exit(1);
}
console.log('badge OCR check passed');
