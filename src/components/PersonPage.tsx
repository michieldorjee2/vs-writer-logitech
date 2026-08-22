/**
 * PersonPage — client entry for the 1:1 buyer page.
 *
 * Markup lives in PersonPageView so the SSR entry renders the identical tree.
 * This wrapper adds the three things that only make sense in a browser:
 *
 *   - the zoomed system canvas behind the note;
 *   - scroll reveal, in the company page's motion grammar;
 *   - the count-up on the one number, matching the company page's counters.
 *
 * All three are enhancement. The hidden state sits behind `.person--anim`,
 * added only once this effect runs, so a visitor without JS gets the complete
 * page rather than the blank one the company page would give them.
 */

import { useEffect, useRef } from 'react';
import type { PersonPage as PersonPageType } from '../lib/graph-types';
import PersonPageView from './PersonPageView';
import { initPersonSystem, cleanupPersonSystem, type SolutionNode } from '../lib/person-system';

interface Props {
    page: PersonPageType;
}

const PRODUCT_LABEL: Record<string, string> = {
    cms: 'CMS',
    opal: 'Opal',
    experimentation: 'Exp',
    cmp: 'CMP',
    commerce: 'Com',
};

/** Count from 0 to target over ~1.8s on an ease-out, close enough to the
 *  company page's counters that the two read as one product. */
function countUp(el: HTMLElement, target: number, duration = 1800): () => void {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
}

export default function PersonPage({ page }: Props) {
    const rootRef = useRef<HTMLElement>(null);

    // ---- the zoomed system canvas ----
    useEffect(() => {
        const solutions: SolutionNode[] = (page.solutions ?? []).slice(0, 4).map((s, i) => ({
            label: PRODUCT_LABEL[s.Product ?? ''] ?? (s.Product ?? 'Opti'),
            rank: i,
        }));
        // With no solutions written yet the system would be a bare star, so
        // fall back to the core three rather than an empty orbit.
        const nodes = solutions.length
            ? solutions
            : [
                  { label: 'CMS', rank: 0 },
                  { label: 'Opal', rank: 1 },
                  { label: 'Exp', rank: 2 },
              ];

        initPersonSystem('person-system', nodes, {
            companyLabel: page.companyName,
            accent: page.brandAccentColor,
        });
        return () => cleanupPersonSystem();
    }, [page.solutions, page.companyName, page.brandAccentColor]);

    // ---- reveal + counters ----
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const counters = Array.from(root.querySelectorAll<HTMLElement>('[data-person-count]'));

        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            counters.forEach((el) => {
                el.textContent = Number(el.dataset.personCount || 0).toLocaleString();
            });
            return;
        }

        root.classList.add('person--anim');
        const cancels: Array<() => void> = [];

        const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-person-anim]'));
        const revealObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    entry.target.classList.add('is-visible');
                    revealObserver.unobserve(entry.target);
                }
            },
            { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
        );
        targets.forEach((t) => revealObserver.observe(t));

        const countObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const el = entry.target as HTMLElement;
                    const target = Number(el.dataset.personCount || 0);
                    if (Number.isFinite(target)) cancels.push(countUp(el, target));
                    countObserver.unobserve(el);
                }
            },
            { threshold: 0.4 },
        );
        counters.forEach((c) => countObserver.observe(c));

        // Anything already above the fold is revealed synchronously, so there
        // is no flash of hidden content on first paint.
        requestAnimationFrame(() => {
            targets.forEach((t) => {
                if (t.getBoundingClientRect().top < window.innerHeight) {
                    t.classList.add('is-visible');
                    revealObserver.unobserve(t);
                }
            });
        });

        return () => {
            revealObserver.disconnect();
            countObserver.disconnect();
            cancels.forEach((c) => c());
            root.classList.remove('person--anim');
        };
    }, []);

    return <PersonPageView page={page} rootRef={rootRef} />;
}
