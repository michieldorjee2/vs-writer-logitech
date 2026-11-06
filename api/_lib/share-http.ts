/** What the personal-link endpoints check of every request (api/share-*.ts). */
import { createHash } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

const header = (req: VercelRequest, name: string): string => {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? '';
};

/** Only the site's own pages post here: a cross-site form post or fetch is refused. */
export function sameSite(req: VercelRequest): boolean {
  const site = header(req, 'sec-fetch-site');
  if (site && site !== 'same-origin') return false;
  const origin = header(req, 'origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (header(req, 'x-forwarded-host') || header(req, 'host'));
  } catch {
    return false;
  }
}

export const isJson = (req: VercelRequest): boolean => /^application\/json(?:;|$)/i.test(header(req, 'content-type').trim());

/** The posted JSON object, or null when it isn't one or is over `max` bytes. */
export function jsonBody(req: VercelRequest, max: number): Record<string, unknown> | null {
  let body: unknown;
  try {
    body = req.body;
  } catch {
    // @vercel/node throws reading a JSON body that doesn't parse.
    return null;
  }
  if (typeof body === 'string') {
    if (body.length > max) return null;
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > max) return null;
  return body as Record<string, unknown>;
}

export function clientIp(req: VercelRequest): string {
  const forwarded = header(req, 'x-forwarded-for').split(',')[0]?.trim();
  return (forwarded || header(req, 'x-real-ip') || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

/** A visitor without an ODP id, as a short hash of address and browser: never stored in the clear. */
export function visitorHash(req: VercelRequest): string {
  return createHash('sha256').update(`${clientIp(req)}|${header(req, 'user-agent').slice(0, 300)}`).digest('hex').slice(0, 32);
}

/** Where links point: the site itself, a preview of it, or a local run; anything else is the site. */
const SITE = 'https://showcase.optimizely.com';
export function linkOrigin(req: VercelRequest): string {
  const host = (header(req, 'x-forwarded-host') || header(req, 'host')).toLowerCase();
  if (host === 'showcase.optimizely.com') return SITE;
  if (/^aldus-[a-z0-9-]+\.vercel\.app$/.test(host)) return `https://${host}`;
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) return `http://${host}`;
  return SITE;
}
