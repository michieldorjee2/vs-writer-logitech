#!/usr/bin/env node
/**
 * visual-baseline.mjs — a reusable visual + CSS regression capture for this app.
 *
 * Written for the Tailwind v3 -> v4 upgrade. A major Tailwind bump changes the
 * CSS and leaves the markup alone, so the only honest gate is: render the live
 * templates twice, once on each Tailwind, and compare the pixels and the CSS.
 *
 *   node scripts/visual-baseline.mjs --out /path/to/before
 *   ...upgrade Tailwind...
 *   node scripts/visual-baseline.mjs --out /path/to/after
 *
 * Point `--out` OUTSIDE the repo. Screenshots are not committed.
 *
 * What lands in <out>:
 *   <route>.<viewport>.png   full-page screenshot per route per viewport
 *   generated.css            every stylesheet the dev server actually served,
 *                            concatenated in a stable order
 *   applied-css.css          the same CSS as the BROWSER parsed it (normalised
 *                            cssText). Keep both: the v4 entry file is written
 *                            differently from the v3 one, so the served source
 *                            is not comparable across the bump, but the parsed
 *                            rules are.
 *   classes.json             every distinct class token in src/**\/*.{tsx,ts}
 *                            and index.html, with the files each appears in
 *   manifest.json            route -> screenshot mapping, byte sizes, DOM hash
 *   env.json                 Tailwind/PostCSS/plugin inventory and evidence
 *
 * ---------------------------------------------------------------------------
 * Three things about this app that the capture has to work around. All three
 * were measured against the live Showcase CMS, not assumed.
 *
 * 1. THE DEV SERVER CANNOT SERVE PAGE CONTENT.
 *    `vite.config.ts`'s graphDevProxy has its own copy of PAGE_QUERY, and that
 *    copy has drifted from the live Graph schema. Six fields no longer exist
 *    (CanonicalUrl, ComparisonRowProperty.OurHighlight,
 *    ComparisonRowProperty.CompetitorHighlight, FeatureSection, FaqSection,
 *    ABMTimelinePhaseProperty.Weeks), Graph answers HTTP 400 with no data, and
 *    the proxy turns that into 404 for every slug. The dev proxy also only ever
 *    queries CompetitorComparisonPage, so PersonPage / RetailCustomerPage /
 *    FinServPage could not resolve there even with a correct query.
 *
 *    `api/content.ts` — the real Vercel function — is correct: all four of its
 *    queries return their page against live Graph today. So this script runs
 *    THAT handler in a sidecar process and points the browser's /api/content
 *    calls at it. The page therefore renders from real CMS content through the
 *    real production dispatch. Nothing is stubbed or hand-fed.
 *
 *    This is deliberately a capture-time workaround, not a fix: vite.config.ts
 *    is outside this script's remit. Fix the dev proxy's PAGE_QUERY and the
 *    sidecar becomes redundant — set --no-sidecar and it will use the dev
 *    server's own proxy instead.
 *
 * 2. VITE BINDS IPv6 ONLY. `vite --port 5199` listens on [::1]:5199 and
 *    nothing on 127.0.0.1, so every URL here uses `localhost` (which resolves
 *    to ::1). Hard-coding 127.0.0.1 gets connection-refused.
 *
 * 3. THESE PAGES ANIMATE ON SCROLL. ABMHyperPage drives GSAP ScrollTrigger and
 *    PersonPage hides its copy behind `.person--anim` until its timeline runs.
 *    Screenshotting on load captures a half-revealed page, and killing
 *    animations up front captures a permanently hidden one. So: scroll the
 *    whole page to fire every reveal, return to top, force any GSAP timeline to
 *    its end, and only then neutralise looping animations and transitions.
 *
 *    The 3D canvases (ABM hero, person galaxy, search orb) stay
 *    frame-nondeterministic; they are listed per route in the manifest as
 *    `nondeterministic` so a diff reviewer knows which deltas to discount.
 *    They are NOT masked — masking a region is how a real regression hides.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS GATE CAN AND CANNOT PROVE, from two capture runs of the same commit:
 *
 *   generated.css, applied-css.css, classes.json  byte-identical. A single
 *       changed byte after the upgrade is a real CSS change.
 *   domFingerprintSha256   stable on all 12 route/viewport pairs. If it still
 *       matches after the upgrade, the markup did not move and every pixel
 *       delta is attributable to CSS.
 *   screenshots            NOT byte-stable everywhere. Per-route noise floors
 *       are recorded as `noiseFloorPct`: 0% for finserv and use-case-preview,
 *       under 1% for abm/person/retail, and up to 30% for /search, whose copy
 *       is seeded from Date.now(). Read screenshots against those numbers.
 *
 * One gap worth knowing about: tailwind-bootstrap-grid's utilities are not
 * exercised by any route here. Its only consumers are DynamicComparisonPage,
 * VsWriterPage, BlockPreview and HeroGradient, and all 2,700 live
 * CompetitorComparisonPage instances carry intelEyebrow or customerLogo, so
 * App.tsx's isABMPage() routes every one of them to ABMHyperPage instead.
 * Nothing in this capture will catch a grid regression.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ args -- */

