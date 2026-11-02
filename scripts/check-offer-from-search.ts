/**
 * check-offer-from-search — asking for an offer's page from the search page
 * (src/lib/offer-from-search.ts; Notion: "Allow for one-off campaign pages
 * from search"). Run as an offer whose team allows pages from search (Aldus
 * UI's On or Approve first), the Companies column offers "Add offer page",
 * and Aldus UI decides what happens to the ask.
 *
 *   1. When "Add offer page" shows: only run as an offer that is On or
 *      Approve first, only for a query, and only when none of the offer's
 *      pages is named exactly that (any case); an account page of the same
 *      company doesn't hide it. Control: a rule that ignores the setting.
 *   2. What the bar says for each answer: started, waiting, asked (one
 *      account, several, again), and each refusal by its code (waiting in
 *      the queue among them); the offer's own refusals (its samples, the
 *      cap, its page setup, the workflow) in one plain line, never Aldus
 *      UI's words; a lost sign-in; anything else "Couldn't reach Mark".
 *      Controls: a note that ignores the outcome; one that passes Aldus UI's
 *      words through.
 *   3. What reaches the browser: only the known fields of Aldus UI's
 *      answer (no account id, no candidates, no website), a pageUrl only
 *      when https. Control: passing the answer through whole leaks the id.
 *   4. The words: none names Opal, an agent, an AE or Marketo.
 *   5. The wiring, read from the sources (spaces and line breaks folded, so
 *      reformatting doesn't fail it): the search page asks offerAddShown,
 *      keeps "Add company" beside "Add offer page" when the company has no
 *      page, and starts an 'offer' request with the running offer; a person
 *      page's company is its route and name only, as before findCompany gave
 *      the domain too (control: the whole match passed on is caught); the
 *      API route sends the signed-in rep, never the body's, and only
 *      askAnswerOf's fields; GET /api/offers passes the setting through
 *      isFromSearch; the dev server routes /api/offers/{id}/pages.
 *
 * No network, no env, no credentials.
 *
 *   npx tsx scripts/check-offer-from-search.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { askAnswerOf, askNote, isFromSearch, OFFER_ASK_WORDS, OFFER_CANT_TAKE_MORE, offerAddShown } from '../src/lib/offer-from-search.js';
import type { OfferPage, RunningOffer } from '../src/lib/offer-looks.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (file: string) => readFileSync(join(ROOT, file), 'utf8');

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
}
const control = (name: string, caught: boolean) => check(`control: ${name}`, caught);

// ─── 1. When "Add offer page" shows ─────────────────────────────────────
console.log('\n1. When "Add offer page" shows');
const page = (companyName: string): OfferPage => ({ route: companyName.toLowerCase(), companyName, domain: null, logoUrl: null, published: null });
const offer = (fromSearch: RunningOffer['fromSearch'], pages: OfferPage[] = [page('Gong')]) => ({ fromSearch, pages });
type Shown = typeof offerAddShown;
const CASES: Array<[string, Parameters<Shown>[0], string, boolean]> = [
  ['not run as an offer', null, 'Anaplan', false],
  ['Off', offer('off'), 'Anaplan', false],
  ['On, no query', offer('on'), '  ', false],
  ['On, a company the offer has no page for', offer('on'), 'Anaplan', true],
  ['Approve first, a company the offer has no page for', offer('approval'), 'Anaplan', true],
  ["On, the offer's page named exactly that (another case, spaces)", offer('on'), '  gONG ', false],
  ['On, a name the offer\'s page only contains', offer('on'), 'Gon', true],
];
const table = (fn: Shown) => CASES.filter(([, running, query, want]) => fn(running, query) !== want).map(([name]) => name);
check('offerAddShown, case by case', table(offerAddShown).length === 0, table(offerAddShown));
control('a rule that ignores the setting fails the table', table((running, query) => Boolean(running && query.trim() && !running.pages.some((p) => p.companyName.toLowerCase() === query.trim().toLowerCase()))).length > 0);
check("isFromSearch: off, on and approval; nothing else", ['off', 'on', 'approval'].every(isFromSearch) && ![undefined, null, 'ON', 'maybe', 1].some(isFromSearch));

// ─── 2. What the bar says ───────────────────────────────────────────────
console.log('\n2. What the bar says');
type Note = ReturnType<typeof askNote>;
const NOTES: Array<[string, number, Parameters<typeof askNote>[1], Note]> = [
  ['started', 200, { outcome: 'started', account: { name: 'Anaplan, Inc.' } }, { kind: 'sent', text: 'Mark is writing Anaplan, Inc.’s page. It shows up in this offer’s list when it’s live.' }],
  ['waiting', 200, { outcome: 'waiting', account: { name: 'Anaplan, Inc.' } }, { kind: 'sent', text: 'Anaplan, Inc.’s page is in the queue. It shows up in this offer’s list when it’s live.' }],
  ['asked, one account', 200, { outcome: 'asked', account: { name: 'Workato' }, choices: 1 }, { kind: 'sent', text: 'Sent for approval. Mark writes the page once the offer’s team approves it.' }],
  ['asked, several', 200, { outcome: 'asked', choices: 3 }, { kind: 'sent', text: 'Sent for approval. Several accounts match cisco.com, so the offer’s team picks one.' }],
  ['asked again', 200, { outcome: 'asked', again: true, choices: 1 }, { kind: 'sent', text: 'Already asked. It’s waiting for approval.' }],
  ['none', 404, { code: 'none', domain: 'cisco.com' }, { kind: 'error', text: 'No account matches cisco.com. Check the domain.' }],
  ['has-page', 409, { code: 'has-page', account: { name: 'Gong' } }, { kind: 'error', text: 'Gong has this offer’s page already.' }],
  ['writing', 409, { code: 'writing', account: { name: 'Gong' } }, { kind: 'error', text: 'Mark is already writing Gong’s page for this offer.' }],
  ['waiting in the queue', 409, { code: 'waiting', account: { name: 'Gong' } }, { kind: 'error', text: 'Gong’s page is already in the queue for this offer.' }],
  ['unsure', 503, { code: 'unsure' }, { kind: 'error', text: 'Still reading the account list. Try again in a minute.' }],
  ['off', 403, { code: 'off' }, { kind: 'error', text: 'This offer doesn’t take pages from search.' }],
  ['not running', 404, { code: 'not-running' }, { kind: 'error', text: 'This offer doesn’t take pages from search.' }],
  ['the samples refuse: one plain line', 409, { code: 'samples-first', error: 'Approve the samples to write the rest.' }, { kind: 'error', text: OFFER_CANT_TAKE_MORE }],
  ['the draft cap refuses: the same line', 409, { code: 'draft-cap', error: 'Drafts stop at 25 pages. Approve the samples to write the rest.' }, { kind: 'error', text: OFFER_CANT_TAKE_MORE }],
  ['the page setup has problems: the same line', 409, { code: 'spec-problems', error: 'The offer page spec has problems: slots must be a list.' }, { kind: 'error', text: OFFER_CANT_TAKE_MORE }],
  ['the workflow isn\'t set up here (503): the same line', 503, { code: 'not-configured', error: 'The offer page workflow is not configured on this deployment.' }, { kind: 'error', text: OFFER_CANT_TAKE_MORE }],
  ['the sign-in ended', 401, {}, { kind: 'error', text: 'Your Optimizely sign-in has ended. Reload the page to sign in again.' }],
  ['Aldus UI down', 502, { error: 'Could not reach Aldus UI' }, { kind: 'error', text: "Couldn't reach Mark. Try again." }],
];
const notes = (fn: typeof askNote) => NOTES.filter(([, status, answer, want]) => JSON.stringify(fn(status, answer, 'cisco.com')) !== JSON.stringify(want)).map(([name]) => name);
check('askNote, answer by answer', notes(askNote).length === 0, notes(askNote).map((name) => [name, askNote(...(NOTES.find((n) => n[0] === name)!.slice(1, 3) as [number, never]), 'cisco.com')]));
control('a note that ignores the outcome fails the table', notes((status, answer, domain) => askNote(status, { ...answer, outcome: answer.outcome ? 'started' : undefined }, domain)).length > 0);
// The bar as it was first written: a 4xx refusal passed Aldus UI's words through.
const passThrough: typeof askNote = (status, answer, domain) => (answer.error && status >= 400 && status < 500 && !['none', 'has-page', 'writing', 'waiting', 'unsure', 'off', 'not-running', 'website'].includes(answer.code ?? '') ? { kind: 'error', text: answer.error } : askNote(status, answer, domain));
control("a bar that passes Aldus UI's words through fails the table", notes(passThrough).length > 0);
const INTERNAL = /\b(?:spec|workflow|deployment|samples?|drafts?)\b/i;
check("no note a rep reads holds Aldus UI's internal words (spec, workflow, deployment, samples, drafts)", NOTES.every(([, status, answer]) => !INTERNAL.test(askNote(status, answer, 'cisco.com').text)));
control('"Approve the samples to write the rest." is caught by that rule', INTERNAL.test('Approve the samples to write the rest.'));

// ─── 3. What reaches the browser ────────────────────────────────────────
console.log('\n3. What reaches the browser');
const RAW = {
  outcome: 'asked',
  account: { name: 'Cisco', id: '0014J00000ciitAAAA' },
  accounts: [{ id: '0014J00000ciitAAAA', name: 'Cisco' }],
  accountId: '0014J00000ciitAAAA',
  choices: 3,
  again: true,
  website: 'cisco.com',
  pageUrl: 'javascript:alert(1)',
  code: 'x'.repeat(41),
  extra: { secret: 'y' },
};
const cut = askAnswerOf(RAW);
const leaks = (answer: unknown) => /0014J/.test(JSON.stringify(answer)) || /website|secret|javascript/.test(JSON.stringify(answer));
check(
  'only the known fields: the account by name, choices, again; no id, candidates, website, non-https link or overlong code',
  JSON.stringify(cut) === JSON.stringify({ outcome: 'asked', account: { name: 'Cisco' }, choices: 3, again: true }) && !leaks(cut),
  cut,
);
check('an https link is kept', askAnswerOf({ code: 'has-page', pageUrl: 'https://showcase.optimizely.com/vb/gong' }).pageUrl === 'https://showcase.optimizely.com/vb/gong');
check('anything that isn\'t an object is an empty answer', JSON.stringify(askAnswerOf(null)) === '{}' && JSON.stringify(askAnswerOf('x')) === '{}');
control('passing the answer through whole leaks the account id', leaks(RAW));

// ─── 4. The words ───────────────────────────────────────────────────────
console.log('\n4. The words');
const words: string[] = [];
const walk = (v: unknown) => (typeof v === 'string' ? words.push(v) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : undefined);
walk(OFFER_ASK_WORDS);
NOTES.forEach(([, status, answer]) => words.push(askNote(status, answer, 'cisco.com').text));
const OFF = /\b(?:opal|jev|agents?|claude|gpt|AEs?|account executives?|marketo)\b/i;
check(`no word names Opal, an agent, an AE or Marketo (${words.length} strings)`, words.length >= 20 && !words.some((w) => OFF.test(w)), words.filter((w) => OFF.test(w)));
control('"Send to AEs" is caught', OFF.test('Send to AEs'));

// ─── 5. The wiring ──────────────────────────────────────────────────────
console.log('\n5. The wiring');
/** A source with its spaces and line breaks folded to one space, so reformatting doesn't fail a rule. */
const folded = (file: string) => source(file).replace(/\s+/g, ' ');
const home = folded('src/components/SearchHome.tsx');
const hook = folded('src/hooks/usePageRequest.tsx');
const route = folded('api/offers/[id]/pages.ts');
const offersLib = folded('api/_lib/offers.ts');
const vite = folded('vite.config.ts');
check('the search page asks offerAddShown for the Companies column', /if \(!offerAddShown\(running, q\)\) return withAdd\(found, companyHere, 'account'\);/.test(home) && /rows: offerAdds\(cs\)/.test(home));
check(
  '…and keeps "Add company" beside it when the company has no page (both rows show)',
  /const adds: Row\[\] = \[\{ key: 'add:offer', kind: 'add', add: 'offer' \}, \.\.\.\(companyHere \? \[\] : \[\{ key: 'add:account', kind: 'add' as const, add: 'account' as const \}\]\)\];/.test(home),
);
check("…and starts an 'offer' request with the running offer and its setting", /req\.start\(row\.add, query, offer\)/.test(home) && /row\.add === 'offer' && running && running\.fromSearch !== 'off' \? \{ id: running\.id, fromSearch: running\.fromSearch \}/.test(home));
check('the hook posts the website to /api/offers/{id}/pages and reads the answer through askAnswerOf and askNote', hook.includes('`/api/offers/${encodeURIComponent(offer.id)}/pages`') && /askNote\(r\.status, askAnswerOf\(/.test(hook));
// findCompany now gives the domain too (an offer page starts from it); a person page's request must not carry it.
const companyRefRule = (text: string) => /if \(known\) setCompanyRef\(\{ route: known\.route, name: known\.name \}\);/.test(text) && !/setCompanyRef\(known\)/.test(text);
check("a person page's company is its route and name only (the request to /api/page-builds as before)", companyRefRule(hook));
control('the whole match passed on (setCompanyRef(known), as first written) is caught', !companyRefRule(hook.replace(/setCompanyRef\(\{ route: known\.route, name: known\.name \}\)/, 'setCompanyRef(known)')));
check(
  'the API route sends the signed-in rep, never the body\'s, and only askAnswerOf\'s fields',
  /requestedBy: \{ email: identity\.email/.test(route) && !/body\)?\.requestedBy|req\.body\.requestedBy/.test(route) && /const answer = askAnswerOf\(body\);/.test(route) && /res\.status\(status\)\.json\(answer\)/.test(route),
);
check('GET /api/offers passes the setting through isFromSearch, off otherwise', /fromSearch: isFromSearch\(offer\.fromSearch\) \? offer\.fromSearch : 'off'/.test(offersLib));
check('the dev server routes /api/offers/{id}/pages to its file', vite.includes("[/^\\/api\\/offers\\/([^/]+)\\/pages$/, '/api/offers/[id]/pages.ts']"));

console.log(failures ? `\n${failures} failure(s).` : '\noffer-from-search: OK');
process.exit(failures ? 1 : 0);
