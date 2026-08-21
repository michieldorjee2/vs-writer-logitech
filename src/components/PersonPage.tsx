/**
 * PersonPage — client entry for the 1:1 buyer page.
 *
 * All markup lives in PersonPageView so the SSR entry renders the identical
 * tree. This wrapper adds one thing: scroll-reveal, as progressive
 * enhancement. The server ships every section visible, so a visitor without
 * JS (or with reduced motion) sees the complete page.
 */

import { useEffect, useRef } from 'react';
import type { PersonPage as PersonPageType } from '../lib/graph-types';
import PersonPageView from './PersonPageView';

interface Props {
    page: PersonPageType;
}

export default function PersonPage({ page }: Props) {
    const rootRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

        root.classList.add('js-reveal');
        const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-person-reveal]'));
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                }
            },
            { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
        );
        targets.forEach((t) => observer.observe(t));
        // Anything already above the fold on first paint is revealed
        // synchronously, so there is no flash of hidden content.
        requestAnimationFrame(() => {
            targets.forEach((t) => {
                if (t.getBoundingClientRect().top < window.innerHeight) {
                    t.classList.add('is-visible');
                    observer.unobserve(t);
                }
            });
        });
        return () => {
            observer.disconnect();
            root.classList.remove('js-reveal');
        };
    }, []);

    return <PersonPageView page={page} rootRef={rootRef} />;
}
