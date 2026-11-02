/**
 * The badge reader's rules, checked without a network or credentials
 * (scripts/check-badge-read.mjs bundles and runs this; `npm run check:badge`).
 *
 *   1. What Mark reads becomes a card: fenced or wordy JSON, ALL-CAPS names,
 *      the website before a work email's domain, never a free-mail domain,
 *      capped lines, and nothing at all from junk.
 *   2. A card becomes the exact /api/page-builds body, and the email is never in it.
 *   3. Off unless MARK_BADGE_AGENT_ID (and OPAL_PAT) are set; the local stand-in
 *      (BADGE_READ_STUB) never answers in production.
 *   4. A ticket follows only the read its rep started, for ten minutes.
 *   5. The photo goes on without its EXIF, and the showcase keeps none of it.
 *   6. The route itself, end to end, off and with the stand-in; the ticket
 *      in a header only, and only the reader that started a read answers it.
 *   7. From the card to a send: only the go button on the card sends, Cancel
 *      while fixing puts the card back exactly, a fixed company keeps its
 *      domain, and the bar and the panel say what is missing once.
 *   8. Production never asks whether the reader is on, and a rep has ten
 *      reads in ten minutes, counted under a hash (nothing of the badge).
 *
 * Mutations that make it fail (each run by hand on the source, restored, and
 * the file compared byte for byte with the original):
 *   - drop 'gmail.com' from FREE_MAIL                        → rule 1 fails
 *   - drop `yahoo` from FREE_MAIL (yahoo.co.uk a website)    → rule 1 fails
 *   - companyOf skips the parent domains, or the name        → rule 2 fails
 *   - delete the stand-in-ticket guard in the route          → rule 6 fails
 *   - the route reads the ticket from the query again        → rule 6 fails
 *   - Cancel while fixing keeps the card as changed          → rule 7 fails
 *   - a read card comes back with a send                     → rule 7 fails
 *   - drop the "misread name keeps its domain" branch        → rule 7 fails
 *   - needs:'person' asks "Build a page for …?" again        → rule 7 fails
 *   - setKind('account') before the badge's send             → rule 7 fails
 *   - drop the badge card's (hover: none) rule, or its class → rule 7 fails
 *   - servedBadgeReady asks the route in production          → rule 8 fails
 *   - `count >= READS_PER_WINDOW`, or the email as the key   → rule 8 fails
 *   - the route counts the read after the upload             → rule 8 fails
 *   - parse the whole answer, not its outermost {…}          → rules 1, 3, 6 fail
 *   - send `personTitle: title` even when empty              → rule 2 fails
 *   - stubRefused ignores VERCEL_ENV                         → rule 3 fails
 *   - badgeMode goes live without OPAL_PAT                   → rule 3 fails
 *   - openTicket skips the email comparison                  → rules 4, 6 fail
 *   - cleanPhoto keeps metadata (.withMetadata())            → rule 5 fails
 *   - import '@vercel/blob' in api/badge-read.ts             → rule 5 fails
 *   - badge-scan.ts keeps the photo in localStorage          → rule 5 fails
 *   - the route answers { ready: true } when off             → rule 6 fails
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BADGE_ERRORS,
  cardFromAgent,
  cardLines,
  companyOf,
  isFreeMail,
  MAX_PHOTO_DATA_URL,
  requestFromCard,
  type BadgeCard,
  type FindCompany,
} from '../src/lib/badge-card';
import { badgeStep, badgeWords, READING, sameCompany, type BadgeEvent, type BadgeSend, type BadgeState } from '../src/lib/badge-flow';
import { servedBadgeReady, TICKET_HEADER } from '../src/lib/badge-scan';
import { badgeRootAttr } from '../api/_lib/badge-mode';
import { overReadLimit, READS_PER_WINDOW, WINDOW_SECONDS, type CountStore } from '../api/_lib/badge-read-limit';
import { sessionKey } from '../api/_lib/auth';
import {
  badgeMode,
  cleanPhoto,
  executionOutcome,
  gsUriOf,
  openTicket,
  readPhoto,
  signTicket,
  STUB_READ_MS,
  stubOutcome,
  stubRefused,
  ticketKey,
  TICKET_MS,
} from '../api/_lib/badge-read';
import handler from '../api/badge-read';

let failures = 0;
let passes = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passes++;
  } catch (err) {
    failures++;
    console.error(`✗ ${name}\n  ${err instanceof Error ? err.message.split('\n').join('\n  ') : String(err)}`);
  }
}

const JANE: BadgeCard = { name: 'Jane Doe', title: 'VP Marketing', company: 'Acme Corp', email: 'jane@acmecorp.example', domain: 'acmecorp.example' };
const answer = (fields: Record<string, string>) => JSON.stringify({ name: '', title: '', company: '', email: '', website: '', ...fields });

/* An index of companies that have a page, found by name, domain or route as SearchHome's findCompany does. */
const INDEX = [
  { slug: 'anaplan', name: 'Anaplan', domain: 'anaplan.com' },
  { slug: 'ibm', name: 'IBM', domain: 'ibm.com' },
  { slug: 'wolters-kluwer', name: 'Wolters Kluwer', domain: 'wolterskluwer.com' },
];
const findCompany: FindCompany = (text) => {
  const t = text.trim().toLowerCase();
  const domain = t.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const hit = INDEX.find((e) => e.name.toLowerCase() === t || e.domain === domain || e.slug === t);
  return hit ? { route: hit.slug, name: hit.name } : null;
};
const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf-8');

