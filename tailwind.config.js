/** @type {import('tailwindcss').Config} */
module.exports = {
    corePlugins: {
        container: false
    },
    content: [
        './src/**/*.{js,ts,jsx,tsx}',
        './index.html'
    ],
    theme: {
        extend: {
            fontFamily: {
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
        container: {
            center: true,
            screens: {
                xl: '1240px',
                xxl: '1400px',
                '2xl': '1600px'
            }
        },
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
        require('tailwindcss-base-font-size')({
            baseFontSize: 10
        }),
        require('@tailwindcss/typography'),
        require('@tailwindcss/container-queries'),
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
        }
    ]
};
