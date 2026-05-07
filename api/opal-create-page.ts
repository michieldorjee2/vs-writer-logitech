import type { VercelRequest, VercelResponse } from '@vercel/node';

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

const OPTIMIZELY_EMAIL_RE = /^[^\s@]+@optimizely\.com$/i;
const MAX_COMPANY_NAME_LEN = 120;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, edit_user_email } = (req.body ?? {}) as Record<string, unknown>;

  if (
    typeof company_name !== 'string' ||
    !company_name.trim() ||
    company_name.trim().length > MAX_COMPANY_NAME_LEN ||
    typeof edit_user_email !== 'string' ||
    !OPTIMIZELY_EMAIL_RE.test(edit_user_email)
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  try {
    const upstream = await fetch(OPAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: company_name.trim(),
        edit_user_email,
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
