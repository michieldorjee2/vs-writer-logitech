/**
 * Build a Brandfetch CDN logo URL from a brand domain.
 * Strips protocol, www, trailing slashes, and query strings.
 */
export function brandLogoUrl(rawDomain: string, type: 'icon' | 'logo' = 'icon'): string {
  let domain = rawDomain.trim();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//, '');
  // Strip www.
  domain = domain.replace(/^www\./, '');
  // Strip trailing slashes and paths
  domain = domain.split('/')[0];
  // Strip query strings
  domain = domain.split('?')[0];

  return `https://cdn.brandfetch.io/${domain}/w/512/h/512/${type}`;
}