/* ---------- 1. What Mark reads becomes a card ---------- */

await check('a fenced JSON answer reads', () => {
  const raw = '```json\n' + answer({ name: 'Jane Doe', title: 'VP Marketing', company: 'Acme Corp', email: 'jane@acmecorp.example' }) + '\n```';
  assert.deepEqual(cardFromAgent(raw), JANE);
});
await check('words around the JSON are ignored', () => {
  assert.deepEqual(cardFromAgent(`Here is what the badge says: ${answer({ name: 'Jane Doe', company: 'Acme Corp' })} Hope that helps.`)?.name, 'Jane Doe');
});
await check('an ALL-CAPS name reads in normal case; a mixed-case name is kept as printed', () => {
  assert.equal(cardFromAgent(answer({ name: 'JANE DOE', company: 'Acme' }))?.name, 'Jane Doe');
  assert.equal(cardFromAgent(answer({ name: "MARY-KATE O'NEIL", company: 'Acme' }))?.name, "Mary-Kate O'Neil");
  assert.equal(cardFromAgent(answer({ name: 'Ronald McDonald', company: 'Acme' }))?.name, 'Ronald McDonald');
  assert.equal(cardFromAgent(answer({ name: 'Anna de Vries', company: 'Acme' }))?.name, 'Anna de Vries');
});
await check('the printed website beats the email domain', () => {
  const card = cardFromAgent(answer({ name: 'Jane', company: 'Acme', email: 'jane@acme-mail.com', website: 'https://www.acme.com/en/about' }));
  assert.equal(card?.domain, 'acme.com');
});
await check('a free-mail address gives no domain', () => {
  assert.ok(isFreeMail('gmail.com'));
  assert.equal(cardFromAgent(answer({ name: 'Jane', company: 'Acme', email: 'jane.doe@gmail.com' }))?.domain, '');
  assert.equal(cardFromAgent(answer({ name: 'Jane', company: 'Acme', email: 'jane@outlook.com' }))?.domain, '');
});
await check("a work email gives its domain", () => {
  assert.equal(cardFromAgent(answer({ name: 'Jane', company: 'Acme', email: 'Jane@Acme.com' }))?.domain, 'acme.com');
});
await check("free mail in any country gives no domain, and never a page request for the mail host", () => {
  for (const host of ['yahoo.co.uk', 'hotmail.fr', 't-online.de', 'outlook.de', 'gmx.net', 'web.de', 'yahoo.com.au', 'icloud.com', 'comcast.net', 'orange.fr']) {
    const card = cardFromAgent(answer({ name: 'Jane Doe', company: 'Acme Corp', email: `jane@${host}` }));
    assert.equal(card?.domain, '', host);
    assert.deepEqual(requestFromCard(card!, findCompany), { needs: 'company' }, host);
  }
});
await check("a company's own mail keeps its domain, even one named like a provider's", () => {
  for (const host of ['acme.com', 'orange.com', 'comcast.com', 'mailchimp.com', 'outlookgroup.com', 'ibm.co.uk']) {
    assert.equal(cardFromAgent(answer({ name: 'Jane', company: 'Acme Corp', email: `jane@${host}` }))?.domain, host, host);
  }
});
await check('an email that is not one is dropped, and gives no domain', () => {
  const card = cardFromAgent(answer({ name: 'Jane', company: 'Acme', email: 'jane at acme' }));
  assert.equal(card?.email, '');
  assert.equal(card?.domain, '');
});
await check('junk, an empty answer and "N/A" lines read as nothing', () => {
  assert.equal(cardFromAgent('I could not see a badge in this photo.'), null);
  assert.equal(cardFromAgent(answer({})), null);
  assert.equal(cardFromAgent(answer({ name: 'N/A', company: 'unknown', title: '-' })), null);
  assert.equal(cardFromAgent('{not json}'), null);
  assert.equal(cardFromAgent([JANE]), null);
  assert.equal(cardFromAgent(null), null);
});
await check('lines are capped (title 160, name 120, company 120)', () => {
  const card = cardFromAgent(answer({ name: 'J'.repeat(300), title: 'T'.repeat(500), company: 'C'.repeat(300) }));
  assert.equal(card?.title.length, 160);
  assert.equal(card?.name.length, 120);
  assert.equal(card?.company.length, 120);
});
await check('a card reads back as itself (the page re-checks what the server sends)', () => {
  assert.deepEqual(cardFromAgent(JANE), JANE);
  assert.deepEqual(cardFromAgent(JSON.parse(JSON.stringify(JANE))), JANE);
});

/* ---------- 2. A card becomes the page request ---------- */

