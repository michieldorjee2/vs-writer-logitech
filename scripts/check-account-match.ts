/**
 * check-account-match — picking the Salesforce account on the search page
 * (src/lib/account-match.ts, api/_lib/salesforce.ts, api/_lib/account-lookups.ts,
 * api/page-builds/match.ts, the pick in api/page-builds/index.ts).
 *
 *   1. What reaches Salesforce: the typed text is allow-listed; the search's own
 *      wildcards and quotes never come from the rep (an apostrophe becomes the
 *      one-character wildcard). Control: the raw text would carry them.
 *   2. Websites read as the Mark workflow reads them (same cases as its tests).
 *   3. Ranking, on the real accounts of 3 Nov: "lenovo" puts Lenovo before its
 *      subsidiaries, "levi" and "levis" find Levi Strauss & Co., heineken.com puts
 *      the account on that website first. Control: sorted by name alone, Lenovo's
 *      Singapore unit would not be second-to-last… (see the cases).
 *   4. findAccounts, with Salesforce stood in: the filters it sends, the "levis"
 *      fallback, a failure read as a failure (never "no accounts").
 *   5. Existing pages: by Salesforce id (15 or 18 characters), else at the account's
 *      address on its own website, so the Atlassian page at /lenovo is not Lenovo's.
 *      Control: a website two listed accounts share gives neither the page.
 *   6. Lookups: a pick is honoured only for the rep who looked up, only for a key
 *      the lookup gave; the rate limit stops the 41st lookup in the window.
 *   7. The wiring, read from the sources: the browser never gets a Salesforce id,
 *      the build sends the picked id as company_name, the routes check sign-in.
 *
 * No network, no env, no credentials.
 *
 *   npx tsx scripts/check-account-match.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  choiceMeta,
  choiceOf,
  domainLevels,
  domainOf,
  nameScore,
  namePatterns,
  rankAccounts,
  searchTerm,
  storedForms,
  type SalesforceAccountRow,
} from '../src/lib/account-match.js';
import { candidateRoutes, MATCHES_PER_WINDOW, pagesFor, pickedAccount, saveMatch, underMatchLimit, type HeldAccount } from '../api/_lib/account-lookups.js';
import type { BuildStore } from '../api/_lib/page-builds-store.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const fold = (s: string) => s.replace(/\s+/g, ' ');

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail: unknown = '') {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail !== '' ? `\n     ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

/* ---------- 1. What reaches Salesforce ---------- */

check('a name is searched as typed', searchTerm('Lenovo') === 'Lenovo');
check("an apostrophe becomes the one-character wildcard", searchTerm("Levi's") === 'Levi_s' && searchTerm('O’Reilly') === 'O_Reilly', [searchTerm("Levi's"), searchTerm('O’Reilly')]);
check('the search wildcards and quotes are dropped', searchTerm('50%_off" OR Name LIKE \\x') === '50 off OR Name LIKE x', searchTerm('50%_off" OR Name LIKE \\x'));
check('& . , - ( ) stay: they are in company names', searchTerm('Procter & Gamble Co. (UK), Ltd-x') === 'Procter & Gamble Co. (UK), Ltd-x');
check('one letter is not a search', searchTerm('a') === null && searchTerm('  %% ') === null);
check('the term is capped', (searchTerm('x'.repeat(500)) ?? '').length === 80);
check('name patterns: the name or one of its words starts with it', JSON.stringify(namePatterns('Levi')) === '["Levi%","% Levi%"]');
const raw = '50%_off" OR';
check('control: the raw text would carry % _ and "', /[%_"]/.test(raw) && !/[%"]/.test(searchTerm(raw) ?? '%'));

/* ---------- 2. Websites, as the workflow reads them ---------- */