function parseArgs(argv) {
    const opts = { port: 5199, sidecar: true, routes: null, settleMs: 1200 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out') opts.out = argv[++i];
        else if (a.startsWith('--out=')) opts.out = a.slice(6);
        else if (a === '--port') opts.port = Number(argv[++i]);
        else if (a.startsWith('--port=')) opts.port = Number(a.slice(7));
        else if (a === '--routes') opts.routes = argv[++i].split(',').map((s) => s.trim());
        else if (a.startsWith('--routes=')) opts.routes = a.slice(9).split(',').map((s) => s.trim());
        else if (a === '--settle') opts.settleMs = Number(argv[++i]);
        else if (a === '--no-sidecar') opts.sidecar = false;
        else if (a === '--help' || a === '-h') opts.help = true;
        else throw new Error(`Unknown argument: ${a}`);
    }
    return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help || !opts.out) {
    console.log(`
visual-baseline.mjs — capture the app's rendered pixels and CSS.

  --out <dir>        REQUIRED. Where to write. Put it outside the repo.
  --port <n>         Dev server port. Default 5199 (fixed on purpose: several
                     projects in this vault fight over 3000/3111).
  --routes a,b       Capture only these route names. Default: all.
  --settle <ms>      Post-scroll settle before the shot. Default 1200.
  --no-sidecar       Use the dev server's own /api/content proxy instead of
                     running api/content.ts. Only useful once vite.config.ts's
                     PAGE_QUERY is repaired — see the header comment.
`.trimEnd());
}

/* ---------------------------------------------------------------- routes -- */

/*
 * Every slug here was read off the live Showcase CMS via Optimizely Graph, not
 * invented. `ready` is the template's own root selector: if it never appears
 * the route is recorded as NOT rendered rather than screenshotted as a spinner
 * or a "we're not quite ready" miss page.
 *
 * /ofx/ carries intelEyebrow + customerLogo, so App.tsx's isABMPage() sends it
 * to ABMHyperPage — the 2,700-page template. It is also the parent of the
 * person page below, which means api/content.ts's fetchParentShot() finds a
 * real screenshot for the person hero instead of silently skipping it.
 */
const ROUTES = [
    {
        name: 'abm-account-page',
        url: '/ofx/',
        ready: '.abm-page',
        template: 'CompetitorComparisonPage -> ABMHyperPage',
        note: 'ABM account template; 2,700 live CompetitorComparisonPage instances.',
        nondeterministic: ['ABM hero 3D canvas (three.js)'],
        noiseFloorPct: 0.7,
    },
    {
        name: 'person-page',
        url: '/ofx/olatz-beitia/',
        ready: '.person',
        template: 'PersonPage -> PersonPageView',
        note: 'Nested 1:1 buyer page; 15 live instances.',
        nondeterministic: ['canvas#person-galaxy (three.js)', 'starfield canvas'],
        noiseFloorPct: 0.3,
    },
    {
        name: 'retail-customer-page',
        url: '/olivia-brennan/',
        ready: '.retail-page',
        template: 'RetailCustomerPage',
        note: 'Maison Aurelle retail template; 10 live instances.',
        nondeterministic: [
            'src/components/retail/OpalStamp.tsx mints a random DOM id per render ' +
                "('opal-stamp-' + Math.random()) and uses it as the prefix for eight " +
                'derived SVG ids, referenced from fill="url(#...)", stroke and href. ' +
                "Left alone that is 110 differing lines in this route's markup on " +
                'every run; NORMALISED_TOKENS in domFingerprint() rewrites the token.',
        ],
        noiseFloorPct: 0.4,
    },
    {
        name: 'finserv-page',
        url: '/meridian-bank/',
        ready: '.finserv-page',
        template: 'FinServPage',
        note: 'Meridian Bank financial-services template; 4 live instances.',
        nondeterministic: [],
        noiseFloorPct: 0,
    },
    {
        name: 'search',
        url: '/search',
        ready: '.search-page',
        template: 'SearchPage',
        note: 'Booth search. Content comes from /api/search-index, which the dev proxy does serve.',
        nondeterministic: [
            '.search-page__orb (animated gradient)',
            'SearchPage.tsx seeds state from Date.now() and re-ticks it every 500ms, ' +
                'so time-derived copy differs between runs. Measured: two captures of ' +
                'the same commit differed by 13% (desktop) and 30% (mobile) in PNG ' +
                'bytes, against 0% for finserv and use-case-preview. Compare this ' +
                'route by eye, not by byte count.',
        ],
        noiseFloorPct: 30,
    },
    {
        name: 'use-case-preview',
        url: '/use-case-preview',
        ready: '.uc-page',
        template: 'UseCasePreview -> UseCasePage',
        note: 'Local Siemens fixture; needs no CMS content.',
        nondeterministic: [],
        noiseFloorPct: 0,
    },
];

const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
];

if (opts.help || !opts.out) {
    console.log('Routes:');
    for (const r of ROUTES) console.log(`  ${r.name.padEnd(22)} ${r.url.padEnd(24)} ${r.template}`);
    if (!opts.out) console.error('\nRefusing to run without --out.');
    process.exit(opts.out ? 0 : 1);
}

/* ------------------------------------------------------------------- env -- */

/** Parse KEY=VALUE out of .env.local. Values are used in memory only. */
function readDotEnv(file) {
    const out = {};
    let raw;
    try {
        raw = readFileSync(file, 'utf8');
    } catch {
        return out;
    }
    for (const line of raw.split('\n')) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
}

const dotenv = readDotEnv(path.join(REPO, '.env.local'));
const GRAPH_AUTH_KEY = process.env.GRAPH_AUTH_KEY || dotenv.GRAPH_AUTH_KEY || '';

/* ------------------------------------------------------- child processes -- */

const children = [];
let tempDir = null;

function track(child, label) {
    children.push({ child, label });
    return child;
}

