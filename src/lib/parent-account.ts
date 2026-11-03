/**
 * An offer page's parent account: the account page (CompetitorComparisonPage) of the company the
 * offer page was written for, so the offer page can show what the account page already has (its
 * logo first; Michiel, 3 Nov: "inherit the logo from its parent account").
 *
 * The CMS tree doesn't link the two: offer pages (ABMExperience) all sit under the site's start
 * page. What they share is the account:
 * 1. The Salesforce account ID, which both carry (`salesforceAccountID`). It is the real link, but
 *    1,884 of the 2,802 account pages hold a placeholder ID of zeros, so on 3 Nov it finds 27.
 * 2. The company: the offer page's `companyName` ("Ralph Lauren Corp.") and the account page's
 *    URL, which is that name as a slug ("/ralph-lauren/"), tried in order: the name as written,
 *    without its legal suffix, and with a run-together name split ("OpenTable" -> "/open-table/").
 *    Only the URL can be filtered in Graph (the eyebrow and display name can't), and an account
 *    page whose URL is the company's name is that company's page. This finds 104.
 * 3. A regional office or division of an account with a page: the account's name followed only
 *    by words like a country, a region or "Technologies", "Services", "Group" ("Microsoft
 *    Australia" -> "/microsoft/", "Cisco Systems, Inc." -> "/cisco/"). Only those words: a name
 *    that merely starts the same ("BILL" and the Bill & Melinda Gates Foundation) is not a parent.
 * The ID wins, then the exact name, then the division. Together, on 3 Nov: about 125 of the 424
 * offer pages; the rest were written for companies with no account page (Dynatrace, Xero,
 * Splunk), and keep their initials.
 */

/** Legal suffixes, as they end a company name ("Wiz, Inc.", "Cint Group AB", "Coforge Ltd"). */
const SUFFIX = /\s*[,.]?\s*\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|plc|ag|ab|asa|sa|nv|bv|gmbh|se|spa|srl|oy|oyj|pty)\b\.?\s*$/i

/** The name without its legal suffixes: "Ziff Davis, LLC." -> "Ziff Davis". */
export function withoutSuffix(name: string): string {
  let s = name.trim()
  let before: string
  do {
    before = s
    s = s.replace(SUFFIX, '').replace(/[\s,.]+$/, '')
  } while (s !== before && s)
  return s || name.trim()
}

/** A URL slug the way the account pages are named: "Alvarez & Marsal" -> "alvarez-and-marsal". */
export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

/** Words that, after an account's name, make a regional office or a division of it. */
const QUALIFIERS = new Set(
  (
    'inc incorporated corp corporation co company ltd limited llc plc ag ab asa sa nv bv gmbh se spa srl oy oyj pty ' +
    'australia uk us usa america americas north south latin emea apac europe european asia pacific canada germany ' +
    'deutschland france nl netherlands japan india nordics nordic benelux uae united kingdom states ireland spain italy ' +
    'brazil mexico singapore hq global international worldwide technologies technology tech services systems group ' +
    'holdings enterprise io digital'
  ).split(' '),
)

/** The account page URLs a company could have, best first. */
export function parentAccountUrls(companyName: string | null | undefined): string[] {
  const name = (companyName ?? '').trim()
  if (!name) return []
  const bare = withoutSuffix(name)
  const split = bare.replace(/([a-z])([A-Z])/g, '$1 $2')
  const exact = [name, bare, split].map(slugify).filter(Boolean)
  // Then the account a regional office or division belongs to, the longest name first.
  const words = slugify(name).split('-')
  const division: string[] = []
  for (let i = words.length - 1; i >= 1; i--) if (words.slice(i).every((w) => QUALIFIERS.has(w))) division.push(words.slice(0, i).join('-'))
  return [...new Set([...exact, ...division])].map((s) => `/${s}/`)
}

/** A Salesforce account ID to look the account page up by, in both its forms (18 and 15 characters); none for a placeholder. */
export function salesforceIds(id: string | null | undefined): string[] {
  const s = (id ?? '').trim()
  if (!/^[A-Za-z0-9]{15}([A-Za-z0-9]{3})?$/.test(s) || /^0+$/.test(s.slice(0, 15))) return []
  return [...new Set([s, s.slice(0, 15)])]
}

export interface ParentAccount {
  url: string
  logo: string | null
  domain: string | null
  salesforceAccountID?: string | null
}

/** Of the account pages Graph found, the one with the offer's Salesforce account, else the one at the best URL. */
export function pickParentAccount(urls: string[], found: ParentAccount[], sfIds: string[] = []): ParentAccount | null {
  const sf = new Set(sfIds.map((i) => i.slice(0, 15)))
  const byId = found.filter((a) => a.salesforceAccountID && sf.has(a.salesforceAccountID.slice(0, 15)))
  if (byId.length === 1) return byId[0]
  for (const u of urls) {
    const hit = (byId.length ? byId : found).find((a) => a.url === u)
    if (hit) return hit
  }
  return byId[0] ?? null
}

/** A logo the offer page has of its own: set, and not a placeholder image. */
export function hasOwnLogo(logo: string | null | undefined): boolean {
  return !!logo && !/^https?:\/\/(www\.)?placehold\.co\//i.test(logo)
}
