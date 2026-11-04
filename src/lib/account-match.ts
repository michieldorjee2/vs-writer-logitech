/**
 * Which Salesforce account a rep means, from what they typed on the search page:
 * a company's name ("lenovo", "Levi's") or its website ("heineken.com").
 *
 * Until 3 Nov 2026 a page could only be asked for by website, matched exactly
 * against Salesforce's Domain_Name__c by the Mark workflow. That failed for the
 * names sales actually type: Levi's is "Levi Strauss & Co." on levistrauss.com,
 * Patagonia's main account lists patagoniaprovisions.com, and Heineken has five
 * accounts. A name typed with the wrong website built an Atlassian page at
 * /lenovo. Now the search page lists the accounts that match, the rep picks one,
 * and Mark builds exactly that account (api/page-builds/match.ts).
 *
 * Pure: shared by the server (api/_lib/account-lookups.ts) and the browser
 * (the types), and tested without a network (scripts/check-account-match.ts).
 */

/** One account the rep can pick: what they see. Never the account's Salesforce id. */
export type AccountChoice = {
  /** Its place in this lookup ('a1', 'a2' …): what the browser sends back. */
  key: string;
  name: string;
  domain: string | null;
  /** Customer_Stage__c: Prospect, Active Customer, Ex-Customer … */
  stage: string | null;
  country: string | null;
  owner: string | null;
  /** The account page it already has, if any: the row opens it instead of building another. */
  page: { route: string } | null;
};

/** POST /api/page-builds/match's answer. */
export type AccountMatch = {
  /** The lookup the picks belong to, held server-side for half an hour. */
  lookup: string;
  query: string;
  accounts: AccountChoice[];
  /** More accounts matched than are listed: typing more of the name narrows them. */
  more: boolean;
};

/** An Account row as salesforce_crm_list_object returns it (the fields the lookup asks for). */
export type SalesforceAccountRow = {
  id?: string;
  Id?: string;
  Name?: string | null;
  Domain_Name__c?: string | null;
  Website?: string | null;
  Customer_Stage__c?: string | null;
  ParentId?: string | null;
  Target_Account__c?: string | null;
  BillingCountry?: string | null;
  Owner?: { Name?: string | null } | null;
  'Owner.Name'?: string | null;
};

export const MAX_QUERY_LENGTH = 80;

/**
 * The text to search account names with, or null when there is nothing to search.
 * Allow-listed: letters, digits, spaces and & . , - + ( ) /. The search's own
 * wildcards (% and _) and quotes never come from the rep; an apostrophe becomes
 * `_`, the one-character wildcard, so "Levi's" still finds "Levi's" and
 * "O'Reilly" finds "O'Reilly" without a quote reaching the query.
 */
export function searchTerm(query: string): string | null {
  const cleaned = query
    .normalize('NFC')
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}\s&.,+()/'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
  if ((cleaned.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) return null;
  return cleaned.replace(/'/g, '_');
}

/** Name patterns: the name starts with the term, or one of its words does. */
export function namePatterns(term: string): string[] {
  return [`${term}%`, `% ${term}%`];
}

/* ---------- Websites, as the Mark workflow reads Domain_Name__c ---------- */

/** "https://www.Lenovo.com/us/en/" → "lenovo.com"; null when it names no website. */
export function domainOf(text: string | null | undefined): string | null {
  const host = String(text ?? '').toLowerCase().replace(/\s+/g, '').replace(/^https?:\/\//, '').split('/')[0];
  const d = host.startsWith('www.') ? host.slice(4) : host;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(d) ? d : null;
}

const REGISTRY_LABELS = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'ltd', 'plc', 'ne', 'or', 'go', 'nhs', 'sch', 'mil']);

/** The domain, then each parent still a company's own: ashridge.hult.edu, hult.edu. Never co.uk. */
export function domainLevels(d: string): string[] {
  const labels = d.split('.');
  const out: string[] = [];
  for (let i = 0; i < labels.length - 1; i++) {
    const rest = labels.slice(i);
    if (rest.length === 2 && REGISTRY_LABELS.has(rest[0]) && rest[1].length === 2) break;
    out.push(rest.join('.'));
  }
  return out;
}