/** Kill everything we started. Safe to call twice. */
function shutdown() {
    for (const { child, label } of children) {
        if (child.exitCode !== null || child.signalCode !== null) continue;
        try {
            // Negative pid kills the whole process group, so vite's own child
            // (esbuild, the optimizer) goes with it rather than orphaning.
            process.kill(-child.pid, 'SIGTERM');
        } catch {
            try {
                child.kill('SIGTERM');
            } catch {
                /* already gone */
            }
        }
        void label;
    }
    if (tempDir) {
        try {
            rmSync(tempDir, { recursive: true, force: true });
        } catch {
            /* best effort */
        }
        tempDir = null;
    }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => {
        shutdown();
        process.exit(130);
    });
}
process.on('exit', shutdown);

/** Poll a URL until it answers, or throw. */
async function waitForHttp(url, { timeoutMs = 90_000, label = url } = {}) {
    const deadline = Date.now() + timeoutMs;
    let lastErr = 'no attempt made';
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
            if (res.status < 500) return;
            lastErr = `HTTP ${res.status}`;
        } catch (e) {
            lastErr = e?.message ?? String(e);
        }
        await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error(`${label} did not come up within ${timeoutMs}ms (last: ${lastErr})`);
}

/* ----------------------------------------------------------- api sidecar -- */

/*
 * Runs api/content.ts — the real production handler — behind a plain HTTP
 * server, so the browser gets exactly the JSON prod returns. The loader is
 * written to a temp dir rather than into the repo: it is capture scaffolding,
 * not source.
 */
const SIDECAR_SOURCE = `
import http from 'node:http';
import handler from ${JSON.stringify(path.join(REPO, 'api/content.ts'))};

const port = Number(process.env.SIDECAR_PORT);

http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('ok');
    }

    // Minimal VercelRequest/VercelResponse shim — api/content.ts touches
    // req.query and res.status()/.json()/.setHeader() and nothing else.
    const vreq = {
        query: Object.fromEntries(url.searchParams.entries()),
        method: req.method,
        headers: req.headers,
        cookies: {},
        body: undefined,
    };
    let code = 200;
    const vres = {
        setHeader(k, v) { try { res.setHeader(k, v); } catch {} return this; },
        status(c) { code = c; return this; },
        json(obj) {
            res.writeHead(code, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(obj));
            return this;
        },
        send(b) { res.writeHead(code); res.end(typeof b === 'string' ? b : JSON.stringify(b)); return this; },
        end() { res.end(); return this; },
    };

    try {
        await handler(vreq, vres);
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sidecar handler threw', detail: String(err) }));
    }
}).listen(port, '127.0.0.1', () => console.error('[sidecar] listening on ' + port));
`;

async function startSidecar(port) {
    if (!GRAPH_AUTH_KEY) {
        throw new Error(
            'GRAPH_AUTH_KEY is not set and not present in .env.local — api/content.ts cannot reach Graph.',
        );
    }
    tempDir = mkdtempSync(path.join(tmpdir(), 'visual-baseline-'));
    const loader = path.join(tempDir, 'api-sidecar.mts');
    writeFileSync(loader, SIDECAR_SOURCE, 'utf8');

    const child = track(
        spawn('npx', ['tsx', loader], {
            cwd: REPO,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            // The key is handed over in the environment. It is never written to
            // a file and never echoed.
            env: { ...process.env, GRAPH_AUTH_KEY, SIDECAR_PORT: String(port) },
        }),
        'api-sidecar',
    );

    const log = [];
    child.stdout.on('data', (d) => log.push(d.toString()));
    child.stderr.on('data', (d) => log.push(d.toString()));
    child.on('exit', (code) => {
        if (code) console.error(`[sidecar] exited ${code}\n${log.join('')}`);
    });

    await waitForHttp(`http://127.0.0.1:${port}/__ping`, { label: 'api sidecar' });
    return `http://127.0.0.1:${port}`;
}

/* -------------------------------------------------------- vite dev server -- */

async function startDevServer(port) {
    const child = track(
        spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
            cwd: REPO,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        }),
        'vite',
    );

    const log = [];
    child.stdout.on('data', (d) => log.push(d.toString()));
    child.stderr.on('data', (d) => log.push(d.toString()));

    let died = null;
    child.on('exit', (code) => {
        died = code;
    });

    // --strictPort makes vite exit rather than hop to another port, so a busy
    // 5199 is a hard, legible failure instead of a silent capture of nothing.
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        if (died !== null) {
            throw new Error(
                `vite exited with ${died} before serving. Port ${port} busy?\n${log.join('')}`,
            );
        }
        try {
            const res = await fetch(`http://localhost:${port}/`, {
                signal: AbortSignal.timeout(4000),
            });
            if (res.ok) return `http://localhost:${port}`;
        } catch {
            /* keep polling */
        }
        await new Promise((r) => setTimeout(r, 400));
    }
    throw new Error(`vite did not serve on ${port} within 90s\n${log.join('')}`);
}

/* --------------------------------------------------------- class scanner -- */

/**
 * Collect every distinct class token written in src/**\/*.{tsx,ts} and
 * index.html.
 *
 * Only string literals inside class/className are read. A template hole
 * (`px-${n}`) is skipped rather than recorded as a bogus token, and the count
 * of skipped holes is reported so the gap is visible instead of silent.
 */
