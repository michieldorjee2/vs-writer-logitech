/**
 * The search index as the browser reads it: Graph's account pages turned into
 * the entries the search page lists.
 *
 * Pure — no DOM beyond localStorage, no React.
 */
import { brandLogoTypeUrl } from './brand-logo';

export type IndexItem = {
  _metadata: { url: { default: string; hierarchical: string }; published: string | null };
  headline: string | null;
  eyebrow: string | null;
  competitorName: string | null;
  brandDomain: string | null;
  brandAccentColor: string | null;
  customerLogo: string | null;
  intelHeadline: string | null;
};

export type Entry = {
  slug: string;          // path the router should navigate to (no leading slash)
  name: string;          // display name
  domain: string;        // display domain
  industry: string;      // e.g. eyebrow text
  color: string;         // hex brand accent (or default)
  logoUrl: string | null;
};

export const RECENT_KEY = 'showcase.recent-searches.v1';
export const MAX_RECENT = 6;

/** "vs-writer-ai-logitech" or "/en/vs-writer-ai-logitech/" → "Logitech" */
export function prettyFromSlug(slug: string): string {
  const base = slug
    .replace(/^\/+|\/+$/g, '')
    .replace(/^en\//, '')
    .replace(/^vs-writer-ai-/, '')
    .replace(/^vs-writer-/, '')
    .replace(/^hyper-/, '');
  return base
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function cleanSlug(url: string): string {
  // Graph returns `/en/vs-writer-ai-logitech/`. Strip locale + slashes.
  return url.replace(/^\/+|\/+$/g, '').replace(/^en\//, '');
}

/** Pull the target company name out of intelHeadline's first <em>.
 *  e.g. "We know <em>Aruba Bank</em>" → "Aruba Bank" */
export function nameFromIntel(intel: string | null): string | null {
  if (!intel) return null;
  const m = intel.match(/<em[^>]*>([^<]+)<\/em>/i);
  return m?.[1]?.trim() || null;
}

export function toEntry(item: IndexItem): Entry {
  const slug = cleanSlug(item._metadata?.url?.hierarchical || item._metadata?.url?.default || '');
  // Preferred: the brand the page was built FOR (Aruba Bank), not the
  // competitor we're fighting against (Sitecore).
  const name =
    nameFromIntel(item.intelHeadline) ||
    prettyFromSlug(slug);
  const domain = item.brandDomain || `${slug}.com`;
  // Use the competitor as secondary context ("vs Sitecore") when present.
  const industry = item.competitorName
    ? `vs ${item.competitorName}`
    : item.eyebrow || 'Comparison page';
  const color = item.brandAccentColor || '#abff44';
  // Prefer the square brand *icon* over the wordmark — fills the circular/
  // squircle chip without leaving whitespace bars around it.
  const logoUrl =
    item.customerLogo ||
    (item.brandDomain ? brandLogoTypeUrl(item.brandDomain, 'icon') : null);
  return { slug, name, domain, industry, color, logoUrl };
}

/** Multiple comparison pages can exist per company (vs-Sitecore / vs-Adobe): keep the first. */
export function dedupeByName<T extends { name: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = e.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function writeRecent(slugs: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(slugs.slice(0, MAX_RECENT)));
  } catch {
    // Swallow — private mode, quota, etc.
  }
}

/** Same reading as api/_lib/validate-input's websiteDomain. */
export function looksLikeWebsite(value: string): boolean {
  const host = value.toLowerCase().replace(/\s+/g, '').replace(/^https?:\/\//, '').split('/')[0];
  const domain = host.startsWith('www.') ? host.slice(4) : host;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain);
}