for (const [typed, d] of [
  ['www. adc-consulting.com', 'adc-consulting.com'],
  ['Prismatic.io', 'prismatic.io'],
  ['https://www.myzeller.com/au', 'myzeller.com'],
  ['HTTPS://www.Printerland.co.uk/', 'printerland.co.uk'],
] as const) {
  check(`"${typed}" is the website ${d}`, domainOf(typed) === d, domainOf(typed));
}
for (const typed of ['Prosus N.V.', 'floor & decor', 'Lenovo', '']) check(`"${typed}" is not a website`, domainOf(typed) === null);
check('levels: a subdomain, then its company', JSON.stringify(domainLevels('ashridge.hult.edu')) === '["ashridge.hult.edu","hult.edu"]');
check('levels: never a registry suffix', JSON.stringify(domainLevels('printerland.co.uk')) === '["printerland.co.uk"]');
check('stored forms: www., scheme and slash', storedForms('lenovo.com').length === 12 && storedForms('lenovo.com').includes('https://www.lenovo.com/'));

/* ---------- 3. Ranking, on the accounts Salesforce had on 3 Nov ---------- */

const acct = (id: string, Name: string, Domain_Name__c: string, extra: Partial<SalesforceAccountRow> = {}): SalesforceAccountRow => ({
  id,
  Name,
  Domain_Name__c,
  Customer_Stage__c: 'Prospect',
  Target_Account__c: 'C',
  ...extra,
});
const lenovo = [
  acct('0014J00000LenSGxAA', 'Lenovo - Singapore', 'lenovo.com', { ParentId: '0014J00000LenovoAA', Website: 'https://www.lenovo.com/sg' }),
  acct('0014J00000LenCNxAA', 'Lenovo Group Ltd. - China', 'lenovo.com', { ParentId: '0014J00000LenovoAA' }),
  acct('0014J00000LenovoAA', 'Lenovo', 'lenovo.com', { BillingCountry: 'China', Owner: { Name: 'Simon McDonald' } }),
];
const names = (rows: SalesforceAccountRow[]) => rows.map((r) => r.Name);
check('"lenovo": Lenovo itself first', rankAccounts(lenovo, 'lenovo')[0].Name === 'Lenovo', names(rankAccounts(lenovo, 'lenovo')));
check('"lenovo.com": Lenovo itself first', rankAccounts(lenovo, 'lenovo.com')[0].Name === 'Lenovo', names(rankAccounts(lenovo, 'lenovo.com')));

const levi = [
  acct('0014J00000DanLevAA', 'Daniel Levin EI', 'pm.me'),
  acct('0014J00000DiCellAA', 'DiCello Levitt', 'dicellolevitt.com'),
  acct('0014J00000LeviStAA', 'Levi Strauss & Co.', 'levistrauss.com', { Customer_Stage__c: 'Active Customer', Target_Account__c: 'B' }),
  acct('0014J00000LeviRSAA', 'Levi, Ray & Shoup', 'lrs.com'),
  acct('0014J00000LeviatAA', 'Leviat', 'leviat.com'),
  acct('0014J00000LevinxAA', 'Levin', 'levin.com.bd'),
];
check('"levi": Levi Strauss & Co. first', rankAccounts(levi, 'levi')[0].Name === 'Levi Strauss & Co.', names(rankAccounts(levi, 'levi')));
check('"Levi\'s": Levi Strauss & Co. first', rankAccounts(levi, "Levi's")[0].Name === 'Levi Strauss & Co.', names(rankAccounts(levi, "Levi's")));
check('"levis": Levi Strauss & Co. first', rankAccounts(levi, 'levis')[0].Name === 'Levi Strauss & Co.', names(rankAccounts(levi, 'levis')));
check('a word starting the name outranks one inside it', nameScore('Levi Strauss & Co.', 'levi') < nameScore('Daniel Levin EI', 'levi'));

