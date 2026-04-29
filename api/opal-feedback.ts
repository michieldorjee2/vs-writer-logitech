import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy the edit-mode "send feedback" payload to the Opal webhook so the
 * browser doesn't need to talk to webhook.opal.optimizely.com directly
 * (that origin doesn't ship CORS headers, so a fetch() preflight from
 * the booth domain fails). The payload shape is fixed by the Opal side:
 *
 *   { company_name, company_slug, suggested_edit, edit_user_email }
 */

const OPAL_WEBHOOK_URL =
  'https://webhook.opal.optimizely.com/webhooks/4f42a24e93f945bcb262bff01a9a1562/4a159bac-e9fb-43d1-82c1-a4431baebedc';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, company_slug, suggested_edit, edit_user_email } = (req.body ?? {}) as Record<string, unknown>;

  if (
    typeof company_name !== 'string' || !company_name.trim() ||
    typeof company_slug !== 'string' || !company_slug.trim() ||
    typeof suggested_edit !== 'string' || !suggested_edit.trim() ||
    typeof edit_user_email !== 'string' || !EMAIL_RE.test(edit_user_email)
  ) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }

  try {
    const upstream = await fetch(OPAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name, company_slug, suggested_edit, edit_user_email }),
    });

    const text = await upstream.text();
    res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      status: upstream.status,
      body: text.slice(0, 2000),
    });
  } catch (err) {
    console.error('[opal-feedback]', err);
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
}
