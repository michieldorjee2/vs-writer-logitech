import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateCompanyName, validateEmail } from './_lib/validate-input.js';

/**
 * Proxy the search-page "Add new" payload to the Opal create-page webhook.
 * Same reasoning as opal-feedback.ts: the upstream webhook origin doesn't
 * ship CORS headers, so we have to call it server-side.
 *
 * Payload shape:
 *   { company_name, edit_user_email }
 */

const OPAL_WEBHOOK_URL =
  'https://webhook.opal.optimizely.com/webhooks/4f42a24e93f945bcb262bff01a9a1562/632a7f56-733d-41d0-b71a-6da3b657c5c6';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, edit_user_email } = (req.body ?? {}) as Record<string, unknown>;

  // Each accepted request buys a ~12-minute agent run at 150-200 credits and
  // can publish a live page, so the bar for spending one is a plausible
  // company name from an identifiable Optimizely address. See _lib/validate-input.
  const name = validateCompanyName(company_name);
  if (!name.ok) {
    console.warn('[opal-create-page] rejected company_name:', name.error);
    return res.status(400).json({ error: name.error });
  }
  const email = validateEmail(edit_user_email, { strict: true });
  if (!email.ok) {
    return res.status(400).json({ error: email.error });
  }

  try {
    const upstream = await fetch(OPAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: name.value,
        edit_user_email: email.value,
      }),
    });

    const text = await upstream.text();
    res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      status: upstream.status,
      body: text.slice(0, 2000),
    });
  } catch (err) {
    console.error('[opal-create-page]', err);
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
}