const heineken = [
  acct('0014J00000HeiAPxAA', 'HEINEKEN Asia Pacific Pte Ltd.', 'apb.com.sg', { ParentId: '0014J00000HeiIntAA' }),
  acct('0014J00000HeiIntAA', 'Heineken International B.V.', 'theheinekencompany.com', { Customer_Stage__c: 'Active Customer', Target_Account__c: 'A' }),
  acct('0014J00000HeiNLxAA', 'Heineken Netherlands', 'heineken.com', { Target_Account__c: 'B' }),
  acct('0014J00000HeiUKxAA', 'Heineken UK', 'heineken.co.uk', { ParentId: '0014J00000HeiIntAA' }),
];
check('"heineken": the tier-A parent first', rankAccounts(heineken, 'heineken')[0].Name === 'Heineken International B.V.', names(rankAccounts(heineken, 'heineken')));
check('"heineken.com": the account on that website first', rankAccounts(heineken, 'heineken.com')[0].Name === 'Heineken Netherlands', names(rankAccounts(heineken, 'heineken.com')));
check('subsidiaries come after their parent', rankAccounts(heineken, 'heineken').findIndex((r) => r.Name === 'Heineken UK') > 1);
const byName = [...heineken].sort((a, b) => (a.Name ?? '').localeCompare(b.Name ?? ''));
check('control: by name alone the Asia Pacific unit would be first', byName[0].Name === 'HEINEKEN Asia Pacific Pte Ltd.');
check('a row listed twice is shown once', rankAccounts([...lenovo, lenovo[2]], 'lenovo').length === 3);
check('competitor records sink', rankAccounts([acct('0014J00000CompAAAA', 'Lenovo', 'lenovo.com', { Customer_Stage__c: 'Competitor' }), lenovo[0]], 'lenovo')[0].Name === 'Lenovo - Singapore');

const choice = choiceOf(lenovo[2], 'a1', null);
check('what the rep sees: name, website, stage, country, owner', choiceMeta(choice) === 'lenovo.com · Prospect · China · Simon McDonald', choiceMeta(choice));
check('the integration user is not named as an owner', choiceOf(acct('0014J00000AtlasxAA', 'Atlassian', 'atlassian.com', { Owner: { Name: 'Marketo Integration' } }), 'a1', null).owner === null);
check('a choice never carries the Salesforce id', !JSON.stringify(choice).includes('0014J00000'), choice);

/* ---------- 4. findAccounts, with Salesforce stood in ---------- */

type Sent = { filters: Record<string, unknown> };
const sent: Sent[] = [];
let answer: (filters: Record<string, unknown>) => unknown = () => ({ success: true, data: { records: [] } });
const realFetch = globalThis.fetch;
globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
  const body = JSON.parse(init?.body ?? '{}') as { tool_name: string; parameters: { filters: string } };
  const filters = JSON.parse(body.parameters.filters) as Record<string, unknown>;
  sent.push({ filters });
  const reply = answer(filters);
  if (reply instanceof Error) throw reply;
  return new Response(JSON.stringify({ response_type: 'json', response: reply }), { status: 200 });
}) as typeof fetch;
process.env.OPAL_PAT = 'test-token-not-real';
const { findAccounts, rowsOf } = await import('../api/_lib/salesforce.js');

sent.length = 0;
answer = () => ({ success: true, data: { records: lenovo } });
let found = await findAccounts('lenovo.com');
check('a website asks by Domain_Name__c and by the name it suggests', sent.length === 2 && 'Domain_Name__c' in sent[0].filters && JSON.stringify(sent[1].filters) === '{"Name":{"$like":["lenovo%","% lenovo%"]}}', sent);
check('…its Domain_Name__c spellings are the workflow\'s', JSON.stringify((sent[0].filters.Domain_Name__c as { $in: string[] }).$in) === JSON.stringify(storedForms('lenovo.com')));
check('…and both answers come back', found.rows.length === 6 && !found.failed);
check('the tool\'s answer: data.records, as sent on 3 Nov', rowsOf({ success: true, data: { records: [lenovo[0]] } })?.length === 1);
check('…or data as the list', rowsOf({ success: true, data: [lenovo[0]] })?.length === 1);
check('no match: the tool\'s "No Account records found" answer is an empty list', JSON.stringify(rowsOf({ success: true, data: { error: 'No Account records found matching your query.' }, totalCount: 0, message: 'Retrieved 0 Account records' })) === '[]');
check('control: an answer of another shape is a failure, not an empty list', rowsOf({ success: true, data: { rows: [lenovo[0]] } }) === null);