function scanClasses() {
    const files = [];
    (function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(tsx|ts)$/.test(entry.name)) files.push(full);
        }
    })(path.join(REPO, 'src'));
    files.push(path.join(REPO, 'index.html'));

    const byToken = new Map();
    let dynamicHoles = 0;
    const CLASS_ATTR = /\b(?:className|class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([\s\S]{0,2000}?)\})/g;

    for (const file of files) {
        let src;
        try {
            src = readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        const rel = path.relative(REPO, file);
        CLASS_ATTR.lastIndex = 0;
        let m;
        while ((m = CLASS_ATTR.exec(src))) {
            const inExpr = m[3] != null;
            const body = m[1] ?? m[2] ?? m[3] ?? '';
            const segments = inExpr
                ? [...body.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)].map(
                      (s) => s[1] ?? s[2] ?? s[3] ?? '',
                  )
                : [body];
            for (const seg of segments) {
                for (const raw of seg.split(/\s+/)) {
                    const tok = raw.trim();
                    if (!tok) continue;
                    if (tok.includes('${')) {
                        dynamicHoles++;
                        continue;
                    }
                    if (!byToken.has(tok)) byToken.set(tok, new Set());
                    byToken.get(tok).add(rel);
                }
            }
        }
    }

    const tokens = [...byToken.keys()].sort();
    return {
        generatedAt: new Date().toISOString(),
        filesScanned: files.length,
        tokenCount: tokens.length,
        dynamicHolesSkipped: dynamicHoles,
        note:
            'Class tokens read from class/className string literals only. ' +
            'Variants are kept attached (e.g. "lg:col-8") because a Tailwind ' +
            'major bump can change variant handling as easily as utilities.',
        tokens,
        byToken: Object.fromEntries(tokens.map((t) => [t, [...byToken.get(t)].sort()])),
    };
}

/* ----------------------------------------------------------- css capture -- */

/**
 * Pull the CSS the dev server actually served.
 *
 * Vite dev injects each CSS module as a <style data-vite-dev-id="<abs path>">,
 * so the DOM itself names every stylesheet in effect — including the ones
 * imported lazily from a component (search.css arrives only on /search). Each
 * named module is then re-fetched with Vite's `?direct` query, which returns
 * the transformed CSS as text with @imports inlined.
 */
async function fetchServedCss(baseUrl, devIds) {
    const parts = [];
    for (const abs of [...devIds].sort()) {
        const rel = path.relative(REPO, abs).split(path.sep).join('/');
        const url = `${baseUrl}/${rel}?direct`;
        let body = '';
        let status = 0;
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
            status = res.status;
            body = await res.text();
        } catch (e) {
            body = `/* FETCH FAILED: ${e?.message ?? e} */`;
        }
        parts.push(
            `/* ===== ${rel} (${url} -> HTTP ${status}, ${Buffer.byteLength(body)} bytes) ===== */\n${body}\n`,
        );
    }
    return parts.join('\n');
}

/* ------------------------------------------------------------ page shots -- */

/*
 * These three run in the browser. They are passed to page.evaluate() as real
 * functions, not as source strings: Playwright's string form is evaluated as an
 * expression, so a bare `() => {...}` string hands back an unserialisable
 * function object instead of calling it.
 */
function scrollAndSettle() {
    return new Promise((resolve) => {
        const step = Math.max(200, Math.floor(window.innerHeight * 0.75));
        let y = 0;
        function next() {
            const max = document.documentElement.scrollHeight;
            if (y < max) {
                window.scrollTo(0, y);
                y += step;
                requestAnimationFrame(() => setTimeout(next, 60));
            } else {
                // Run every GSAP timeline to its end so nothing is caught mid-reveal.
                try {
                    if (window.gsap) {
                        window.gsap.globalTimeline.progress(1);
                        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
                    }
                } catch {
                    /* no gsap on this route */
                }
                window.scrollTo(0, 0);
                setTimeout(resolve, 250);
            }
        }
        next();
    });
}

/*
 * Applied only AFTER the reveal pass. Looping animations and in-flight
 * transitions are what make two runs of the same commit differ; the reveals
 * they would otherwise freeze have already completed by this point.
 *
 * `vite-error-overlay` is hidden as a last line of defence. Routing /api/*
 * (see captureRoute) removes the cause, but if any other dev-server error ever
 * raises the overlay it must not silently sit on top of the baseline. Its
 * presence is recorded on the route before this rule applies, so it shows up in
 * the manifest as `viteErrorOverlay` instead of just disappearing.
 */
const FREEZE_CSS = `
*, *::before, *::after {
    animation-play-state: paused !important;
    animation-delay: 0s !important;
    transition: none !important;
    caret-color: transparent !important;
}
vite-error-overlay { display: none !important; }
`;

/** Read Vite's HMR error overlay, if the dev server raised one. */
function readViteOverlay() {
    const el = document.querySelector('vite-error-overlay');
    if (!el) return null;
    const root = el.shadowRoot;
    const text = root ? (root.textContent || '').trim() : (el.textContent || '').trim();
    return text.slice(0, 600);
}

function collectCssState() {
    const devIds = [];
    for (const el of document.querySelectorAll('style[data-vite-dev-id]')) {
        devIds.push(el.getAttribute('data-vite-dev-id'));
    }
    const applied = [];
    const skipped = [];
    for (const sheet of document.styleSheets) {
        let rules = null;
        try {
            rules = sheet.cssRules;
        } catch {
            rules = null; // cross-origin (Google Fonts) — unreadable by design
        }
        if (!rules) {
            skipped.push(sheet.href || '(inline, unreadable)');
            continue;
        }
        const owner =
            sheet.ownerNode && sheet.ownerNode.getAttribute
                ? sheet.ownerNode.getAttribute('data-vite-dev-id')
                : null;
        const text = Array.from(rules, (r) => r.cssText).join('\n');
        applied.push({ id: owner || sheet.href || '(inline)', ruleCount: rules.length, text });
    }
    return { devIds, applied, skipped };
}

