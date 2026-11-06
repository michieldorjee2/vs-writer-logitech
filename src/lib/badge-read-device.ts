import { cardFromLines, linesOfBlocks, OCR_PARAMETERS, readablePixels, readScale } from './badge-ocr';
import type { BadgeCard } from './badge-card';
import type { Worker } from 'tesseract.js';

/*
 * Reading a badge in the browser: Tesseract (WebAssembly, in a web worker)
 * finds the lines of text in the photo, and badge-ocr.ts sorts them into the
 * card. Nothing leaves the device: no photo, no text. Mark reads only what
 * this can't (badge-scan.ts readBadge, when the reader is set up).
 *
 * Tesseract's files are this site's own, at /ocr/<version>/ (vite.config.ts's
 * ocrFiles serves and builds them from node_modules): its worker, the engine
 * in the builds it picks between, and the English model. About 7 MB the first
 * time, from the HTTP cache (and the search page's service worker) after that.
 * Loaded when the camera opens, so a badge held up is read at once.
 */

export const OCR_VERSION = '7.0.0';
const BASE = `/ocr/${OCR_VERSION}`;
/** The worker is kept this long after a read for the next badge, then let go: it holds ~100 MB. */
const IDLE_MS = 2 * 60_000;

let worker: Promise<Worker> | null = null;
let idle: number | undefined;

/** Starts loading Tesseract (the camera has opened): the read that follows doesn't wait for it. */
export function prepareDeviceReader(): void {
  void getWorker().catch(() => {
    worker = null;
  });
}

function getWorker(): Promise<Worker> {
  window.clearTimeout(idle);
  worker ??= import('tesseract.js').then(async ({ createWorker, OEM }) => {
    const w = await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: BASE,
      langPath: BASE,
      // Same-origin files: no blob copy of the worker, and the model comes from the HTTP cache, not IndexedDB.
      workerBlobURL: false,
      cacheMethod: 'none',
    });
    await w.setParameters(OCR_PARAMETERS as never);
    return w;
  });
  return worker;
}

function letGoLater() {
  window.clearTimeout(idle);
  idle = window.setTimeout(() => {
    const w = worker;
    worker = null;
    void w?.then((x) => x.terminate()).catch(() => undefined);
  }, IDLE_MS);
}

/** The photo at the size Tesseract reads best, drawn upright (the browser applies the photo's orientation), in high-contrast grey. */
async function prepared(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = readScale(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no-canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    readablePixels(pixels.data);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/** The badge in `file`, read here; null when no name or company could be read (or Tesseract didn't load). */
export async function readBadgeOnDevice(file: Blob, signal: AbortSignal): Promise<BadgeCard | null> {
  try {
    const [w, image] = await Promise.all([getWorker(), prepared(file)]);
    if (signal.aborted) return null;
    const { data } = await w.recognize(image, {}, { blocks: true, text: false });
    letGoLater();
    if (signal.aborted) return null;
    return cardFromLines(linesOfBlocks(data.blocks));
  } catch {
    worker = null;
    return null;
  }
}