sent.length = 0;
answer = () => ({ success: true, data: { error: 'No Account records found matching your query.' }, totalCount: 0 });
await findAccounts("Levi's 50%");
check('a name asks by name only, cleaned', sent.length === 1 && JSON.stringify(sent[0].filters) === '{"Name":{"$like":["Levi_s 50%","% Levi_s 50%"]}}', sent);

sent.length = 0;
answer = (f) => (JSON.stringify(f).includes('levi%') ? { success: true, data: { records: [levi[2]] } } : { success: true, data: [] });
found = await findAccounts('levis');
check('"levis" with no answer is tried as "levi"', sent.length === 2 && JSON.stringify(sent[1].filters).includes('"levi%"') && found.rows[0]?.Name === 'Levi Strauss & Co.', sent);

answer = () => new Error('socket hang up');
found = await findAccounts('lenovo');
check('Salesforce not answering is a failure, not "no accounts"', found.failed === true && found.rows.length === 0);
answer = () => ({ success: false, error: 'INVALID_FIELD' });
found = await findAccounts('lenovo');
check('…and so is an error answer', found.failed === true);
globalThis.fetch = realFetch;

/* ---------- 5. Pages the accounts already have ---------- */

const page = (route: string, salesforceAccountID: string | null, brandDomain: string | null) => ({
  _metadata: { url: { hierarchical: `/${route}/` } },
  salesforceAccountID,
  brandDomain,
});
let pages = pagesFor(lenovo, [page('lenovo-group', '0014J00000LenCNxAA', null)]);
check('a page by its Salesforce id', pages.get('0014J00000LenCNxAA')?.route === 'lenovo-group' && pages.size === 1, [...pages]);
pages = pagesFor(lenovo, [page('lenovo-group', '0014J00000LenCN', null)]);
check('…a 15-character id is the same account', pages.get('0014J00000LenCNxAA')?.route === 'lenovo-group');
pages = pagesFor(lenovo, [page('lenovo', '000000000000000', 'www.lenovo.com')]);
check("a page at the account's name, on its website (a placeholder id)", pages.get('0014J00000LenovoAA')?.route === 'lenovo' && pages.size === 1, [...pages]);
pages = pagesFor(lenovo, [page('lenovo', '0014J00000AtlPTYAA', 'atlassian.com')]);
check("the Atlassian page at /lenovo is not Lenovo's (3 Nov)", pages.size === 0, [...pages]);
pages = pagesFor(heineken, [page('heineken', '000000000000000', 'www.heineken.com')]);
check("a page at the website's own address, when one listed account has that website", pages.get('0014J00000HeiNLxAA')?.route === 'heineken' && pages.size === 1, [...pages]);
const twoOnLenovoCom = lenovo.filter((r) => r.Name !== 'Lenovo');
pages = pagesFor(twoOnLenovoCom, [page('lenovo', '000000000000000', 'lenovo.com')]);
check("control: at the website's address, a website two listed accounts share marks neither", pages.size === 0, [...pages]);
pages = pagesFor(lenovo, [page('lenovo/jane-doe', '0014J00000LenovoAA', 'lenovo.com')]);
check('a person page is not the account page', pages.size === 0);
check("the addresses asked for: the name's and the website's", JSON.stringify(candidateRoutes(heineken[2])) === '["heineken-netherlands","heineken"]', candidateRoutes(heineken[2]));

/* ---------- 6. Lookups: whose, which key, how many ---------- */

