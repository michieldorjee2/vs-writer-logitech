import { cardFromAgent, hostOf, isFreeMail, type BadgeCard } from './badge-card';

/*
 * A badge read in the browser (src/lib/badge-read-device.ts runs Tesseract on
 * the photo): the lines of text it found, sorted here into who and where they
 * work. Pure, so server/badge-read-check.ts tests it on badges of every kind.
 *
 * What a badge looks like, and so how each line is told apart:
 *   · the name is the biggest words on it that read like a name, sometimes
 *     first and last name on two lines;
 *   · the title has the words titles have (Director, Head of, VP, Engineer…);
 *   · the company is the line the email's or website's domain spells, a line
 *     ending in Inc, Ltd, GmbH…, or else the most prominent line left;
 *   · the event's own lines (ATTENDEE, OPTICON 2026, a badge number) are none
 *     of those.
 * The rep checks the card before anything is built, and fixes a line in one tap.
 */

/** The long edge Tesseract reads at: badge print is large, and this keeps a phone's read to a second or two. */
export const OCR_READ_EDGE = 2000;
/** Smaller photos are scaled up to this: Tesseract misses print under ~20 px tall. */
export const OCR_MIN_EDGE = 1400;
/** The scale a photo is read at (badge-read-device.ts in the browser, the check in Node). */
export function readScale(width: number, height: number): number {
  const long = Math.max(width, height, 1);
  return long > OCR_READ_EDGE ? OCR_READ_EDGE / long : long < OCR_MIN_EDGE ? OCR_MIN_EDGE / long : 1;
}
/**
 * The photo's pixels (RGBA, in place) made easy for Tesseract: grey by how bright each colour looks,
 * with the contrast raised. Tesseract's own conversion lost print in a brand colour ("Optimizely" in
 * blue) and white print on a coloured band ("SPONSOR" on purple): it found neither, and the ribbon
 * was the only line left to be the company. (Stretching the range to full black and white instead
 * lost the marker-pen name on a sticker held up against a dark wall.)
 */
export function readablePixels(rgba: Uint8ClampedArray | Uint8Array): void {
  for (let p = 0; p < rgba.length; p += 4) {
    const grey = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8;
    const v = Math.max(0, Math.min(255, Math.round((grey - 128) * 1.4 + 128)));
    rgba[p] = rgba[p + 1] = rgba[p + 2] = v;
    rgba[p + 3] = 255;
  }
}

/** Tesseract's settings for a badge: a few lines scattered about, not a page of text (PSM.SPARSE_TEXT). */
export const OCR_PARAMETERS = { tessedit_pageseg_mode: '11' } as const;

/** One line Tesseract read: its words, how sure it was (0–100), and where it sits (pixels). */
export type OcrLine = { text: string; confidence: number; top: number; left: number; height: number };

/** Below this Tesseract was mostly guessing: a logo, a QR code, a lanyard's pattern. */
const MIN_CONFIDENCE = 45;

/* Words only a job title has. "Marketing" or "Digital" alone are not enough: companies are called that too. */
const TITLE_STRONG =
  /\b(chief|officer|c[a-z]o|ciso|s?e?vp|avp|vice[- ]president|president|director|head|manager|mgr|lead|leader|engineer|architect|developer|designer|founder|co-?founder|owner|partner|principal|consultant|analyst|specialist|strategist|executive|coordinator|administrator|admin|advisor|adviser|scientist|researcher|editor|producer|associate|assistant|intern|representative|evangelist|advocate|chair(man|woman|person)?|secretary|treasurer|professor|recruiter|controller|supervisor|technician|officer)\b/i;
const TITLE_WEAK =
  /\b(senior|sr|junior|jr|global|regional|marketing|sales|product|operations|growth|digital|content|brand|commerce|e-?commerce|technology|it|data|customer|success|solutions|program|project|business|development|strategy|experience|cx|ux|web|platform|engineering|finance|people|hr|talent|communications|partnerships|channel|enterprise|emea|apac|americas|north america)\b/i;
/* The end of a company's legal name. */
const COMPANY_SUFFIX =
  /\b(inc|incorporated|ltd|limited|llc|llp|lp|gmbh|ag|kg|plc|corp|corporation|co|company|bv|b\.v|nv|n\.v|sa|s\.a|sas|sarl|srl|spa|s\.p\.a|ab|as|a\/s|oy|oyj|pty|pte|kk|group|holdings?|labs?|technologies|systems|industries|international)\.?$/i;
