// CMP DAM (cmp.optimizely.com) serves public image assets at full resolution
// by default. The CDN supports an on-the-fly `width` rendition param (format /
// quality params are ignored), so appending it returns a right-sized image
// instead of the multi-hundred-KB original. This is the resize lever the
// project's `unoptimized: true` Next image config otherwise leaves unused.

const CMP_IMAGE_HOST_RE = /(^|\.)cmp\.optimizely\.com$/i

/**
 * Append a `width` rendition param to a CMP image URL so the CDN returns a
 * resized image. No-op (returns the input unchanged) for non-CMP hosts,
 * already-sized URLs, and anything that isn't a parseable absolute URL.
 *
 * `width` should be the largest CSS pixel size the image renders at; the CDN
 * caps at the source width, so passing a generous cap (e.g. 1920 for a
 * full-bleed hero) is safe and never upscales.
 */
export function cmpImageUrl(url: string, width: number): string {
  try {
    const u = new URL(url)
    if (!CMP_IMAGE_HOST_RE.test(u.hostname)) return url
    if (u.searchParams.has('width')) return url
    u.searchParams.set('width', String(Math.round(width)))
    return u.toString()
  } catch {
    return url
  }
}

// Shared DAM placeholder, used as the fallback for cards whose layout requires
// an image when the CMS content doesn't supply one.
export const PLACEHOLDER_IMAGE_URL =
  'https://images3.cmp.optimizely.com/Zz1hOTU5MjFjNDY5MWYxMWYxOTU5NmZlODFjZDBjMWExMg=='

/**
 * The shared placeholder image, sized via the CDN `width` rendition param.
 * Pass the largest CSS pixel width the slot renders at.
 */
export function placeholderImageUrl(width: number): string {
  return cmpImageUrl(PLACEHOLDER_IMAGE_URL, width)
}
