import type { CompetitorComparisonPage } from './graph-types';

/**
 * Identity helpers for a comparison page — "what's the customer slug,
 * what's the customer name?". Centralised here so the sticky CTA, the
 * edit-mode webhook, and any future consumer all derive the same
 * answer for the same page.
 *
 * Source of truth: `_metadata.url.default` from the CMS (locale-prefixed
 * — Optimizely Graph stores the hierarchical URL even in `default`).
 * We strip the leading 2-letter ISO segment (en, en-us, fr-ca, …) so
 * the derived slug is stable across locales.
 */

/**
 * Locale-stripped slug, always with a leading slash. e.g. for a CMS
 * URL of "/en/aruba-bank-nv/" returns "/aruba-bank-nv".
 */
export function getPageSlug(page: CompetitorComparisonPage): string {
  const raw =
    page._metadata?.url?.default?.trim() ||
    (typeof window !== 'undefined' ? window.location.pathname : '/');
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  // Strip a leading locale segment if present (en, en-us, fr-ca, …)
  const localeStripped = trimmed.replace(/^[a-z]{2}(-[a-z]{2})?\//i, '');
  return '/' + localeStripped;
}

/**
 * Title-cased name of the company the page is built for. The page
 * schema doesn't have a single "customer name" field, so we look at
 * three increasingly-fuzzy sources in order:
 *
 *   1. The `<em>...</em>` span inside `intelHeadline` — content
 *      authors wrap the customer name here ("We know <em>Aruba
 *      Bank</em>"), making it the most reliable source.
 *   2. The hero `eyebrow` text, with the "Personalized for " prefix
 *      stripped ("Personalized for Aruba Bank" → "Aruba Bank").
 *   3. Slug-derived as a last resort. This loses entity suffixes
 *      (e.g. "/aruba-bank-nv" → "Aruba Bank Nv") but is always
 *      available.
 *
 * `competitorName` is intentionally NOT used — that's the rival
 * product (Sitecore, Adobe), not the customer.
 */
export function deriveCustomerName(page: CompetitorComparisonPage): string {
  /* 0. Person pages carry the company name outright, and the slug fallback
        below would otherwise turn "/becton-dickinson/tom-polen" into
        "Becton Dickinson Tom Polen" — a company that does not exist. */
  const personCompany = (page as { companyName?: string }).companyName;
  if (personCompany?.trim()) return personCompany.trim();

  // 1. Author-tagged inside intelHeadline.
  const em = page.intelHeadline?.match(/<em>([^<]+)<\/em>/i);
  const fromEm = em?.[1]?.trim();
  if (fromEm) return fromEm;

  // 2. From eyebrow — only when it cleanly starts with "Personalized for".
  const eyebrowMatch = page.eyebrow?.match(/^\s*personali[sz]ed\s+for\s+(.+?)\s*$/i);
  const fromEyebrow = eyebrowMatch?.[1]?.trim();
  if (fromEyebrow) return fromEyebrow;

  // 3. Slug fallback.
  const slug = getPageSlug(page);
  const stripped = slug
    .replace(/^\/+|\/+$/g, '')
    .replace(/^vs-writer-ai-/, '')
    .replace(/^vs-writer-/, '')
    .replace(/-/g, ' ');
  if (!stripped) return 'your team';
  return (
    stripped
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'your team'
  );
}
