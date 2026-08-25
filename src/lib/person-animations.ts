/**
 * PersonPage motion — the company page's grammar, on the company page's engine.
 *
 * The person page used to reveal with a bespoke IntersectionObserver and a CSS
 * transition. It worked, but it read as a different product: whole sections
 * arrived as one slab, the hero sat still while the company page's parallaxed
 * away, and the one number counted on a hand-rolled easing curve while the
 * company page's counters ran on GSAP's.
 *
 * So this is abm-animations.ts's vocabulary, narrowed to what a page about one
 * person needs:
 *
 *   [data-person-anim]     — 24px rise, power3.out, 0.55s, fired at 'top 95%'
 *   [data-person-stagger]  — the same, applied to the children, 0.06s apart
 *   [data-person-count]    — GSAP's counter with snap, 2s on power2.out
 *
 * Two things are deliberately NOT shared with abm-animations.ts. The attribute
 * name is different, because `[data-animate] { opacity: 0 }` is global and
 * would blank this page if the script never ran. And cleanup kills only the
 * ScrollTriggers this module created, rather than ScrollTrigger.getAll(), so a
 * client-side route change out of a person page cannot take another surface's
 * triggers with it.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** Every trigger and tween this module owns, so cleanup is surgical. */
let triggers: ScrollTrigger[] = [];
let tweens: gsap.core.Tween[] = [];
let timelines: gsap.core.Timeline[] = [];
let spinRaf = 0;
let spinTeardown: Array<() => void> = [];

function track<T extends gsap.core.Tween>(t: T): T {
    tweens.push(t);
    if (t.scrollTrigger) triggers.push(t.scrollTrigger);
    return t;
}

/**
 * The hero's entrance, beat for beat with the company page's `revealText()`:
 * sweep up first, then badge, then the name, then the supporting lines, then
 * the scroll cue. The elements differ; the timing does not.
 */
function initHeroIntro(root: HTMLElement, delay: number): void {
    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);

    // Delayed so the copy arrives behind the galaxy's opening sweep rather
    // than competing with it. The value comes from person-galaxy so the two
    // are not guessing at each other's timing.
    const tl = gsap.timeline({ delay });
    timelines.push(tl);

    const sweep = q<HTMLElement>('.person__sweep');
    if (sweep) tl.to(sweep, { opacity: 1, duration: 1 }, 0);

    const crumb = q<HTMLElement>('.person__crumb');
    if (crumb) tl.fromTo(crumb, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.05);

    const eyebrow = q<HTMLElement>('.person__eyebrow');
    if (eyebrow) tl.fromTo(eyebrow, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.15);

    const name = q<HTMLElement>('.person__name');
    if (name) tl.fromTo(name, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power4.out' }, 0.25);

    const role = q<HTMLElement>('.person__role');
    if (role) tl.fromTo(role, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.5);

    const opening = q<HTMLElement>('.person__opening');
    if (opening) tl.fromTo(opening, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0.7);

    const badge = q<HTMLElement>('.person__tier');
    if (badge) tl.fromTo(badge, { opacity: 0, y: 16, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }, 0.95);

    const cue = q<HTMLElement>('.person__scroll');
    if (cue) tl.to(cue, { opacity: 1, duration: 0.5 }, 1.3);
}

/**
 * Hero parallax and the sweep's scrubbed exit — the same numbers the company
 * page uses, so leaving one hero feels like leaving the other.
 */
function initHeroScroll(root: HTMLElement): void {
    const hero = root.querySelector<HTMLElement>('.person__hero');
    const inner = root.querySelector<HTMLElement>('.person__hero-inner');
    if (!hero || !inner) return;

    track(
        gsap.to(inner, {
            y: -120,
            opacity: 0,
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 },
        }),
    );

    const sweep = root.querySelector<HTMLElement>('.person__sweep');
    if (sweep) {
        track(
            gsap.fromTo(
                sweep,
                { opacity: 1 },
                {
                    opacity: 0,
                    scrollTrigger: { trigger: hero, start: '30% top', end: '70% top', scrub: 1 },
                },
            ),
        );
    }

    // The cue is an invitation, not a fixture — it goes as soon as it is taken.
    const cue = root.querySelector<HTMLElement>('.person__scroll');
    if (cue) {
        track(
            gsap.to(cue, {
                opacity: 0,
                scrollTrigger: { trigger: hero, start: 'top top', end: '25% top', scrub: 1 },
            }),
        );
    }
}

/** The generic reveal, and the card cascade inside it. */
function initReveals(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-person-anim]').forEach((el) => {
        const delay = parseFloat(el.dataset.personDelay || '0');
        track(
            gsap.fromTo(
                el,
                { opacity: 0, y: 24 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.55,
                    delay: delay * 0.5,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: el, start: 'top 95%', toggleActions: 'play none play none' },
                },
            ),
        );
    });

    root.querySelectorAll<HTMLElement>('[data-person-stagger]').forEach((group) => {
        const items = Array.from(group.children) as HTMLElement[];
        if (items.length === 0) return;
        track(
            gsap.fromTo(
                items,
                { opacity: 0, y: 24 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.55,
                    stagger: 0.06,
                    ease: 'power3.out',
                    scrollTrigger: { trigger: group, start: 'top 92%', toggleActions: 'play none play none' },
                },
            ),
        );
    });
}