await check('a company with a page, by domain: the person under its route', () => {
  const asked = requestFromCard({ ...JANE, company: 'Anaplan Inc.', domain: 'anaplan.com' }, findCompany);
  assert.deepEqual(asked, {
    body: { kind: 'person', personName: 'Jane Doe', personTitle: 'VP Marketing', company: { route: 'anaplan', name: 'Anaplan' } },
    companyIsNew: false,
  });
});
await check('a company with a page, by name when no domain was read', () => {
  const asked = requestFromCard({ ...JANE, company: 'Anaplan', domain: '', email: '' }, findCompany);
  assert.ok('body' in asked);
  assert.deepEqual(asked.body.company, { route: 'anaplan', name: 'Anaplan' });
});
await check("a company without a page: its website and name, built first", () => {
  assert.deepEqual(requestFromCard(JANE, findCompany), {
    body: { kind: 'person', personName: 'Jane Doe', personTitle: 'VP Marketing', company: { website: 'acmecorp.example', name: 'Acme Corp' } },
    companyIsNew: true,
  });
});
await check('no title: personTitle is left out, not sent empty', () => {
  const asked = requestFromCard({ ...JANE, title: '  ' }, findCompany);
  assert.ok('body' in asked);
  assert.equal('personTitle' in asked.body, false);
});
await check("no name: the company's page", () => {
  assert.deepEqual(requestFromCard({ ...JANE, name: '' }, findCompany), {
    body: { kind: 'account', website: 'acmecorp.example', name: 'Acme Corp' },
    companyIsNew: true,
  });
});
await check('no name, and the company has a page: the name is needed', () => {
  assert.deepEqual(requestFromCard({ ...JANE, name: '', domain: 'anaplan.com' }, findCompany), { needs: 'person' });
});
await check('a name but no company to hang it off: the company is needed', () => {
  assert.deepEqual(requestFromCard({ ...JANE, company: 'Some Startup', domain: '', email: '' }, findCompany), { needs: 'company' });
  assert.deepEqual(requestFromCard({ ...JANE, company: '', domain: '', email: '' }, findCompany), { needs: 'company' });
});
await check('the email read off the badge is never in a page request', () => {
  for (const card of [JANE, { ...JANE, name: '' }, { ...JANE, domain: 'anaplan.com' }]) {
    const asked = requestFromCard(card, findCompany);
    assert.ok('body' in asked);
    assert.ok(!JSON.stringify(asked.body).includes('@'), JSON.stringify(asked.body));
  }
});
await check("the panel's lines say whether the company has a page", () => {
  assert.equal(cardLines(JANE, companyOf(JANE, findCompany)).company.meta, 'acmecorp.example · New page');
  const known = { ...JANE, domain: 'anaplan.com' };
  assert.deepEqual(cardLines(known, companyOf(known, findCompany)).company, { name: 'Anaplan', meta: 'Has a page', missing: false, route: 'anaplan' });
  const none = { ...JANE, company: '', domain: '' };
  assert.equal(cardLines(none, companyOf(none, findCompany)).company.missing, true);
  assert.equal(cardLines({ ...JANE, name: '' }, null).person.missing, true);
});
await check("a team or country domain finds its company's page, by a parent domain or by name, never a second page", () => {
  const ibm = cardFromAgent(answer({ name: 'Jane Doe', company: 'IBM', email: 'jane@uk.ibm.com' }));
  assert.equal(ibm?.domain, 'uk.ibm.com');
  assert.deepEqual(companyOf(ibm!, findCompany), { route: 'ibm', name: 'IBM' });
  assert.deepEqual(companyOf({ ...JANE, company: '', domain: 'research.uk.ibm.com' }, findCompany), { route: 'ibm', name: 'IBM' });
  for (const domain of ['wolterskluwer.nl', 'wolterskluwer.de']) {
    assert.deepEqual(companyOf({ ...JANE, company: 'Wolters Kluwer', domain }, findCompany), { route: 'wolters-kluwer', name: 'Wolters Kluwer' }, domain);
  }
  // Neither: a new page, from the domain read.
  assert.deepEqual(companyOf({ ...JANE, domain: 'uk.acmecorp.example' }, findCompany), { website: 'uk.acmecorp.example', name: 'Acme Corp' });
});

/* ---------- 3. Off until set up; the stand-in never in production ---------- */