/*
 * The event's own words: a badge's role ribbon ("SPONSOR", "Gold Sponsor", "Exhibitor Staff") and
 * its furniture ("Hello, my name is", "All access"). A line of nothing else is the event's, not the
 * person's or their company's.
 */
const ROLE_WORDS = new Set(
  (
    'attendee attendees speaker speakers sponsor sponsors sponsored exhibitor exhibitors exhibit staff press media vip guest guests ' +
    'delegate delegates visitor visitors crew organizer organiser organizers organisers volunteer volunteers partner partners ' +
    'customer customers employee contractor gold silver bronze platinum diamond titanium premier premium elite founding official ' +
    'headline strategic all access full conference pass day days expo summit general admission ga welcome hello my name is ' +
    'team member members keynote panelist panellist moderator host judge mentor student faculty hall only vendor event ' +
    'registrant participant backstage'
  ).split(' '),
);
/* Ribbon words taken off the ends of a company's line ("Optimizely Sponsor"): never a company's own last word. */
const RIBBON_WORDS = new Set('sponsor sponsors attendee attendees speaker speakers exhibitor exhibitors staff vip delegate delegates visitor visitors volunteer volunteers crew organizer organiser organizers organisers'.split(' '));
const TIER_WORDS = new Set('gold silver bronze platinum diamond titanium premier premium elite founding official headline strategic'.split(' '));
/* The words that make a line of event words a ribbon: "Summit Partners" is a company, "Media Partner" a ribbon. */
const RIBBONISH = new Set([...RIBBON_WORDS, 'partner', 'keynote', 'panelist', 'panellist', 'moderator', 'registrant', 'participant', 'exhibit', 'judge', 'mentor']);
/* The event's fixed phrases. */
const FURNITURE = /^(hello,?( my name is)?|my name( is)?|all access|general admission|(full|day|expo|conference|vip|all access|attendee) pass|welcome)$/i;
const PERSON_WORD = /^[\p{L}][\p{L}'’.-]*$/u;
const EMAIL_IN = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;
const WEBSITE_IN = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i;

/** Letters only, lower case: how a domain's name and a line are compared. */
const squash = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** A line's words as Tesseract gave them, tidied: stray marks gone, one space between words. */
export function tidy(text: string): string {
  return text
    .replace(/[|¦_~`^«»•·©®™]+/g, ' ')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s+/g, ' ')
    // Leading marks go; a trailing comma stays until the end ("Senior Director," runs on to the next line).
    .replace(/^[\s,;:.\-–—'"]+|[\s\-–—'"]+$/g, '')
    .trim();
}

/** A word as letters, lower case, with the digits Tesseract mistakes for letters read as those letters. */
function letters(word: string): string {
  return word.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l').replace(/5/g, 's').replace(/[^\p{L}]/gu, '');
}

/** Whether two words of the same length differ in one letter: how Tesseract misreads ("SPONSDR"). Not a letter
 *  more or less: "Partners" is a company's word, "Partner" a ribbon's. */
function oneOff(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length && diff < 2; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

/** Whether a word is in `set`, or one letter off a long one there (Tesseract's "SPONSDR"). */
function inSet(word: string, set: Set<string>): boolean {
  const w = letters(word);
  if (set.has(w)) return true;
  if (w.length < 6) return false;
  for (const r of set) if (r.length >= 6 && oneOff(w, r)) return true;
  return false;
}

/**
 * Whether a line is only the event's words: a ribbon ("SPONSOR", "GOLD SPONSOR", "Exhibitor Staff",
 * "SPONS0R"), one word of the event's ("PRESS", "EXPO"), or its fixed phrases ("Hello, my name is").
 * Event words that don't make a ribbon are a company's name ("Summit Partners", "Silver Lake").
 */
export function roleOnly(text: string): boolean {
  if (FURNITURE.test(text.trim())) return true;
  const words = text.split(/[\s,;:/|&+-]+/).filter((w) => letters(w));
  if (!words.length || !words.every((w) => inSet(w, ROLE_WORDS))) return false;
  return words.length === 1 || words.some((w) => inSet(w, RIBBONISH));
}

/** A company's line without the ribbon words printed on it: "Optimizely Sponsor", "Gold Sponsor: Optimizely" → "Optimizely". */
export function withoutRibbon(text: string): string {
  const words = text.split(' ');
  let stripped = false;
  const ribbon = (w: string) => RIBBON_WORDS.has(letters(w)) || (stripped && TIER_WORDS.has(letters(w)));
  while (words.length > 1 && ribbon(words[words.length - 1])) {
    words.pop();
    stripped = true;
  }
  while (words.length > 1 && ribbon(words[0])) {
    words.shift();
    stripped = true;
  }
  // Tier words now at the end, once a ribbon word went ("Optimizely Gold Sponsor" → "Optimizely Gold" → "Optimizely").
  while (stripped && words.length > 1 && TIER_WORDS.has(letters(words[words.length - 1]))) words.pop();
  return words.join(' ').replace(/[\s,;:\-–—|]+$/, '').replace(/^[\s,;:\-–—|]+/, '');
}

/** Whether a line could be someone's name: one to four words of letters, none of them a title's or a company's. */
function nameLike(text: string): boolean {
  const words = text.split(' ');
  if (words.length < 1 || words.length > 4) return false;
  if (!words.every((w) => PERSON_WORD.test(w) && (w.replace(/[.'’-]/g, '').length >= 2 || /^\p{Lu}\.?$/u.test(w)))) return false;
  return !TITLE_STRONG.test(text) && !COMPANY_SUFFIX.test(text) && !roleOnly(text);
}

function titleScore(text: string): number {
  const strong = text.match(new RegExp(TITLE_STRONG.source, 'gi'))?.length ?? 0;
  const weak = text.match(new RegExp(TITLE_WEAK.source, 'gi'))?.length ?? 0;
  return strong * 2 + (strong ? weak : 0);
}

/** A line the event printed, not the person: a role ribbon, the event's name and year, a badge number. */
function eventLine(text: string): boolean {
  if (roleOnly(text)) return true;
  if (/\b(19|20)\d\d\b/.test(text)) return true;
  if (/#|\bbooth\b|\bbadge\b|\bpass\b/i.test(text)) return true;
  const letters = text.replace(/[^\p{L}]/gu, '').length;
  return letters < 2 || letters / text.replace(/\s/g, '').length < 0.6;
}

/** Whether a line spells the domain's name ("HEINEKEN" and heineken.com, "Levi Strauss & Co." and levistrauss.com). */
function spellsDomain(text: string, domain: string): boolean {
  if (!domain) return false;
  const label = squash(domain.split('.')[0]);
  const line = squash(text);
  if (label.length < 3 || line.length < 3) return false;
  return line === label || line.startsWith(label) || label.startsWith(line) || (line.length >= 5 && label.includes(line));
}

/** "heineken.com" → "Heineken": the company when the badge only says it in an email. */
function companyFromDomain(domain: string): string {
  const label = domain.split('.')[0];
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
}

type Kept = OcrLine & { i: number };

/**
 * The card a badge's lines make, or null when they hold neither a name nor a
 * company. The same rules as a card Mark reads (cardFromAgent): an email at a
 * free mail host gives no company, a name in capitals is written as a name.
 */
export function cardFromLines(raw: OcrLine[]): BadgeCard | null {
  const lines: Kept[] = raw
    .map((l, i) => ({ ...l, text: tidy(l.text), i }))
    .filter((l) => l.text && l.confidence >= MIN_CONFIDENCE)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  // The email and the website, wherever they are; their lines are used up.
  let email = '';
  let website = '';
  const used = new Set<number>();
  for (const l of lines) {
    const found = l.text.replace(/\s/g, '').match(EMAIL_IN)?.[0];
    if (found && !email) {
      email = found.toLowerCase();
      used.add(l.i);
    } else if (!found && WEBSITE_IN.test(l.text.replace(/\s/g, '')) && /\./.test(l.text) && !website) {
      website = l.text.replace(/\s/g, '');
      used.add(l.i);
    }
  }
  const mailHost = email ? hostOf(email.slice(email.indexOf('@') + 1)) : '';
  const domain = hostOf(website) || (mailHost && !isFreeMail(mailHost) ? mailHost : '');
  const left = () => lines.filter((l) => !used.has(l.i) && !eventLine(l.text));

  // The company the domain spells comes first: it also keeps a big company name from passing for a person's.
  let company = '';
  const spelled = left().find((l) => spellsDomain(withoutRibbon(l.text), domain));
  if (spelled) {
    company = withoutRibbon(spelled.text);
    used.add(spelled.i);
  }

  // The name: the biggest words that read like a name, first and last name together. A one-word line
  // may go on in the line under it ("MICHIEL" / "DORJEE"); a word left on its own is less likely a name
  // than a logo's ("OPTIMIZELY"), so it counts for less than a name of two or three words.
  let name = '';
  let nameLine: Kept | null = null;
  const candidates = left().filter((l) => nameLike(l.text));
  const units = candidates.map((l) => {
    const words = l.text.split(' ').length;
    const below =
      words === 1
        ? candidates.find(
            (b) =>
              b !== l &&
              b.top > l.top &&
              b.top - (l.top + l.height) < l.height * 0.8 &&
              Math.abs(b.height - l.height) <= l.height * 0.3 &&
              b.text.split(' ').length <= 2,
          )
        : undefined;
    const total = words + (below ? below.text.split(' ').length : 0);
    const weight = total === 1 ? 0.6 : total <= 3 ? 1 : 0.8;
    return { l, below, text: below ? `${l.text} ${below.text}` : l.text, score: l.height * weight };
  });
  const top = units.sort((a, b) => b.score - a.score || a.l.top - b.l.top)[0];
  if (top) {
    name = top.text;
    nameLine = top.l;
    used.add(top.l.i);
    if (top.below) used.add(top.below.i);
  }

  // The title: the line most like one, and the line under it when the title runs on.
  let title = '';
  const titles = left()
    .map((l) => ({ l, score: titleScore(l.text) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.l.top - b.l.top);
  const best = titles[0]?.l;
  if (best) {
    title = best.text;
    used.add(best.i);
    const next = left().find((l) => l.top > best.top && l.top - (best.top + best.height) < best.height * 0.8 && Math.abs(l.height - best.height) <= best.height * 0.35);
    // It runs on when the line ends unfinished ("Head of", "Senior Director,") or the next starts that way
    // ("of Digital", "and Growth"), or the next is a title too; never into the company's line.
    const runsOn = (next: Kept) =>
      !COMPANY_SUFFIX.test(next.text) &&
      (titleScore(next.text) > 0 || /^(of|and|&|for)\b/i.test(next.text) || /([,&/-]|\b(of|and|for))$/i.test(title));
    if (next && runsOn(next)) {
      title = `${title} ${next.text}`.replace(/\s+,/g, ',');
      used.add(next.i);
    }
  }

  // The company, if the domain didn't spell it: a legal name's ending; else the nearest line under the
  // name (badges print who, then where; the event's own banner sits above); else the biggest line left.
  if (!company) {
    const rest = left();
    const legal = rest.find((l) => COMPANY_SUFFIX.test(withoutRibbon(l.text)));
    const under = nameLine ? rest.filter((l) => l.top > nameLine.top).sort((a, b) => a.top - b.top)[0] : undefined;
    const pick = legal ?? under ?? [...rest].sort((a, b) => b.height - a.height || a.top - b.top)[0];
    if (pick) company = withoutRibbon(pick.text);
  }
  if (!company && domain) company = companyFromDomain(domain);

  const done = (text: string) => text.replace(/[\s,;:]+$/, '');
  return cardFromAgent({ name: done(name), title: done(title), company: done(company), email, website });
}

/** Tesseract's `blocks` output (recognize(…, {}, { blocks: true })) as the lines cardFromLines reads. */
type OcrBlocks = Array<{
  paragraphs?: Array<{ lines?: Array<{ text?: string; confidence?: number; bbox?: { x0: number; y0: number; x1: number; y1: number } }> }>;
}> | null;
export function linesOfBlocks(blocks: OcrBlocks): OcrLine[] {
  const out: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const l of paragraph.lines ?? []) {
        if (!l.bbox || !l.text) continue;
        out.push({ text: l.text, confidence: l.confidence ?? 0, top: l.bbox.y0, left: l.bbox.x0, height: l.bbox.y1 - l.bbox.y0 });
      }
    }
  }
  return out;
}
