import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from '../_lib/auth.js';
import { markConfigured, MarkError } from '../_lib/mark.js';
import { alreadyRequestedMessage, claimWebsite, releaseWebsite } from '../_lib/page-request-lock.js';
import { buildForSite, buildStore, buildsForRep } from '../_lib/page-builds-store.js';
import { startAccountBuild, startPersonBuild, summarize, summaryOf } from '../_lib/page-builds.js';
import { validateCompanyName, validateCompanyWebsite, validateText, websiteDomain } from '../_lib/validate-input.js';
import { nameFromWebsite } from '../../src/lib/page-builds.js';

/**
 * The search page's page builds (replaces the opal-create-page webhooks).
 *
 *   GET   → { builds: BuildSummary[] }  the signed-in rep's builds, newest first
 *   POST  { kind: 'account', website, name? }
 *         { kind: 'person', personName, personTitle?, company: { route, name } }
 *         { kind: 'person', personName, personTitle?, company: { website, name? } }
 *         → { build: BuildSummary, company?: BuildSummary }
 *
 * A person whose company has no page yet gets the company's page built first;
 * their own build waits for it (and starts when anyone next looks at either).
 * 409 `already_requested`: the website is already being built (page-request-lock).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identity = requireIdentity(req, res);
  if (!identity) return;
  res.setHeader('Cache-Control', 'private, no-store');

  const store = buildStore();
  if (!store || !markConfigured()) return res.status(503).json({ error: 'Page builds are not configured' });

  if (req.method === 'GET') {
    try {
      const records = await buildsForRep(store, identity.email);
      const builds = await Promise.all(
        records.map((r) => (r.status === 'running' || r.status === 'waiting' ? summaryOf(store, r) : summarize(r, null))),
      );
      return res.status(200).json({ builds });
    } catch (err) {
      console.error('[page-builds] list', err);
      return res.status(502).json({ error: 'Could not read the builds' });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = (req.body ?? {}) as Record<string, unknown>;
  try {
    if (body.kind === 'account') {
      const website = validateCompanyWebsite(body.website);
      if (!website.ok) return res.status(400).json({ error: website.error });
      const name = typed(body.name) ?? nameFromWebsite(website.value);
      const claimed = await claim(store, website.value, identity.email);
      if (claimed) return res.status(409).json(claimed);
      try {
        const build = await startAccountBuild(store, { website: website.value, domain: websiteDomain(website.value) as string, name, email: identity.email });
        return res.status(200).json({ build: summarize(build, null) });
      } catch (err) {
        await releaseWebsite(store, websiteDomain(website.value) as string).catch(() => {});
        throw err;
      }
    }

    if (body.kind === 'person') {
      const person = validateText(body.personName, 'personName', 120, { requireLetter: true });
      if (!person.ok) return res.status(400).json({ error: person.error });
      const title = typeof body.personTitle === 'string' && body.personTitle.trim() ? validateText(body.personTitle, 'personTitle', 160) : null;
      if (title && !title.ok) return res.status(400).json({ error: title.error });
      const company = (body.company ?? {}) as Record<string, unknown>;

      // The company has a page: build the person under it.
      if (typeof company.route === 'string' && /^[a-z0-9-]+$/.test(company.route)) {
        const companyName = validateCompanyName(company.name);
        if (!companyName.ok) return res.status(400).json({ error: companyName.error });
        const build = await startPersonBuild(store, {
          personName: person.value,
          personTitle: title?.ok ? title.value : undefined,
          companyName: companyName.value,
          companyRoute: company.route,
          email: identity.email,
        });
        return res.status(200).json({ build: summarize(build, null) });
      }

      // No page yet: the company first, then the person. A build of the company that is
      // already under way (asked for a moment ago, by anyone) is waited for, not repeated.
      const website = validateCompanyWebsite(company.website);
      if (!website.ok) return res.status(400).json({ error: website.error });
      const domain = websiteDomain(website.value) as string;
      const underway = await buildForSite(store, domain);
      if (underway?.status === 'done') {
        const build = await startPersonBuild(store, {
          personName: person.value,
          personTitle: title?.ok ? title.value : undefined,
          companyName: underway.companyName ?? underway.name,
          companyRoute: underway.finalRoute ?? underway.route,
          email: identity.email,
        });
        return res.status(200).json({ build: summarize(build, null) });
      }
      let companyBuild = underway && (underway.status === 'running' || underway.status === 'waiting') ? underway : null;
      if (!companyBuild) {
        const name = typed(company.name) ?? nameFromWebsite(website.value);
        const claimed = await claim(store, website.value, identity.email);
        if (claimed) return res.status(409).json(claimed);
        companyBuild = await startAccountBuild(store, { website: website.value, domain, name, email: identity.email });
      }
      const build = await startPersonBuild(store, {
        personName: person.value,
        personTitle: title?.ok ? title.value : undefined,
        companyName: companyBuild.name,
        companyRoute: companyBuild.route,
        email: identity.email,
        after: companyBuild.id,
      });
      return res.status(200).json({ build: summarize(build, null), company: summarize(companyBuild, null) });
    }

    return res.status(400).json({ error: "kind must be 'account' or 'person'" });
  } catch (err) {
    console.error('[page-builds] start', err);
    const status = err instanceof MarkError && err.status === 503 ? 503 : 502;
    return res.status(status).json({ error: "Couldn't reach Mark. Try again." });
  }
}

/** A typed name worth using for the page's address, or null (a website, or nothing). */
function typed(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const name = validateCompanyName(raw);
  if (!name.ok || websiteDomain(name.value)) return null;
  return name.value;
}

/** The website's 15-minute lock; the 409 body when someone holds it. */
async function claim(store: NonNullable<ReturnType<typeof buildStore>>, website: string, email: string) {
  const domain = websiteDomain(website) as string;
  try {
    const earlier = await claimWebsite(store, domain, email);
    return earlier ? { error: 'already_requested', message: alreadyRequestedMessage(domain, earlier, email) } : null;
  } catch (err) {
    // The lock must not stop a request when the store hiccups.
    console.error('[page-builds] lock', err);
    return null;
  }
}
