/**
 * Where a CTA opens, read from its URL.
 *
 * An absolute http(s) URL leaves the page — the contact form, a booking link — so it opens in
 * a new tab and the reader keeps the page they came from. Laura's review (2026-10-21): the
 * CTA reloaded the same tab, and the offer spec could not change that because no content
 * field carries a target. Anything else stays in the tab: `#about` scrolls within the page,
 * and a `mailto:` opened in a new tab only leaves an empty one behind.
 *
 * Spread it onto the anchor: `<a href={url} {...linkTarget(url)}>`.
 */
export function linkTarget(url: string | undefined): { target?: '_blank'; rel?: string } {
  return url && /^https?:\/\//i.test(url.trim())
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {}
}
