import type { RichText } from './graph-types';

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

/** Parse a rich-text html value into a boolean or string for the comparison table */
export function parseComparisonValue(html: string): boolean | string {
    const text = stripHtml(html).toLowerCase();
    if (text === 'yes' || text === '✓' || text === 'true') return true;
    if (text === 'no' || text === '✗' || text === 'false' || text === '') return false;
    return stripHtml(html);
}

/** Map comparison table rows from Graph shape to component props */
export function mapComparisonRows(rows: Array<{
    Category: string;
    OurValue: RichText | null;
    OurHighlight: boolean;
    CompetitorValue: RichText | null;
    CompetitorHighlight: boolean;
}>) {
    return rows.map((row) => ({
        feature: row.Category,
        opal: parseComparisonValue(row.OurValue?.html ?? ''),
        writer: parseComparisonValue(row.CompetitorValue?.html ?? ''),
    }));
}