/*
 * A DOM fingerprint. The whole premise of this gate is that a Tailwind major
 * changes CSS and not markup; recording the fingerprint on both runs turns that
 * premise into something checkable, and makes any pixel delta attributable to
 * CSS rather than to a content edit that landed mid-upgrade.
 *
 * Inline `style` attributes are excluded: GSAP and three.js write transforms
 * and opacities into them, which differ run to run on the same commit.
 */
function domFingerprint() {
    /*
     * Tokens the app deliberately randomises per render. Left in, they change
     * the fingerprint on every run and the "did the markup change?" check
     * becomes useless for that route.
     *
     * These are value-level substitutions applied to every attribute, because a
     * random id does not stay in its `id`: OpalStamp mints one random token and
     * uses it as the prefix for eight derived SVG ids, which are then referenced
     * from fill="url(#...)", stroke="url(#...)" and href="#..." — 110 differing
     * lines from one Math.random() call. Only the literal random token is
     * rewritten; the surrounding value is untouched, so a real markup change
     * still shows.
     */
    const NORMALISED_TOKENS = [
        // src/components/retail/OpalStamp.tsx:
        //   const id = 'opal-stamp-' + Math.random().toString(36).slice(2, 8);
        { match: /opal-stamp-[a-z0-9]{1,8}/g, as: 'opal-stamp-<random>' },
    ];

    function valueOf(node, name) {
        let raw = node.getAttribute(name);
        if (raw == null) return raw;
        for (const rule of NORMALISED_TOKENS) raw = raw.replace(rule.match, rule.as);
        return raw;
    }

    const out = [];
    (function walk(node) {
        out.push('<' + node.tagName.toLowerCase());
        const names = node
            .getAttributeNames()
            .filter((n) => n !== 'style')
            .sort();
        for (const n of names) out.push(' ' + n + '="' + valueOf(node, n) + '"');
        out.push('>');
        for (const child of node.children) walk(child);
    })(document.body);
    return out.join('');
}

