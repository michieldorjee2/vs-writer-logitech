/**
 * An offer's look, server side (src/lib/offer-looks.ts): start Mark on it,
 * follow the run, then cut the photograph it found into the search page's
 * sizes, keep them in Vercel Blob, and store the look in Aldus UI.
 *
 * Kept in the page builds' Upstash store:
 *   look:job:<offer id>    the job (JobRecord), a day
 *   look:start:<offer id>  one browser starts Mark, not every one that asks at once
 *   look:cut:<offer id>    one request cuts the photograph, not every one polling
 *
 * Env: BLOB_READ_WRITE_TOKEN (the showcase-looks store), and what aldus.ts and mark.ts read.
 */
import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';
import {
  LOOK_LADDER,
  parseAgentLook,
  type AgentLook,
  type LookJob,
  type LookJobStatus,
  type ShowcaseLook,
} from '../../src/lib/offer-looks.js';
import { eventsFrom, toolLabel, type MarkChunk } from '../../src/lib/page-builds.js';
import { saveLook, type AldusOffer } from './aldus.js';
import { getAgentExecution, getMemoryChunks, isMarkFile, LOOK_AGENT_ID, markFileHeaders, startAgent, type MarkAgentExecution } from './mark.js';
import type { BuildStore } from './page-builds-store.js';

type JobRecord = {
  offerId: string;
  status: LookJobStatus;
  startedAt: number;
  finishedAt?: number;
  executionId: string;
  by: string;
  error?: string;
  look?: ShowcaseLook;
};

const KEEP_SECONDS = 24 * 60 * 60;
/* A run Mark hasn't finished in this long is given up on (its own cap is 600 s per stream; background runs go on). */
const GIVE_UP_MS = 15 * 60 * 1000;
const CUT_LOCK_SECONDS = 240;
/* How long a run usually takes, for the progress ring: research, maybe a trace, then the JSON. */
const TYPICAL_MS = 150_000;

const jobKey = (id: string) => `look:job:${id}`;

export async function getJob(store: BuildStore, offerId: string): Promise<JobRecord | null> {
  return ((await store.get(jobKey(offerId))) as JobRecord | null) ?? null;
}
const saveJob = (store: BuildStore, job: JobRecord) => store.set(jobKey(job.offerId), job, { ex: KEEP_SECONDS });

/* ---------- Starting ---------- */

/* A run that failed is shown as failed to the next rep who picks the offer, rather than started
   again on every page load; Try again (retry) starts a new one. */
const FAILED_SHOWN_MS = 30 * 60 * 1000;

/** Starts Mark on the offer's look, unless a run for it is under way already (or just failed, unless asked again). */
export async function startLook(store: BuildStore, offer: AldusOffer, email: string, retry = false): Promise<JobRecord> {
  const held = await getJob(store, offer.id);
  if (held && isOpen(held)) return held;
  if (held?.status === 'failed' && !retry && Date.now() - (held.finishedAt ?? held.startedAt) < FAILED_SHOWN_MS) return held;
  const first = await store.set(`look:start:${offer.id}`, email, { nx: true, ex: 30 });
  if (!first) return (await getJob(store, offer.id)) ?? (held as JobRecord);
  const executionId = await startAgent(LOOK_AGENT_ID, {
    offer_title: offer.title,
    offer_brief: (offer.brief || '').slice(0, 600),
    offer_window: `${offer.windowStart.slice(0, 10)} to ${offer.windowEnd.slice(0, 10)}`,
  });
  const job: JobRecord = { offerId: offer.id, status: 'making', startedAt: Date.now(), executionId, by: email };
  await saveJob(store, job);
  return job;
}

const isOpen = (job: JobRecord) => (job.status === 'making' || job.status === 'cutting') && Date.now() - job.startedAt < GIVE_UP_MS;

/* ---------- Following ---------- */

const isDone = (s: string) => /^(completed|success|succeeded)$/i.test(s);
const isFailed = (s: string) => /^(failed|error|cancelled|canceled|timed_out|timeout|paused)$/i.test(s);
const statusOf = (ex: MarkAgentExecution) => String(ex.status_code || ex.status || '');
const responseOf = (ex: MarkAgentExecution) => (typeof ex.result === 'string' ? ex.result : ex.result?.response ?? '');

/* Several browsers may poll one job; Mark's records are read at most every few seconds per instance. */
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>, ms = 3000): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 100) cache.delete(cache.keys().next().value as string);
  return value;
}

