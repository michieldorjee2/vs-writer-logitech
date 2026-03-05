import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const HASH_KEY = 'page-misses';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured' });
  }

  try {
    const redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });

    const misses: Record<string, number> = (await redis.hgetall(HASH_KEY)) ?? {};

    // Sort by count descending
    const sorted = Object.fromEntries(
      Object.entries(misses).sort(([, a], [, b]) => b - a),
    );

    return res.status(200).json(sorted);
  } catch (err) {
    console.error('[misses]', err);
    return res.status(500).json({ error: 'Failed to read misses' });
  }
}
