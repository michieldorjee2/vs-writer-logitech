import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/brand-logo?domain=logitech.com
 *
 * Server-side proxy that fetches a brand's SVG logo via the Optimizely CMS
 * get_logo_svg tool pattern (Brandfetch). Returns clean SVG with backgrounds
 * stripped and fills set to white, ready for 3D canvas rendering.
 *
 * Falls back to Brandfetch CDN icon endpoint.
 */

const BRANDFETCH_KEY = process.env.BRANDFETCH_KEY || '';

function cleanDomain(raw: string): string {
  let d = raw.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split('?')[0];
  return d;
}

async function fetchSvgFromBrandfetch(domain: string): Promise<string | null> {
  // Try the Brandfetch API to get logo data
  const url = `https://api.brandfetch.io/v2/brands/${domain}`;
  try {
    const res = await fetch(url, {
      headers: BRANDFETCH_KEY ? { 'Authorization': `Bearer ${BRANDFETCH_KEY}` } : {},
    });
    if (!res.ok) return null;
    const data = await res.json() as any;

    // Find an SVG logo (prefer icon type)
    const logos = data?.logos || [];
    for (const logo of logos) {
      if (logo.type === 'icon' || logo.type === 'symbol') {
        for (const fmt of (logo.formats || [])) {
          if (fmt.format === 'svg' && fmt.src) {
            const svgRes = await fetch(fmt.src);
            if (svgRes.ok) return svgRes.text();
          }
        }
      }
    }
    // Fallback: try any SVG format
    for (const logo of logos) {
      for (const fmt of (logo.formats || [])) {
        if (fmt.format === 'svg' && fmt.src) {
          const svgRes = await fetch(fmt.src);
          if (svgRes.ok) return svgRes.text();
        }
      }
    }
  } catch {
    // API not available or no key
  }
  return null;
}

function cleanSvg(svgText: string): string | null {
  // Simple regex-based cleaning (no DOMParser on server)
  if (!svgText.includes('<svg')) return null;

  // Extract viewBox
  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 100 100';

  // Extract all <path d="...">
  const pathRegex = /<path[^>]*\bd="([^"]+)"[^>]*\/?>/g;
  const paths: string[] = [];
  let m;
  while ((m = pathRegex.exec(svgText)) !== null) {
    paths.push(m[1]);
  }

  if (paths.length === 0) return null;

  let clean = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="white">`;
  for (const d of paths) {
    clean += `<path d="${d}" fill="white"/>`;
  }
  clean += '</svg>';
  return clean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const domain = req.query.domain;
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'Missing domain parameter' });
  }

  const cleaned = cleanDomain(domain);

  // Try Brandfetch API
  const rawSvg = await fetchSvgFromBrandfetch(cleaned);
  if (rawSvg) {
    const clean = cleanSvg(rawSvg);
    if (clean) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(clean);
    }
  }

  // Fallback: try fetching the favicon/logo directly from the domain
  for (const path of ['/favicon.svg', '/logo.svg']) {
    try {
      const r = await fetch(`https://${cleaned}${path}`);
      if (r.ok) {
        const text = await r.text();
        if (text.includes('<svg')) {
          const clean = cleanSvg(text);
          if (clean) {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).send(clean);
          }
        }
      }
    } catch { /* skip */ }
  }

  return res.status(404).json({ error: 'No SVG logo found' });
}