/** Reads the run and moves the job on. When Mark is done, the first request here cuts the photograph. */
export async function refreshJob(store: BuildStore, job: JobRecord, offer: AldusOffer | null): Promise<{ job: JobRecord; execution: MarkAgentExecution | null }> {
  if (!isOpen(job)) {
    if (job.status === 'making' || job.status === 'cutting') {
      job = { ...job, status: 'failed', finishedAt: Date.now(), error: 'Mark took too long. Try again.' };
      await saveJob(store, job);
    }
    return { job, execution: null };
  }
  const execution = await cached(`lookex:${job.executionId}`, () => getAgentExecution(job.executionId));
  if (job.status !== 'making') return { job, execution };
  const status = statusOf(execution);
  if (isFailed(status)) {
    job = { ...job, status: 'failed', finishedAt: Date.now(), error: firstSentence(execution.error_message || (typeof execution.result === 'object' ? execution.result?.error : '') || '') || 'Mark stopped before it finished.' };
    await saveJob(store, job);
    return { job, execution };
  }
  if (!isDone(status)) return { job, execution };

  const found = parseAgentLook(responseOf(execution));
  if (!found) {
    job = { ...job, status: 'failed', finishedAt: Date.now(), error: 'Mark found no photograph it could use.' };
    await saveJob(store, job);
    return { job, execution };
  }
  if (!(await store.set(`look:cut:${job.offerId}`, 1, { nx: true, ex: CUT_LOCK_SECONDS }))) return { job: { ...job, status: 'cutting' }, execution };
  job = { ...job, status: 'cutting' };
  await saveJob(store, job);
  try {
    const look = await cutLook(job.offerId, found, `mark:${job.executionId}`);
    if (!offer) throw new Error('The offer is no longer running, so its look was not kept.');
    const saved = await saveLook(job.offerId, look);
    job = { ...job, status: 'done', finishedAt: Date.now(), look: saved };
  } catch (err) {
    job = { ...job, status: 'failed', finishedAt: Date.now(), error: firstSentence(err instanceof Error ? err.message : String(err)) };
  }
  await saveJob(store, job);
  return { job, execution };
}

/** What the browser draws: the job, Mark's narration and tool calls so far, one line and a ring. */
export async function jobView(job: JobRecord, execution: MarkAgentExecution | null): Promise<LookJob> {
  let chunks: MarkChunk[] = [];
  const memoryId = execution?.memory_id;
  if (memoryId) {
    const settled = job.status !== 'making';
    chunks = await cached(`lookmem:${memoryId}`, () => getMemoryChunks(memoryId), settled ? 600_000 : 3000).catch(() => []);
  }
  const events = eventsFrom(chunks).map((e) => (e.kind === 'tool' && e.tool ? { ...e, text: lookToolLabel(e.tool, chunks, e.seq) } : e));
  const elapsed = Date.now() - job.startedAt;
  const progress =
    job.status === 'done' ? 1 : job.status === 'cutting' ? 0.92 : job.status === 'failed' ? 0 : Math.min(0.85, 0.04 + (elapsed / TYPICAL_MS) * 0.8);
  const last = [...events].reverse().find((e) => e.kind === 'tool' || e.kind === 'text');
  const statusLine =
    job.status === 'done'
      ? 'Ready'
      : job.status === 'failed'
        ? job.error || 'Mark could not make the look'
        : job.status === 'cutting'
          ? 'Cutting the photograph into sizes…'
          : last
            ? last.kind === 'tool'
              ? `${last.text}…`
              : last.text.split(/(?<=[.!?])\s/)[0].slice(0, 120)
            : 'Starting…';
  return {
    offerId: job.offerId,
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    statusLine,
    progress,
    events: events.slice(-40),
    look: job.look ?? null,
    error: job.error,
  };
}

/** The look agent's own tools, in words; the rest as the page builds say them. */
function lookToolLabel(tool: string, chunks: MarkChunk[], seq: string): string {
  const chunk = chunks.find((c) => c.id === seq);
  const input = ((chunk?.content as { input?: Record<string, unknown> } | undefined)?.input ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'search_web':
      return input.result_type === 'images' ? `Looking for photos: “${String(input.search_query ?? '').slice(0, 60)}”` : toolLabel(tool, input);
    case 'tracelab_vectorize':
      return 'Tracing the logo into a vector';
    case 'tracelab_get_svg':
      return 'Reading the traced logo';
    case 'generate_or_edit_image':
      return 'Generating a photograph';
    default:
      return toolLabel(tool, input);
  }
}

function firstSentence(text: string): string {
  const plain = text.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim();
  const m = /^(.{12,200}?[.!?])(\s|$)/.exec(plain);
  return (m ? m[1] : plain.slice(0, 200)).trim();
}

/* ---------- Cutting ---------- */

const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
const MIN_WIDTH = 1600;
const TALL_ASPECT = 3 / 4;
const AVIF = { quality: 42, effort: 4, chromaSubsampling: '4:2:0' } as const;
const WEBP = { quality: 66, effort: 4 } as const;

async function download(url: string, accept: string): Promise<{ bytes: Buffer; type: string }> {
  const res = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (OptimizelyShowcase look cutter)', ...(isMarkFile(url) ? markFileHeaders() : {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const length = Number(res.headers.get('content-length') || 0);
  if (length > MAX_PHOTO_BYTES) throw new Error('too large');
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_PHOTO_BYTES) throw new Error('too large');
  return { bytes, type };
}