const mem = new Map<string, unknown>();
const store = {
  async get<T>(k: string) {
    return (mem.get(k) as T) ?? null;
  },
  async set(k: string, v: unknown, opts?: { nx?: boolean }) {
    if (opts?.nx && mem.has(k)) return null;
    mem.set(k, v);
    return 'OK';
  },
  async incr(k: string) {
    const n = Number(mem.get(k) ?? 0) + 1;
    mem.set(k, n);
    return n;
  },
} as unknown as BuildStore;
const held: HeldAccount[] = [{ key: 'a1', crmAccountId: '0014J00000LenovoAA', name: 'Lenovo', domain: 'lenovo.com', page: null }];
const lookup = await saveMatch(store, 'Brittany.Oldham@optimizely.com', 'lenovo', held);
check('the rep who looked up gets their pick', (await pickedAccount(store, lookup, 'a1', 'brittany.oldham@optimizely.com'))?.crmAccountId === '0014J00000LenovoAA');
check("another rep's pick from the same lookup is refused", (await pickedAccount(store, lookup, 'a1', 'kristin.petrucci@optimizely.com')) === null);
check('a key the lookup did not give is refused', (await pickedAccount(store, lookup, 'a2', 'brittany.oldham@optimizely.com')) === null);
check('a malformed key or lookup is refused before the store is read', (await pickedAccount(store, lookup, '0014J00000LenovoAA', 'brittany.oldham@optimizely.com')) === null && (await pickedAccount(store, '../x', 'a1', 'brittany.oldham@optimizely.com')) === null);
let allowed = 0;
for (let i = 0; i < MATCHES_PER_WINDOW + 1; i++) if (await underMatchLimit(store, 'busy@optimizely.com')) allowed++;
check(`the ${MATCHES_PER_WINDOW + 1}st lookup in ten minutes is refused`, allowed === MATCHES_PER_WINDOW, allowed);
check('…for that rep only', await underMatchLimit(store, 'other@optimizely.com'));

/* ---------- 7. Wiring ---------- */

const match = fold(read('api/page-builds/match.ts'));
check('match: sign-in first', match.indexOf('requireIdentity(req, res)') > 0 && match.indexOf('requireIdentity(req, res)') < match.indexOf('findAccounts('));
check('match: the rate limit before Salesforce', match.indexOf('underMatchLimit(') < match.indexOf('findAccounts('));
check('match: a Salesforce failure is a 502, never an empty list', match.includes("if (found.failed) return res.status(502)"));
const idx = fold(read('api/page-builds/index.ts'));
check('build: a pick is read for the signed-in rep', idx.includes('pickedAccount(store, body.lookup, body.key, identity.email)') && idx.includes('pickedAccount(store, company.lookup, company.key, identity.email)'));
check('build: an account with a page is not built again', idx.includes("if (account.page) return res.status(409)"));
const builds = fold(read('api/_lib/page-builds.ts'));
check('build: the picked account goes to Mark by its Salesforce id', builds.includes('company_name: input.crmAccountId || input.website'));
const summarize = builds.slice(builds.indexOf('export function summarize'), builds.indexOf('/** For the list'));
check("build: a summary never carries the account's id", summarize.length > 100 && !summarize.includes('crmAccountId'));
const lookups = fold(read('api/_lib/account-lookups.ts'));
check('match: the browser gets choiceOf (no id), the store keeps the id', lookups.includes('accounts: shown.map((r, i) => choiceOf(r,') && lookups.includes('crmAccountId: rowId(r)'));
const vite = read('vite.config.ts');
check('dev server: /match before /[id]', vite.indexOf("'/api/page-builds/match.ts'") > 0 && vite.indexOf("'/api/page-builds/match.ts'") < vite.indexOf("'/api/page-builds/[id].ts'"));
const hook = fold(read('src/hooks/usePageRequest.tsx'));
check('page: a company is known only by its exact name or website, not by an address that reads like it', hook.includes('hit.name.toLowerCase() === t ||') && !hook.includes('e.slug === t'));

const home = fold(read('src/components/SearchHome.tsx'));
check('page: "+ Add company" hides only for a page named what was typed, or on that website', home.includes('companies.some((e) => named(e.name) || (!!typedSite && e.domain.toLowerCase() === typedSite))'));
check('control: the address match that hid "lenovo" is gone', !home.includes('const companyHere = !!findCompany(q)'));

check('build: a person build whose company page fails to start releases the lock, both ways in', (idx.match(/await releaseWebsite\(store, (pickedKey\(account\)|domain)\)\.catch/g) ?? []).length >= 3);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