/**
 * The one number. The face carries the target; the twenty extrusion layers
 * behind it carry the same string, so every layer has to be written on each
 * frame or the 3D stack tears away from the value on top of it.
 */
function initCounter(root: HTMLElement): void {
    const face = root.querySelector<HTMLElement>('[data-person-count]');
    if (!face) return;

    const target = Number(face.dataset.personCount || 0);
    if (!Number.isFinite(target)) return;

    const prefix = face.dataset.personCountPrefix || '';
    const suffix = face.dataset.personCountSuffix || '';
    const layers = Array.from(root.querySelectorAll<HTMLElement>('[data-person-count-layer]'));
    const write = (n: number) => {
        const text = prefix + Math.round(n).toLocaleString('en-US') + suffix;
        face.textContent = text;
        for (const l of layers) l.textContent = text;
    };

    write(0);

    const proxy = { v: 0 };
    let hasRun = false;
    const run = () => {
        if (hasRun) return;
        hasRun = true;
        tweens.push(
            gsap.to(proxy, {
                v: target,
                duration: 2,
                ease: 'power2.out',
                onUpdate: () => write(proxy.v),
                onComplete: () => write(target),
            }),
        );
    };

    triggers.push(
        ScrollTrigger.create({ trigger: face, start: 'top 95%', onEnter: run, onEnterBack: run }),
    );
}

/**
 * The warp button's conic ring. abm-warp-cta.ts drives `--warp-spin` from
 * inside its canvas loop; here there is no canvas and no modal, so this is
 * just the spin — the same 36°/s idle and 200°/s hover it uses.
 */
function initWarpSpin(root: HTMLElement): void {
    const buttons = Array.from(root.querySelectorAll<HTMLElement>('.warp-btn'));
    if (buttons.length === 0) return;

    let hovering = false;
    for (const b of buttons) {
        const on = () => { hovering = true; };
        const off = () => { hovering = false; };
        b.addEventListener('pointerenter', on);
        b.addEventListener('pointerleave', off);
        b.addEventListener('focus', on);
        b.addEventListener('blur', off);
        spinTeardown.push(() => {
            b.removeEventListener('pointerenter', on);
            b.removeEventListener('pointerleave', off);
            b.removeEventListener('focus', on);
            b.removeEventListener('blur', off);
        });
    }

    let angle = 0;
    let rate = 36;
    let last = performance.now();
    const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const targetRate = hovering ? 200 : 36;
        rate += (targetRate - rate) * Math.min(1, dt * 3.5);
        angle = (angle + rate * dt) % 360;
        const value = angle.toFixed(2) + 'deg';
        for (const b of buttons) b.style.setProperty('--warp-spin', value);
        spinRaf = requestAnimationFrame(frame);
    };
    spinRaf = requestAnimationFrame(frame);
}

export function initPersonAnimations(root: HTMLElement, heroDelay = 0): void {
    initHeroIntro(root, heroDelay);
    initHeroScroll(root);
    initReveals(root);
    initCounter(root);
    initWarpSpin(root);
    // Section heights settle after the fonts and the hero canvas do; without
    // this the triggers are measured against a shorter page and fire early.
    ScrollTrigger.refresh();
}

/**
 * Reduced motion: no reveals, no parallax, no counter — but the page still has
 * to show its number and its sweep, both of which the animated path would have
 * supplied.
 */
export function settlePersonStatic(root: HTMLElement): void {
    const face = root.querySelector<HTMLElement>('[data-person-count]');
    if (face) {
        const target = Number(face.dataset.personCount || 0);
        const text =
            (face.dataset.personCountPrefix || '') +
            (Number.isFinite(target) ? target.toLocaleString('en-US') : face.textContent) +
            (face.dataset.personCountSuffix || '');
        face.textContent = text;
        root.querySelectorAll<HTMLElement>('[data-person-count-layer]').forEach((l) => {
            l.textContent = text;
        });
    }
    const sweep = root.querySelector<HTMLElement>('.person__sweep');
    if (sweep) sweep.style.opacity = '1';
    // The cue starts hidden because the intro timeline brings it up; with no
    // timeline it has to be revealed here or the hero loses its only "there is
    // more below" affordance.
    const cue = root.querySelector<HTMLElement>('.person__scroll');
    if (cue) cue.style.opacity = '1';
}

export function cleanupPersonAnimations(): void {
    for (const t of triggers) t.kill();
    for (const t of tweens) t.kill();
    for (const t of timelines) t.kill();
    triggers = [];
    tweens = [];
    timelines = [];

    if (spinRaf) {
        cancelAnimationFrame(spinRaf);
        spinRaf = 0;
    }
    for (const off of spinTeardown) off();
    spinTeardown = [];
}
