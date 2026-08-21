import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateText, validateEmail, MAX_COMPANY_NAME, MAX_SUGGESTED_EDIT, MAX_SLUG } from './_lib/validate-input.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, company_slug, suggested_edit, edit_user_email } = (req.body ?? {}) as Record<string, unknown>;

  // Every field here lands in an agent prompt that then edits a live page, so
  // each one is length-bounded and screened for payload shapes. The email stays
  // non-strict: Edit mode is used at booths where a non-Optimizely address is
  // sometimes the right attribution.
  const fields = {
    company_name: validateText(company_name, 'company_name', MAX_COMPANY_NAME, { requireLetter: true }),
    company_slug: validateText(company_slug, 'company_slug', MAX_SLUG),
    suggested_edit: validateText(suggested_edit, 'suggested_edit', MAX_SUGGESTED_EDIT),
  };
  for (const result of Object.values(fields)) {
    if (!result.ok) {
      console.warn('[opal-feedback] rejected:', result.error);
      return res.status(400).json({ error: result.error });
    }
  }
  const email = validateEmail(edit_user_email, { strict: false });
  if (!email.ok) {
    return res.status(400).json({ error: email.error });
  }

  try {
    const upstream = await fetch(OPAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: (fields.company_name as { value: string }).value,
        company_slug: (fields.company_slug as { value: string }).value,
        suggested_edit: (fields.suggested_edit as { value: string }).value,
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
    console.error('[opal-feedback]', err);
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
}
