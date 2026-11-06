/**
 * A badge read, and the page request it turns into.
 *
 * The search page's camera: the rep snaps a conference badge or a business card,
 * the browser reads it (badge-ocr.ts) or, failing that, Mark's badge reader
 * (JSON { name, title, company, email, website }), and the panel shows who and
 * which company. Nothing is built until the rep sends it; each line can be fixed first.
 *
 * Pure, so the search page (useBadgeCard, badge-flow.ts, badge-scan.ts) and the
 * read route (api/badge-read.ts) share it, and server/badge-read-check.ts tests
 * it (scripts/check-badge-read.mjs, `npm run check:badge`).
 *
 * The email is read only to work out the company's domain. It is never sent on:
 * a person page has no email field, and requestFromCard leaves it out.
 */

export type BadgeCard = { name: string; title: string; company: string; email: string; domain: string };

/** What GET /api/badge-read?ticket= answers while Mark reads and once it is done. */
export type BadgeReadStatus = { status: 'reading' } | { status: 'done'; card: BadgeCard } | { status: 'failed' };

/** A company the search index has a page for, by name or website. */
export type FindCompany = (text: string) => { route: string; name: string } | null;
/** The company a person page hangs off: one with a page, or the website of one without. */
export type CompanyRef = { route: string; name: string } | { website: string; name?: string };

/*
 * Mail that says nothing about where someone works, by the provider's name in any country:
 * gmail.com, yahoo.co.uk, hotmail.fr, t-online.de, gmx.net. An exact list let yahoo.co.uk
 * through as "the company's website", and Mark would have built a page from it.
 */
const FREE_MAIL =
  /^(gmail|googlemail|yahoo|ymail|rocketmail|hotmail|outlook|live|msn|aol|aim|icloud|me|mac|gmx|web|mail|email|inbox|proton|protonmail|pm|tutanota|tuta|fastmail|zohomail|yandex|rambler|qq|163|126|yeah|sina|naver|hanmail|daum|libero|virgilio|seznam|wp|onet|interia|rediffmail|t-online|freenet|posteo|hushmail|btinternet|bigpond|ntlworld|talktalk|sbcglobal|bellsouth|rogers|shaw|wanadoo|tiscali|alice|optusnet|telenet|skynet|ziggo|xs4all|bluewin|laposte)(\.[a-z]{2,}){1,2}$/;
/* Internet providers: orange.fr and comcast.net are personal mail, orange.com and comcast.com their own staff's. */
const ISP_MAIL = /^(orange|free|sfr|comcast|verizon|att|cox|charter|telus|o2)\.(?!com$)[a-z]{2,}(\.[a-z]{2,})?$/;

/** Whether a mail host says nothing about where someone works (free mail, an internet provider's). */
export const isFreeMail = (host: string) => FREE_MAIL.test(host) || ISP_MAIL.test(host);

/* The same caps /api/page-builds puts on a person's name and title and a company's name. */
const MAX = { name: 120, title: 160, company: 120, email: 254, website: 200 };

/** The photo the read route takes: a data URL of at most this many decoded bytes. */
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTO_DATA_URL = Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 64;

/** The lines the read route answers with; the page shows them as they are. */
export const BADGE_ERRORS = {
  notSetUp: "Badge scanning isn't set up yet.",
  tooLarge: 'That photo is too large.',
  notAPhoto: "Couldn't read that badge.",
  tooMany: 'Too many badges just now.',
} as const;

/** "acme.com" from "https://www.acme.com/about", or '' when it isn't a website. */
export function hostOf(value: string): string {
  const host = value.toLowerCase().replace(/\s+/g, '').replace(/^https?:\/\//, '').split(/[/?#]/)[0];
  const domain = host.startsWith('www.') ? host.slice(4) : host;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain) ? domain : '';
}

/* What a reader writes for a line that isn't there, despite being asked for "". */
const BLANK = /^(n\/?a|none|null|unknown|not (printed|legible|visible|shown)|-+|—|\?+)$/i;

function line(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  const text = value.replace(/\s+/g, ' ').trim();
  return BLANK.test(text) ? '' : text.slice(0, max).trim();
}

/** "JANE DOE" reads "Jane Doe". A name printed in mixed case is kept as printed (McDonald, de Vries). */
function nameCase(name: string): string {
  if (!/\p{Lu}/u.test(name) || name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'’-])(\p{Ll})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * The reader's answer as a card, or null when it read neither a name nor a
 * company (not a badge, or nothing legible). Takes the agent's text (JSON,
 * fenced or with words around it), an object already parsed, or a card.
 */
export function cardFromAgent(raw: unknown): BadgeCard | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    // The JSON is the outermost {…}: fences and any words around it fall outside.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      value = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;

  const name = nameCase(line(v.name, MAX.name));
  const title = line(v.title, MAX.title);
  const company = line(v.company, MAX.company);
  const typedEmail = line(v.email, MAX.email).toLowerCase();
  const email = EMAIL.test(typedEmail) ? typedEmail : '';
  const mailHost = email ? hostOf(email.slice(email.lastIndexOf('@') + 1)) : '';
  // The printed website says where they work; failing that, a work email's domain does.
  // (A card this file already made carries `domain`: it reads back the same.)
  const site = hostOf(line(v.website, MAX.website)) || hostOf(line(v.domain, MAX.website));
  const domain = site || (mailHost && !isFreeMail(mailHost) ? mailHost : '');
  if (!name && !company) return null;
  return { name, title, company, email, domain };
}

/** "uk.ibm.com" → ["uk.ibm.com", "ibm.com"]: the domain, then each parent while two labels are left. */
function domainAndParents(domain: string): string[] {
  const labels = domain.split('.');
  return labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'));
}

/**
 * The company the page hangs off: one with a page, else the domain of one
 * without, else null. One with a page is found by the domain read, a parent of
 * it (uk.ibm.com is IBM's), or the company's name (wolterskluwer.nl is Wolters
 * Kluwer's), so a country or team domain never builds a second page.
 */
export function companyOf(card: BadgeCard, findCompany: FindCompany): CompanyRef | null {
  if (!card.domain) return card.company ? findCompany(card.company) : null;
  for (const domain of domainAndParents(card.domain)) {
    const hit = findCompany(domain);
    if (hit) return hit;
  }
  return (card.company ? findCompany(card.company) : null) ?? { website: card.domain, ...(card.company ? { name: card.company } : {}) };
}

/**
 * The exact /api/page-builds body for a card the rep has checked, or which
 * line still needs them: a person page when there is a name (under a company
 * with a page, or the website of one without), the company's page when the
 * badge gave no name, never a page with nothing to hang it off.
 */
export function requestFromCard(
  card: BadgeCard,
  findCompany: FindCompany,
): { body: Record<string, unknown>; companyIsNew: boolean } | { needs: 'company' | 'person' } {
  const company = companyOf(card, findCompany);
  const name = card.name.trim();
  const title = card.title.trim();
  if (name) {
    if (!company) return { needs: 'company' };
    return {
      body: { kind: 'person', personName: name, ...(title ? { personTitle: title } : {}), company },
      companyIsNew: !('route' in company),
    };
  }
  if (company && !('route' in company)) {
    return { body: { kind: 'account', website: company.website, ...(company.name ? { name: company.name } : {}) }, companyIsNew: true };
  }
  return { needs: 'person' };
}
