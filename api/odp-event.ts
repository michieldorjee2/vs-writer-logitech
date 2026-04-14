import type { VercelRequest, VercelResponse } from '@vercel/node';

const ODP_API = 'https://api.zaius.com/v3/events';
const ODP_TRACKER_ID = '8yoUTdBkNwpVOLCXeZpKdw';

/**
 * Proxies client-side tracking events to the ODP Events API.
 * POST /api/odp-event  { events: [{ type, action, identifiers, data }] }
 *
 * Handles both fetch (application/json) and sendBeacon (text/plain) bodies.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // sendBeacon sends text/plain — Vercel won't auto-parse it
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      console.error('JSON parse failed, raw body:', typeof req.body, String(req.body).slice(0, 500));
      return res.status(400).json({ error: 'invalid JSON' });
    }
  }

  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    console.error('Bad payload, body type:', typeof body, 'body:', JSON.stringify(body).slice(0, 500));
    return res.status(400).json({ error: 'events array required' });
  }

  const odpPayload = JSON.stringify(events);
  console.log('ODP request payload:', odpPayload.slice(0, 1000));

  try {
    const odpRes = await fetch(ODP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ODP_TRACKER_ID,
      },
      body: odpPayload,
    });

    const text = await odpRes.text();
    console.log('ODP response:', odpRes.status, text.slice(0, 1000));

    if (!odpRes.ok) {
      return res.status(502).json({ error: 'ODP upstream error', status: odpRes.status, detail: text.slice(0, 200) });
    }

    return res.status(202).json({ ok: true });
  } catch (err) {
    console.error('ODP fetch failed:', err);
    return res.status(502).json({ error: 'ODP unreachable' });
  }
}
