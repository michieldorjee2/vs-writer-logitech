/** @type {import('tailwindcss').Config} */
module.exports = {
    /*
     * v4 DROPPED `corePlugins` -- it is read by nothing and silently ignored.
     * Left in place because it still records the intent, and because deleting
     * it would make the container story above unreadable: the `.container`
     * utility is now emitted by v4 core AND by tailwind-bootstrap-grid, and
     * they agree only because `theme.container` was removed below.
     */
    corePlugins: {
        container: false
    },
    content: [
        './src/**/*.{js,ts,jsx,tsx}',
        './index.html'
    ],
    theme: {
        extend: {
            /*
             * v4 EXPOSES ITS DEFAULT THEME AS CSS VARIABLES, and this app's
             * hand-written stylesheets already own several of those names. On
             * v3 the two namespaces could not touch: a utility compiled to a
             * literal (`letter-spacing: 0.025em`) and `var(--tracking-wide)`
             * was purely the app's. On v4 a utility compiles to
             * `var(--tracking-wide)` and the value comes from the `theme`
             * cascade layer, which outranks the `legacy` layer the stylesheets
             * are imported into — so Tailwind's default silently replaced the
             * app's in every hand-written rule. Measured collisions:
             *
             *   --font-serif      v4 ui-serif,Georgia,..  app 'Iowan Old Style'..  42 refs
             *   --tracking-tight  v4 -0.025em             app -0.02em              13 refs
             *   --tracking-wide   v4 0.025em              app 0.05em               21 refs
             *   --tracking-wider  v4 0.05em               app 0.1em                 8 refs
             *   --ease-out        v4 cubic-bezier(0,0,.2,1) app cubic-bezier(.16,1,.3,1) 10 refs
             *
             * `--font-serif` alone re-typefaces the whole Maison Aurelle retail
             * template. Declaring each namespace HERE is what fixes it: a
             * legacy-config theme value is INLINED into the utility instead of
             * being emitted as a theme variable, so `.tracking-widest` still
             * compiles to `letter-spacing: 0.1em` exactly as it did on v3 AND
             * the name is no longer in the theme layer, which hands
             * `var(--tracking-wide)` back to the app's own `:root`. Clearing
             * the names with `--tracking-wide: initial` in CSS would have
             * fixed the second half and broken the first.
             *
             * The values are tailwindcss@3.4.19's own defaults, read off
             * `resolveConfig(defaultConfig)`, so no utility changes.
             * `--ease-in-out` is deliberately absent: the app declares it but
             * never reads it (0 refs), and `ease-in-out` IS used as a utility.
             */
            letterSpacing: {
                tighter: '-0.05em',
                tight: '-0.025em',
                normal: '0em',
                wide: '0.025em',
                wider: '0.05em',
                widest: '0.1em'
            },
            transitionTimingFunction: {
                DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
                linear: 'linear',
                in: 'cubic-bezier(0.4, 0, 1, 1)',
                out: 'cubic-bezier(0, 0, 0.2, 1)',
                'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            fontFamily: {
                serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                sans: '"Figtree", Arial, sans-serif',
                mono: 'NBI Pro Mono, Arial, sans-serif',
                // Greenfield (2026 brand) — competitive-takeout family + search
                display: '"VC Nudge", "Die Grotesk B", Arial, sans-serif',
                grotesk: '"Die Grotesk B", system-ui, sans-serif',
                'roboto-mono': '"Roboto Mono", ui-monospace, monospace',
            },
            animation: {
                background: 'background 7s ease infinite'
            },
            keyframes: {
                'pulse-scale': {
                    '0%, 100%': { transform: 'scale(1.2)', opacity: 0.75 },
                    '50%': { transform: 'scale(1)', opacity: 1 }
                },
                background: {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' }
                }
            },
            fontSize: {
                '5xl': '4.8rem'
            },
            fontWeight: {
                regular: 320,
                medium: 500,
                semibold: 600,
                bold: 700
            },
            borderRadius: {
                DEFAULT: '24px',
                md: '12px'
            },
            textShadow: {
                DEFAULT: '0px 0px 10px currentColor'
            },
            transitionDuration: {
                800: '800ms'
            },
            boxShadow: {
                'card-hover':
                    '0px 10px 10px 0px rgba(72, 79, 97, 0.30) inset, 0px 8px 10px 0px rgba(0, 0, 0, 0.20), 0px -1px 10px 0px rgba(72, 79, 97, 0.30) inset',
                'card-pressed':
                    '4px 10px 10px 0px rgba(16, 20, 29, 0.50) inset, 0px -1px 10px 0px rgba(16, 20, 29, 0.30) inset'
            },
            backgroundImage: {
                'gradient-card-border': 'radial-gradient(at center 0%, #CED2DCB2, #484F61B2)',
                'gradient-hero-background': 'linear-gradient(180deg, #10141d 55.03%, #191e28 100%), radial-gradient(17.88% 49.57% at 32.13% 100%, #10141d 34.26%, #303542 99.94%), radial-gradient(21.21% 58.79% at 50.01% 100%, #303542 0.25%, #10141d 97.49%), radial-gradient(10.56% 29.27% at 50.01% 100%, #404656 0.25%, #10141d 97.49%)',
            }
        },
        /*
         * `theme.container` is GONE, deliberately. It was dead configuration on
         * v3 -- `corePlugins.container: false` above switched the core
         * container off, so the only `.container` in the served CSS came from
         * tailwind-bootstrap-grid and it carried no media queries at all, just
         * `max-width: var(--container-max-width)` against the `:root` variable
         * the plugin sets per breakpoint.
         *
         * v4 has no `corePlugins` key, so it ignores that switch and emits its
         * own `.container` -- and it DOES read `theme.container`. Keeping the
         * block gave `.container` a second, later rule with
         * `@media (width >= 576px) { max-width: none }`, which is the last
         * matching declaration and so wiped the max-width at every viewport
         * from 576px to 1240px. Measured in the compiled CSS.
         *
         * Without it, v4's core container derives its max-widths from
         * `theme.screens` -- the same 576/768/992/1200/1400/1600 the plugin
         * feeds `--container-max-width` -- so `.container` computes the same
         * max-width at every breakpoint it did on v3. No route in the visual
         * capture renders a `.container` (see scripts/visual-baseline.mjs's
         * header), so this one is verified in the CSS, not in pixels.
         */
        colors: {
            'optimizely-blue': {
                DEFAULT: '#abff44',
                '20-tint': '#e4f0da',
                '40-tint': '#d8e4cb',
                '60-tint': '#c8ff8f',
                '80-tint': '#7ddd3d',
                '80-shade': '#3ab533',
                '60-shade': '#2f8f2a',
                '40-shade': '#197050',
                '20-shade': '#0d3a29'
            },
            'dark-blue': {
                DEFAULT: '#08251a',
            },
            'light-blue': {
                DEFAULT: '#91dbda',
            },
            orange: {
                DEFAULT: '#ff8110',
            },
            green: {
                DEFAULT: '#3be081',
            },
            yellow: {
                DEFAULT: '#ffce00',
            },
            purple: {
                DEFAULT: '#861dff',
                '80-shade': '#6b17cc',
            },
            'gray': {
                '100': '#f8f8fc',
                '200': '#e9ebf1',
                '300': '#ced2dc',
                '400': '#969cac',
                '500': '#656c81',
                '600': '#484f61',
                '900': '#111827'
            },
            // Greenfield (2026 brand) palette — used by .cmp-takeout + search
            fir: {
                dark: '#08251a',
                DEFAULT: '#0d3a29',
                2: '#114a35',
                light: '#197050'
            },
            lime: {
                DEFAULT: '#abff44',
                grass: '#7ddd3d',
                go: '#3ab533'
            },
            teal: {
                lt: '#91dbda',
                dk: '#007b79'
            },
            cream: '#eff6e9',
            'fir-n3': '#e4f0da',
            'fir-n4': '#d8e4cb',
            'fir-n5': '#c3ceaf',
            'fir-n6': '#a1ac8d',
            'fir-n7': '#717863',
            black: '#000',
            dust: '#F1ECE6',
            white: '#fff',
            vulcan: '#10141d',
            'vulcan-85': '#2c313f',
            'bright-gray': '#e9ebf1',
            'vulcan-95': '#191e28',
            'vulcan-90': '#232834',
            ebony: '#0e1122',
            red: '#f13030',
            independence: '#484f61',
            'pale-sky': '#656c81',
            'santas-gray': '#969cac',
            mischka: '#ced2dc',
            'ghost-white': '#f8f8fc',
            'theme-color': 'var(--theme-color)',
            'theme-color-dark': 'var(--theme-color-dark)',
            transparent: 'transparent'
        },
        screens: {
            sm: '576px',
            md: '768px',
            lg: '992px',
            xl: '1200px',
            xxl: '1400px',
            '2xl': '1600px'
        }
    },
    plugins: [
        /*
         * Kept on v4 through `@config`, because `container`, `row`, `col-12`,
         * `lg:col-8`, `lg:col-10`, `lg:offset-1` and `lg:offset-2` are all in
         * live use (BlockPreview, DynamicComparisonPage[.server], HeroGradient,
         * VsWriterPage) and there is no v4 equivalent that emits the same
         * `--bs-gutter-x` box model. Replacing those call sites by hand is a
         * bigger and riskier change than loading a v3-era plugin that v4 still
         * runs. Its options are passed in camelCase and v7 of the plugin reads
         * snake_case, so BOTH are silently ignored and the gutter is the
         * plugin's own 1.5rem default — a pre-existing defect, NOT introduced
         * here. Renaming them to `grid_gutter_width` would change the rendered
         * layout, so it is deliberately left alone for a separate change.
         */
        require('tailwind-bootstrap-grid')({
            containerMaxWidths: {
                sm: '576px',
                md: '768px',
                lg: '992px',
                xl: '1200px',
                xxl: '1400px'
            },
            gridGutterWidth: '2.4rem'
        }),
        /*
         * Was `require('tailwindcss-base-font-size')({ baseFontSize: 10 })`.
         * That plugin reaches into `tailwindcss/defaultConfig` and
         * `tailwindcss/resolveConfig`, neither of which v4 exports, so it
         * throws at config load. The local file is a byte-faithful snapshot of
         * what it produced on v3 — see its header.
         */
        require('./tailwind.base-font-size.cjs'),
        /*
         * `@tailwindcss/typography` moved to `@plugin` in src/index.css.
         * `@tailwindcss/container-queries` is gone: v4 ships container queries
         * in core, and nothing in the app uses a `@container` utility anyway
         * (zero `@`-prefixed class tokens in the 1,210 the app emits).
         */
        function ({ matchUtilities, theme }) {
            matchUtilities(
                {
                    'text-shadow': (value) => ({
                        textShadow: value
                    })
                },
                { values: theme('textShadow') }
            );
        },
        function ({ addVariant }) {
            addVariant('hocus', ['&:hover', '&:focus']);
        },
        /*
         * D4 fix. The vendored Radix `_ui` primitives (`tooltip`, `dialog`, `alert-dialog`,
         * `dropdown-menu`, `context-menu`, `menubar`, `navigation-menu`, `hover-card`,
         * `popover`, `toast`, `select`) are written against this plugin's `animate-in` /
         * `fade-in-0` / `zoom-in-95` / `slide-in-from-*` vocabulary, and upstream's own
         * package.json never installs it either (verified against the unpacked zip) — these
         * classes compile to nothing in optimizely.com's real build too. None of these
         * components is currently imported by any Showcase renderer (`grep -rhoE
         * "@/components/_ui/[a-z-]+" src/cms` names only `avatar`/`button`/`card`/`icons`/
         * `taxonomy-tag`), so this has zero effect on anything that renders today; it closes
         * out the D4 audit's remaining unresolved-class bucket rather than leaving ~35 dead
         * classes silently unstyled the moment one of these components is ever wired up. Pure
         * addition — a v3-shaped `addUtilities`/`matchUtilities` plugin, exactly like the
         * three above it that v4 already runs fine through `@config`.
         */
        require('tailwindcss-animate')
    ]
};
