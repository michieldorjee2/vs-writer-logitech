import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateCompanyWebsite, websiteDomain } from './_lib/validate-input.js';
import { requireIdentity } from './_lib/auth.js';
import {
  alreadyRequestedMessage,
  claimWebsite,
  lockStore,
  releaseWebsite,
  type LockStore,
} from './_lib/page-request-lock.js';

/**
 * Proxy the search-page "Add new" payload to the Opal create-page webhook.
 * Same reasoning as opal-feedback.ts: the upstream webhook origin doesn't
 * ship CORS headers, so we have to call it server-side.
 *
 * Payload shape:
 *   { company_name, edit_user_email }
 *
 * The browser sends `company_name`; `edit_user_email` is the signed-in
 * person's address (api/_lib/auth.ts), never one the request names.
 *
 * `company_name` is the company's website. Opal resolves it to one Salesforce
 * account by its domain (or the parent domain's account), refreshes that
 * account's wiki dossier, and builds the page from it; a request it cannot
 * resolve is answered on Teams with the reason.
 *
 * 409 `already_requested` (with a `message` for the rep): the same website was
 * requested less than 15 minutes ago, so no second build is started.
 */

// The one-off workflow's webhook. The URL is the credential, so it lives in the
// environment (Vercel: OPAL_CREATE_PAGE_WEBHOOK_URL), not in the repo.
const OPAL_WEBHOOK_URL = process.env.OPAL_CREATE_PAGE_WEBHOOK_URL || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const identity = requireIdentity(req, res);
  if (!identity) return;
  const { company_name } = (req.body ?? {}) as Record<string, unknown>;

  if (!OPAL_WEBHOOK_URL) {
    console.error('[opal-create-page] OPAL_CREATE_PAGE_WEBHOOK_URL is not set');
    return res.status(503).json({ error: 'Page requests are not configured' });
  }

  // Each accepted request starts an Opal run that can publish a live page, so
  // the bar for spending one is a website from a signed-in Optimizely person.
  // See _lib/validate-input.
  const name = validateCompanyWebsite(company_name);
  if (!name.ok) {
    console.warn('[opal-create-page] rejected company_name:', name.error);
    return res.status(400).json({ error: name.error });
  }

  // A second request for a website that is still being built would start a
  // second build. The store being down must not stop requests, so any error
  // here lets the request through unlocked.
  const domain = websiteDomain(name.value) as string;
  let store: LockStore | null = null;
  try {
    store = lockStore();
    const earlier = store ? await claimWebsite(store, domain, identity.email) : null;
    if (earlier) {
      return res.status(409).json({
        error: 'already_requested',
        message: alreadyRequestedMessage(domain, earlier, identity.email),
      });
    }
  } catch (err) {
    console.error('[opal-create-page] lock', err);
    store = null;
  }
  const release = () => store && releaseWebsite(store, domain).catch(() => {});

  try {
    const upstream = await fetch(OPAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // requested_at keeps every body unique: Opal's webhook gateway drops a body
      // identical to one it has seen, so a repeat request for the same website
      // would otherwise vanish without a run or a reply.
      body: JSON.stringify({
        company_name: name.value,
        edit_user_email: identity.email,
        requested_at: new Date().toISOString(),
      }),
    });

    const text = await upstream.text();
    if (!upstream.ok) await release();
    res.status(upstream.ok ? 200 : 502).json({
      ok: upstream.ok,
      status: upstream.status,
      body: text.slice(0, 2000),
    });
  } catch (err) {
    console.error('[opal-create-page]', err);
    await release();
    res.status(502).json({ error: 'Upstream fetch failed' });
  }
}
