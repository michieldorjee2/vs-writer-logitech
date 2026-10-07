import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Vendored from optimizely.com and kept byte-identical to upstream plus the
    // recorded patches — see src/vendor/opticom/UPSTREAM.md, "Never hand-edit a
    // vendored file". scripts/sync-opticom.mjs overwrites any edit made here and
    // `--check` fails on one, so lint findings in it are not ours to fix.
    'src/vendor/**',
    // esbuild output of server/ssr-handler.tsx, regenerated on every build.
    'api/_ssr-bundle.mjs',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // A leading underscore marks a parameter that has to exist but is not
      // read — server/stubs/* keep the arity of the react-use hooks they stand
      // in for, or every caller fails to type-check.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // A dev-server convenience, not a correctness check: a file that exports a
      // hook beside a component (retail-cart's provider + useCart, the CMS
      // renderers' lane helpers) gets a full reload instead of a hot swap.
      // Nothing about production depends on it, so it warns — the severity
      // create-vite's own template uses — rather than failing the run.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
