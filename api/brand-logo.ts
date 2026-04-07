import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/brand-logo?domain=logitech.com
 *
 * Server-side proxy that fetches a brand's SVG logo via the Brandfetch API.
 * Returns clean SVG (paths only, white fill) for 3D canvas rendering.
 * Tries: symbol SVG → icon SVG → logo SVG → any SVG available.
 */

const BRANDFETCH_API = 'https://api.brandfetch.io/v2/brands/';
const BRANDFETCH_KEY = process.env.BRANDFETCH_KEY || '';

function cleanDomain(raw: string): string {
  let d = raw.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  return d.split('/')[0].split('?')[0];
}

function extractCleanSvg(svgText: string): string | null {
  if (!svgText.includes('<svg')) return null;

  const vbMatch = svgText.match(/viewBox="([^"]+)"/);
  const wMatch = svgText.match(/\bwidth="([^"]+)"/);
  const hMatch = svgText.match(/\bheight="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1] : `0 0 ${wMatch?.[1] || 100} ${hMatch?.[1] || 100}`;

  // Extract all <path d="..."> elements
  const pathRegex = /<path[^>]*?\bd="([^"]+)"[^>]*?\/?>/g;
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

  if (!BRANDFETCH_KEY) {
    return res.status(500).json({ error: 'BRANDFETCH_KEY not configured' });
  }

  try {
    const apiRes = await fetch(`${BRANDFETCH_API}${cleaned}`, {
      headers: { 'Authorization': `Bearer ${BRANDFETCH_KEY}` },
    });

    if (!apiRes.ok) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const data = await apiRes.json() as any;
    const logos = data?.logos || [];

    // Priority order: symbol, icon, logo — prefer SVG format
    const typeOrder = ['symbol', 'icon', 'logo'];
    for (const targetType of typeOrder) {
      for (const logo of logos) {
        if (logo.type !== targetType) continue;
        for (const fmt of (logo.formats || [])) {
          if (fmt.format === 'svg' && fmt.src) {
            const svgRes = await fetch(fmt.src);
            if (!svgRes.ok) continue;
            const svgText = await svgRes.text();
            const clean = extractCleanSvg(svgText);
            if (clean) {
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
              return res.status(200).send(clean);
            }
          }
        }
      }
    }

    // Fallback: any SVG from any logo type
    for (const logo of logos) {
      for (const fmt of (logo.formats || [])) {
        if (fmt.format === 'svg' && fmt.src) {
          const svgRes = await fetch(fmt.src);
          if (!svgRes.ok) continue;
          const svgText = await svgRes.text();
          const clean = extractCleanSvg(svgText);
          if (clean) {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).send(clean);
          }
        }
      }
    }

    return res.status(404).json({ error: 'No SVG logo found for this brand' });
  } catch (err) {
    console.error('[api/brand-logo]', err);
    return res.status(500).json({ error: 'Failed to fetch brand logo' });
  }
}