await check('off with nothing set, or with only one of OPAL_PAT and MARK_BADGE_AGENT_ID', () => {
  assert.equal(badgeMode({}), 'off');
  assert.equal(badgeMode({ OPAL_PAT: 'pat' }), 'off');
  assert.equal(badgeMode({ MARK_BADGE_AGENT_ID: 'agent' }), 'off');
  assert.equal(badgeMode({ OPAL_PAT: 'pat', MARK_BADGE_AGENT_ID: '   ' }), 'off');
  assert.equal(badgeMode({ OPAL_PAT: 'pat', MARK_BADGE_AGENT_ID: 'agent' }), 'live');
});
await check('the stand-in answers locally, and is refused when VERCEL_ENV or NODE_ENV is production', () => {
  assert.equal(badgeMode({ BADGE_READ_STUB: '1' }), 'stub');
  assert.equal(badgeMode({ BADGE_READ_STUB: '1', NODE_ENV: 'development' }), 'stub');
  assert.equal(badgeMode({ BADGE_READ_STUB: '1', NODE_ENV: 'production' }), 'off');
  assert.equal(badgeMode({ BADGE_READ_STUB: '1', VERCEL_ENV: 'production' }), 'off');
  assert.equal(badgeMode({ BADGE_READ_STUB: '1', VERCEL_ENV: 'preview', NODE_ENV: 'production' }), 'off');
  assert.equal(badgeMode({ BADGE_READ_STUB: '1', VERCEL_ENV: 'production', OPAL_PAT: 'pat', MARK_BADGE_AGENT_ID: 'agent' }), 'live');
  assert.equal(stubRefused({ VERCEL_ENV: 'production' }), true);
  assert.equal(stubRefused({ VERCEL_ENV: 'development', NODE_ENV: 'development' }), false);
});
await check('the stand-in reads for a moment, then answers Jane Doe, a failure, or the JSON it was given', () => {
  const t0 = 1_000_000;
  assert.deepEqual(stubOutcome({ BADGE_READ_STUB: '1' }, t0, t0 + 10), { status: 'reading' });
  assert.deepEqual(stubOutcome({ BADGE_READ_STUB: '1' }, t0, t0 + STUB_READ_MS), { status: 'done', card: JANE });
  assert.deepEqual(stubOutcome({ BADGE_READ_STUB: 'fail' }, t0, t0 + STUB_READ_MS), { status: 'failed' });
  const own = stubOutcome({ BADGE_READ_STUB: answer({ name: 'Sam Lee', company: 'Anaplan', website: 'anaplan.com' }) }, t0, t0 + STUB_READ_MS);
  assert.equal(own.status === 'done' && own.card.domain, 'anaplan.com');
});
await check("Mark's run: reading until done, the card when it read one, failed otherwise", () => {
  assert.deepEqual(executionOutcome({ id: 'x', status_code: 'running' }), { status: 'reading' });
  assert.deepEqual(executionOutcome({ id: 'x', status: 'PENDING' }), { status: 'reading' });
  assert.deepEqual(executionOutcome({ id: 'x', status_code: 'failed' }), { status: 'failed' });
  assert.deepEqual(executionOutcome({ id: 'x', status_code: 'cancelled' }), { status: 'failed' });
  const raw = '```json\n' + answer({ name: 'JANE DOE', title: 'VP Marketing', company: 'Acme Corp', email: 'jane@acmecorp.example' }) + '\n```';
  assert.deepEqual(executionOutcome({ id: 'x', status_code: 'completed', result: { response: raw } }), { status: 'done', card: JANE });
  assert.deepEqual(executionOutcome({ id: 'x', status: 'COMPLETED', result: raw }), { status: 'done', card: JANE });
  assert.deepEqual(executionOutcome({ id: 'x', status_code: 'completed', result: { response: 'No badge here.' } }), { status: 'failed' });
});

/* ---------- 4. Tickets ---------- */

await check("a ticket opens for its rep, until it expires, and for nobody else", () => {
  const key = ticketKey('session-secret');
  const now = 5_000_000;
  const token = signTicket({ ex: 'run-1', em: 'rep@optimizely.com', exp: now + TICKET_MS }, key);
  assert.deepEqual(openTicket(token, key, 'Rep@Optimizely.com', now), { ex: 'run-1', em: 'rep@optimizely.com', exp: now + TICKET_MS });
  assert.equal(openTicket(token, key, 'other@optimizely.com', now), null, 'another rep');
  assert.equal(openTicket(token, key, 'rep@optimizely.com', now + TICKET_MS + 1), null, 'expired');
  assert.equal(openTicket(token, ticketKey('another-secret'), 'rep@optimizely.com', now), null, 'another key');
  const [payload, sig] = token.split('.');
  const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
  assert.equal(openTicket(`${payload}.${flipped}`, key, 'rep@optimizely.com', now), null, 'tampered signature');
  const forged = Buffer.from(JSON.stringify({ ex: 'someone-elses-run', em: 'rep@optimizely.com', exp: now + TICKET_MS })).toString('base64url');
  assert.equal(openTicket(`${forged}.${sig}`, key, 'rep@optimizely.com', now), null, 'payload swapped under the old signature');
  for (const junk of [undefined, '', 'abc', `${token}.extra`, 'a'.repeat(5000)]) assert.equal(openTicket(junk, key, 'rep@optimizely.com', now), null, String(junk).slice(0, 20));
});
await check('a ticket key is not the session secret itself', () => {
  assert.notEqual(ticketKey('session-secret'), 'session-secret');
});

/* ---------- 5. The photo ---------- */

