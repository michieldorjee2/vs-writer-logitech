/**
 * PersonPage — client entry for the 1:1 buyer page.
 *
 * Markup lives in PersonPageView so the SSR entry renders the identical tree.
 * This wrapper adds the things that only make sense in a browser:
 *
 *   - the company page's fixed starfield, and the WebGL galaxy over it;
 *   - the company page's motion, from person-animations.ts;
 *   - the sticky bar, on the company page's own component.
 *
 * All of it is enhancement. The hidden state sits behind `.person--anim`,
 * added only once this effect runs, so a visitor without JS gets the complete
 * page rather than the blank one the company page would give them.
 *
 * three.js is imported dynamically. It is by some distance the heaviest thing
 * this page loads and nothing above the fold needs it to be readable, so the
 * hero paints first and the galaxy arrives into it.
 */

import { useEffect, useRef } from 'react';
import type { PersonPage as PersonPageType } from '../lib/graph-types';
import PersonPageView, { PRODUCT_LABEL } from './PersonPageView';
import { initStarfield, cleanupStarfield } from '../lib/starfield';
import {
    initPersonAnimations,
    settlePersonStatic,
    cleanupPersonAnimations,
} from '../lib/person-animations';
import { initStickyCTA, cleanupStickyCTA } from '../lib/abm-sticky-cta';

interface Props {
    page: PersonPageType;
}

export default function PersonPage({ page }: Props) {
    const rootRef = useRef<HTMLElement>(null);
    /* How long the copy waits for the galaxy's opening. Set once the galaxy
       chunk resolves; 0 if it never does. */
    const heroDelay = useRef(0);
    const started_ref = useRef<(() => void) | null>(null);
    const startAnimations = () => started_ref.current?.();
    const solutionKey = (page.solutions ?? []).map((s) => s.Product ?? '').join('|');

    // ---- the sky, and the galaxy in it ----
    useEffect(() => {
        // The company page's own starfield, fixed behind the whole page — not a
        // hero backdrop. Both surfaces are then set in the same sky.
        initStarfield({ accent: page.brandAccentColor });

        const products = (page.solutions ?? []).slice(0, 5).map((s, i) => ({
            label: PRODUCT_LABEL[s.Product ?? ''] ?? (s.Product ?? 'Optimizely'),
            rank: i,
        }));
        // With no solutions written yet the orbit would be empty, so fall back
        // to the three every conversation starts from.
        const orbit = products.length
            ? products
            : [
                  { label: 'Content Management', rank: 0 },
                  { label: 'Experimentation', rank: 1 },
                  { label: 'Opal', rank: 2 },
              ];

        let dispose: (() => void) | null = null;
        let cancelled = false;

        import('../lib/person-galaxy')
            .then(({ initPersonGalaxy, cleanupPersonGalaxy, HERO_INTRO_SECONDS }) => {
                if (cancelled) return;
                initPersonGalaxy('person-galaxy', orbit, {
                    accent: page.brandAccentColor,
                    screenshotUrl: page.siteScreenshotUrl,
                    domain: page.siteScreenshotDomain || page.companySlug,
                });
                dispose = cleanupPersonGalaxy;
                heroDelay.current = HERO_INTRO_SECONDS;
                startAnimations();

                /* TEMPORARY — waypoint editor, opened with ?galaxy=edit.
                   Delete this block and src/lib/person-galaxy-controls.ts to
                   remove it; nothing else depends on either. */
                if (new URLSearchParams(window.location.search).get('galaxy') === 'edit') {
                    import('../lib/person-galaxy-controls').then((ctl) => {
                        if (cancelled) return;
                        ctl.initGalaxyControls();
                        const prev = dispose;
                        dispose = () => { ctl.cleanupGalaxyControls(); prev?.(); };
                    });
                }
            })
            .catch(() => {
                // No galaxy to wait for — bring the copy in immediately rather
                // than holding an empty hero for a sweep that will never play.
                heroDelay.current = 0;
                startAnimations();
            });

        return () => {
            cancelled = true;
            dispose?.();
            cleanupStarfield();
        };
        // Depend on a stable key, not the array identity — page.solutions is a
        // fresh reference every render, which would re-init the scene each time.
    }, [
        solutionKey,
        page.companySlug,
        page.brandAccentColor,
        page.siteScreenshotUrl,
        page.siteScreenshotDomain,
    ]);

    /* ---- motion + the sticky bar ----
       The hidden state goes on immediately so there is no flash of content,
       but the timeline itself waits for the galaxy's opening sweep. Whichever
       of the two paths above resolves first calls startAnimations, and a
       backstop timer runs it regardless — a hero that stays blank because a
       chunk failed to load would be far worse than an un-choreographed one. */
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            settlePersonStatic(root);
            return;
        }

        root.classList.add('person--anim');
        let started = false;
        started_ref.current = () => {
            if (started || !rootRef.current) return;
            started = true;
            initPersonAnimations(rootRef.current, heroDelay.current);
        };
        const backstop = window.setTimeout(() => started_ref.current?.(), 3000);

        return () => {
            window.clearTimeout(backstop);
            cleanupPersonAnimations();
            root.classList.remove('person--anim');
        };
    }, []);

    // The sticky bar reads section offsets, so it re-initialises whenever the
    // sections it keys off change.
    useEffect(() => {
        initStickyCTA(page.companyName ?? undefined, {
            barId: 'person-sticky-cta',
            textId: 'person-sticky-cta-text',
            heroId: 'person-hero',
            ctaId: 'next',
            phases: [
                { id: 'person-problem', text: 'What the job is scored on' },
                { id: 'person-operation', text: `What ${page.companyName || 'your team'} is running today` },
                { id: 'person-practice', text: 'What changes for your team' },
                { id: 'person-how', text: 'How it works' },
                { id: 'person-proof', text: 'Proof from the same seat' },
            ],
        });
        return () => cleanupStickyCTA();
    }, [page.companyName]);

    return <PersonPageView page={page} rootRef={rootRef} />;
}
