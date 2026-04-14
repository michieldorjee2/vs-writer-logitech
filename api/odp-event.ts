import type { VercelRequest, VercelResponse } from '@vercel/node';

const ODP_API = 'https://unification.optimizely.com/v3/events';
const ODP_TRACKER_ID = '8yoUTdBkNwpVOLCXeZpKdw';

/**
 * Proxies client-side tracking events to the ODP Events API.
 * POST /api/odp-event  { events: [{ type, action, identifiers, data }] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { events } = req.body ?? {};
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: 'events array required' });
  }

  try {
    const odpRes = await fetch(ODP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ODP_TRACKER_ID,
      },
      body: JSON.stringify(events),
    });

    if (!odpRes.ok) {
      const text = await odpRes.text();
      console.error('ODP API error:', odpRes.status, text);
      return res.status(502).json({ error: 'ODP upstream error', status: odpRes.status });
    }

    return res.status(202).json({ ok: true });
  } catch (err) {
    console.error('ODP fetch failed:', err);
    return res.status(502).json({ error: 'ODP unreachable' });
  }
}
