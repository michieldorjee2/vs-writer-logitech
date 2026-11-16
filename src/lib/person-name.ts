/**
 * Whether what a rep typed as a person's name is one, before Mark is asked to build
 * their page. Shared by the search bar (usePageRequest) and POST /api/page-builds,
 * which refuses the same things.
 *
 * Why: 9 of the 11 person pages asked for between 22 Oct and 16 Nov named a company or
 * a website as the person ("IKEA", "thales", "lenovo", "https://www.depaul.edu"). The
 * search bar used to carry the search text into the name field, so a rep who searched
 * "IKEA", picked "+ Add person" and typed the company got "IKEA" as the person too. Mark
 * then built every stakeholder on the company page, or nothing, but never a person.
 */

/*
 * No imports: the API functions load this too, and an extensionless import breaks them
 * (PR #57). Same test as search-entries' looksLikeWebsite.
 */
function looksLikeWebsite(value: string): boolean {
  const host = value.toLowerCase().replace(/\s+/g, '').replace(/^https?:\/\//, '').split('/')[0];
  const domain = host.startsWith('www.') ? host.slice(4) : host;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain);
}

/** Legal suffixes a company name may carry, compared away. */
const LEGAL = /\b(inc|incorporated|ltd|limited|llc|plc|corp|corporation|co|company|ab|as|asa|ag|gmbh|bv|nv|sa|sas|spa|pty|oy|oyj|group|holdings?)\b\.?/g;

/** A name for comparing: lower case, no accents, punctuation or legal suffix. */
export function foldName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(LEGAL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Why `name` is not a person's name, in a sentence the rep reads, or null when it is one.
 * `company` is the company the page is for, when known (its name, website or address).
 */
export function personNameProblem(name: string, company?: string | null): string | null {
  const value = name.trim();
  if (!value) return "Enter the person's name.";
  if (/:\/\/|^www\./i.test(value) || looksLikeWebsite(value)) {
    return "That's a website. Enter the person's full name, e.g. Jane Smith.";
  }
  const folded = foldName(value);
  if (company) {
    const others = [company, company.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[./]/)[0]].map(foldName).filter(Boolean);
    if (others.includes(folded)) return `That's the company. Enter the name of the person at ${company.trim()}.`;
  }
  // First and last name: one word is a company, a product or a nickname far more often
  // than it is a person, and Mark needs the surname to find them.
  const words = folded.split(' ').filter((w) => /[a-z]/.test(w));
  if (words.length < 2) return "Enter the person's full name, first and last, e.g. Jane Smith.";
  return null;
}

/** Whether the search text can stand as the person's name when "+ Add person" opens. */
export const looksLikePersonName = (value: string): boolean => personNameProblem(value) === null;