async function captureRoute(browser, baseUrl, route, viewport, outDir, sidecarUrl) {
    const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 400)}`));

    /*
     * A console error for a failed subresource reads only "Failed to load
     * resource: ... 404 ()" — no URL, so it cannot be diagnosed. Collect the
     * responses themselves. A missing font or logo changes how the page renders
     * and has to be visible in the manifest, not guessed at later.
     */
    const failedRequests = new Set();
    page.on('response', (res) => {
        if (res.status() >= 400) failedRequests.add(`${res.status()} ${res.url()}`);
    });
    page.on('requestfailed', (req) => {
        failedRequests.add(`${req.failure()?.errorText ?? 'failed'} ${req.url()}`);
    });

    /*
     * Every /api/* request is handled here, because letting one reach the Vite
     * dev server is not harmless.
     *
     * The dev server implements only the six endpoints in DEV_PROXY_ENDPOINTS.
     * Any other /api/... path falls through to Vite's own module transform, and
     * for a request with a dotted query value that throws:
     * /api/brand-logo?domain=ofx.com made vite:esbuild derive its loader from
     * the last dot and fail with `Invalid loader value: "com"`. Vite then raises
     * its HMR error overlay, which is a full-width panel over the top of the
     * page — it covered the entire ABM hero in the first capture run. A baseline
     * whose above-the-fold region is an error panel cannot gate anything.
     *
     * So: /api/content goes to the real handler, the dev server's own endpoints
     * pass through, and everything else gets a clean 404 — which is exactly what
     * those endpoints return in any environment without their key, and which
     * every caller already handles (abm-hero-3d falls back to the image sprite
     * when /api/brand-logo is not ok). Each unimplemented hit is recorded on the
     * route rather than swallowed.
     */
    const DEV_PROXY_ENDPOINTS = new Set([
        '/api/content',
        '/api/search-index',
        '/api/edit-status',
        '/api/preview',
        '/api/opal-feedback',
        '/api/opal-create-page',
    ]);
    const unimplementedApiHits = new Set();

    await page.route('**/api/**', async (r) => {
        const target = new URL(r.request().url());

        if (target.pathname === '/api/content' && sidecarUrl) {
            try {
                const res = await fetch(`${sidecarUrl}/api/content${target.search}`, {
                    signal: AbortSignal.timeout(60_000),
                });
                return r.fulfill({
                    status: res.status,
                    contentType: 'application/json',
                    body: await res.text(),
                });
            } catch (e) {
                return r.fulfill({
                    status: 502,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'sidecar unreachable', detail: String(e) }),
                });
            }
        }

        if (DEV_PROXY_ENDPOINTS.has(target.pathname)) return r.continue();

        unimplementedApiHits.add(target.pathname);
        return r.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({
                error: 'not implemented by the vite dev server',
                path: target.pathname,
            }),
        });
    });

    const record = {
        route: route.name,
        url: route.url,
        template: route.template,
        note: route.note,
        viewport: viewport.name,
        viewportSize: `${viewport.width}x${viewport.height}`,
        rendered: false,
        readySelector: route.ready,
        screenshot: null,
        bytes: 0,
        nondeterministic: route.nondeterministic,
        /*
         * How much this route's PNG size moves between two runs of the SAME
         * commit, measured over a repeat capture. A delta at or under this is
         * noise; a delta above it is the upgrade. finserv and use-case-preview
         * came back byte-identical, so any change there at all is real.
         */
        noiseFloorPct: route.noiseFloorPct,
    };

    try {
        const res = await page.goto(`${baseUrl}${route.url}`, {
            waitUntil: 'domcontentloaded',
            timeout: 90_000,
        });
        record.httpStatus = res?.status() ?? null;

        try {
            await page.waitForSelector(route.ready, { state: 'attached', timeout: 60_000 });
            record.rendered = true;
        } catch {
            record.rendered = false;
            // Say what DID render, so "not rendered" is diagnosable rather than bare.
            record.renderFailure = await page.evaluate(() => {
                const h1 = document.querySelector('h1');
                return {
                    title: document.title,
                    firstHeading: h1 ? h1.textContent.trim().slice(0, 160) : null,
                    bodyClasses: document.body.className,
                    bodyTextStart: document.body.innerText.trim().slice(0, 200),
                };
            });
        }

        try {
            await page.waitForLoadState('networkidle', { timeout: 30_000 });
        } catch {
            record.networkIdle = false;
        }

        await page.evaluate(scrollAndSettle);

        const overlay = await page.evaluate(readViteOverlay);
        if (overlay) record.viteErrorOverlay = overlay;

        await page.addStyleTag({ content: FREEZE_CSS });
        await page.waitForTimeout(opts.settleMs);

        record.domFingerprintSha256 = createHash('sha256')
            .update(await page.evaluate(domFingerprint))
            .digest('hex');

        const cssState = await page.evaluate(collectCssState);

        const file = `${route.name}.${viewport.name}.png`;
        const dest = path.join(outDir, file);
        await page.screenshot({ path: dest, fullPage: true });
        record.screenshot = file;
        record.bytes = statSync(dest).size;
        record.pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        if (consoleErrors.length) record.consoleErrors = consoleErrors.slice(0, 12);
        if (failedRequests.size) record.failedRequests = [...failedRequests].sort().slice(0, 30);
        if (unimplementedApiHits.size) {
            record.unimplementedApiEndpoints = [...unimplementedApiHits].sort();
        }

        return { record, cssState };
    } catch (err) {
        record.error = String(err?.message ?? err);
        if (consoleErrors.length) record.consoleErrors = consoleErrors.slice(0, 12);
        if (failedRequests.size) record.failedRequests = [...failedRequests].sort().slice(0, 30);
        return { record, cssState: null };
    } finally {
        await context.close().catch(() => {});
    }
}

/* ------------------------------------------------------------------- env -- */

function pkgVersion(name) {
    try {
        return JSON.parse(
            readFileSync(path.join(REPO, 'node_modules', name, 'package.json'), 'utf8'),
        ).version;
    } catch {
        return null;
    }
}

/**
 * The Tailwind plugin list, read out of tailwind.config.js as text.
 *
 * tailwind.config.js is CommonJS inside a "type": "module" package, so it
 * cannot simply be imported here. Reading the `require()` calls out of the
 * plugins array is both format-agnostic and honest about what is declared.
 */
function readTailwindPlugins() {
    let src = '';
    try {
        src = readFileSync(path.join(REPO, 'tailwind.config.js'), 'utf8');
    } catch {
        return { error: 'tailwind.config.js not readable', plugins: [] };
    }
    const pluginsIdx = src.lastIndexOf('plugins:');
    const tail = pluginsIdx === -1 ? '' : src.slice(pluginsIdx);
    const named = [...tail.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    const inline = [...tail.matchAll(/function\s*\(\s*\{\s*([^}]*)\}\s*\)/g)].map((m) =>
        m[1].replace(/\s+/g, ' ').trim(),
    );
    return {
        declared: named,
        inlinePlugins: inline,
        corePluginsDisabled: /corePlugins\s*:\s*\{[^}]*container\s*:\s*false/.test(src)
            ? ['container']
            : [],
    };
}

/*
 * Which source files actually use each Tailwind plugin's utilities.
 *
 * The v4 upgrade has to decide per plugin whether to keep, replace or drop it,
 * and that decision needs evidence rather than the plugin list. Each entry
 * names the utility surface the plugin owns, matched against the class tokens
 * scanned out of the source.
 *
 * `owns: null` means the plugin emits no utilities at all, so no grep can find
 * it and no visual route can be pointed at it. tailwindcss-base-font-size is
 * the case that matters: it is a global transform, and the only way to see it
 * is to compile with and without it.
 */
const PLUGIN_UTILITY_SURFACES = {
    'tailwind-bootstrap-grid': {
        owns: /^(container|container-fluid|row|no-gutters|col|col-auto|col-\d{1,2}|col-(?:sm|md|lg|xl|xxl)(?:-(?:\d{1,2}|auto))?|offset-\d{1,2}|offset-(?:sm|md|lg|xl|xxl)-\d{1,2}|row-cols-(?:\d{1,2}|auto)|row-cols-(?:sm|md|lg|xl|xxl)-(?:\d{1,2}|auto)|gutters?-[a-z0-9-]+)$/,
        layer: 'components (@tailwind components)',
        note:
            'Emits its grid into the COMPONENTS layer, which v4 no longer has as ' +
            'a directive. Also supplies `.container`, because tailwind.config.js ' +
            'sets corePlugins.container = false — and v4 has no corePlugins key.',
    },
    'tailwindcss-base-font-size': {
        owns: null,
        layer: 'base + whole-theme rewrite',
        note:
            'No utilities. Does two things: addBase({html:{fontSize:"10px"}}) and ' +
            'a rescale of EVERY rem value in the theme by 16/baseFontSize = 1.6x ' +
            '(measured: p-4 -> 1.6rem, text-base -> 1.6rem/2.4rem, w-64 -> 25.6rem). ' +
            'The two halves cancel, so rendered pixels are unchanged today. If ' +
            'either half stops working under v4 every spacing and font-size ' +
            'utility in the app shifts by 1.6x or 0.625x, app-wide, with nothing ' +
            'to grep for. It reaches into v3 internals (tailwindcss/defaultConfig, ' +
            'tailwindcss/resolveConfig) via plugin.withOptions.',
    },
    '@tailwindcss/typography': {
        owns: /^(prose|prose-(?:sm|base|lg|xl|2xl|invert|[a-z]+))$/,
        variantOwns: /^prose-[a-z0-9]+:/,
        layer: 'components',
        note:
            'Matched by class token only. Note that Tailwind v3 extracts candidates ' +
            'from ALL file text, so the English word "prose" in a TypeScript comment ' +
            'is enough to emit the whole .prose block even when no element uses it.',
    },
    '@tailwindcss/container-queries': {
        owns: /^(@container(?:\/[a-zA-Z0-9_-]+)?)$/,
        variantOwns: /^@(?:xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|\[[^\]]+\])(?:\/[a-zA-Z0-9_-]+)?:/,
        layer: 'utilities + variants',
        note: 'Tailwind v4 ships container queries in core, so the plugin is redundant there.',
    },
};

/** Map each declared plugin to the tokens and files that exercise it. */
function computePluginUsage(declaredPlugins, classes) {
    return declaredPlugins.map((name) => {
        const spec = PLUGIN_UTILITY_SURFACES[name];
        if (!spec) {
            return { plugin: name, emitsUtilities: 'unknown', usedTokens: [], usedBy: [] };
        }
        if (!spec.owns) {
            return {
                plugin: name,
                emitsUtilities: false,
                layer: spec.layer,
                note: spec.note,
                usedTokens: [],
                usedBy: ['(not greppable — global, applies to every file)'],
            };
        }
        const usedTokens = [];
        const files = new Set();
        for (const token of classes.tokens) {
            // A variant prefix does not change which plugin owns the utility.
            const base = token.replace(/^(?:[^:\s]+:)+/, '');
            const hit =
                spec.owns.test(token) ||
                spec.owns.test(base) ||
                (spec.variantOwns && spec.variantOwns.test(token));
            if (!hit) continue;
            usedTokens.push(token);
            for (const f of classes.byToken[token]) files.add(f);
        }
        return {
            plugin: name,
            emitsUtilities: true,
            layer: spec.layer,
            note: spec.note,
            usedTokens: usedTokens.sort(),
            usedBy: [...files].sort(),
        };
    });
}

async function readPostcssPlugins() {
    for (const file of ['postcss.config.js', 'postcss.config.cjs', 'postcss.config.mjs']) {
        const full = path.join(REPO, file);
        try {
            statSync(full);
        } catch {
            continue;
        }
        const text = readFileSync(full, 'utf8');
        let names = [];
        try {
            const mod = await import(`file://${full}`);
            const cfg = mod.default ?? mod;
            names = Array.isArray(cfg.plugins) ? cfg.plugins.map(String) : Object.keys(cfg.plugins ?? {});
        } catch {
            names = [...text.matchAll(/^\s*([a-z@][\w@/-]*)\s*:/gim)]
                .map((m) => m[1])
                .filter((n) => n !== 'plugins');
        }
        return { file, plugins: names, source: text.trim() };
    }
    return { file: null, plugins: [], source: null };
}

