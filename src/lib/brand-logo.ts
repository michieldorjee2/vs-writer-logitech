/**
 * Build a Brandfetch CDN logo URL from a brand domain.
 * Strips protocol, www, trailing slashes, and query strings.
 */
function cleanDomain(rawDomain: string): string {
  let domain = rawDomain.trim();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/^www\./, '');
  domain = domain.split('/')[0];
  domain = domain.split('?')[0];
  return domain;
}

/** Brandfetch icon URL (returns SVG when available, PNG fallback) */
export function brandLogoUrl(rawDomain: string, type: 'icon' | 'logo' | 'symbol' = 'icon'): string {
  const domain = cleanDomain(rawDomain);
  return `https://cdn.brandfetch.io/${domain}/${type}`;
}
