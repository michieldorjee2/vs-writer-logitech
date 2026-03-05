import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const HASH_KEY = 'page-misses';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.body ?? {};
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing slug' });
  }

  // Gracefully skip if KV is not configured
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn('[track-miss] KV not configured — skipping');
    return res.status(200).json({ ok: true, tracked: false });
  }

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    await redis.hincrby(HASH_KEY, slug, 1);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[track-miss]', err);
    return res.status(200).json({ ok: true, tracked: false });
  }
}
