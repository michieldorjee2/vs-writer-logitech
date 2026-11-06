/*
 * Suggestions while a line on the badge is fixed (BadgeLanyard): the people or
 * companies in the search page's index whose name matches what is typed. Pure,
 * so server/badge-read-check.ts tests the order.
 */

/** A page the index has: a person's or a company's. */
export type Suggestion = { kind: 'person' | 'company'; route: string; name: string; meta: string; logo: string | null; title?: string };

/** Lower case, accents gone, one space between words: "Lars Østergaard" and "lars ostergaard" match. */
export function folded(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The best `limit` of `items` for `typed`: the whole name starting with it first,
 * then a word of it starting with it, then it anywhere in the name; shorter names
 * first within each. Under two letters typed, nothing.
 */
export function bestMatches<T extends { name: string; route?: string }>(items: T[], typed: string, limit = 3): T[] {
  const q = folded(typed);
  if (q.length < 2) return [];
  const ranked: Array<{ item: T; rank: number; length: number }> = [];
  for (const item of items) {
    const name = folded(item.name);
    const rank = name.startsWith(q) ? 0 : ` ${name}`.includes(` ${q}`) ? 1 : name.includes(q) ? 2 : -1;
    if (rank >= 0) ranked.push({ item, rank, length: name.length });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.length - b.length);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const { item } of ranked) {
    // One row a page: two people of one name at two companies are two rows.
    const key = `${folded(item.name)}|${item.route ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length === limit) break;
  }
  return out;
}
