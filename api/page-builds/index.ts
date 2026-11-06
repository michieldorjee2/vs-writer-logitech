import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireIdentity } from '../_lib/auth.js';
import { markConfigured, MarkError } from '../_lib/mark.js';
import { pickedAccount, type HeldAccount } from '../_lib/account-lookups.js';
import { alreadyRequestedMessage, claimWebsite, releaseWebsite } from '../_lib/page-request-lock.js';
import { buildForSite, buildStore, buildsForRep } from '../_lib/page-builds-store.js';
import { startAccountBuild, startPersonBuild, summarize, summaryOf } from '../_lib/page-builds.js';
import { validateCompanyName, validateCompanyWebsite, validateText, websiteDomain } from '../_lib/validate-input.js';
import { nameFromWebsite } from '../../src/lib/page-builds.js';

/**
 * The search page's page builds (replaces the opal-create-page webhooks).
 *
 *   GET   → { builds: BuildSummary[] }  the signed-in rep's builds, newest first
 *   POST  { kind: 'account', lookup, key }        a company picked from POST /api/page-builds/match
 *         { kind: 'account', website, name? }
 *         { kind: 'person', personName, personTitle?, company: { route, name } }
 *         { kind: 'person', personName, personTitle?, company: { lookup, key } }
 *         { kind: 'person', personName, personTitle?, company: { website, name? } }
 *         → { build: BuildSummary, company?: BuildSummary }
 *
 * A person whose company has no page yet gets the company's page built first;
 * their own build waits for it (and starts when anyone next looks at either).
 * 409 `already_requested`: the website is already being built (page-request-lock).
 * 409 `has_page`: the picked account has a page already. 410 `lookup_expired`: the
 * pick is from a list that has gone (half an hour), or was another rep's.
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
    // A company picked from POST /api/page-builds/match's list: Mark builds that account.
    if (body.kind === 'account' && body.lookup !== undefined) {
      const account = await pickedAccount(store, body.lookup, body.key, identity.email);
      if (!account) return res.status(410).json({ error: 'lookup_expired', message: LOOKUP_EXPIRED });
      if (account.page) return res.status(409).json({ error: 'has_page', message: `${account.name} already has a page: showcase.optimizely.com/${account.page.route}`, route: account.page.route });
      const claimed = await claimKey(store, pickedKey(account), account.domain ?? account.name, identity.email);
      if (claimed) return res.status(409).json(claimed);
      try {
        const build = await startPickedAccount(store, account, identity.email);
        return res.status(200).json({ build: summarize(build, null) });
      } catch (err) {
        await releaseWebsite(store, pickedKey(account)).catch(() => {});
        throw err;
      }
    }

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

      // A company picked from the match list: under its page if it has one, else its page first.
      if (company.lookup !== undefined) {
        const account = await pickedAccount(store, company.lookup, company.key, identity.email);
        if (!account) return res.status(410).json({ error: 'lookup_expired', message: LOOKUP_EXPIRED });
        const personInput = { personName: person.value, personTitle: title?.ok ? title.value : undefined, email: identity.email };
        if (account.page) {
          const build = await startPersonBuild(store, { ...personInput, companyName: account.name, companyRoute: account.page.route });
          return res.status(200).json({ build: summarize(build, null) });
        }
        const underway = account.domain ? await buildForSite(store, account.domain) : null;
        let companyBuild =
          underway && underway.crmAccountId === account.crmAccountId && (underway.status === 'running' || underway.status === 'waiting') ? underway : null;
        if (!companyBuild) {
          const claimed = await claimKey(store, pickedKey(account), account.domain ?? account.name, identity.email);
          if (claimed) return res.status(409).json(claimed);
          try {
            companyBuild = await startPickedAccount(store, account, identity.email);
          } catch (err) {
            // A start that failed holds nothing: the next ask goes straight through.
            await releaseWebsite(store, pickedKey(account)).catch(() => {});
            throw err;
          }
        }
        const build = await startPersonBuild(store, { ...personInput, companyName: companyBuild.name, companyRoute: companyBuild.route, after: companyBuild.id });
        return res.status(200).json({ build: summarize(build, null), company: summarize(companyBuild, null) });
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
        try {
          companyBuild = await startAccountBuild(store, { website: website.value, domain, name, email: identity.email });
        } catch (err) {
          await releaseWebsite(store, domain).catch(() => {});
          throw err;
        }
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
  return claimKey(store, domain, domain, email);
}

/**
 * The same lock under any key: a picked account's website, or the account itself when
 * Salesforce lists no website for it. `label` is what the rep reads.
 */
async function claimKey(store: NonNullable<ReturnType<typeof buildStore>>, key: string, label: string, email: string) {
  try {
    const earlier = await claimWebsite(store, key, email);
    return earlier ? { error: 'already_requested', message: alreadyRequestedMessage(label, earlier, email) } : null;
  } catch (err) {
    // The lock must not stop a request when the store hiccups.
    console.error('[page-builds] lock', err);
    return null;
  }
}

const LOOKUP_EXPIRED = 'That list is out of date. Search for the company again.';

/** The lock key of a picked account: its website, or the account when it has none. */
const pickedKey = (account: HeldAccount) => account.domain ?? `account-${account.crmAccountId.slice(0, 15)}`;

function startPickedAccount(store: NonNullable<ReturnType<typeof buildStore>>, account: HeldAccount, email: string) {
  return startAccountBuild(store, {
    website: account.domain ?? account.name,
    domain: account.domain ?? '',
    name: account.name,
    email,
    crmAccountId: account.crmAccountId,
  });
}
