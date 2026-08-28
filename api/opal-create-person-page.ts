import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/opal-create-person-page
 *
 * Sibling of opal-create-page. That one asks Opal for an ACCOUNT page; this one
 * asks for a 1:1 PERSON page, which is what sales actually wants when they have
 * a named buyer rather than just a logo.
 *
 * It posts to the `person_pages_for_company` workflow, which checks whether the
 * account page exists, creates it first if it does not, and only then builds the
 * person page underneath it. So a rep can ask for a person at a company we have
 * never built anything for, and get both.
 */

const OPAL_WEBHOOK_URL =
  'https://webhook.opal.optimizely.com/webhooks/4f42a24e93f945bcb262bff01a9a1562/3f7a8105-b0bf-4539-b204-bb8140fddbbe';

const OPTIMIZELY_EMAIL_RE = /^[^\s@]+@optimizely\.com$/i;
const MAX_COMPANY_NAME_LEN = 120;
const MAX_PERSON_NAME_LEN = 120;
const MAX_TITLE_LEN = 160;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { company_name, person_name, person_title, edit_user_email } =
    (req.body ?? {}) as Record<string, unknown>;

  const company = typeof company_name === 'string' ? company_name.trim() : '';
  const person = typeof person_name === 'string' ? person_name.trim() : '';
  const title = typeof person_title === 'string' ? person_title.trim() : '';
  const email = typeof edit_user_email === 'string' ? edit_user_email.trim() : '';

  if (!company || company.length > MAX_COMPANY_NAME_LEN) {
    return res.status(400).json({ error: 'Missing or invalid company_name' });
  }
  if (!person || person.length > MAX_PERSON_NAME_LEN) {
    return res.status(400).json({ error: 'Missing or invalid person_name' });
  }
  if (title.length > MAX_TITLE_LEN) {
    return res.status(400).json({ error: 'person_title too long' });
  }
  // Same gate as the account-page route: this triggers real spend and writes to
  // a customer-facing site, so it stays inside the company.
  if (!OPTIMIZELY_EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Missing or invalid edit_user_email' });
  }

  try {
    const upstream = await fetch(OPAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_company: company,
        person_name: person,
        // Omitted rather than sent empty — the agent verifies the title itself
        // when it is not supplied, and an empty string reads as "known to be
        // blank" instead of "not provided".
        ...(title ? { person_title: title } : {}),
        optimizely_email: email,
      }),
    });
    const text = await upstream.text();
    return res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      status: upstream.status,
      body: text.slice(0, 2000),
    });
  } catch (err) {
    console.error('[opal-create-person-page]', err);
    return res.status(502).json({ error: 'Upstream fetch failed' });
  }
}
