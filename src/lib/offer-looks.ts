/**
 * Running the search page as an offer: a rep picks one of Aldus UI's running
 * offers in the profile menu, and /search takes on its look (a photograph of
 * the place, a headline, the event's logo) and lists its pages.
 *
 * The look is made by Mark (agent `showcase_event_look`) the first time the
 * offer is picked; the server cuts the photograph into the sizes below,
 * keeps them in Vercel Blob, and stores the look in Aldus UI
 * (/api/machine/showcase/offers/{id}/look), which owns it from then on.
 *
 * Pure: the server and the browser share it.
 */
import type { Backdrop } from './home-scenes.js';

/** As Aldus UI stores it (aldus-ui lib/offers/showcase-look-types.ts). */
export type ShowcaseLook = {
  headline: string;
  accent?: string;
  logo?: { svg: string; sourceUrl: string; traced: boolean };
  background: {
    /** The folder the cuts live in: `{base}/wide-1600.avif`, `{base}/tall-720.webp` … */
    base: string;
    aspect: number;
    lqip: string;
    sourceUrl: string;
    credit?: string;
    license: 'generated' | 'official' | 'stock' | 'unknown';
  };
  location?: string;
  dates?: string;
  madeBy: string;
  madeAt: string;
};

/** An offer page, as Graph has it (an ABMExperience whose componentPlan names the offer). */
export type OfferPage = {
  route: string;
  companyName: string;
  domain: string | null;
  logoUrl: string | null;
  published: string | null;
};

/** A running offer, as GET /api/offers lists it. */
export type RunningOffer = {
  id: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  look: ShowcaseLook | null;
  pages: OfferPage[];
};

/** What the server draws /search with, and the browser hydrates (#root data-offer). */
export type ShownOffer = Pick<RunningOffer, 'id' | 'title' | 'look'>;

export type LookJobStatus = 'making' | 'cutting' | 'done' | 'failed';

/** What a step of Mark's run was doing, for its icon. */
export type LookTool = 'search' | 'photos' | 'browse' | 'trace' | 'generate' | 'cut';

/** One line of the card: Mark's two- or three-word status, or the tool's own words. */
export type LookStep = { id: string; text: string; tool?: LookTool };

/** A look being made, as GET /api/offers/{id}/look answers. */
export type LookJob = {
  offerId: string;
  status: LookJobStatus;
  startedAt: number;
  finishedAt?: number;
  /** One line for the card: the latest thing Mark is doing. */
  statusLine: string;
  progress: number;
  steps: LookStep[];
  look: ShowcaseLook | null;
  error?: string;
};

/** The cookie that holds the offer a rep runs /search as. */
export const OFFER_COOKIE = 'sh_offer';
export const isOfferId = (v: unknown): v is string => typeof v === 'string' && /^[\w.-]{1,200}$/.test(v) && !v.startsWith('.');

/* ---------- The photograph's cuts ---------- */

/** Fewer steps than the bundled scenes: these are cut in a function, once per offer. */
export const LOOK_LADDER = {
  wide: { avif: [960, 1600, 2400], webp: [960, 1600] },
  tall: { avif: [720, 1440], webp: [720] },
} as const;
export type LookCut = keyof typeof LOOK_LADDER;
export type LookFormat = 'avif' | 'webp';

export const lookSrc = (base: string, cut: LookCut, width: number, format: LookFormat) => `${base}/${cut}-${width}.${format}`;
export const lookSrcSet = (base: string, cut: LookCut, format: LookFormat) =>
  LOOK_LADDER[cut][format].map((w) => `${lookSrc(base, cut, w, format)} ${w}w`).join(', ');

export function lookBackdrop(look: ShowcaseLook): Backdrop {
  const { base, aspect, lqip } = look.background;
  return {
    key: `look:${base}`,
    aspect,
    lqip,
    srcSet: (cut, format) => lookSrcSet(base, cut, format),
    fallback: lookSrc(base, 'wide', 1600, 'webp'),
  };
}

/* ---------- What Mark answers ---------- */

export type AgentLook = {
  headline: string;
  accent: string;
  location: string;
  dates: string;
  photos: Array<{ url: string; page_url: string; credit?: string; license: string; why?: string }>;
  logo: { svg_url: string; source_url: string; traced: boolean } | null;
  notes?: string;
};

/** The agent's answer: bare JSON as asked, or JSON inside a fence or a sentence when it drifts. */
export function parseAgentLook(raw: unknown): AgentLook | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    const text = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      value = JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
  const headline = str(v.headline).replace(/[.。]$/, '');
  const photos = (Array.isArray(v.photos) ? v.photos : [])
    .map((p) => (p && typeof p === 'object' ? (p as Record<string, unknown>) : {}))
    .filter((p) => /^https:\/\//.test(str(p.url)))
    .slice(0, 3)
    .map((p) => ({ url: str(p.url), page_url: str(p.page_url), credit: str(p.credit) || undefined, license: str(p.license) || 'unknown', why: str(p.why) || undefined }));
  if (!headline || !photos.length) return null;
  const logo = v.logo && typeof v.logo === 'object' ? (v.logo as Record<string, unknown>) : null;
  const accent = str(v.accent);
  return {
    headline: headline.slice(0, 120),
    accent: accent && headline.includes(accent) ? accent : '',
    location: str(v.location),
    dates: str(v.dates),
    photos,
    logo: logo && /^https:\/\//.test(str(logo.svg_url)) ? { svg_url: str(logo.svg_url), source_url: str(logo.source_url) || str(logo.svg_url), traced: logo.traced === true } : null,
    notes: str(v.notes) || undefined,
  };
}

/** The headline in three parts, so the accent can be drawn in the accent colour. */
export function headlineParts(look: Pick<ShowcaseLook, 'headline' | 'accent'>): [string, string, string] {
  const { headline, accent } = look;
  const at = accent ? headline.indexOf(accent) : -1;
  if (!accent || at < 0) return [headline, '', ''];
  return [headline.slice(0, at), accent, headline.slice(at + accent.length)];
}

/** The logo as an image source: drawn as an <img>, where nothing in it runs. */
export const logoSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

