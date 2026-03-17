import { useEffect } from 'react';
import type { CompetitorComparisonPage } from '../lib/graph-types';

const SITE_URL = 'https://showcase.optimizely.com';

/**
 * Manages <head> meta tags, canonical URL, and JSON-LD structured data
 * for a CompetitorComparisonPage. Cleans up on unmount.
 */
export function useHeadMeta(page: CompetitorComparisonPage | null) {
    useEffect(() => {
        if (!page) return;

        const ids: string[] = [];

        function injectTag(tag: HTMLElement, id: string) {
            tag.id = id;
            ids.push(id);
            document.head.appendChild(tag);
        }

        // --- Title & meta description ---
        document.title = page.PageTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', page.MetaDescription);

        // --- Canonical URL ---
        document.querySelector('link[rel="canonical"]')?.remove();
        const canonical = document.createElement('link');
        canonical.rel = 'canonical';
        canonical.href = page.CanonicalUrl?.default
            || `${SITE_URL}${page._metadata.url.hierarchical}`;
        injectTag(canonical, '__meta_canonical');

        // --- JSON-LD: WebPage ---
        const webPageLd: Record<string, unknown> = {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: page.PageTitle,
            description: page.MetaDescription,
            url: canonical.href,
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

        const webPageScript = document.createElement('script');
        webPageScript.type = 'application/ld+json';
        webPageScript.textContent = JSON.stringify(webPageLd);
        injectTag(webPageScript, '__ld_webpage');

        // --- JSON-LD: FAQPage (FaqSection is now a list) ---
        if (Array.isArray(page.FaqSection)) {
            for (const entry of page.FaqSection) {
                const faqJson = (entry as any)?._json;
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
                    const faqScript = document.createElement('script');
                    faqScript.type = 'application/ld+json';
                    faqScript.textContent = JSON.stringify(faqLd);
                    injectTag(faqScript, '__ld_faq');
                    break;
                }
            }
        }

        // --- JSON-LD: Review/testimonials (flat fields) ---
        const reviews: Array<Record<string, unknown>> = [];
        if (page.testimonial1 && page.testimonial1JobTitle) {
            reviews.push({
                '@type': 'Review',
                reviewBody: page.testimonial1,
                author: {
                    '@type': 'Person',
                    name: page.testimonial1JobTitle,
                    ...(page.testimonial1Company ? { jobTitle: page.testimonial1Company } : {}),
                },
            });
        }
        if (page.testimonial2 && page.testimonial2JobTitle) {
            reviews.push({
                '@type': 'Review',
                reviewBody: page.testimonial2,
                author: {
                    '@type': 'Person',
                    name: page.testimonial2JobTitle,
                    ...(page.testimonial2Company ? { jobTitle: page.testimonial2Company } : {}),
                },
            });
        }
        if (reviews.length > 0) {
            const reviewLd = {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: 'Optimizely',
                review: reviews,
            };
            const reviewScript = document.createElement('script');
            reviewScript.type = 'application/ld+json';
            reviewScript.textContent = JSON.stringify(reviewLd);
            injectTag(reviewScript, '__ld_reviews');
        }

        // --- Cleanup on unmount or page change ---
        return () => {
            ids.forEach((id) => document.getElementById(id)?.remove());
        };
    }, [page]);
}
