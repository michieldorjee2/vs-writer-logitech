const SITE_URL = 'https://showcase.optimizely.com';

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build HTML string for <head> meta tags, canonical, and JSON-LD.
 * Pure function — no DOM dependency, safe for Node.js SSR.
 */
export function buildHeadHtml(page: {
    PageTitle: string;
    MetaDescription: string;
    CanonicalUrl: { default: string } | null;
    _metadata: { url: { hierarchical: string }; published: string };
    ComparisonTable?: { OurLabel: string } | null;
    Testimonials?: Array<{ item: { Quote: string; AuthorName: string; AuthorTitle: string | null } | null }> | null;
    FaqSection?: { item: { _json?: unknown } | null } | null;
}): string {
    const parts: string[] = [];

    // Title
    parts.push(`<title>${escapeHtml(page.PageTitle)}</title>`);

    // Meta description
    parts.push(`<meta name="description" content="${escapeHtml(page.MetaDescription)}" />`);

    // Canonical
    const canonicalHref = page.CanonicalUrl?.default || `${SITE_URL}${page._metadata.url.hierarchical}`;
    parts.push(`<link rel="canonical" href="${escapeHtml(canonicalHref)}" />`);

    // JSON-LD: WebPage
    const webPageLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: page.PageTitle,
        description: page.MetaDescription,
        url: canonicalHref,
        publisher: {
            '@type': 'Organization',
            name: 'Optimizely',
            url: 'https://www.optimizely.com',
            logo: {
                '@type': 'ImageObject',
                url: 'https://www.optimizely.com/globalassets/02.-global/01.-icons-and-logos/01.-logos/optimizely_logo_full-color_dark-bg.svg',
            },
        },
        datePublished: page._metadata.published,
    };

    if (page._metadata.url.hierarchical) {
        const slug = page._metadata.url.hierarchical.replace(/^\/|\/$/g, '');
        webPageLd.breadcrumb = {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: page.PageTitle, item: `${SITE_URL}/${slug}` },
            ],
        };
    }

    parts.push(`<script type="application/ld+json">${JSON.stringify(webPageLd)}</script>`);

    // JSON-LD: FAQPage
    const faqJson = page.FaqSection?.item?._json as any;
    if (faqJson?.Items?.length) {
        const faqLd = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqJson.Items.map((item: any) => ({
                '@type': 'Question',
                name: item.Heading ?? '',
                acceptedAnswer: { '@type': 'Answer', text: item.MainContent?.html ?? '' },
            })),
        };
        parts.push(`<script type="application/ld+json">${JSON.stringify(faqLd)}</script>`);
    }

    // JSON-LD: Reviews
    const resolved = page.Testimonials?.filter((t) => t.item?.Quote && t.item?.AuthorName) ?? [];
    if (resolved.length > 0) {
        const reviewLd = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: page.ComparisonTable?.OurLabel ?? 'Optimizely',
            review: resolved.map((t) => ({
                '@type': 'Review',
                reviewBody: t.item!.Quote,
                author: {
                    '@type': 'Person',
                    name: t.item!.AuthorName,
                    ...(t.item!.AuthorTitle ? { jobTitle: t.item!.AuthorTitle } : {}),
                },
            })),
        };
        parts.push(`<script type="application/ld+json">${JSON.stringify(reviewLd)}</script>`);
    }

    return parts.join('\n    ');
}