/** Every way Domain_Name__c holds a website (it is typed by hand: www., a scheme, a slash). */
export function storedForms(d: string): string[] {
  const out: string[] = [];
  for (const h of [d, `www.${d}`]) for (const p of ['', 'http://', 'https://']) for (const s of ['', '/']) out.push(p + h + s);
  return out;
}

/** The company-ish word of a website: "lenovo" for lenovo.com, "printerland" for printerland.co.uk. */
export function domainLabel(d: string): string {
  const levels = domainLevels(d);
  return (levels[levels.length - 1] ?? d).split('.')[0];
}

/* ---------- Ranking ---------- */

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * How well a name answers what was typed: 0 is the name itself, 5 is barely.
 * "levis" also answers as "levi" (the search tries it too: api/_lib/salesforce.ts).
 */
export function nameScore(name: string, query: string): number {
  const q = fold(query);
  const plain = wordScore(fold(name), q);
  return /[a-z]{3}s$/.test(q) ? Math.min(plain, wordScore(fold(name), q.slice(0, -1))) : plain;
}

function wordScore(n: string, q: string): number {
  if (!q) return 5;
  if (n === q) return 0;
  if (n.startsWith(`${q} `)) return 1;
  if (n.startsWith(q)) return 2;
  if (` ${n} `.includes(` ${q} `)) return 3;
  if (` ${n}`.includes(` ${q}`)) return 4;
  return 5;
}

const TIER_RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
/** Records that are not the company itself (the Mark workflow sets them aside the same way). */
const NOT_THE_COMPANY = new Set(['Competitor', 'Holding Company']);

export const rowId = (r: SalesforceAccountRow) => r.id || r.Id || '';
export const rowDomain = (r: SalesforceAccountRow) => domainOf(r.Domain_Name__c) ?? domainOf(r.Website);
export const rowOwner = (r: SalesforceAccountRow) => {
  const owner = (r.Owner?.Name ?? r['Owner.Name'] ?? '').trim();
  // The integration user owns records nobody has claimed: naming it helps no one.
  return owner && !/integration/i.test(owner) ? owner : null;
};

/**
 * The accounts in the order a rep should see them: the website they typed, then
 * the name that answers best, then the company itself before its subsidiaries,
 * the sales team's own tier, and the name.
 */
export function rankAccounts(rows: SalesforceAccountRow[], query: string): SalesforceAccountRow[] {
  const typedDomain = domainOf(query);
  const label = typedDomain ? domainLabel(typedDomain) : null;
  const ids = new Set(rows.map(rowId).filter(Boolean));
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const id = rowId(r);
    if (!id || seen.has(id) || !r.Name) return false;
    seen.add(id);
    return true;
  });
  const key = (r: SalesforceAccountRow) => [
    typedDomain && rowDomain(r) === typedDomain ? 0 : 1,
    // Set aside before the name, as the workflow's tie-breaks do: Adobe the competitor is not the page.
    NOT_THE_COMPANY.has(r.Customer_Stage__c ?? '') ? 1 : 0,
    nameScore(r.Name ?? '', label ?? query),
    r.ParentId && ids.has(r.ParentId) ? 1 : 0,
    TIER_RANK[(r.Target_Account__c ?? '').trim()] ?? 9,
    (r.Name ?? '').length,
  ];
  return unique
    .map((r) => ({ r, k: key(r) }))
    .sort((a, b) => {
      for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] - b.k[i];
      return (a.r.Name ?? '').localeCompare(b.r.Name ?? '');
    })
    .map(({ r }) => r);
}

/** What the rep sees of one account, under the key the lookup gives it. */
export function choiceOf(r: SalesforceAccountRow, key: string, page: { route: string } | null): AccountChoice {
  return {
    key,
    name: (r.Name ?? '').trim(),
    domain: rowDomain(r),
    stage: (r.Customer_Stage__c ?? '').trim() || null,
    country: (r.BillingCountry ?? '').trim() || null,
    owner: rowOwner(r),
    page,
  };
}

/** The row's second line: "lenovo.com · Prospect · China · Simon McDonald". */
export function choiceMeta(c: Pick<AccountChoice, 'domain' | 'stage' | 'country' | 'owner'>): string {
  return [c.domain, c.stage, c.country, c.owner].filter(Boolean).join(' · ');
}
