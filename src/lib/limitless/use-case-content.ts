import type { CompetitorComparisonPage } from '../graph-types';
import type { ComponentId } from './component-plan';

/**
 * Content for the components Laura's "Use Case Template v2" introduces.
 *
 * Only TWO of its seven blocks need a content shape the 67 registered fields
 * on CompetitorComparisonPage cannot already hold. The other five map onto
 * fields that exist and are in PAGE_QUERY today:
 *
 *   rail meta          <- derived from eyebrow / intelEyebrow + company name
 *   hero               <- eyebrow, headline, subheadline
 *   hero pills         <- intelStats { Value Label }
 *   where it breaks    <- painPoints { Title Description }
 *   who to talk to     <- teamMembers + stakeholders + ctaTitle/ctaDescription
 *                         + ctaButtonText + modalScheduleUrl
 *
 * The two that do not:
 *
 *   useCaseLanes       the three need -> solution cards. painPoints is the
 *                      closest existing shape and carries two strings where
 *                      this needs four; overloading it would make the lane and
 *                      the solution unaddressable.
 *   thesis*            the "Why now" argument. roiTitle/roiDescription is the
 *                      nearest empty pair, and using it would put prose about
 *                      content velocity into fields every other reader treats
 *                      as an ROI claim.
 *
 * NONE of the fields below are registered on the content type or selected by
 * PAGE_QUERY. A selection on one unregistered field fails the entire GraphQL
 * query and 404s all 2,695 pages (commit 9091988), so the order is forced:
 * register in the CMS -> `npm run check:graph` -> add to PAGE_QUERY. Until
 * then this content reaches the renderer from a live Aldus plan or a fixture,
 * and every reader treats it as optional.
 */

export interface UseCaseLane {
  /** The buyer's own framing of the goal — "Drive revenue". */
  Lane: string;
  /** The need, in the account's language, not ours. */
  Need: string;
  /** What we would use. A product name, shown as a pill. */
  Solution: string;
  /** Why it applies here. Two to three sentences. */
  Outcome: string;
}

export interface ThesisContent {
  Headline: string;
  /** Rendered as separate paragraphs in order. */
  Paragraphs: string[];
  Quote?: string;
  /** Who or what the quote is attributed to. Laura's page attributes it to
   *  "The argument this page makes" rather than inventing a speaker — keep
   *  that honesty; never fabricate a named quote. */
  Attribution?: string;
}

/** Staged fields. See the header note before adding any of these to a query. */
export interface UseCaseFields {
  useCaseLanes: UseCaseLane[] | null;
  /** Heading above the lane cards. Defaults if absent. */
  useCaseHeading: string | null;
  /** The line under the heading — "Your need on top. What we'd use underneath." */
  useCaseNote: string | null;
  /** The footer line on the card — "All three are in active evaluation." */
  useCaseFooter: string | null;
  thesisHeadline: string | null;
  /** Paragraphs joined by a blank line. Split on render. */
  thesisBody: string | null;
  thesisQuote: string | null;
  thesisAttribution: string | null;
  /** Three short lines in the rail foot. Derived when absent. */
  railMeta: string[] | null;
  /** The decision record the engine writes. Read by parseCmsPlan(). */
  componentPlan: string | null;
}

export type UseCasePage = CompetitorComparisonPage & Partial<UseCaseFields>;

// ---- Readers ---------------------------------------------------------------

export interface HeroPill {
  text: string;
}

/**
 * Hero pills come from `intelStats`, an existing registered field.
 *
 * A stat is {Value, Label} and a pill is one phrase, so the pill is
 * `Value Label` joined by a space. That reads correctly for both shapes on
 * Laura's page — a metric ("4.8M" + "monthly digital visitors") and a
 * statement ("Strategic focus:" + "Modernizing U.S. shipyards with AI") —
 * with the punctuation left to the author, where it belongs. The alternative
 * was an eighth new field to say the same thing.
 */
export function readPills(page: UseCasePage): HeroPill[] {
  return (page.intelStats ?? [])
    .map((s) => [s.Value, s.Label].filter((x) => x && x.trim()).join(' ').trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ text }));
}

export function readLanes(page: UseCasePage): UseCaseLane[] {
  return (page.useCaseLanes ?? []).filter((l) => l && l.Need && l.Solution);
}

export function readThesis(page: UseCasePage): ThesisContent | null {
  const paragraphs = (page.thesisBody ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!page.thesisHeadline && paragraphs.length === 0) return null;
  return {
    Headline: page.thesisHeadline ?? '',
    Paragraphs: paragraphs,
    Quote: page.thesisQuote ?? undefined,
    Attribution: page.thesisAttribution ?? undefined,
  };
}

/**
 * The rail foot. Derived when `railMeta` is absent so the rail is never empty
 * on a page written before the field existed: the account's own eyebrow, then
 * who the page is for, then the year it was published.
 */
export function readRailMeta(page: UseCasePage, companyName: string): string[] {
  if (page.railMeta && page.railMeta.length > 0) return page.railMeta;
  const lines: string[] = [];
  if (page.intelEyebrow) lines.push(page.intelEyebrow);
  if (companyName) lines.push(`Prepared for ${companyName}`);
  const published = page._metadata?.published;
  if (published) lines.push(new Date(published).getUTCFullYear().toString());
  return lines;
}

/**
 * Which staged components actually have content, for unmetInclusions(). Their
 * `derivedFrom` is `() => false` (no field to sniff yet), so without this the
 * defect check would report a false positive on every plan that includes them.
 */
export function stagedContentPresence(page: UseCasePage): Partial<Record<ComponentId, boolean>> {
  return {
    'use-case-matrix': readLanes(page).length > 0,
    'why-now-thesis': readThesis(page) !== null,
  };
}

// ---- Headline emphasis -----------------------------------------------------

/**
 * Split a headline on *asterisk* markers so one phrase can take the brand's
 * extrusion treatment: "Complex engineering requires *simple software.*"
 *
 * Laura's artifact wraps the phrase in a <span>, and `intelHeadline` /
 * `challengeHeadline` are already rendered through dangerouslySetInnerHTML for
 * exactly that reason. This field does not follow that convention on purpose:
 * these pages are public, agent-authored, and this repo ships no sanitizer, so
 * a second raw-HTML surface is not worth one styled phrase. Asterisks survive a
 * plain String field, an agent prompt and a CMS round trip, and cannot inject.
 *
 * Unmatched markers are left as literal text rather than swallowed, so a
 * malformed headline is visibly wrong instead of silently truncated.
 */
export function splitEmphasis(headline: string): Array<{ text: string; emphasis: boolean }> {
  const out: Array<{ text: string; emphasis: boolean }> = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headline)) !== null) {
    if (m.index > last) out.push({ text: headline.slice(last, m.index), emphasis: false });
    out.push({ text: m[1], emphasis: true });
    last = m.index + m[0].length;
  }
  if (last < headline.length) out.push({ text: headline.slice(last), emphasis: false });
  return out.length > 0 ? out : [{ text: headline, emphasis: false }];
}