/* ------------------------------------------------------------------ main -- */

async function main() {
    const outDir = path.resolve(opts.out);
    mkdirSync(outDir, { recursive: true });
    console.log(`[baseline] out: ${outDir}`);

    const { chromium } = await import('playwright');

    const sidecarPort = opts.port + 1;
    let sidecarUrl = null;
    if (opts.sidecar) {
        console.log(`[baseline] starting api/content.ts sidecar on ${sidecarPort}`);
        sidecarUrl = await startSidecar(sidecarPort);
    } else {
        console.log('[baseline] --no-sidecar: using the dev server /api/content proxy');
    }

    console.log(`[baseline] starting vite on ${opts.port}`);
    const baseUrl = await startDevServer(opts.port);
    console.log(`[baseline] dev server: ${baseUrl}`);

    const browser = await chromium.launch();
    const records = [];
    const devIds = new Set();
    const appliedById = new Map();
    const unreadableSheets = new Set();

    const wanted = opts.routes ? ROUTES.filter((r) => opts.routes.includes(r.name)) : ROUTES;
    if (opts.routes) {
        const missing = opts.routes.filter((n) => !ROUTES.some((r) => r.name === n));
        if (missing.length) throw new Error(`Unknown route name(s): ${missing.join(', ')}`);
    }

    try {
        for (const route of wanted) {
            for (const viewport of VIEWPORTS) {
                process.stdout.write(`[baseline] ${route.name} @ ${viewport.name} ... `);
                const { record, cssState } = await captureRoute(
                    browser,
                    baseUrl,
                    route,
                    viewport,
                    outDir,
                    sidecarUrl,
                );
                records.push(record);
                if (cssState) {
                    for (const id of cssState.devIds) devIds.add(id);
                    for (const sheet of cssState.applied) {
                        // First sighting wins; a stylesheet's text does not vary
                        // by viewport, only by whether the route loaded it.
                        if (!appliedById.has(sheet.id)) appliedById.set(sheet.id, sheet);
                    }
                    for (const s of cssState.skipped) unreadableSheets.add(s);
                }
                console.log(
                    record.error
                        ? `ERROR ${record.error}`
                        : record.rendered
                          ? `ok (${record.bytes} bytes, ${record.pageHeight}px tall)`
                          : 'NOT RENDERED',
                );
            }
        }
    } finally {
        await browser.close().catch(() => {});
    }

    /* -- generated.css: what the dev server served -- */
    const servedCss = await fetchServedCss(baseUrl, devIds);
    const generatedCssPath = path.join(outDir, 'generated.css');
    writeFileSync(generatedCssPath, servedCss, 'utf8');

    /* -- applied-css.css: the same CSS as the browser parsed it -- */
    const appliedParts = [...appliedById.values()]
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map(
            (s) =>
                `/* ===== ${s.id} (${s.ruleCount} rules, browser-normalised) ===== */\n${s.text}\n`,
        );
    const appliedCssPath = path.join(outDir, 'applied-css.css');
    writeFileSync(appliedCssPath, appliedParts.join('\n'), 'utf8');

    /* -- classes.json -- */
    const classes = scanClasses();
    writeFileSync(path.join(outDir, 'classes.json'), JSON.stringify(classes, null, 2), 'utf8');

    /* -- env.json -- */
    const twPlugins = readTailwindPlugins();
    const postcss = await readPostcssPlugins();
    const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    const env = {
        generatedAt: new Date().toISOString(),
        repo: REPO,
        node: process.version,
        tailwindcss: {
            installed: pkgVersion('tailwindcss'),
            declared: pkg.devDependencies?.tailwindcss ?? pkg.dependencies?.tailwindcss ?? null,
        },
        vite: pkgVersion('vite'),
        playwright: pkgVersion('playwright'),
        postcss: {
            postcssVersion: pkgVersion('postcss'),
            autoprefixerVersion: pkgVersion('autoprefixer'),
            configFile: postcss.file,
            pluginList: postcss.plugins,
            configSource: postcss.source,
        },
        tailwindConfig: {
            file: 'tailwind.config.js',
            declaredPlugins: twPlugins.declared,
            inlinePlugins: twPlugins.inlinePlugins,
            corePluginsDisabled: twPlugins.corePluginsDisabled,
        },
        tailwindPlugins: (twPlugins.declared ?? []).map((name) => ({
            name,
            installedVersion: pkgVersion(name),
        })),
        pluginUsage: computePluginUsage(twPlugins.declared ?? [], classes),
        cssEntry: 'src/index.css',
        cssModulesServed: [...devIds].sort().map((p) => path.relative(REPO, p)),
        stylesheetsNotReadable: [...unreadableSheets],
        generatedCssBytes: Buffer.byteLength(servedCss),
        appliedCssBytes: Buffer.byteLength(appliedParts.join('\n')),
        classTokenCount: classes.tokenCount,
        /*
         * Measured on the v3 config, recorded here so the v4 migration does not
         * carry a broken option across and call it a regression afterwards.
         */
        knownConfigDefects: [
            {
                where: 'tailwind.config.js -> plugins -> tailwind-bootstrap-grid',
                defect:
                    'Options are passed in camelCase (containerMaxWidths, ' +
                    'gridGutterWidth) but v7 of the plugin reads snake_case ' +
                    '(container_max_widths, grid_gutter_width, grid_columns, ' +
                    'generate_container). Both passed options are silently ignored.',
                evidence:
                    'Compiled output has --bs-gutter-x: 1.5rem (the plugin default) ' +
                    'although the config asks for 2.4rem; the same compile with ' +
                    'grid_gutter_width: "2.4rem" yields 2.4rem. The container ' +
                    'max-widths happen to be unaffected because the values passed ' +
                    'match the plugin defaults exactly.',
                impact:
                    'Pre-existing, not caused by the upgrade. Gutters are 1.5rem ' +
                    'wide today, so "fixing" the option name during the migration ' +
                    'would itself change the layout.',
            },
        ],
    };
    writeFileSync(path.join(outDir, 'env.json'), JSON.stringify(env, null, 2), 'utf8');

    /* -- manifest.json -- */
    const manifest = {
        generatedAt: new Date().toISOString(),
        out: outDir,
        baseUrl,
        port: opts.port,
        sidecar: opts.sidecar
            ? {
                  used: true,
                  handler: 'api/content.ts',
                  why:
                      "vite.config.ts's graphDevProxy PAGE_QUERY has drifted from the live Graph " +
                      'schema (6 unknown fields -> HTTP 400 -> 404 for every slug) and only ever ' +
                      'queries CompetitorComparisonPage. The production handler is correct, so it ' +
                      'serves /api/content here. Content is real, from the live Showcase CMS.',
              }
            : { used: false },
        viewports: VIEWPORTS,
        routeCount: wanted.length,
        screenshotCount: records.filter((r) => r.screenshot).length,
        renderedCount: records.filter((r) => r.rendered).length,
        notRendered: records.filter((r) => !r.rendered).map((r) => `${r.route}@${r.viewport}`),
        artifacts: {
            'generated.css': Buffer.byteLength(servedCss),
            'applied-css.css': Buffer.byteLength(appliedParts.join('\n')),
            'classes.json': statSync(path.join(outDir, 'classes.json')).size,
            'env.json': statSync(path.join(outDir, 'env.json')).size,
        },
        routes: records,
    };
    writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    console.log(
        `[baseline] ${manifest.screenshotCount} screenshots, ` +
            `${manifest.renderedCount}/${records.length} rendered, ` +
            `generated.css ${env.generatedCssBytes} bytes, ` +
            `${classes.tokenCount} class tokens`,
    );
    if (manifest.notRendered.length) {
        console.error(`[baseline] NOT RENDERED: ${manifest.notRendered.join(', ')}`);
    }
    return manifest.notRendered.length === 0 ? 0 : 1;
}

let exitCode = 1;
try {
    exitCode = await main();
} catch (err) {
    console.error(`[baseline] failed: ${err?.stack ?? err}`);
    exitCode = 1;
} finally {
    shutdown();
    // Give the SIGTERMs a moment to land before the event loop drains.
    await Promise.race([once(process, '__never'), new Promise((r) => setTimeout(r, 300))]);
}
process.exit(exitCode);
