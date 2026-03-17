import type { ComparisonRow } from './graph-types';

/**
 * Graph rich text comes as <p>…</p>. Promote to the given heading tag
 * and style <em> with the brand blue color.
 */
export function richTextAsTag(html: string, tag: 'h1' | 'h2' | 'p' = 'p'): string {
    return html
        .replace(/<p>/g, `<${tag}>`)
        .replace(/<\/p>/g, `</${tag}>`)
        .replace(/<em>/g, '<em class="not-italic text-optimizely-blue">');
}

/** Strip HTML tags and extract inner text (works in Node.js and browser) */
export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

/** Parse a plain-text or rich-text value into a boolean or string for the comparison table */
export function parseComparisonValue(value: string): boolean | string {
    const text = stripHtml(value).toLowerCase();
    if (text === 'yes' || text === '✓' || text === 'true') return true;
    if (text === 'no' || text === '✗' || text === 'false' || text === '') return false;
    return stripHtml(value);
}

/** Map comparison table rows from Graph shape to component props */
export function mapComparisonRows(rows: ComparisonRow[]) {
    return rows.map((row) => ({
        feature: row.Category,
        opal: parseComparisonValue(row.OurValue ?? ''),
        writer: parseComparisonValue(row.CompetitorValue ?? ''),
    }));
}
