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

/**
 * Brandfetch Logo Link CDN URL.
 * Works in <img> tags (browser referrer auth). Does NOT work with server-side fetch().
 * The ?c= param is the Logo Link client ID (free tier).
 */
const BRANDFETCH_CLIENT_ID = '1id3sONkMfoRECy0vYF';

export function brandLogoUrl(rawDomain: string): string {
  const domain = cleanDomain(rawDomain);
  return `https://cdn.brandfetch.io/domain/${domain}?c=${BRANDFETCH_CLIENT_ID}`;
}

export function brandLogoTypeUrl(rawDomain: string, type: 'icon' | 'logo' | 'symbol' = 'icon'): string {
  const domain = cleanDomain(rawDomain);
  return `https://cdn.brandfetch.io/domain/${domain}/type/${type}?c=${BRANDFETCH_CLIENT_ID}`;
}