/**
 * The first of Mark's photographs that is big enough and landscape, cut into
 * LOOK_LADDER's sizes (the whole frame, and a 3:4 slice from its middle) and
 * kept in Blob under looks/<offer>/<hash of the photo>/.
 */
async function cutBackground(offerId: string, photos: AgentLook['photos']): Promise<ShowcaseLook['background']> {
  const sharp = (await import('sharp')).default;
  const tried: string[] = [];
  for (const photo of photos) {
    try {
      const { bytes, type } = await download(photo.url, 'image/avif,image/webp,image/jpeg,image/png,image/*');
      if (type && !type.startsWith('image/')) throw new Error(`not an image (${type})`);
      // Upright, sRGB and 8-bit once, so every cut starts from the same pixels.
      const { data: upright, info } = await sharp(bytes, { failOn: 'none', limitInputPixels: 80_000_000 })
        .rotate()
        .toColourspace('srgb')
        .jpeg({ quality: 95 })
        .toBuffer({ resolveWithObject: true });
      if (info.width < MIN_WIDTH) throw new Error(`${info.width}px wide`);
      if (info.width / info.height < 1.2) throw new Error('not landscape');

      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      const folder = `looks/${offerId}/${hash}`;
      const cropW = Math.min(info.width, Math.round(info.height * TALL_ASPECT));
      const crop = { left: Math.round((info.width - cropW) / 2), top: 0, width: cropW, height: info.height };

      const jobs: Array<() => Promise<string>> = [];
      for (const cut of ['wide', 'tall'] as const) {
        for (const format of ['avif', 'webp'] as const) {
          for (const width of LOOK_LADDER[cut][format]) {
            jobs.push(async () => {
              let pipe = sharp(upright);
              if (cut === 'tall') pipe = pipe.extract(crop);
              pipe = pipe.resize({ width, withoutEnlargement: true });
              const encoded = await (format === 'avif' ? pipe.avif(AVIF) : pipe.webp(WEBP)).toBuffer();
              const blob = await put(`${folder}/${cut}-${width}.${format}`, encoded, {
                access: 'public',
                addRandomSuffix: false,
                allowOverwrite: true,
                contentType: `image/${format}`,
                cacheControlMaxAge: 31_536_000,
              });
              return blob.url;
            });
          }
        }
      }
      // Three at a time: AVIF encodes are the slow part, and a function has a few cores.
      const urls: string[] = [];
      for (let i = 0; i < jobs.length; i += 3) urls.push(...(await Promise.all(jobs.slice(i, i + 3).map((j) => j()))));
      const lqip = await sharp(upright).resize({ width: 24 }).webp({ quality: 40 }).toBuffer();
      return {
        base: urls[0].slice(0, urls[0].lastIndexOf('/')),
        aspect: +(info.width / info.height).toFixed(4),
        lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
        sourceUrl: /^https:\/\//.test(photo.page_url) ? photo.page_url : photo.url,
        ...(photo.credit ? { credit: photo.credit.slice(0, 200) } : {}),
        license: (['generated', 'official', 'stock'] as const).find((l) => l === photo.license) ?? 'unknown',
      };
    } catch (err) {
      tried.push(`${hostOf(photo.url)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`None of Mark's photographs could be used (${tried.join('; ')}).`);
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 40);
  }
};

const MAX_SVG = 200_000;

/** As Aldus UI checks it (aldus-ui lib/offers/showcase-look.ts cleanSvg): one <svg>, nothing that runs. */
export function cleanSvg(raw: string): string | null {
  if (raw.length > MAX_SVG) return null;
  const svg = raw
    .trim()
    .replace(/^<\?xml[^>]*\?>\s*/i, '')
    .replace(/<!DOCTYPE[^>]*>\s*/i, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return null;
  if (/<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<object|<embed/i.test(svg)) return null;
  return svg;
}

async function fetchLogo(logo: AgentLook['logo']): Promise<ShowcaseLook['logo'] | undefined> {
  if (!logo) return undefined;
  try {
    const { bytes } = await download(logo.svg_url, 'image/svg+xml,text/xml,*/*');
    const svg = cleanSvg(bytes.toString('utf8'));
    return svg ? { svg, sourceUrl: logo.source_url, traced: logo.traced } : undefined;
  } catch {
    return undefined;
  }
}

export async function cutLook(offerId: string, found: AgentLook, madeBy: string): Promise<Omit<ShowcaseLook, 'madeAt'>> {
  const [background, logo] = await Promise.all([cutBackground(offerId, found.photos), fetchLogo(found.logo)]);
  return {
    headline: found.headline,
    ...(found.accent ? { accent: found.accent } : {}),
    background,
    ...(logo ? { logo } : {}),
    ...(found.location ? { location: found.location.slice(0, 120) } : {}),
    ...(found.dates ? { dates: found.dates.slice(0, 80) } : {}),
    madeBy,
  };
}
