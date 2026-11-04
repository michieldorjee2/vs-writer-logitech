import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from '../_lib/auth.js';
import { offerAccounts, underMatchLimit } from '../_lib/account-lookups.js';
import { buildStore } from '../_lib/page-builds-store.js';
import { findAccounts } from '../_lib/salesforce.js';
import { markConfigured } from '../_lib/mark.js';
import { validateText } from '../_lib/validate-input.js';
import { MAX_QUERY_LENGTH, searchTerm, domainOf, type AccountMatch } from '../../src/lib/account-match.js';

/**
 * POST { query } → AccountMatch: the Salesforce accounts a company name or a
 * website could mean, for the search page to offer before Mark builds a page
 * (src/lib/account-match.ts). The rep then starts the build with
 * POST /api/page-builds { kind: 'account', lookup, key }.
 *
 * Signed-in Optimizely people only, like the rest of the search page.
 * 429 after MATCHES_PER_WINDOW lookups in ten minutes; 502 when Salesforce
 * did not answer (never shown as "no accounts").
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const store = buildStore();
  if (!store || !markConfigured()) return res.status(503).json({ error: 'Page builds are not configured' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const query = validateText(body.query, 'query', MAX_QUERY_LENGTH + 40, { requireLetter: true });
  if (!query.ok) return res.status(400).json({ error: query.error });
  if (!domainOf(query.value) && !searchTerm(query.value)) {
    return res.status(400).json({ error: 'Type at least two letters of the company’s name, or its website.' });
  }

  try {
    if (!(await underMatchLimit(store, identity.email))) {
      return res.status(429).json({ error: 'That’s a lot of lookups in a few minutes. Wait a moment and try again.' });
    }
    const found = await findAccounts(query.value);
    if (found.failed) return res.status(502).json({ error: 'Salesforce didn’t answer. Try again in a minute.' });
    const offered = await offerAccounts(store, identity.email, query.value, found.rows);
    const answer: AccountMatch = { lookup: offered.lookup, query: query.value, accounts: offered.accounts, more: offered.more };
    return res.status(200).json(answer);
  } catch (err) {
    console.error('[page-builds/match]', err);
    return res.status(502).json({ error: 'Couldn’t look that up. Try again.' });
  }
}
