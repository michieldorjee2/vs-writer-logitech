import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateCompanyWebsite, validateEmail } from './_lib/validate-input.js';

/**
 * Proxy the search-page "Add new" payload to the Opal create-page webhook.
 * Same reasoning as opal-feedback.ts: the upstream webhook origin doesn't
 * ship CORS headers, so we have to call it server-side.
 *
 * Payload shape:
 *   { company_name, edit_user_email }
 *
 * `company_name` is the company's website. Opal resolves it to one Salesforce
 * account by exact domain, refreshes that account's wiki dossier, and builds the
 * page from it; a request it cannot resolve is answered on Teams with the reason.
 */

// The one-off workflow's webhook. The URL is the credential, so it lives in the
// environment (Vercel: OPAL_CREATE_PAGE_WEBHOOK_URL), not in the repo.
const OPAL_WEBHOOK_URL = process.env.OPAL_CREATE_PAGE_WEBHOOK_URL || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, edit_user_email } = (req.body ?? {}) as Record<string, unknown>;

  if (!OPAL_WEBHOOK_URL) {
    console.error('[opal-create-page] OPAL_CREATE_PAGE_WEBHOOK_URL is not set');
    return res.status(503).json({ error: 'Page requests are not configured' });
  }

  // Each accepted request starts an Opal run that can publish a live page, so
  // the bar for spending one is a website from an identifiable Optimizely
  // address. See _lib/validate-input.
  const name = validateCompanyWebsite(company_name);
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
      // requested_at keeps every body unique: Opal's webhook gateway drops a body
      // identical to one it has seen, so a repeat request for the same website
      // would otherwise vanish without a run or a reply.
      body: JSON.stringify({
        company_name: name.value,
        edit_user_email: email.value,
        requested_at: new Date().toISOString(),
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