await check('only a JPEG, PNG or WebP data URL of at most 3 MB is taken', () => {
  assert.deepEqual(readPhoto(undefined), { ok: false, error: BADGE_ERRORS.notAPhoto });
  assert.deepEqual(readPhoto('data:image/gif;base64,R0lGODlhAQABAAAAACw='), { ok: false, error: BADGE_ERRORS.notAPhoto });
  assert.deepEqual(readPhoto('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), { ok: false, error: BADGE_ERRORS.notAPhoto });
  assert.deepEqual(readPhoto(`data:image/jpeg;base64,${'A'.repeat(MAX_PHOTO_DATA_URL)}`), { ok: false, error: BADGE_ERRORS.tooLarge });
  const ok = readPhoto('data:image/png;base64,iVBORw0KGgo=');
  assert.ok(ok.ok && ok.bytes.length === 8);
});
await check("the photo Mark gets is upright, at most 1600px and carries no EXIF", async () => {
  const sharp = (await import('sharp')).default;
  const shot = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#808080' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Copyright: 'badge-check', Artist: 'Jane Doe' } })
    .toBuffer();
  const before = await sharp(shot).metadata();
  assert.ok(before.exif && before.orientation === 6, 'the test photo has EXIF to strip');
  const cleaned = await sharp(await cleanPhoto(shot)).metadata();
  assert.equal(cleaned.format, 'jpeg');
  assert.equal(cleaned.exif, undefined, 'EXIF kept');
  assert.equal(cleaned.orientation, undefined, 'orientation tag kept');
  assert.deepEqual([cleaned.width, cleaned.height], [800, 1600], 'turned upright and shrunk');
  await assert.rejects(cleanPhoto(Buffer.from('not an image')));
});
await check('the showcase keeps no photo: no store, no file, no log of it, nothing in the browser', () => {
  const root = process.cwd();
  const server = ['api/badge-read.ts', 'api/_lib/badge-read.ts', 'api/_lib/badge-mode.ts'].map((f) => [f, readFileSync(join(root, f), 'utf-8')] as const);
  // The cap's count (rule 8) is the one thing in a store, and it is checked to be a count.
  const counter = ['api/_lib/badge-read-limit.ts'].map((f) => [f, readFileSync(join(root, f), 'utf-8')] as const);
  const client = ['src/lib/badge-scan.ts', 'src/lib/badge-flow.ts', 'src/hooks/useBadgeCard.ts', 'src/components/BadgeScanButton.tsx'].map(
    (f) => [f, readFileSync(join(root, f), 'utf-8')] as const,
  );
  for (const [file, text] of server) {
    assert.doesNotMatch(text, /@vercel\/blob|@upstash\/redis|page-builds-store|page-request-lock|['"](node:)?fs(\/promises)?['"]/, `${file} imports a store`);
  }
  for (const [file, text] of [...server, ...counter]) {
    assert.doesNotMatch(text, /console\.\w+\([^)]*\b(photo|image|jpeg|bytes|card|body|ticket)\b/, `${file} logs the photo or the read`);
  }
  for (const [file, text] of counter) assert.doesNotMatch(text, /\b(photo|image|jpeg|card|ticket|badgeParameters)\b/i, `${file} handles more than a count`);
  for (const [file, text] of client) {
    assert.doesNotMatch(text, /localStorage|sessionStorage|indexedDB|caches\.open/, `${file} keeps something in the browser`);
  }
});
await check("the file record's gs:// address is found wherever it sits", () => {
  assert.equal(gsUriOf({ id: 'f1', uri: 'gs://bucket/f1' }), 'gs://bucket/f1');
  assert.equal(gsUriOf({ data: { file: { gcs_uri: 'gs://bucket/f2' } } }), 'gs://bucket/f2');
  assert.equal(gsUriOf({ url: 'https://opal-backend.optimizely.com/v1/file/f3' }), null);
});

/* ---------- 6. The route ---------- */

type Answer = { status: number; body: unknown };
async function call(
  method: 'GET' | 'POST',
  opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: unknown } = {},
): Promise<Answer> {
  const out: Answer = { status: 200, body: undefined };
  const res = {
    setHeader: () => res,
    getHeader: () => undefined,
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  };
  const req = { method, query: opts.query ?? {}, body: opts.body, cookies: {}, headers: opts.headers ?? {} };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await handler(req as any, res as any);
  return out;
}
const ENV_KEYS = [
  'OPTIID_RELAY_SECRET',
  'SESSION_SECRET',
  'DEV_AUTH_EMAIL',
  'OPAL_PAT',
  'MARK_BADGE_AGENT_ID',
  'BADGE_READ_STUB',
  'NODE_ENV',
  'VERCEL_ENV',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
];
/* The header the page follows a read by, as Node hands it to the route (lower case). */
const byTicket = (ticket: string) => ({ headers: { [TICKET_HEADER.toLowerCase()]: ticket } });
async function withEnv(env: Record<string, string>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    await fn();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
const PHOTO = `data:image/jpeg;base64,${(await (await import('sharp')).default({ create: { width: 64, height: 40, channels: 3, background: '#fff' } }).jpeg().toBuffer()).toString('base64')}`;

await check('signed out: 401', () =>
  withEnv({}, async () => {
    assert.equal((await call('GET')).status, 401);
  }),
);
await check('unset MARK_BADGE_AGENT_ID: no camera (ready false), and a read is refused with 503', () =>
  withEnv({ DEV_AUTH_EMAIL: 'rep@optimizely.com', OPAL_PAT: 'pat' }, async () => {
    assert.deepEqual(await call('GET'), { status: 200, body: { ready: false } });
    assert.deepEqual(await call('POST', { body: { image: PHOTO } }), { status: 503, body: { error: BADGE_ERRORS.notSetUp } });
  }),
);
await check('the stand-in in production: no camera, and no read', () =>
  withEnv({ DEV_AUTH_EMAIL: 'rep@optimizely.com', BADGE_READ_STUB: '1', NODE_ENV: 'production' }, async () => {
    assert.deepEqual(await call('GET'), { status: 200, body: { ready: false } });
    assert.equal((await call('POST', { body: { image: PHOTO } })).status, 503);
  }),
);
await check('the stand-in locally: camera, a ticket, reading, then the card; another rep gets nothing', () =>
  withEnv({ DEV_AUTH_EMAIL: 'rep@optimizely.com', BADGE_READ_STUB: '1', NODE_ENV: 'development' }, async () => {
    assert.deepEqual(await call('GET'), { status: 200, body: { ready: true } });
    assert.deepEqual(await call('POST', { body: { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } }), { status: 400, body: { error: BADGE_ERRORS.notAPhoto } });
    const sent = await call('POST', { body: { image: PHOTO } });
    assert.equal(sent.status, 202);
    const ticket = (sent.body as { ticket: string }).ticket;
    assert.deepEqual(await call('GET', byTicket(ticket)), { status: 200, body: { status: 'reading' } });
    const realNow = Date.now;
    Date.now = () => realNow() + STUB_READ_MS + 10;
    try {
      assert.deepEqual(await call('GET', byTicket(ticket)), { status: 200, body: { status: 'done', card: JANE } });
    } finally {
      Date.now = realNow;
    }
    process.env.DEV_AUTH_EMAIL = 'someone-else@optimizely.com';
    assert.equal((await call('GET', byTicket(ticket))).status, 404);
  }),
);

await check("a ticket travels in a header: one in the address is not read", () =>
  withEnv({ DEV_AUTH_EMAIL: 'rep@optimizely.com', BADGE_READ_STUB: '1', NODE_ENV: 'development' }, async () => {
    const ticket = ((await call('POST', { body: { image: PHOTO } })).body as { ticket: string }).ticket;
    assert.deepEqual(await call('GET', { query: { ticket } }), { status: 200, body: { ready: true } });
    assert.deepEqual(await call('GET', byTicket(ticket)), { status: 200, body: { status: 'reading' } });
  }),
);
await check("only the reader that started a read answers its ticket: the stand-in's under Mark, and Mark's under the stand-in, are 404", async () => {
  const ticketFor = (ex: string) => signTicket({ ex, em: 'rep@optimizely.com', exp: Date.now() + TICKET_MS }, ticketKey(sessionKey()));
  await withEnv({ DEV_AUTH_EMAIL: 'rep@optimizely.com', OPAL_PAT: 'pat', MARK_BADGE_AGENT_ID: 'reader' }, async () => {
    assert.deepEqual(await call('GET', byTicket(ticketFor(`stub:${Date.now() - STUB_READ_MS}`))), { status: 404, body: { error: 'That read is not there any more.' } });
  });
  await withEnv({ DEV_AUTH_EMAIL: 'rep@optimizely.com', BADGE_READ_STUB: '1', NODE_ENV: 'development' }, async () => {
    assert.deepEqual(await call('GET', byTicket(ticketFor('run-1'))), { status: 404, body: { error: 'That read is not there any more.' } });
  });
});

/* ---------- 7. From the card to a send ---------- */

/** The card a read gives, then each event in turn: where it ends, and every page request sent on the way. */
function walk(card: BadgeCard, ...events: BadgeEvent[]) {
  let state: BadgeState | null = badgeStep(READING, { type: 'read', card }, findCompany).state;
  const sends: BadgeSend[] = [];
  for (const event of events) {
    if (!state) break;
    const next = badgeStep(state, event, findCompany);
    if (next.send) sends.push(next.send);
    state = next.state;
  }
  return { state, sends };
}
const type = (text: string): BadgeEvent => ({ type: 'type', text });
const edit = (field: 'person' | 'company'): BadgeEvent => ({ type: 'edit', field });
const SUBMIT: BadgeEvent = { type: 'submit' };
const CANCEL: BadgeEvent = { type: 'cancel' };

await check('nothing is sent while Mark reads, nor by any step but the go button on the card', () => {
  for (const event of [SUBMIT, edit('person'), edit('company'), type('x'), CANCEL]) {
    const next = badgeStep(READING, event, findCompany);
    assert.equal(next.send, undefined, event.type);
  }
  assert.equal(badgeStep(READING, { type: 'read', card: JANE }, findCompany).send, undefined, 'the read itself');
  assert.equal(badgeStep(READING, CANCEL, findCompany).state, null, 'Cancel while reading puts it away');
  // Fixing every line, accepting each: still nothing sent until the card's go button.
  const fixed = walk(JANE, edit('person'), type('Jane Q. Doe'), SUBMIT, type('CMO'), SUBMIT, edit('company'), type('Acme'), SUBMIT);
  assert.deepEqual(fixed.sends, []);
  assert.equal(fixed.state?.phase, 'card');
  const sent = walk(JANE, SUBMIT);
  assert.deepEqual(sent.sends, [requestFromCard(JANE, findCompany)]);
});
await check('Cancel while fixing a line puts the card back exactly as it was when the line was tapped', () => {
  for (const events of [
    [edit('company'), type('something else'), CANCEL],
    [edit('person'), type('Somebody'), CANCEL],
    // A name with no page writes to the card while it asks for the domain: Cancel undoes that too.
    [edit('company'), type('Other Co'), SUBMIT, CANCEL],
    [edit('company'), type('Other Co'), SUBMIT, edit('person'), CANCEL],
  ]) {
    const { state, sends } = walk(JANE, ...events);
    assert.deepEqual(state, { phase: 'card', card: JANE, draft: '', saved: null, error: null }, events.map((e) => e.type).join(' '));
    assert.deepEqual(sends, []);
  }
  // The name accepted, then Cancel on the title: the name stays, the title is as read.
  assert.deepEqual(walk(JANE, edit('person'), type('Jane Q. Doe'), SUBMIT, type('CMO'), CANCEL).state?.card, { ...JANE, name: 'Jane Q. Doe' });
});
await check('fixing the company: a misread name keeps the domain read, another name asks for its domain, a typed domain wins', () => {
  assert.deepEqual(walk(JANE, edit('company'), type('Acme'), SUBMIT).state, { phase: 'card', card: { ...JANE, company: 'Acme' }, draft: '', saved: null, error: null });
  const other = walk(JANE, edit('company'), type('Other Co'), SUBMIT).state;
  assert.equal(other?.phase, 'company');
  assert.match(other?.error ?? '', /No page for Other Co yet[^]*Enter its domain/);
  assert.deepEqual(walk(JANE, edit('company'), type('Other Co'), SUBMIT, type('otherco.com'), SUBMIT).state?.card, { ...JANE, company: 'Other Co', domain: 'otherco.com' });
  // A company with a page, by name or domain.
  assert.deepEqual(companyOf(walk(JANE, edit('company'), type('Anaplan'), SUBMIT).state!.card!, findCompany), { route: 'anaplan', name: 'Anaplan' });
  assert.deepEqual(walk(JANE, edit('company'), type('anaplan.com'), SUBMIT).state?.card, { ...JANE, company: 'Anaplan', domain: 'anaplan.com' });
  // The rep types a domain with no page, while the name read finds another company's page: the domain wins.
  const wk = { ...JANE, company: 'Wolters Kluwer', domain: 'wolterskluwer.nl' };
  const typed = walk(wk, edit('company'), type('wolterskluwer.nl'), SUBMIT).state!.card!;
  assert.deepEqual(companyOf(typed, findCompany), { website: 'wolterskluwer.nl' });
  assert.equal(walk(JANE, edit('company'), type(''), SUBMIT).state?.error, 'Enter the company they work at');
  assert.equal(walk(JANE, edit('person'), type('  '), SUBMIT).state?.error, "Enter the person's name");
});
await check('a name and a domain are one company by a word of the name in a label', () => {
  for (const [name, domain] of [['Acme', 'acmecorp.example'], ['Wolters Kluwer', 'wolterskluwer.nl'], ['HP', 'hp.com'], ['Société Générale', 'societegenerale.com'], ['Coca-Cola', 'coca-cola.com']]) {
    assert.equal(sameCompany(name, domain), true, `${name} ${domain}`);
  }
  for (const [name, domain] of [['Other Co', 'acmecorp.example'], ['The Group', 'acmecorp.example'], ['Example', 'acmecorp.example']]) {
    assert.equal(sameCompany(name, domain), false, `${name} ${domain}`);
  }
});
await check("a line the page needs opens instead of sending, and the bar asks for it once (no note repeating the row)", () => {
  const needsCompany = { ...JANE, company: 'Some Startup', domain: '', email: '' };
  const opened = walk(needsCompany, SUBMIT);
  assert.deepEqual([opened.state?.phase, opened.sends], ['company', []]);
  assert.deepEqual(badgeWords(walk(needsCompany).state!, findCompany), { status: 'Which company?', hint: null, placeholder: '' });
  const needsPerson = { ...JANE, name: '', title: '', domain: 'anaplan.com' };
  assert.deepEqual([walk(needsPerson, SUBMIT).state?.phase, walk(needsPerson, SUBMIT).sends], ['person', []]);
  assert.deepEqual(badgeWords(walk(needsPerson).state!, findCompany), { status: 'Who at Anaplan?', hint: null, placeholder: '' });
  // Ready to send: the bar asks, the note says what Mark builds.
  const ready = badgeWords(walk(JANE).state!, findCompany);
  assert.equal(ready.status, 'Build a page for Jane Doe?');
  assert.match(ready.hint ?? '', /^Mark builds the company's page first/);
  assert.equal(badgeWords(walk({ ...JANE, name: '' }).state!, findCompany).status, 'Build a page for Acme Corp?');
});
await check('on a touch screen only the line being fixed is lit, not the one fixed before (tapped lines keep :hover)', () => {
  assert.match(source('src/components/SearchHome.tsx'), /<div className="sh-col sh-badge-card">\s*<h2 style=\{slot\(0, 0\)\}>From the badge<\/h2>/);
  const touch = source('src/styles/badge-scan.css').match(/@media \(hover: none\) \{([^}]*\})\s*\}/)?.[1] ?? '';
  assert.match(touch, /\.sh-badge-card \.sh-row:hover:not\(\.is-active\) \{ background: none; \}/);
});
await check("the panel's heading changes only once a request is sent (a badge's failed send leaves it as it was)", () => {
  const hook = source('src/hooks/usePageRequest.tsx');
  assert.deepEqual(hook.match(/setKind\([^)]*\)/g), ['setKind(nextKind)', 'setKind(sentKind)', 'setKind(sentKind)']);
  assert.equal(hook.match(/setKind\(sentKind\);\s*setPhase\('sent'\);/g)?.length, 2);
});

/* ---------- 8. Readiness without asking, and the cap on reads ---------- */

await check('production never asks whether the reader is on: the page render says so on #root', () => {
  assert.equal(servedBadgeReady(true, 'on', false), true);
  assert.equal(servedBadgeReady(true, undefined, false), false);
  assert.equal(servedBadgeReady(false, undefined, false), false, 'a production page the server did not draw');
  assert.equal(servedBadgeReady(false, undefined, true), null, 'the dev server asks');
  assert.equal(badgeRootAttr({}), '', 'unset: production HTML as today');
  assert.equal(badgeRootAttr({ OPAL_PAT: 'pat', MARK_BADGE_AGENT_ID: 'reader' }), ' data-badge="on"');
  assert.equal(badgeRootAttr({ BADGE_READ_STUB: '1', VERCEL_ENV: 'production' }), '');
  assert.match(source('server/ssr-handler.tsx'), /<div id="root" data-scene="\$\{scene\.id\}"\$\{offerAttr\}\$\{badgeRootAttr\(\)\}>/);
  assert.match(source('src/home-main.tsx'), /badgeReady=\{servedBadgeReady\(!!served, root\.dataset\.badge, import\.meta\.env\.DEV\)\}/);
  assert.match(source('src/components/SearchHome.tsx'), /useBadgeReady\(!!identity, badgeReady\)/);
});
await check('ten reads per rep in ten minutes, counted under a hash of the email; no store, no cap', async () => {
  const counts = new Map<string, number>();
  const writes: Array<{ op: string; key: string; value?: unknown; opts?: unknown }> = [];
  const store = {
    set: async (key: string, value: unknown, opts: unknown) => {
      writes.push({ op: 'set', key, value, opts });
      if (!counts.has(key)) counts.set(key, Number(value));
      return 'OK';
    },
    incr: async (key: string) => {
      writes.push({ op: 'incr', key });
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key);
    },
    expire: async (key: string, seconds: number) => {
      writes.push({ op: 'expire', key, value: seconds });
      return 1;
    },
  } as unknown as CountStore;
  for (let i = 1; i <= READS_PER_WINDOW; i++) assert.equal(await overReadLimit(store, i % 2 ? 'Rep@Optimizely.com' : 'rep@optimizely.com'), false, `read ${i}`);
  assert.equal(await overReadLimit(store, 'rep@optimizely.com'), true, 'one too many');
  assert.equal(await overReadLimit(store, 'other@optimizely.com'), false, 'another rep');
  assert.equal(await overReadLimit(null, 'rep@optimizely.com'), false, 'no store');
  for (const w of writes) {
    assert.doesNotMatch(w.key, /@|optimizely|rep/i, 'the key holds no email');
    if (w.op === 'set') assert.deepEqual([w.value, w.opts], [0, { nx: true, ex: WINDOW_SECONDS }], 'a count, for ten minutes');
    if (w.op === 'expire') assert.equal(w.value, WINDOW_SECONDS);
  }
  // The route counts a read before anything reaches Mark.
  const route = source('api/badge-read.ts');
  assert.ok(route.indexOf('overReadLimit(') > 0 && route.indexOf('overReadLimit(') < route.indexOf('uploadBadgePhoto(jpeg)'), 'counted before the upload');
  assert.ok(route.indexOf('overReadLimit(') < route.indexOf('startAgent('), 'counted before the run');
});

console.log(failures ? `\n${failures} of ${passes + failures} badge checks failed.` : `badge checks: ${passes} passed.`);
process.exit(failures ? 1 : 0);
